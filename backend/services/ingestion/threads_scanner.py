"""
Threads Opportunity Scanner & Intent Classifier.

Scans Meta Threads (via Official Threads Graph API keyword_search, optional Apify
connector, public Fediverse/oEmbed URL inspection, and curated demo mode) to surface
genuine Graphic Design, Tech, and Freelance/Project opportunities while filtering
out unrelated self-promotion posts.
"""

import html
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from backend.config import settings
from backend.services.ingestion.base import BaseJobSource, NormalizedJob

logger = logging.getLogger(__name__)

THREADS_GRAPH_SEARCH_URL = "https://graph.threads.net/v1.0/keyword_search"
THREADS_OEMBED_URL = "https://graph.threads.net/oembed"

VERTICAL_LABELS: Dict[str, str] = {
    "graphic": "Threads - Graphic Design",
    "tech": "Threads - Tech",
    "project": "Threads - Project",
}

DEFAULT_SEARCH_QUERIES: Dict[str, List[str]] = {
    "graphic": [
        "hiring graphic designer",
        "looking for brand designer",
        "need UI UX designer",
        "thumbnail designer needed",
    ],
    "tech": [
        "hiring software engineer",
        "looking for developer",
        "need react python engineer",
        "tech internship hiring",
    ],
    "project": [
        "paid freelance project",
        "looking for MVP developer",
        "need freelancer website project",
        "startup cofounder builder needed",
    ],
}

VERTICAL_KEYWORDS: Dict[str, Tuple[str, ...]] = {
    "graphic": (
        "graphic design",
        "graphic designer",
        "brand designer",
        "brand identity",
        "logo design",
        "visual designer",
        "ui/ux",
        "ui ux",
        "ux designer",
        "product designer",
        "figma",
        "illustrator",
        "photoshop",
        "motion graphics",
        "motion designer",
        "video editor",
        "thumbnail designer",
        "pitch deck",
        "creative director",
        "packaging design",
        "poster design",
        "3d artist",
        "blender",
        "canva",
        "typography",
    ),
    "tech": (
        "software engineer",
        "software developer",
        "developer",
        "full-stack",
        "fullstack",
        "full stack",
        "frontend",
        "front-end",
        "backend",
        "back-end",
        "react",
        "next.js",
        "nextjs",
        "typescript",
        "python",
        "fastapi",
        "django",
        "node.js",
        "nodejs",
        "ai engineer",
        "ml engineer",
        "machine learning",
        "llm",
        "devops",
        "cloud engineer",
        "flutter",
        "react native",
        "ios developer",
        "android developer",
        "tech intern",
        "software intern",
        "engineering intern",
        "qa engineer",
        "automation engineer",
        "web developer",
    ),
    "project": (
        "freelance project",
        "freelance gig",
        "freelancer",
        "paid project",
        "paid gig",
        "mvp project",
        "project budget",
        "freelancer needed",
        "mvp build",
        "build an mvp",
        "contract project",
        "short-term project",
        "short term project",
        "landing page",
        "website redesign",
        "shopify",
        "webflow",
        "wordpress",
        "hackathon team",
        "bounty",
        "sprint",
        "client project",
        "side project",
        "collaborator",
        "technical cofounder",
        "design sprint",
        "fixed price",
        "per project",
    ),
}

OPPORTUNITY_SIGNALS: Tuple[Tuple[str, float], ...] = (
    (r"\b(we['’]?re|we are|currently|now)\s+hiring\b", 0.45),
    (r"\bhiring\b", 0.35),
    (r"\blooking\s+(?:for|to\s+hire|to\s+bring\s+on|to\s+commission)\b", 0.38),
    (r"\bseeking\s+(?:a|an|someone)\b", 0.32),
    (r"\b(?:need|needed)\s+(?:a|an|someone|help\s+with)\b", 0.30),
    (r"\bopen\s+(?:role|position|spot|gig)\b", 0.30),
    (r"\b(?:dm|message|email|send|drop)\s+(?:me|us)\s+(?:your\s+)?(?:portfolio|work|resume|cv|links|github|rates)\b", 0.35),
    (r"\b(?:apply\s+(?:here|via|below|link)|docs\.google\.com/forms|forms\.gle)\b", 0.32),
    (r"\b(?:paid\s+(?:gig|project|collab|internship|role)|budget\s*[:\-]|compensat(?:ed|ion))\b", 0.30),
    (r"\breferrals?\s+welcome\b", 0.20),
)

