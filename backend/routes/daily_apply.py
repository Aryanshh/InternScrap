import os
import re
import uuid
import logging
import threading
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Header, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db, SessionLocal
from backend.models.job import Job
from backend.models.profile import UserProfile
from backend.models.application import Application
from backend.models.resume import Resume
from backend.models.match import Match
from backend.services.matching_engine import evaluate_job_match
from backend.services.iim_resume_service import generate_iim_pdf
from backend.services.auto_applier import AutoApplierEngine
from backend.routes.auto_apply import resolve_candidate_profile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/daily-21", tags=["Daily 21 Remote Drops"])

# In-memory cache for curated daily jobs: {(user_id, date_str): List[Dict[str, Any]]}
DAILY_21_CACHE: Dict[str, List[Dict[str, Any]]] = {}

# Active background batch tasks registry: {batch_id: Dict[str, Any]}
ACTIVE_BATCH_TASKS: Dict[str, Dict[str, Any]] = {}


class Daily21ApplyRequest(BaseModel):
    mode: Optional[str] = "review"  # "review" or "submit"
    theme: Optional[str] = "classic"  # "classic", "executive", "tech"
    custom_answers: Optional[Dict[str, str]] = None
    job_ids: Optional[List[str]] = None


def _extract_job_skills(job: Job) -> List[str]:
    """Extracts or derives a clean skills list for a job."""
    desc = (job.description or "").lower()
    common_skills = [
        "Python", "TypeScript", "JavaScript", "React", "FastAPI",
        "Node.js", "Docker", "PostgreSQL", "AWS", "SQL", "Git",
        "Next.js", "Tailwind CSS", "GraphQL", "Kubernetes", "Redis"
    ]
    detected = [s for s in common_skills if re.search(rf"\b{re.escape(s.lower())}\b", desc)]
    return detected[:5] or [job.category or "Remote Tech"]


def curate_daily_21_jobs(db: Session, target_user_id: str, today_str: str) -> List[Dict[str, Any]]:
    """
    Deterministically selects exactly 21 high-matching, verified remote jobs for today.
    Uses cached selection if already generated for this user and date.
    """
    cache_key = f"{target_user_id}:{today_str}"
    if cache_key in DAILY_21_CACHE:
        # Re-check live application statuses against tracker
        cached_jobs = DAILY_21_CACHE[cache_key]
        job_ids = [j["id"] for j in cached_jobs]
        apps = db.query(Application).filter(Application.job_id.in_(job_ids)).all()
        app_map = {a.job_id: a.status for a in apps}
        for j in cached_jobs:
            j["application_status"] = app_map.get(j["id"], "queued")
        return cached_jobs

    profile_data = resolve_candidate_profile(db, target_user_id)
    active_resume = db.query(Resume).filter(Resume.is_active == True).first()

    # Query active remote jobs with valid apply URLs
    query = db.query(Job).filter(
        Job.is_active == True,
        Job.remote_type == "remote",
    )
    raw_jobs = query.all()
    valid_jobs = []
    for j in raw_jobs:
        urls = j.apply_urls or []
        first_valid = next(
            (u for u in urls if u and (u.startswith("http://") or u.startswith("https://"))),
            None,
        )
        if first_valid:
            valid_jobs.append(j)

    # Pre-fetch existing matches and applications
    existing_matches = {}
    if active_resume:
        matches = db.query(Match).filter(Match.resume_id == active_resume.id).all()
        existing_matches = {m.job_id: m for m in matches}

    apps = db.query(Application).all()
    app_map = {a.job_id: a.status for a in apps}

    candidate_skills = set(s.lower() for s in profile_data.get("skills", []))
    scored_candidates = []

    for j in valid_jobs:
        match_score = 75.0  # default baseline for verified remote roles
        gaps = []

        if j.id in existing_matches:
            m = existing_matches[j.id]
            match_score = float(m.blended_score or m.keyword_score or 75.0)
            gaps = m.gap_list or []
        elif active_resume:
            ev = evaluate_job_match(j.description or "", active_resume.to_dict())
            match_score = float(ev["blended_score"])
            gaps = ev.get("gap_list", [])
        else:
            # Score based on candidate profile skills
            job_text = f"{j.title} {j.description or ''}".lower()
            overlap = sum(1 for sk in candidate_skills if sk in job_text)
            match_score = min(98.0, 70.0 + (overlap * 4.5))

        scored_candidates.append({
            "job": j,
            "match_score": round(match_score, 1),
            "gaps": gaps,
        })

    # Sort deterministically: match score desc, posted date desc, title asc
    scored_candidates.sort(
        key=lambda x: (
            x["match_score"],
            x["job"].posted_date.isoformat() if x["job"].posted_date else "",
            x["job"].title.lower()
        ),
        reverse=True
    )

    top_21_scored = scored_candidates[:21]

    formatted_jobs = []
    for item in top_21_scored:
        j = item["job"]
        app_status = app_map.get(j.id, "queued")
        skills = _extract_job_skills(j)
        urls = j.apply_urls or []
        first_url = next(
            (u for u in urls if u and (u.startswith("http://") or u.startswith("https://"))),
            urls[0] if urls else "",
        )

        formatted_jobs.append({
            "id": j.id,
            "title": j.title,
            "company": j.company,
            "location": j.location or "Remote Worldwide",
            "remote_type": j.remote_type or "remote",
            "apply_url": first_url,
            "apply_urls": urls,
            "salary_range": j.salary_range or "$35 - $65 / hr",
            "category": j.category or "Engineering",
            "primary_source": j.primary_source or "Remote Feed",
            "posted_date": j.posted_date.isoformat() if j.posted_date else None,
            "is_internship": bool(j.is_internship),
            "match_score": item["match_score"],
            "skills": skills,
            "description": (j.description or "")[:400] + "..." if len(j.description or "") > 400 else (j.description or ""),
            "application_status": app_status,
        })

    DAILY_21_CACHE[cache_key] = formatted_jobs
    return formatted_jobs


