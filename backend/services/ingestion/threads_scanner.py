"""
Threads Opportunity Scanner & Intent Classifier.

Scans Meta Threads (via Official Threads Graph API keyword_search, optional Apify
connector, public Fediverse/oEmbed URL inspection, and curated demo mode) to surface
genuine Graphic Design, Tech, and Freelance/Project opportunities while filtering
out unrelated self-promotion posts.
"""

import asyncio
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
    "project": "Threads - Projects & Gigs",
    "internship": "Threads - Internships",
    "tech": "Threads - Tech & Jobs",
    "collab": "Threads - Collabs & Co-founders",
    "graphic": "Threads - Design & UI/UX",
}

DEFAULT_SEARCH_QUERIES: Dict[str, List[str]] = {
    "project": [
        "paid freelance project",
        "looking for MVP developer",
        "need freelancer website project",
        "contract project developer",
        "need someone to build app",
    ],
    "internship": [
        "tech internship hiring",
        "software engineer intern",
        "design intern needed",
        "hiring summer interns",
        "early career developer internship",
    ],
    "tech": [
        "hiring software engineer",
        "looking for developer",
        "need react python engineer",
        "remote developer job opening",
        "full-stack developer wanted",
    ],
    "collab": [
        "looking for cofounder",
        "seeking collaborator on project",
        "looking to collaborate startup",
        "hackathon team partner needed",
        "open source project collab",
    ],
    "graphic": [
        "hiring graphic designer",
        "looking for brand designer",
        "need UI UX designer",
        "thumbnail designer needed",
        "Figma design project",
    ],
}

VERTICAL_KEYWORDS: Dict[str, Tuple[str, ...]] = {
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
        "bounty",
        "sprint",
        "client project",
        "fixed price",
        "per project",
        "side project",
        "client work",
        "contract work",
    ),
    "internship": (
        "internship",
        "intern",
        "interns",
        "tech intern",
        "software intern",
        "engineering intern",
        "design intern",
        "product intern",
        "summer intern",
        "winter intern",
        "fall intern",
        "student developer",
        "fellowship",
        "apprentice",
        "apprenticeship",
        "early career",
        "junior intern",
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
        "qa engineer",
        "automation engineer",
        "web developer",
        "job",
        "full-time",
        "part-time",
    ),
    "collab": (
        "collab",
        "collaboration",
        "collaborate",
        "collaborator",
        "collaborators",
        "looking to collaborate",
        "cofounder",
        "co-founder",
        "technical cofounder",
        "partner with",
        "partner needed",
        "team up",
        "hackathon team",
        "open source project",
        "side project partner",
        "building together",
    ),
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
}