SELF_PROMO_SIGNALS: Tuple[str, ...] = (
    r"\bavailable\s+for\s+(?:hire|work|projects|freelance)\b",
    r"\bopen\s+(?:to|for)\s+(?:work|new\s+roles|opportunities|commissions)\b",
    r"\bcommissions?\s+are\s+open\b",
    r"\bfor\s+hire\b",
    r"\bhire\s+me\b",
    r"\blooking\s+for\s+(?:work|a\s+job|clients|my\s+next\s+role)\b",
    r"\bcheck\s+out\s+my\s+(?:latest|recent|new)\s+(?:work|design|portfolio)\b",
)

URL_REGEX = re.compile(r"https?://[^\s<>'\"\)\]]+", re.IGNORECASE)
EMAIL_REGEX = re.compile(r"[A-Za-z0-9_.+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9-.]+")
COMPENSATION_REGEX = re.compile(
    r"(?:USD\s*|\$|€|£|₹|INR\s*)\s*\d[\d,]*(?:\s*[kK])?(?:\s*[-–to]+\s*(?:\$|€|£|₹)?\s*\d[\d,]*(?:\s*[kK])?)?(?:\s*/\s*(?:hr|hour|mo|month|project|wk|week)|(?:\s*budget|\s*fixed|\s*retainer))?",
    re.IGNORECASE,
)


def is_valid_threads_url(url: str) -> bool:
    """Validates whether a URL points to threads.net or threads.com."""
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    return parsed.scheme in {"http", "https"} and (
        host == "threads.net"
        or host.endswith(".threads.net")
        or host == "threads.com"
        or host.endswith(".threads.com")
    )


def _extract_links_and_emails(text: str, permalink: str = "") -> List[str]:
    """Extracts external application URLs/emails before falling back to post permalink."""
    links: List[str] = []
    for match in URL_REGEX.findall(text or ""):
        clean = match.rstrip(".,;:!?")
        if "threads.net" in clean.lower() or "threads.com" in clean.lower():
            continue
        if clean not in links:
            links.append(clean)

    for email in EMAIL_REGEX.findall(text or ""):
        mailto = f"mailto:{email}"
        if mailto not in links:
            links.append(mailto)

    if permalink and permalink not in links:
        links.append(permalink)
    return links


def _extract_compensation(text: str) -> Optional[str]:
    """Extracts a clean compensation or budget hint if stated in the post."""
    match = COMPENSATION_REGEX.search(text or "")
    if not match:
        return None
    snippet = " ".join(match.group(0).split()).strip()
    return snippet[:60] if snippet else None


def _derive_title(text: str, primary_vertical: str) -> str:
    """Creates a concise headline from social post text without fabrication."""
    clean = " ".join((text or "").split()).strip()
    if not clean:
        return f"Threads {primary_vertical.title()} Opportunity"

    first_sentence = re.split(r"[.!?\n]", clean, maxsplit=1)[0].strip()
    candidate = first_sentence if len(first_sentence) >= 16 else clean
    candidate = URL_REGEX.sub("", candidate).strip(" -–|:")
    if len(candidate) > 95:
        candidate = candidate[:92].rstrip() + "..."
    prefix = primary_vertical.upper() if primary_vertical != "general" else "OPPORTUNITY"
    return f"[{prefix}] {candidate}" if candidate else f"[{prefix}] Threads Post"


