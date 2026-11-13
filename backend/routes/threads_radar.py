"""
FastAPI routes for Threads Opportunity Radar (Graphic, Tech, Project).
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models.job import Job
from backend.services.dedup import merge_job_records
from backend.services.ingestion.threads_scanner import (
    DEFAULT_SEARCH_QUERIES,
    ThreadsOpportunitySource,
    VERTICAL_LABELS,
    inspect_threads_url,
    is_valid_threads_url,
)
from backend.services.threads_alerts import dispatch_threads_alerts, get_alert_history

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/threads", tags=["Threads Opportunity Radar"])

ALLOWED_VERTICALS = ("all", "project", "internship", "tech", "collab", "graphic", "job")
CORE_VERTICALS = ["project", "internship", "tech", "collab", "graphic"]

THREADS_RADAR_CONFIG: Dict[str, Any] = {
    "enabled_verticals": list(CORE_VERTICALS),
    "keywords": {k: list(v) for k, v in DEFAULT_SEARCH_QUERIES.items()},
    "scan_interval_minutes": 10,
    "auto_demo_fallback": True,
    "send_email_alerts": True,
    "access_token": settings.THREADS_ACCESS_TOKEN,
    "apify_token": settings.THREADS_APIFY_TOKEN,
    "apify_actor_id": settings.THREADS_APIFY_ACTOR_ID,
    "webhook_url": settings.THREADS_WEBHOOK_URL,
    "telegram_bot_token": settings.THREADS_TELEGRAM_BOT_TOKEN,
    "telegram_chat_id": settings.THREADS_TELEGRAM_CHAT_ID,
    "last_scan_at": None,
    "last_scan_report": None,
}


class ThreadsScanRequest(BaseModel):
    verticals: Optional[List[str]] = None
    custom_keywords: Optional[Dict[str, List[str]]] = None
    mode: str = "auto"  # auto | meta_api | apify | fediverse | demo
    limit: int = Field(default=80, ge=1, le=100)
    send_alerts: bool = True


class ParseThreadsUrlRequest(BaseModel):
    url: str


class ThreadsConfigUpdateRequest(BaseModel):
    enabled_verticals: Optional[List[str]] = None
    keywords: Optional[Dict[str, List[str]]] = None
    scan_interval_minutes: Optional[int] = Field(default=None, ge=5, le=1440)
    auto_demo_fallback: Optional[bool] = None
    send_email_alerts: Optional[bool] = None
    access_token: Optional[str] = None
    apify_token: Optional[str] = None
    apify_actor_id: Optional[str] = None
    webhook_url: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None


def _mask_secret(value: str) -> str:
    clean = (value or "").strip()
    if not clean:
        return ""
    if len(clean) <= 6:
        return "*" * len(clean)
    return f"***{clean[-4:]}"


def _derive_vertical_from_job(job: Job) -> str:
    for src in (job.sources or []):
        s_lower = str(src).lower()
        if s_lower.startswith("vertical:"):
            val = s_lower.split(":", 1)[1].strip()
            if val in CORE_VERTICALS:
                return val

    cat = (job.category or "").lower()
    title = (job.title or "").lower()
    desc = (job.description or "").lower()

    if job.is_internship or "intern" in cat or "intern" in title or "fellow" in cat:
        return "internship"
    if "collab" in cat or "collab" in title or "cofounder" in cat or "partner" in title:
        return "collab"
    if "graphic" in cat or "design" in cat or "ui" in cat or "ux" in cat or "figma" in cat:
        return "graphic"
    if "tech" in cat or "engineer" in cat or "developer" in cat or "software" in title or "tech" in title:
        return "tech"
    if "project" in cat or "project" in title or "freelance" in cat or "gig" in cat:
        return "project"

    return "project"


def _serialize_threads_job(job: Job) -> Dict[str, Any]:
    data = job.to_dict()
    data["vertical"] = _derive_vertical_from_job(job)
    return data


def _public_config_snapshot() -> Dict[str, Any]:
    return {
        "enabled_verticals": THREADS_RADAR_CONFIG["enabled_verticals"],
        "keywords": THREADS_RADAR_CONFIG["keywords"],
        "scan_interval_minutes": THREADS_RADAR_CONFIG["scan_interval_minutes"],
        "auto_demo_fallback": THREADS_RADAR_CONFIG["auto_demo_fallback"],
        "send_email_alerts": THREADS_RADAR_CONFIG["send_email_alerts"],
        "providers": {
            "meta_api_configured": bool(THREADS_RADAR_CONFIG["access_token"].strip()),
            "meta_api_token_preview": _mask_secret(THREADS_RADAR_CONFIG["access_token"]),
            "apify_configured": bool(THREADS_RADAR_CONFIG["apify_token"].strip()),
            "apify_actor_id": THREADS_RADAR_CONFIG["apify_actor_id"],
            "webhook_configured": bool(THREADS_RADAR_CONFIG["webhook_url"].strip()),
            "webhook_preview": _mask_secret(THREADS_RADAR_CONFIG["webhook_url"]),
            "telegram_configured": bool(
                THREADS_RADAR_CONFIG["telegram_bot_token"].strip()
                and THREADS_RADAR_CONFIG["telegram_chat_id"].strip()
            ),
        },
        "last_scan_at": THREADS_RADAR_CONFIG["last_scan_at"],
        "last_scan_report": THREADS_RADAR_CONFIG["last_scan_report"],
        "recent_alerts": get_alert_history(limit=5),
    }


async def execute_threads_scan(
    db: Session,
    *,
    verticals: Optional[List[str]] = None,
    custom_keywords: Optional[Dict[str, List[str]]] = None,
    scan_mode: str = "auto",
    limit: int = 80,
    send_alerts: bool = True,
) -> Dict[str, Any]:
    """
    Executes a Threads opportunity scan, deduplicates & persists results to DB,
    and optionally triggers notifications for newly added leads.
    """
    target_verticals = [
        v.lower() for v in (verticals or THREADS_RADAR_CONFIG["enabled_verticals"])
        if v.lower() in ALLOWED_VERTICALS
    ] or list(ALLOWED_VERTICALS)

    merged_keywords = dict(THREADS_RADAR_CONFIG["keywords"])
    if custom_keywords:
        for k, vals in custom_keywords.items():
            if k.lower() in ALLOWED_VERTICALS and isinstance(vals, list) and vals:
                merged_keywords[k.lower()] = [str(item).strip() for item in vals if str(item).strip()]

    source = ThreadsOpportunitySource(
        verticals=target_verticals,
        custom_keywords=merged_keywords,
        scan_mode=scan_mode,
        access_token=THREADS_RADAR_CONFIG["access_token"],
        apify_token=THREADS_RADAR_CONFIG["apify_token"],
        apify_actor_id=THREADS_RADAR_CONFIG["apify_actor_id"],
        allow_demo_fallback=THREADS_RADAR_CONFIG["auto_demo_fallback"],
    )

    normalized_items = await source.fetch_jobs(limit=limit)

    existing_threads_jobs = (
        db.query(Job)
        .filter(Job.is_active == True, Job.primary_source == "Threads")
        .all()
    )
    by_fingerprint = {j.fingerprint: j for j in existing_threads_jobs if j.fingerprint}
    by_url = {}
    for ex_job in existing_threads_jobs:
        for u in (ex_job.apply_urls or []):
            if u:
                by_url[u] = ex_job

    newly_added: List[Job] = []
    merged_count = 0

    for norm in normalized_items:
        fp = norm.fingerprint or f"threads_{uuid.uuid4().hex[:10]}"
        matched = by_fingerprint.get(fp)
        if not matched:
            for u in norm.apply_urls:
                if u in by_url:
                    matched = by_url[u]
                    break

        if matched:
            merge_job_records(matched, norm.model_dump())
            merged_count += 1
        else:
            new_job = Job(
                id=f"threads_{uuid.uuid4().hex[:12]}",
                title=norm.title,
                company=norm.company,
                location=norm.location,
                remote_type=norm.remote_type,
                category=norm.category,
                is_internship=norm.is_internship,
                description=norm.description,
                apply_urls=norm.apply_urls,
                sources=norm.sources,
                primary_source="Threads",
                posted_date=norm.posted_date or datetime.now(timezone.utc),
                salary_range=norm.salary_range,
                fingerprint=fp,
                is_active=True,
            )
            db.add(new_job)
            db.flush()
            by_fingerprint[fp] = new_job
            for u in norm.apply_urls:
                by_url[u] = new_job
            newly_added.append(new_job)

    db.commit()
    for item in newly_added:
        db.refresh(item)

    THREADS_RADAR_CONFIG["last_scan_at"] = datetime.now(timezone.utc).isoformat()
    THREADS_RADAR_CONFIG["last_scan_report"] = source.last_scan_report

    alert_summary: Optional[Dict[str, Any]] = None
    if send_alerts and newly_added:
        alert_summary = await dispatch_threads_alerts(
            [_serialize_threads_job(j) for j in newly_added],
            webhook_url=THREADS_RADAR_CONFIG["webhook_url"],
            telegram_bot_token=THREADS_RADAR_CONFIG["telegram_bot_token"],
            telegram_chat_id=THREADS_RADAR_CONFIG["telegram_chat_id"],
            send_email_preview=THREADS_RADAR_CONFIG["send_email_alerts"],
            deduplicate=True,
        )

    return {
        "success": True,
        "newly_added": len(newly_added),
        "merged_existing": merged_count,
        "total_scanned_opportunities": len(normalized_items),
        "scan_report": source.last_scan_report,
        "alert_summary": alert_summary,
    }


@router.get("/stats")
def get_threads_stats(db: Session = Depends(get_db)):
    """Returns summary statistics for Threads Opportunity Radar across all 5 sectors."""
    jobs = (
        db.query(Job)
        .filter(Job.is_active == True, Job.primary_source == "Threads")
        .all()
    )
    serialized = [_serialize_threads_job(j) for j in jobs]
    return {
        "total": len(serialized),
        "vertical_counts": {
            "all": len(serialized),
            "project": sum(1 for item in serialized if item["vertical"] == "project"),
            "internship": sum(1 for item in serialized if item["vertical"] == "internship"),
            "tech": sum(1 for item in serialized if item["vertical"] == "tech"),
            "collab": sum(1 for item in serialized if item["vertical"] == "collab"),
            "graphic": sum(1 for item in serialized if item["vertical"] == "graphic"),
        },
        "last_scan_at": THREADS_RADAR_CONFIG.get("last_scan_at"),
        "scan_interval_minutes": THREADS_RADAR_CONFIG.get("scan_interval_minutes"),
    }


@router.get("/opportunities")
async def list_threads_opportunities(
    vertical: str = Query("all", description="all | project | internship | tech | collab | graphic"),
    search: Optional[str] = Query(None),
    auto_seed: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Returns scanned Threads opportunities grouped across Project, Internship, Tech, Collab, and Graphic verticals."""
    jobs = (
        db.query(Job)
        .filter(Job.is_active == True, Job.primary_source == "Threads")
        .order_by(Job.posted_date.desc())
        .all()
    )

    if not jobs:
        try:
            await execute_threads_scan(db, scan_mode="auto", limit=80, send_alerts=False)
            jobs = (
                db.query(Job)
                .filter(Job.is_active == True, Job.primary_source == "Threads")
                .order_by(Job.posted_date.desc())
                .all()
            )
        except Exception as scan_err:
            logger.warning(f"Auto-seed scan notice: {scan_err}")

    serialized = [_serialize_threads_job(j) for j in jobs]

    vertical_counts = {
        "all": len(serialized),
        "project": sum(1 for item in serialized if item["vertical"] == "project"),
        "internship": sum(1 for item in serialized if item["vertical"] == "internship"),
        "tech": sum(1 for item in serialized if item["vertical"] == "tech"),
        "collab": sum(1 for item in serialized if item["vertical"] == "collab"),
        "graphic": sum(1 for item in serialized if item["vertical"] == "graphic"),
    }

    target_v = vertical.strip().lower()
    if target_v != "all":
        serialized = [item for item in serialized if item["vertical"] == target_v]

    if search and search.strip():
        q = search.strip().lower()
        serialized = [
            item for item in serialized
            if q in (item.get("title") or "").lower()
            or q in (item.get("company") or "").lower()
            or q in (item.get("description") or "").lower()
        ]

    return {
        "count": len(serialized),
        "vertical_counts": vertical_counts,
        "opportunities": serialized,
        "scanner_status": _public_config_snapshot(),
    }