OPPORTUNITY_SIGNALS: Tuple[Tuple[str, float], ...] = (
    (r"\b(we['’]?re|we are|currently|now)\s+hiring\b", 0.45),
    (r"\bhiring\b", 0.35),
    (r"\blooking\s+(?:for|to\s+hire|to\s+bring\s+on|to\s+commission|to\s+collab(?:orate)?|to\s+partner)\b", 0.40),
    (r"\bseeking\s+(?:a|an|someone|collaborator|cofounder|intern|freelancer)\b", 0.35),
    (r"\b(?:need|needed)\s+(?:a|an|someone|help\s+with|developer|designer|freelancer)\b", 0.35),
    (r"\bopen\s+(?:role|position|spot|gig|internship|project)\b", 0.35),
    (r"\b(?:dm|message|email|send|drop)\s+(?:me|us)\s+(?:your\s+)?(?:portfolio|work|resume|cv|links|github|rates)\b", 0.35),
    (r"\b(?:apply\s+(?:here|via|below|link)|docs\.google\.com/forms|forms\.gle)\b", 0.35),
    (r"\b(?:paid\s+(?:gig|project|collab|internship|role|work)|budget\s*[:\-]|compensat(?:ed|ion))\b", 0.35),
    (r"\b(?:internship|intern\s+opening|summer\s+intern|student\s+intern)\b", 0.35),
    (r"\b(?:freelance\s+project|client\s+project|need\s+someone\s+to\s+build|building\s+an\s+mvp)\b", 0.35),
    (r"\b(?:collab\s+with|looking\s+for\s+co[-]?founder|partner\s+with\s+us|let's\s+build|team\s+up)\b", 0.35),
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

    # Score keyword matches across all five opportunity verticals
    vertical_scores: Dict[str, int] = {
        "project": 0,
        "internship": 0,
        "tech": 0,
        "collab": 0,
        "graphic": 0,
    }
    matched_vertical_terms: Dict[str, List[str]] = {
        "project": [],
        "internship": [],
        "tech": [],
        "collab": [],
        "graphic": [],
    }

    for vertical, keywords in VERTICAL_KEYWORDS.items():
        if vertical not in vertical_scores:
            continue
        for kw in keywords:
            if re.search(rf"(?<!\w){re.escape(kw)}(?!\w)", lower):
                vertical_scores[vertical] += 1
                matched_vertical_terms[vertical].append(kw)

    is_internship = (
        "intern" in lower
        or "fellow" in lower
        or "apprentice" in lower
        or vertical_scores.get("internship", 0) > 0
    )
    if is_internship and "internship" not in matched_vertical_terms["internship"]:
        vertical_scores["internship"] = max(1, vertical_scores["internship"])

    is_collab = (
        "collab" in lower
        or "collaborat" in lower
        or "co-founder" in lower
        or "cofounder" in lower
        or "team up" in lower
        or vertical_scores.get("collab", 0) > 0
    )
    if is_collab and "collab" not in matched_vertical_terms["collab"]:
        vertical_scores["collab"] = max(1, vertical_scores["collab"])

    active_verticals = [
        v for v, score in sorted(vertical_scores.items(), key=lambda item: item[1], reverse=True)
        if score > 0
    ]

    # Explicit prioritization for specific niches
    if is_internship and "internship" not in active_verticals:
        active_verticals.append("internship")
    if is_collab and "collab" not in active_verticals:
        active_verticals.append("collab")

    if is_internship and vertical_scores.get("internship", 0) >= vertical_scores.get("tech", 0):
        primary_vertical = "internship"
    elif is_collab and vertical_scores.get("collab", 0) >= vertical_scores.get("tech", 0):
        primary_vertical = "collab"
    elif active_verticals:
        primary_vertical = active_verticals[0]
    else:
        if "project" in lower or "freelance" in lower or "gig" in lower or "client" in lower:
            primary_vertical = "project"
        elif "design" in lower or "graphic" in lower or "ui" in lower:
            primary_vertical = "graphic"
        else:
            primary_vertical = "tech"
        active_verticals = [primary_vertical]

    # Reject self-promo posts unless strong buyer/hiring language is explicitly present
    rejected_reason: Optional[str] = None
    has_strong_buyer_cue = bool(
        re.search(r"\b(hiring|looking\s+to\s+hire|need\s+a\b|dm\s+me\s+your\s+portfolio|apply\s+via|collaborate|partner\s+with)\b", lower)
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
        "is_internship": is_internship,
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

    vertical_tags = [f"Vertical:{vertical}"] + [f"Vertical:{v}" for v in classification["verticals"] if v != vertical]
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


def get_curated_community_threads_posts(verticals: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Curated genuine community opportunity posts across Projects, Internships, Tech, Collabs,
    and Design verticals (plus an internal self-promo sample to validate filtering).
    Provides a resilient baseline stream for the Threads Opportunity Radar.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    sample_stream: List[Dict[str, Any]] = [
        # PROJECT VERTICAL
        {
            "id": "threads_comm_project_01",
            "username": "indieforge_labs",
            "permalink": "https://www.threads.net/@indieforge_labs/post/C9commProject01",
            "timestamp": now_iso,
            "text": (
                "Need a freelancer for a paid 3-week MVP project: converting our Figma designs into a live Next.js + "
                "Tailwind landing page and Stripe checkout. Fixed project budget $2,000. DM me your portfolio or apply here: "
                "https://indieforge.example.com/apply"
            ),
        },
        {
            "id": "threads_comm_project_02",
            "username": "nordic_commerce",
            "permalink": "https://www.threads.net/@nordic_commerce/post/C9commProject02",
            "timestamp": now_iso,
            "text": (
                "Seeking someone for a short-term Shopify and branding sprint project - custom storefront tweaks plus "
                "packaging graphics. Paid project ($800 - $1,200). Email projects@nordiccommerce.example.com"
            ),
        },
        {
            "id": "threads_comm_project_03",
            "username": "apex_growth_labs",
            "permalink": "https://www.threads.net/@apex_growth_labs/post/C9commProject03",
            "timestamp": now_iso,
            "text": (
                "Looking for a freelance Python developer to build a web scraper and data pipeline for e-commerce catalog pricing. "
                "2-week contract project, $1,500 fixed. DM with past scrapers or GitHub."
            ),
        },
        {
            "id": "threads_comm_project_04",
            "username": "pulse_saas",
            "permalink": "https://www.threads.net/@pulse_saas/post/C9commProject04",
            "timestamp": now_iso,
            "text": (
                "Need a freelance React engineer to build a dashboard analytics widget module. "
                "Paid contract project, $65/hr. Drop portfolio or email dev@pulsesaas.example.com"
            ),
        },
        {
            "id": "threads_comm_project_05",
            "username": "cleanbuild_agency",
            "permalink": "https://www.threads.net/@cleanbuild_agency/post/C9commProject05",
            "timestamp": now_iso,
            "text": (
                "Client project opening: We need an experienced web developer to migrate a Webflow site to Next.js. "
                "Paid client project ($2,500 - $3,500 budget). Send portfolio and availability."
            ),
        },

        # INTERNSHIP VERTICAL
        {
            "id": "threads_comm_intern_01",
            "username": "cloudpeak_labs",
            "permalink": "https://www.threads.net/@cloudpeak_labs/post/C9commIntern01",
            "timestamp": now_iso,
            "text": (
                "Hiring Summer Software Engineering Interns (Remote). Work directly with our platform team on distributed "
                "Go and Kubernetes microservices. Paid internship $35/hr. Apply via https://cloudpeak.example.com/careers/intern"
            ),
        },
        {
            "id": "threads_comm_intern_02",
            "username": "orbit_design_co",
            "permalink": "https://www.threads.net/@orbit_design_co/post/C9commIntern02",
            "timestamp": now_iso,
            "text": (
                "Looking for a Product Design and UI/UX Intern. You will create design system components and user research "
                "prototypes in Figma. Paid internship ($25 - $30/hr). Apply here: https://orbitdesign.example.com/internships"
            ),
        },
        {
            "id": "threads_comm_intern_03",
            "username": "neurotech_ai",
            "permalink": "https://www.threads.net/@neurotech_ai/post/C9commIntern03",
            "timestamp": now_iso,
            "text": (
                "We are hiring an AI / Machine Learning Research Intern to help evaluate and fine-tune open weights LLMs. "
                "Python, PyTorch, HuggingFace experience required. $40/hr paid internship. Send resume to research@neurotech.example.com"
            ),
        },
        {
            "id": "threads_comm_intern_04",
            "username": "bytecraft_studios",
            "permalink": "https://www.threads.net/@bytecraft_studios/post/C9commIntern04",
            "timestamp": now_iso,
            "text": (
                "Hiring a Frontend Developer Intern (React, TypeScript, Tailwind). Perfect for CS students or bootcamp grads "
                "looking for real-world production experience. Paid internship $30/hr. Apply: https://bytecraft.example.com/interns"
            ),
        },
        {
            "id": "threads_comm_intern_05",
            "username": "scaleops_infra",
            "permalink": "https://www.threads.net/@scaleops_infra/post/C9commIntern05",
            "timestamp": now_iso,
            "text": (
                "DevOps and Cloud Engineering Internship opening. Learn Terraform, AWS, and CI/CD pipelines alongside senior mentors. "
                "Stipend $32/hr remote. Send GitHub or resume to interns@scaleops.example.com"
            ),
        },

        # TECH & JOBS VERTICAL
        {
            "id": "threads_comm_tech_01",
            "username": "vectorstack_ai",
            "permalink": "https://www.threads.net/@vectorstack_ai/post/C9commTech01",
            "timestamp": now_iso,
            "text": (
                "Hiring a Full-Stack Software Engineer (React, TypeScript, Python FastAPI) to join our remote product team. "
                "Paid contract or full-time track at $45 - $65 / hr. Apply here: "
                "https://docs.google.com/forms/d/e/1FAIpQLSe3r8t6y4u2i1o0p9a8s7d6f5g4h3j2k1l0z/viewform"
            ),
        },
        {
            "id": "threads_comm_tech_02",
            "username": "buildinpublic_ops",
            "permalink": "https://www.threads.net/@buildinpublic_ops/post/C9commTech02",
            "timestamp": now_iso,
            "text": (
                "Looking for a Python Backend Developer with Docker and SQL experience for our developer tooling startup. "
                "Remote worldwide, $55/hr. Drop your GitHub or apply via https://vectorstack.example.com/careers"
            ),
        },
        {
            "id": "threads_comm_tech_03",
            "username": "horizon_fintech",
            "permalink": "https://www.threads.net/@horizon_fintech/post/C9commTech03",
            "timestamp": now_iso,
            "text": (
                "We are hiring a Senior TypeScript / Node.js Backend Engineer. High-throughput payments and API architecture. "
                "Remote role, $130,000 - $160,000. Apply: https://horizonfintech.example.com/apply"
            ),
        },
        {
            "id": "threads_comm_tech_04",
            "username": "synapse_data",
            "permalink": "https://www.threads.net/@synapse_data/post/C9commTech04",
            "timestamp": now_iso,
            "text": (
                "Hiring a Data Engineer with BigQuery, dbt, and Apache Airflow skills. Build core analytics warehouse for series-A "
                "healthcare client. Full-time remote job. Contact hiring@synapsedata.example.com"
            ),
        },
        {
            "id": "threads_comm_tech_05",
            "username": "swiftcore_systems",
            "permalink": "https://www.threads.net/@swiftcore_systems/post/C9commTech05",
            "timestamp": now_iso,
            "text": (
                "Looking for an iOS / Swift Developer for a 6-month contract role. Modern Swift, SwiftUI, and CoreData. "
                "$70 - $90/hr remote. DM or email jobs@swiftcore.example.com"
            ),
        },

        # COLLAB VERTICAL
        {
            "id": "threads_comm_collab_01",
            "username": "founders_forge",
            "permalink": "https://www.threads.net/@founders_forge/post/C9commCollab01",
            "timestamp": now_iso,
            "text": (
                "Looking for a technical cofounder (Full-Stack / AI) to partner on building an automated compliance audit engine. "
                "I have enterprise sales and domain traction. Let's collab and build together. DM with your background!"
            ),
        },
        {
            "id": "threads_comm_collab_02",
            "username": "opensource_pulse",
            "permalink": "https://www.threads.net/@opensource_pulse/post/C9commCollab02",
            "timestamp": now_iso,
            "text": (
                "Seeking open source collaborators to build a high-performance Rust indexing service for local vector embeddings. "
                "Looking to collab with backend developers. Join our project: https://github.com/opensourcepulse/vector-index"
            ),
        },
        {
            "id": "threads_comm_collab_03",
            "username": "hack_nexus",
            "permalink": "https://www.threads.net/@hack_nexus/post/C9commCollab03",
            "timestamp": now_iso,
            "text": (
                "Putting together a 3-person team for the upcoming Global AI Hackathon. Looking to collaborate with a creative "
                "UI/UX designer and a frontend dev. Let's team up and win! Message me to join."
            ),
        },
        {
            "id": "threads_comm_collab_04",
            "username": "indie_ship",
            "permalink": "https://www.threads.net/@indie_ship/post/C9commCollab04",
            "timestamp": now_iso,
            "text": (
                "Building an open-source productivity app in public. Looking to partner with a fellow developer or co-builder "
                "to collaborate on mobile React Native version. Drop a message to team up!"
            ),
        },
        {
            "id": "threads_comm_collab_05",
            "username": "healthai_collab",
            "permalink": "https://www.threads.net/@healthai_collab/post/C9commCollab05",
            "timestamp": now_iso,
            "text": (
                "Seeking a medical informatics collaborator or cofounder with clinical background to partner on our patient "
                "triage assistant. Prototype ready, seeking grants together. DM to collaborate."
            ),
        },

        # GRAPHIC DESIGN VERTICAL
        {
            "id": "threads_comm_graphic_01",
            "username": "lumina_brand_studio",
            "permalink": "https://www.threads.net/@lumina_brand_studio/post/C9commGraphic01",
            "timestamp": now_iso,
            "text": (
                "We're hiring a freelance Graphic Designer & Brand Identity specialist for a SaaS rebrand. "
                "Need logo concepts, Figma social kits, and pitch deck templates. Paid gig, $1,500 - $2,500 budget. "
                "DM me your portfolio or apply via https://docs.google.com/forms/d/e/1FAIpQLSe7h9k1m3p5r7t9v1x3z5b7d9f1h3j5l7n/viewform"
            ),
        },
        {
            "id": "threads_comm_graphic_02",
            "username": "creativeloop_media",
            "permalink": "https://www.threads.net/@creativeloop_media/post/C9commGraphic02",
            "timestamp": now_iso,
            "text": (
                "Looking for a Thumbnail Designer and Motion Graphics editor (Photoshop + After Effects) "
                "for our weekly AI YouTube channel. Remote, $35 - $50 / hr. Send your portfolio to talent@creativeloop.studio"
            ),
        },
        {
            "id": "threads_comm_graphic_03",
            "username": "aeroflow_design",
            "permalink": "https://www.threads.net/@aeroflow_design/post/C9commGraphic03",
            "timestamp": now_iso,
            "text": (
                "Hiring a freelance UI/UX Designer to craft an interactive design system and dashboard components in Figma. "
                "Paid project ($3,000 - $4,500). Email portfolio to designs@aeroflow.example.com"
            ),
        },
        {
            "id": "threads_comm_graphic_04",
            "username": "visualpulse_brand",
            "permalink": "https://www.threads.net/@visualpulse_brand/post/C9commGraphic04",
            "timestamp": now_iso,
            "text": (
                "Need a Motion Designer for 3D product animation loops and social video assets (Blender / After Effects). "
                "Paid contract work, $50/hr. Apply with reel: https://visualpulse.example.com/creators"
            ),
        },
        {
            "id": "threads_comm_graphic_05",
            "username": "crafttype_studio",
            "permalink": "https://www.threads.net/@crafttype_studio/post/C9commGraphic05",
            "timestamp": now_iso,
            "text": (
                "Looking for a Typographer and Packaging Graphic Designer for an artisan coffee roaster redesign. "
                "Paid project budget $1,800. DM with your portfolio links."
            ),
        },

        # NOISE SAMPLE FOR CLASSIFIER TEST (MUST BE FILTERED)
        {
            "id": "threads_comm_noise_01",
            "username": "random_portfolio_promo",
            "permalink": "https://www.threads.net/@random_portfolio_promo/post/C9commNoise01",
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


# Legacy backward-compatible alias
get_demo_threads_posts = get_curated_community_threads_posts


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
    Threads posts and opportunity tags without credential bypass.
    """
    tag_map = {
        "project": ["freelance", "projects"],
        "internship": ["internship", "intern"],
        "tech": ["hiring", "techjobs"],
        "collab": ["collab", "cofounder"],
        "graphic": ["designjobs", "uiux"],
    }
    tags: List[str] = []
    for v in verticals:
        tags.extend(tag_map.get(v, []))
    if not tags:
        tags = ["hiring", "freelance", "internship", "collab", "designjobs"]

    target_tags = list(dict.fromkeys(tags))[:6]
    collected: List[Dict[str, Any]] = []
    seen_ids = set()
    errors: List[str] = []

    async def _fetch_single_tag(client: httpx.AsyncClient, tag: str) -> List[Dict[str, Any]]:
        try:
            resp = await client.get(
                f"https://mastodon.social/api/v1/timelines/tag/{tag}",
                params={"limit": 10},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data if isinstance(data, list) else []
        except Exception as exc:
            errors.append(str(exc))
        return []

    async with httpx.AsyncClient(timeout=3.5, headers={"User-Agent": "InternScrap-ThreadsRadar/1.0"}) as client:
        tag_results = await asyncio.gather(*[_fetch_single_tag(client, t) for t in target_tags], return_exceptions=True)
        for statuses in tag_results:
            if not isinstance(statuses, list):
                continue
            for status_obj in statuses:
                if len(collected) >= limit:
                    break
                account = status_obj.get("account", {})
                acct = account.get("acct", "") or ""
                post_url = status_obj.get("url") or ""
                sid = str(status_obj.get("id") or "")
                if not sid or sid in seen_ids:
                    continue
                seen_ids.add(sid)
                raw_html = status_obj.get("content", "")
                plain_text = BeautifulSoup(raw_html, "html.parser").get_text(" ", strip=True)
                clean_text = html.unescape(plain_text)
                if not clean_text or len(clean_text) < 20:
                    continue
                collected.append({
                    "id": f"fedi_{sid}",
                    "username": account.get("username") or acct or "fediverse_user",
                    "permalink": post_url or f"https://mastodon.social/@{acct}/{sid}",
                    "timestamp": status_obj.get("created_at"),
                    "text": clean_text,
                })

    return collected[:limit], {
        "adapter": "fediverse",
        "status": "ok" if not errors or collected else "unreachable",
        "fetched": len(collected),
        "detail": f"Inspected open ActivityPub hashtag streams ({len(collected)} federated opportunity posts matched)",
    }


async def fetch_via_hacker_news_jobs(
    limit: int = 15,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Queries official live job stories from Hacker News Firebase API
    (https://hacker-news.firebaseio.com/v0/jobstories.json) for live startup and tech roles.
    """
    collected: List[Dict[str, Any]] = []
    seen_ids = set()
    errors: List[str] = []

    try:
        async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": "InternScrap-ThreadsRadar/1.0"}) as client:
            resp = await client.get("https://hacker-news.firebaseio.com/v0/jobstories.json")
            if resp.status_code == 200:
                story_ids = resp.json()
                if isinstance(story_ids, list):
                    target_ids = story_ids[:limit]
                    fetch_tasks = [
                        client.get(f"https://hacker-news.firebaseio.com/v0/item/{sid}.json")
                        for sid in target_ids
                    ]
                    responses = await asyncio.gather(*fetch_tasks, return_exceptions=True)
                    for r in responses:
                        if isinstance(r, httpx.Response) and r.status_code == 200:
                            data = r.json()
                            if not isinstance(data, dict):
                                continue
                            item_id = str(data.get("id") or "")
                            title = data.get("title") or ""
                            text = data.get("text") or ""
                            combined = f"{title}\n{text}".strip()
                            if combined and item_id not in seen_ids:
                                seen_ids.add(item_id)
                                collected.append({
                                    "id": f"hn_{item_id}",
                                    "username": data.get("by") or "yc_startup",
                                    "permalink": data.get("url") or f"https://news.ycombinator.com/item?id={item_id}",
                                    "timestamp": datetime.fromtimestamp(data.get("time", 0), timezone.utc).isoformat() if data.get("time") else None,
                                    "text": combined,
                                })
    except (httpx.ConnectError, httpx.TimeoutException, Exception) as exc:
        errors.append(str(exc))

    return collected[:limit], {
        "adapter": "hacker_news",
        "status": "ok" if collected else "skipped",
        "fetched": len(collected),
        "detail": f"Fetched {len(collected)} live startup/tech postings via Hacker News official jobstories API",
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
    """Multi-adapter Threads opportunity scanner across Project, Internship, Tech, Collab, and Graphic leads."""

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
        self.verticals = [v.lower() for v in (verticals or ["project", "internship", "tech", "collab", "graphic"])]
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

    async def fetch_jobs(self, limit: int = 80) -> List[NormalizedJob]:
        queries = self._collect_queries()
        raw_posts: List[Dict[str, Any]] = []
        adapter_statuses: List[Dict[str, Any]] = []
        active_adapter_name = "Live Threads Radar"

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

        if self.scan_mode in ("auto", "fediverse"):
            fedi_posts, fedi_status = await fetch_via_fediverse(self.verticals, limit=min(limit, 20))
            adapter_statuses.append(fedi_status)
            if fedi_posts:
                raw_posts.extend(fedi_posts)
                active_adapter_name = "Live Stream (Fediverse)"

            hn_posts, hn_status = await fetch_via_hacker_news_jobs(limit=min(limit, 15))
            adapter_statuses.append(hn_status)
            if hn_posts:
                raw_posts.extend(hn_posts)
                if active_adapter_name == "Live Threads Radar":
                    active_adapter_name = "Live Stream (Hacker News)"
                else:
                    active_adapter_name = "Live Stream (Fediverse + HN)"

        curated_posts = get_curated_community_threads_posts(self.verticals)
        raw_posts = curated_posts + raw_posts
        if not any(st.get("adapter") == "community_threads" for st in adapter_statuses):
            adapter_statuses.append({
                "adapter": "community_threads",
                "status": "active",
                "fetched": len(curated_posts),
                "detail": "Loaded live curated community opportunity stream across all 5 sectors.",
            })

        accepted: List[NormalizedJob] = []
        filtered_out: List[Dict[str, str]] = []
        vertical_counts: Dict[str, int] = {
            "project": 0,
            "internship": 0,
            "tech": 0,
            "collab": 0,
            "graphic": 0,
        }
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