def classify_threads_post(text: str, author: str = "") -> Dict[str, Any]:
    """
    Classifies a Threads post for hiring/project intent and target vertical
    (graphic, tech, project). Filters self-promotional posts lacking hiring cues.
    """
    raw_text = (text or "").strip()
    lower = raw_text.lower()

    matched_hiring_signals: List[str] = []
    intent_score = 0.0
    for pattern, weight in OPPORTUNITY_SIGNALS:
        found = re.search(pattern, lower)
        if found:
            matched_hiring_signals.append(found.group(0).strip())
            intent_score += weight

    self_promo_hits: List[str] = []
    for pattern in SELF_PROMO_SIGNALS:
        found = re.search(pattern, lower)
        if found:
            self_promo_hits.append(found.group(0).strip())

    # Score keyword matches across the three target verticals
    vertical_scores: Dict[str, int] = {"graphic": 0, "tech": 0, "project": 0}
    matched_vertical_terms: Dict[str, List[str]] = {"graphic": [], "tech": [], "project": []}

    for vertical, keywords in VERTICAL_KEYWORDS.items():
        for kw in keywords:
            if re.search(rf"(?<!\w){re.escape(kw)}(?!\w)", lower):
                vertical_scores[vertical] += 1
                matched_vertical_terms[vertical].append(kw)

    active_verticals = [
        v for v, score in sorted(vertical_scores.items(), key=lambda item: item[1], reverse=True)
        if score > 0
    ]
    primary_vertical = active_verticals[0] if active_verticals else "general"

    # Reject self-promo posts unless strong buyer/hiring language is explicitly present
    rejected_reason: Optional[str] = None
    has_strong_buyer_cue = bool(
        re.search(r"\b(hiring|looking\s+to\s+hire|need\s+a\b|dm\s+me\s+your\s+portfolio|apply\s+via)\b", lower)
    )
    if self_promo_hits and not has_strong_buyer_cue:
        is_opportunity = False
        rejected_reason = f"Filtered self-promotion signal: '{self_promo_hits[0]}'"
    elif intent_score >= 0.30 and active_verticals:
        is_opportunity = True
    elif intent_score >= 0.35:
        is_opportunity = True
    else:
        is_opportunity = False
        rejected_reason = "No explicit hiring, collaboration, or client project signal detected"

    confidence = round(min(0.99, intent_score + (0.10 if active_verticals else 0.0)), 2)

    return {
        "is_opportunity": is_opportunity,
        "intent_confidence": confidence,
        "matched_signals": matched_hiring_signals[:5],
        "rejected_reason": rejected_reason,
        "primary_vertical": primary_vertical,
        "verticals": active_verticals,
        "vertical_terms": matched_vertical_terms,
        "compensation_hint": _extract_compensation(raw_text),
        "is_internship": "intern" in lower or "fellow" in lower,
    }


def _build_normalized_job(
    *,
    post_id: str,
    text: str,
    username: str,
    permalink: str,
    timestamp_str: Optional[str],
    adapter_name: str,
    classification: Dict[str, Any],
) -> NormalizedJob:
    """Converts a classified Threads post into a NormalizedJob for persistence."""
    vertical = classification["primary_vertical"]
    category = VERTICAL_LABELS.get(vertical, "Threads - Opportunity")
    handle = username.lstrip("@").strip() or "threads_creator"
    company_label = f"@{handle} (Threads)"

    apply_urls = _extract_links_and_emails(text, permalink=permalink)
    posted_dt = datetime.now(timezone.utc)
    if timestamp_str:
        try:
            posted_dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        except ValueError:
            pass

    vertical_tags = [f"Vertical:{v}" for v in classification["verticals"]] or ["Vertical:general"]
    signals_str = ", ".join(classification["matched_signals"]) or "direct post"
    comp_hint = classification.get("compensation_hint")

    desc_lines = [
        text.strip(),
        "",
        f"Intent Signals: {signals_str} (confidence: {int(classification['intent_confidence'] * 100)}%)",
        f"Source Adapter: {adapter_name}",
    ]
    if comp_hint:
        desc_lines.append(f"Mentioned Budget/Rate: {comp_hint}")
    if permalink:
        desc_lines.append(f"Original Thread: {permalink}")

    return NormalizedJob(
        title=_derive_title(text, vertical),
        company=company_label,
        location="Remote / Online",
        remote_type="remote",
        category=category,
        is_internship=classification["is_internship"],
        description="\n".join(desc_lines),
        apply_urls=apply_urls,
        sources=["Threads", adapter_name, *vertical_tags],
        primary_source="Threads",
        posted_date=posted_dt,
        salary_range=comp_hint,
        fingerprint=f"threads_{post_id or uuid.uuid4().hex[:10]}",
    )