@router.post("/scan")
async def scan_threads_opportunities(
    payload: ThreadsScanRequest = Body(default_factory=ThreadsScanRequest),
    db: Session = Depends(get_db),
):
    """Manually triggers the Threads scanner across selected verticals and adapters."""
    valid_modes = {"auto", "meta_api", "apify", "fediverse", "demo"}
    mode = (payload.mode or "auto").lower()
    if mode not in valid_modes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scan mode '{payload.mode}'. Choose one of: {', '.join(sorted(valid_modes))}.",
        )

    return await execute_threads_scan(
        db,
        verticals=payload.verticals,
        custom_keywords=payload.custom_keywords,
        scan_mode=mode,
        limit=payload.limit,
        send_alerts=payload.send_alerts,
    )


@router.post("/parse-url")
async def parse_and_import_threads_url(
    payload: ParseThreadsUrlRequest = Body(...),
    db: Session = Depends(get_db),
):
    """
    Inspects any public Threads post URL (via Meta public oEmbed & OpenGraph tags),
    classifies its vertical (Graphic / Tech / Project), and saves it to the radar.
    """
    clean_url = payload.url.strip()
    if not is_valid_threads_url(clean_url):
        raise HTTPException(
            status_code=400,
            detail="URL must be a valid threads.net or threads.com link.",
        )

    existing_threads = (
        db.query(Job)
        .filter(Job.is_active == True, Job.primary_source == "Threads")
        .all()
    )
    for ex in existing_threads:
        if clean_url in (ex.apply_urls or []):
            return {
                "success": True,
                "action": "already_exists",
                "classification": None,
                "job": _serialize_threads_job(ex),
            }

    parsed = await inspect_threads_url(clean_url)
    norm = parsed["normalized"]

    new_job = Job(
        id=f"threads_{uuid.uuid4().hex[:12]}",
        title=norm.title,
        company=norm.company,
        location=norm.location,
        remote_type=norm.remote_type,
        category=norm.category,
        is_internship=norm.is_internship,
        description=norm.description,
        apply_urls=norm.apply_urls,
        sources=norm.sources,
        primary_source="Threads",
        posted_date=norm.posted_date or datetime.now(timezone.utc),
        salary_range=norm.salary_range,
        fingerprint=norm.fingerprint or f"threads_url_{uuid.uuid4().hex[:8]}",
        is_active=True,
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return {
        "success": True,
        "action": "created",
        "classification": parsed["classification"],
        "job": _serialize_threads_job(new_job),
    }


@router.get("/config")
def get_threads_config():
    """Returns Threads Radar scanner configuration with masked credentials."""
    return _public_config_snapshot()


@router.put("/config")
def update_threads_config(payload: ThreadsConfigUpdateRequest = Body(...)):
    """Updates runtime keywords, enabled verticals, interval, and webhook/token settings."""
    if payload.enabled_verticals is not None:
        valid_vs = [v.lower() for v in payload.enabled_verticals if v.lower() in ALLOWED_VERTICALS]
        if not valid_vs:
            raise HTTPException(status_code=400, detail="Select at least one vertical: graphic, tech, or project.")
        THREADS_RADAR_CONFIG["enabled_verticals"] = valid_vs

    if payload.keywords is not None:
        for k, vals in payload.keywords.items():
            if k.lower() in ALLOWED_VERTICALS and isinstance(vals, list):
                cleaned = [str(x).strip() for x in vals if str(x).strip()]
                if cleaned:
                    THREADS_RADAR_CONFIG["keywords"][k.lower()] = cleaned

    if payload.scan_interval_minutes is not None:
        THREADS_RADAR_CONFIG["scan_interval_minutes"] = payload.scan_interval_minutes
    if payload.auto_demo_fallback is not None:
        THREADS_RADAR_CONFIG["auto_demo_fallback"] = payload.auto_demo_fallback
    if payload.send_email_alerts is not None:
        THREADS_RADAR_CONFIG["send_email_alerts"] = payload.send_email_alerts

    for field_name in (
        "access_token",
        "apify_token",
        "apify_actor_id",
        "webhook_url",
        "telegram_bot_token",
        "telegram_chat_id",
    ):
        val = getattr(payload, field_name)
        if val is not None:
            THREADS_RADAR_CONFIG[field_name] = val.strip()

    return {"success": True, "config": _public_config_snapshot()}


@router.post("/test-alert")
async def trigger_test_threads_alert(db: Session = Depends(get_db)):
    """Sends a test Threads Radar alert across configured webhook, Telegram, and email channels."""
    latest_job = (
        db.query(Job)
        .filter(Job.is_active == True, Job.primary_source == "Threads")
        .order_by(Job.posted_date.desc())
        .first()
    )
    sample_payload = (
        _serialize_threads_job(latest_job)
        if latest_job
        else {
            "id": "threads_test_alert",
            "title": "[GRAPHIC] SaaS Brand & Pitch Deck Designer Needed",
            "company": "@lumina_brand_studio (Threads)",
            "category": VERTICAL_LABELS["graphic"],
            "salary_range": "$1,500 - $2,500",
            "description": "Test alert from InternScrap Threads Opportunity Radar.",
            "apply_urls": ["https://www.threads.net/"],
            "fingerprint": "threads_test_alert",
        }
    )

    delivery = await dispatch_threads_alerts(
        [sample_payload],
        webhook_url=THREADS_RADAR_CONFIG["webhook_url"],
        telegram_bot_token=THREADS_RADAR_CONFIG["telegram_bot_token"],
        telegram_chat_id=THREADS_RADAR_CONFIG["telegram_chat_id"],
        send_email_preview=THREADS_RADAR_CONFIG["send_email_alerts"],
        deduplicate=False,
    )
    return {"success": True, "delivery": delivery}