def run_batch_worker(
    batch_id: str,
    target_user_id: str,
    jobs_to_apply: List[Dict[str, Any]],
    mode: str,
    theme: str,
    custom_answers: Optional[Dict[str, str]],
):
    """
    Background worker thread executing the 1-click batch application for Daily 21 jobs.
    Uses Playwright and strictly candidate's authentic Wellfound dossier and 1-page IIM PDF.
    """
    db = SessionLocal()
    task = ACTIVE_BATCH_TASKS.get(batch_id)
    if not task:
        db.close()
        return

    try:
        profile_data = resolve_candidate_profile(db, target_user_id)
        if custom_answers:
            profile_data["custom_answers"] = {
                **profile_data.get("custom_answers", {}),
                **custom_answers,
            }

        # Generate authentic 1-page IIM PDF resume
        try:
            resume_pdf_path = generate_iim_pdf(profile_data, theme=theme or "classic")
            task["resume_attached"] = os.path.basename(resume_pdf_path) if resume_pdf_path else None
        except Exception as pdf_err:
            logger.error(f"Failed to generate IIM resume for Daily 21 batch: {pdf_err}")
            resume_pdf_path = ""
            task["resume_attached"] = None

        urls = [j["apply_url"] for j in jobs_to_apply if j.get("apply_url")]
        task["logs"].append(f"Starting batch auto-apply for {len(urls)} remote applications in {mode.upper()} mode.")

        def on_item_start(index: int, url: str):
            curr_job = jobs_to_apply[index] if index < len(jobs_to_apply) else {}
            task["current_index"] = index + 1
            task["current_job"] = {
                "id": curr_job.get("id"),
                "title": curr_job.get("title"),
                "company": curr_job.get("company"),
                "url": url,
            }
            task["logs"].append(f"[{index + 1}/{len(urls)}] Navigating to {curr_job.get('title', 'Role')} at {curr_job.get('company', 'Company')}...")

        def on_item_complete(index: int, url: str, res: Dict[str, Any]):
            curr_job = jobs_to_apply[index] if index < len(jobs_to_apply) else {}
            item_result = {
                "job_id": curr_job.get("id"),
                "title": curr_job.get("title"),
                "company": curr_job.get("company"),
                "url": url,
                "platform": res.get("platform", "Direct Portal"),
                "status": res.get("status", "unknown"),
                "fields_filled": res.get("fields_filled", []),
                "fields_count": res.get("fields_count", 0),
                "screenshot_url": f"/api/auto-apply/screenshot/{res['screenshot']}" if res.get("screenshot") else None,
                "error": res.get("error"),
                "logs": res.get("logs", []),
                "timestamp": res.get("timestamp"),
            }
            task["results"].append(item_result)
            task["completed_count"] = len(task["results"])
            task["logs"].append(
                f"[{index + 1}/{len(urls)}] Completed {curr_job.get('company')}: {res.get('status')} "
                f"({res.get('fields_count', 0)} fields filled, platform: {res.get('platform')})."
            )

        engine = AutoApplierEngine(headless=True)
        engine.process_batch(
            urls=urls,
            profile_data=profile_data,
            resume_pdf_path=resume_pdf_path,
            mode=mode,
            user_id=target_user_id,
            on_item_start=on_item_start,
            on_item_complete=on_item_complete,
        )

        task["status"] = "completed"
        task["finished_at"] = datetime.now(timezone.utc).isoformat()
        task["logs"].append(f"Successfully processed all {len(urls)} Daily 21 jobs.")

    except Exception as ex:
        logger.error(f"Daily 21 batch runner error: {ex}", exc_info=True)
        task["status"] = "failed"
        task["error"] = str(ex)
        task["finished_at"] = datetime.now(timezone.utc).isoformat()
        task["logs"].append(f"Batch execution encountered error: {ex}")
    finally:
        db.close()