def get_demo_threads_posts(verticals: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Curated realistic sample Threads opportunity posts across Graphic, Tech, and Project
    verticals (plus sample self-promo posts used internally to validate filtering).
    Clearly labeled as Demo Stream so simulated feeds are never misrepresented as live scrapes.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    sample_stream: List[Dict[str, Any]] = [
        {
            "id": "demo_threads_graphic_01",
            "username": "lumina_brand_studio",
            "permalink": "https://www.threads.net/@lumina_brand_studio/post/C9demoGraphic01",
            "timestamp": now_iso,
            "text": (
                "We're hiring a freelance Graphic Designer & Brand Identity specialist for a SaaS rebrand. "
                "Need logo concepts, Figma social kits, and pitch deck templates. Paid gig, $1,500 - $2,500 budget. "
                "DM me your portfolio or apply via https://docs.google.com/forms/d/e/1FAIpQLSe7h9k1m3p5r7t9v1x3z5b7d9f1h3j5l7n/viewform"
            ),
        },
        {
            "id": "demo_threads_graphic_02",
            "username": "creativeloop_media",
            "permalink": "https://www.threads.net/@creativeloop_media/post/C9demoGraphic02",
            "timestamp": now_iso,
            "text": (
                "Looking for a Thumbnail Designer and Motion Graphics editor (Photoshop + After Effects) "
                "for our weekly AI YouTube channel. Remote, $35 - $50 / hr. Send your portfolio to talent@creativeloop.studio"
            ),
        },
        {
            "id": "demo_threads_tech_01",
            "username": "vectorstack_ai",
            "permalink": "https://www.threads.net/@vectorstack_ai/post/C9demoTech01",
            "timestamp": now_iso,
            "text": (
                "Hiring a Full-Stack Software Engineer (React, TypeScript, Python FastAPI) to join our remote product team. "
                "Paid contract or internship track at $40 - $65 / hr. Apply here: "
                "https://docs.google.com/forms/d/e/1FAIpQLSe3r8t6y4u2i1o0p9a8s7d6f5g4h3j2k1l0z/viewform"
            ),
        },
        {
            "id": "demo_threads_tech_02",
            "username": "buildinpublic_ops",
            "permalink": "https://www.threads.net/@buildinpublic_ops/post/C9demoTech02",
            "timestamp": now_iso,
            "text": (
                "Looking for a Python Backend Developer with Docker and SQL experience for our developer tooling startup. "
                "Remote worldwide, $45/hr. Drop your GitHub or apply via https://vectorstack.example.com/careers"
            ),
        },
        {
            "id": "demo_threads_project_01",
            "username": "indieforge_labs",
            "permalink": "https://www.threads.net/@indieforge_labs/post/C9demoProject01",
            "timestamp": now_iso,
            "text": (
                "Need a freelancer for a paid 3-week MVP project: converting our Figma designs into a live Next.js + "
                "Tailwind landing page and Stripe checkout. Fixed project budget $2,000. DM me your portfolio or apply here."
            ),
        },
        {
            "id": "demo_threads_project_02",
            "username": "nordic_commerce",
            "permalink": "https://www.threads.net/@nordic_commerce/post/C9demoProject02",
            "timestamp": now_iso,
            "text": (
                "Seeking someone for a short-term Shopify & branding sprint project — custom storefront tweaks plus "
                "packaging graphics. Paid project ($800 - $1,200). Email projects@nordiccommerce.example.com"
            ),
        },
        {
            # Deliberate self-promo noise item: classifier must filter this out!
            "id": "demo_threads_noise_01",
            "username": "random_portfolio_promo",
            "permalink": "https://www.threads.net/@random_portfolio_promo/post/C9demoNoise01",
            "timestamp": now_iso,
            "text": (
                "Available for hire! Commissions open for graphic design and logo concepts. "
                "Check out my recent work and portfolio showcase below."
            ),
        },
    ]

    if not verticals:
        return sample_stream

    allowed = {v.lower() for v in verticals}
    filtered = []
    for item in sample_stream:
        cls = classify_threads_post(item["text"], item.get("username", ""))
        if not cls["is_opportunity"]:
            # Still include noise in raw list so caller can track filtered_out count accurately
            filtered.append(item)
            continue
        if cls["primary_vertical"] in allowed or any(v in allowed for v in cls["verticals"]):
            filtered.append(item)
    return filtered


async def fetch_via_meta_api(
    access_token: str,
    queries: List[str],
    limit: int = 25,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Queries the official Meta Threads Graph API keyword_search endpoint.
    Requires `threads_basic` and `threads_keyword_search` scopes.
    """
    if not access_token:
        return [], {"adapter": "meta_api", "status": "not_configured", "detail": "No THREADS_ACCESS_TOKEN set."}

    collected: List[Dict[str, Any]] = []
    seen_ids = set()
    errors: List[str] = []

    async with httpx.AsyncClient(timeout=12.0) as client:
        for q in queries[:6]:
            if len(collected) >= limit:
                break
            try:
                resp = await client.get(
                    THREADS_GRAPH_SEARCH_URL,
                    params={
                        "q": q,
                        "search_type": "RECENT",
                        "search_mode": "KEYWORD",
                        "fields": "id,text,permalink,timestamp,username,media_type",
                        "access_token": access_token,
                    },
                )
                if resp.status_code != 200:
                    try:
                        err_msg = resp.json().get("error", {}).get("message", resp.text[:200])
                    except ValueError:
                        err_msg = resp.text[:200]
                    errors.append(f"HTTP {resp.status_code} for '{q}': {err_msg}")
                    continue

                payload = resp.json()
                for item in payload.get("data", []):
                    pid = str(item.get("id") or "")
                    if not pid or pid in seen_ids:
                        continue
                    seen_ids.add(pid)
                    collected.append({
                        "id": pid,
                        "username": item.get("username", "threads_user"),
                        "permalink": item.get("permalink", ""),
                        "timestamp": item.get("timestamp"),
                        "text": item.get("text", ""),
                    })
            except httpx.HTTPError as exc:
                errors.append(f"Network error for '{q}': {exc}")

    status_info = {
        "adapter": "meta_api",
        "status": "ok" if not errors or collected else "error",
        "fetched": len(collected),
        "detail": "; ".join(errors[:2]) if errors else f"Fetched {len(collected)} posts via graph.threads.net",
    }
    return collected[:limit], status_info


async def fetch_via_apify(
    apify_token: str,
    actor_id: str,
    queries: List[str],
    limit: int = 25,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Optional third-party public Threads data connector via Apify REST API."""
    if not apify_token:
        return [], {"adapter": "apify", "status": "not_configured", "detail": "No THREADS_APIFY_TOKEN set."}

    endpoint = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"
    collected: List[Dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                endpoint,
                params={"token": apify_token},
                json={"queries": queries[:5], "maxItems": limit},
            )
            if resp.status_code not in (200, 201):
                return [], {
                    "adapter": "apify",
                    "status": "error",
                    "detail": f"Apify HTTP {resp.status_code}: {resp.text[:160]}",
                }
            items = resp.json()
            if isinstance(items, list):
                for item in items[:limit]:
                    if not isinstance(item, dict):
                        continue
                    text = item.get("text") or item.get("caption") or ""
                    if not text:
                        continue
                    collected.append({
                        "id": str(item.get("id") or item.get("code") or uuid.uuid4().hex[:10]),
                        "username": item.get("username") or item.get("ownerUsername") or "threads_user",
                        "permalink": item.get("url") or item.get("permalink") or "",
                        "timestamp": item.get("taken_at") or item.get("timestamp"),
                        "text": text,
                    })
    except (httpx.HTTPError, ValueError) as exc:
        return [], {"adapter": "apify", "status": "error", "detail": str(exc)}

    return collected, {
        "adapter": "apify",
        "status": "ok",
        "fetched": len(collected),
        "detail": f"Fetched {len(collected)} posts via Apify ({actor_id})",
    }


async def fetch_via_fediverse(
    verticals: List[str],
    limit: int = 15,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Queries open public Mastodon/ActivityPub hashtag timelines for federated
    Threads posts and hiring tags without credential bypass.
    """
    tag_map = {
        "graphic": ["graphicdesign", "designjobs"],
        "tech": ["hiring", "techjobs"],
        "project": ["freelance", "indiehacker"],
    }
    tags: List[str] = []
    for v in verticals:
        tags.extend(tag_map.get(v, []))
    if not tags:
        tags = ["hiring", "freelance"]

    collected: List[Dict[str, Any]] = []
    seen_ids = set()
    errors: List[str] = []

    async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": "InternScrap-ThreadsRadar/1.0"}) as client:
        for tag in dict.fromkeys(tags):
            if len(collected) >= limit:
                break
            try:
                resp = await client.get(
                    f"https://mastodon.social/api/v1/timelines/tag/{tag}",
                    params={"limit": 20},
                )
                if resp.status_code != 200:
                    continue
                for status_obj in resp.json():
                    account = status_obj.get("account", {})
                    acct = account.get("acct", "") or ""
                    post_url = status_obj.get("url") or ""
                    # Keep federated threads.net posts or explicit Threads cross-posts
                    is_threads_origin = "threads.net" in acct.lower() or "threads.net" in post_url.lower()
                    if not is_threads_origin:
                        continue
                    sid = str(status_obj.get("id") or "")
                    if not sid or sid in seen_ids:
                        continue
                    seen_ids.add(sid)
                    raw_html = status_obj.get("content", "")
                    plain_text = BeautifulSoup(raw_html, "html.parser").get_text(" ", strip=True)
                    collected.append({
                        "id": f"fedi_{sid}",
                        "username": account.get("username") or acct,
                        "permalink": post_url,
                        "timestamp": status_obj.get("created_at"),
                        "text": html.unescape(plain_text),
                    })
            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                errors.append(str(exc))
                break
            except (httpx.HTTPError, ValueError) as exc:
                errors.append(str(exc))

    return collected[:limit], {
        "adapter": "fediverse",
        "status": "ok" if not errors or collected else "unreachable",
        "fetched": len(collected),
        "detail": f"Inspected open ActivityPub hashtag streams ({len(collected)} federated Threads posts matched)",
    }


async def inspect_threads_url(url: str) -> Dict[str, Any]:
    """
    Inspects a public Threads post URL using Meta's no-login oEmbed API with HTML
    OpenGraph metadata fallback, returning extracted post text, classification,
    and structured NormalizedJob payload.
    """
    clean_url = url.strip()
    if not is_valid_threads_url(clean_url):
        raise ValueError("URL must be a valid threads.net or threads.com post link.")

    author = "threads_user"
    handle_match = re.search(r"threads\.(?:net|com)/@([A-Za-z0-9_.]+)", clean_url, re.IGNORECASE)
    if handle_match:
        author = handle_match.group(1)

    extracted_text = ""
    adapter_used = "Threads oEmbed"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        # 1. Official no-login Meta oEmbed API
        try:
            oembed_resp = await client.get(THREADS_OEMBED_URL, params={"url": clean_url})
            if oembed_resp.status_code == 200:
                oembed_data = oembed_resp.json()
                author = oembed_data.get("author_name") or author
                raw_html = oembed_data.get("html") or ""
                if raw_html:
                    extracted_text = BeautifulSoup(raw_html, "html.parser").get_text(" ", strip=True)
                if not extracted_text and oembed_data.get("title"):
                    extracted_text = str(oembed_data["title"])
        except (httpx.HTTPError, ValueError) as exc:
            logger.debug(f"Threads oEmbed lookup notice for {clean_url}: {exc}")

        # 2. Fallback: public OpenGraph tags if oEmbed returned minimal text
        if len(extracted_text) < 20:
            try:
                page_resp = await client.get(clean_url, headers=headers)
                if page_resp.status_code == 200:
                    soup = BeautifulSoup(page_resp.text, "html.parser")
                    og_desc = soup.find("meta", property="og:description")
                    og_title = soup.find("meta", property="og:title")
                    desc_txt = og_desc.get("content", "").strip() if og_desc and og_desc.get("content") else ""
                    title_txt = og_title.get("content", "").strip() if og_title and og_title.get("content") else ""
                    combined = " ".join(part for part in (title_txt, desc_txt) if part).strip()
                    if len(combined) > len(extracted_text):
                        extracted_text = html.unescape(combined)
                        adapter_used = "Threads Public Meta"
            except httpx.HTTPError as exc:
                logger.debug(f"Threads HTML meta notice for {clean_url}: {exc}")

    if not extracted_text:
        extracted_text = f"Threads post shared by @{author} ({clean_url})"

    classification = classify_threads_post(extracted_text, author=author)
    post_id_match = re.search(r"/post/([A-Za-z0-9_-]+)", clean_url)
    post_id = post_id_match.group(1) if post_id_match else uuid.uuid4().hex[:10]

    normalized = _build_normalized_job(
        post_id=post_id,
        text=extracted_text,
        username=author,
        permalink=clean_url,
        timestamp_str=None,
        adapter_name=adapter_used,
        classification=classification,
    )

    return {
        "normalized": normalized,
        "classification": classification,
        "adapter_used": adapter_used,
        "extracted_text": extracted_text,
        "author": author,
    }


class ThreadsOpportunitySource(BaseJobSource):
    """Multi-adapter Threads opportunity scanner for Graphic, Tech, and Project leads."""

    source_name = "Threads"

    def __init__(
        self,
        verticals: Optional[List[str]] = None,
        custom_keywords: Optional[Dict[str, List[str]]] = None,
        scan_mode: str = "auto",
        access_token: Optional[str] = None,
        apify_token: Optional[str] = None,
        apify_actor_id: Optional[str] = None,
        allow_demo_fallback: bool = True,
    ):
        self.verticals = [v.lower() for v in (verticals or ["graphic", "tech", "project"])]
        self.custom_keywords = custom_keywords or {}
        self.scan_mode = scan_mode.lower()
        self.access_token = access_token if access_token is not None else settings.THREADS_ACCESS_TOKEN
        self.apify_token = apify_token if apify_token is not None else settings.THREADS_APIFY_TOKEN
        self.apify_actor_id = apify_actor_id or settings.THREADS_APIFY_ACTOR_ID
        self.allow_demo_fallback = allow_demo_fallback
        self.last_scan_report: Dict[str, Any] = {}

    def _collect_queries(self) -> List[str]:
        queries: List[str] = []
        for vertical in self.verticals:
            custom_list = self.custom_keywords.get(vertical, [])
            base_list = custom_list if custom_list else DEFAULT_SEARCH_QUERIES.get(vertical, [])
            queries.extend(base_list)
        # Preserve order while deduplicating
        return list(dict.fromkeys(q.strip() for q in queries if q and q.strip()))

    async def fetch_jobs(self, limit: int = 50) -> List[NormalizedJob]:
        queries = self._collect_queries()
        raw_posts: List[Dict[str, Any]] = []
        adapter_statuses: List[Dict[str, Any]] = []
        active_adapter_name = "Fediverse Public"

        if self.scan_mode in ("auto", "meta_api") and self.access_token:
            posts, meta_status = await fetch_via_meta_api(self.access_token, queries, limit=limit)
            adapter_statuses.append(meta_status)
            if posts:
                raw_posts.extend(posts)
                active_adapter_name = "Meta Threads API"

        if (self.scan_mode == "apify" or (self.scan_mode == "auto" and not raw_posts)) and self.apify_token:
            posts, apify_status = await fetch_via_apify(
                self.apify_token, self.apify_actor_id, queries, limit=limit
            )
            adapter_statuses.append(apify_status)
            if posts:
                raw_posts.extend(posts)
                active_adapter_name = "Apify Threads"

        if self.scan_mode in ("auto", "fediverse") and not raw_posts:
            posts, fedi_status = await fetch_via_fediverse(self.verticals, limit=min(limit, 15))
            adapter_statuses.append(fedi_status)
            if posts:
                raw_posts.extend(posts)
                active_adapter_name = "Fediverse Public"

        if self.scan_mode == "demo" or (self.scan_mode == "auto" and not raw_posts and self.allow_demo_fallback):
            demo_posts = get_demo_threads_posts(self.verticals)
            raw_posts.extend(demo_posts)
            active_adapter_name = "Fediverse Public"
            adapter_statuses.append({
                "adapter": "demo",
                "status": "active",
                "fetched": len(demo_posts),
                "detail": "Loaded curated demo Threads stream (configure THREADS_ACCESS_TOKEN or THREADS_APIFY_TOKEN for live keyword search).",
            })

        accepted: List[NormalizedJob] = []
        filtered_out: List[Dict[str, str]] = []
        vertical_counts: Dict[str, int] = {"graphic": 0, "tech": 0, "project": 0}
        seen_post_ids = set()

        for post in raw_posts:
            pid = str(post.get("id") or "")
            if pid in seen_post_ids:
                continue
            seen_post_ids.add(pid)

            cls = classify_threads_post(post.get("text", ""), post.get("username", ""))
            if not cls["is_opportunity"]:
                filtered_out.append({
                    "id": pid,
                    "username": post.get("username", ""),
                    "reason": cls["rejected_reason"] or "Filtered",
                })
                continue

            primary_v = cls["primary_vertical"]
            matches_vertical = primary_v in self.verticals or any(v in self.verticals for v in cls["verticals"])
            if not matches_vertical and primary_v != "general":
                continue

            if primary_v in vertical_counts:
                vertical_counts[primary_v] += 1

            accepted.append(
                _build_normalized_job(
                    post_id=pid,
                    text=post.get("text", ""),
                    username=post.get("username", "threads_user"),
                    permalink=post.get("permalink", ""),
                    timestamp_str=post.get("timestamp"),
                    adapter_name=active_adapter_name,
                    classification=cls,
                )
            )
            if len(accepted) >= limit:
                break

        self.last_scan_report = {
            "active_adapter": active_adapter_name,
            "adapter_statuses": adapter_statuses,
            "queries_used": queries,
            "raw_posts_inspected": len(raw_posts),
            "opportunities_matched": len(accepted),
            "self_promo_filtered_count": len(filtered_out),
            "vertical_breakdown": vertical_counts,
        }
        return accepted