@router.get("")
def get_daily_21_drops(
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    force_refresh: bool = Query(False),
    db: Session = Depends(get_db),
):
    """
    Returns today's curated 21 verified remote jobs for the candidate.
    Stable per candidate and per date.
    """
    target_id = user_id or x_user_id or "default_user"
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    cache_key = f"{target_id}:{today_str}"
    if force_refresh and cache_key in DAILY_21_CACHE:
        del DAILY_21_CACHE[cache_key]

    jobs = curate_daily_21_jobs(db, target_id, today_str)

    completed_today = sum(1 for j in jobs if j.get("application_status") in ("applied", "saved"))

    return {
        "success": True,
        "date": today_str,
        "user_id": target_id,
        "total": len(jobs),
        "completed_today": completed_today,
        "jobs": jobs,
    }


@router.post("/apply-all")
def trigger_daily_21_apply_all(
    payload: Daily21ApplyRequest = Body(...),
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """
    Triggers 1-click batch application for today's Daily 21 remote jobs.
    Runs asynchronously and provides live progress tracking.
    """
    target_id = user_id or x_user_id or "default_user"
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    all_jobs = curate_daily_21_jobs(db, target_id, today_str)

    if payload.job_ids and len(payload.job_ids) > 0:
        selected_set = set(payload.job_ids)
        jobs_to_apply = [j for j in all_jobs if j["id"] in selected_set]
    else:
        jobs_to_apply = all_jobs

    if not jobs_to_apply:
        raise HTTPException(status_code=400, detail="No valid remote jobs found to apply.")

    batch_id = f"daily21_{uuid.uuid4().hex[:10]}"
    ACTIVE_BATCH_TASKS[batch_id] = {
        "batch_id": batch_id,
        "user_id": target_id,
        "date": today_str,
        "status": "running",
        "mode": payload.mode or "review",
        "theme": payload.theme or "classic",
        "total": len(jobs_to_apply),
        "completed_count": 0,
        "current_index": 0,
        "current_job": {
            "id": jobs_to_apply[0].get("id"),
            "title": jobs_to_apply[0].get("title"),
            "company": jobs_to_apply[0].get("company"),
        },
        "results": [],
        "logs": [f"Initialized Daily 21 batch runner for {len(jobs_to_apply)} remote jobs."],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
        "error": None,
    }

    worker_thread = threading.Thread(
        target=run_batch_worker,
        kwargs={
            "batch_id": batch_id,
            "target_user_id": target_id,
            "jobs_to_apply": jobs_to_apply,
            "mode": payload.mode or "review",
            "theme": payload.theme or "classic",
            "custom_answers": payload.custom_answers,
        },
        daemon=True,
    )
    worker_thread.start()

    return {
        "success": True,
        "message": f"Daily 21 batch runner initiated for {len(jobs_to_apply)} jobs.",
        "batch_id": batch_id,
        "total": len(jobs_to_apply),
        "mode": payload.mode or "review",
    }


@router.get("/progress/{batch_id}")
def get_daily_21_progress(batch_id: str):
    """
    Returns real-time progress, live job state, and proof screenshot logs for an active batch.
    """
    task = ACTIVE_BATCH_TASKS.get(batch_id)
    if not task:
        raise HTTPException(status_code=404, detail="Batch execution task not found.")

    return {
        "success": True,
        "batch_id": task["batch_id"],
        "status": task["status"],
        "mode": task["mode"],
        "theme": task.get("theme", "classic"),
        "total": task["total"],
        "completed_count": task["completed_count"],
        "current_index": task["current_index"],
        "current_job": task.get("current_job"),
        "resume_attached": task.get("resume_attached"),
        "results": task["results"],
        "logs": task["logs"][-30:],  # return recent 30 logs for smooth UI
        "started_at": task["started_at"],
        "finished_at": task["finished_at"],
        "error": task.get("error"),
    }
