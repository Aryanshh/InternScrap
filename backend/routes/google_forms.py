import os
import re
import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Header, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db, SessionLocal
from backend.models.job import Job
from backend.models.profile import UserProfile
from backend.models.application import Application
from backend.services.google_form_registrant import GoogleFormRegistrant
from backend.services.ingestion.google_forms_finder import (
    GoogleFormsJobSource,
    parse_google_form_metadata,
)
from backend.routes.auto_apply import resolve_candidate_profile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/google-forms", tags=["Google Forms Scraper & Registrant"])


class ParseUrlRequest(BaseModel):
    url: str


class RegisterFormRequest(BaseModel):
    url: str
    mode: Optional[str] = "review"  # "review" or "submit"
    user_id: Optional[str] = None
    custom_answers: Optional[Dict[str, str]] = None


class BatchRegisterRequest(BaseModel):
    urls: List[str]
    mode: Optional[str] = "review"
    user_id: Optional[str] = None
    custom_answers: Optional[Dict[str, str]] = None


@router.get("/jobs")
async def list_google_form_jobs(
    db: Session = Depends(get_db),
    auto_seed: bool = Query(True),
):
    """
    Returns active job and internship postings that use Google Forms for application.
    Auto-seeds from GoogleFormsJobSource if none exist yet.
    """
    # Query jobs where source is Google Forms or apply_urls contain google form pattern
    jobs = db.query(Job).filter(Job.is_active == True).all()
    gform_jobs = [
        j for j in jobs
        if j.primary_source == "Google Forms"
        or any("docs.google.com/forms" in (u or "") or "forms.gle" in (u or "") for u in (j.apply_urls or []))
    ]

    # If no Google Form jobs found and auto_seed is True, run the finder to seed
    if not gform_jobs and auto_seed:
        source = GoogleFormsJobSource()
        discovered = await source.fetch_jobs(limit=20)
        for d in discovered:
            job_id = f"gform_{uuid.uuid4().hex[:12]}"
            new_job = Job(
                id=job_id,
                title=d.title,
                company=d.company,
                location=d.location,
                remote_type=d.remote_type,
                category=d.category,
                is_internship=d.is_internship,
                description=d.description,
                apply_urls=d.apply_urls,
                sources=d.sources,
                primary_source="Google Forms",
                salary_range=d.salary_range,
                fingerprint=d.fingerprint or f"fp_{uuid.uuid4().hex[:8]}",
            )
            db.add(new_job)
            gform_jobs.append(new_job)
        db.commit()

    return {
        "count": len(gform_jobs),
        "jobs": [j.to_dict() for j in gform_jobs],
    }


@router.post("/scrape")
async def trigger_google_forms_scrape(db: Session = Depends(get_db)):
    """
    Scrapes community feeds (Reddit, startup networks) for newly posted Google Forms.
    """
    source = GoogleFormsJobSource()
    discovered = await source.fetch_jobs(limit=25)
    added_count = 0

    for d in discovered:
        # Check if already in DB by apply_urls
        first_url = d.apply_urls[0] if d.apply_urls else ""
        existing = db.query(Job).filter(Job.apply_urls.contains([first_url])).first()
        if not existing:
            job_id = f"gform_{uuid.uuid4().hex[:12]}"
            new_job = Job(
                id=job_id,
                title=d.title,
                company=d.company,
                location=d.location,
                remote_type=d.remote_type,
                category=d.category,
                is_internship=d.is_internship,
                description=d.description,
                apply_urls=d.apply_urls,
                sources=d.sources,
                primary_source="Google Forms",
                salary_range=d.salary_range,
                fingerprint=d.fingerprint or f"fp_{uuid.uuid4().hex[:8]}",
            )
            db.add(new_job)
            added_count += 1

    db.commit()
    return {
        "success": True,
        "newly_added": added_count,
        "total_scraped": len(discovered),
    }


@router.post("/parse-url")
async def parse_and_add_google_form(
    payload: ParseUrlRequest = Body(...),
    db: Session = Depends(get_db),
):
    """
    Inspects any live Google Form link, parses title & company, and creates a Job record.
    """
    url = payload.url.strip()
    if not ("docs.google.com/forms" in url or "forms.gle" in url):
        raise HTTPException(status_code=400, detail="URL must be a valid Google Form link (docs.google.com/forms or forms.gle).")

    parsed = await parse_google_form_metadata(url)
    existing = db.query(Job).filter(Job.apply_urls.contains([url])).first()

    if existing:
        return {"success": True, "action": "already_exists", "job": existing.to_dict()}

    job_id = f"gform_{uuid.uuid4().hex[:12]}"
    new_job = Job(
        id=job_id,
        title=parsed["title"],
        company=parsed["company"],
        location=parsed["location"],
        remote_type=parsed["remote_type"],
        category=parsed["category"],
        is_internship=parsed["is_internship"],
        description=parsed["description"],
        apply_urls=[url],
        sources=["Google Forms"],
        primary_source="Google Forms",
        salary_range=parsed["salary_range"],
        fingerprint=f"gform_parsed_{uuid.uuid4().hex[:8]}",
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return {"success": True, "action": "created", "job": new_job.to_dict()}


@router.post("/register")
def register_on_google_form(
    payload: RegisterFormRequest = Body(...),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """
    Executes automated registration on a Google Form on the candidate's behalf
    using their authentic Wellfound dossier and 1-page IIM resume.
    """
    url = payload.url.strip()
    if not ("docs.google.com/forms" in url or "forms.gle" in url):
        raise HTTPException(status_code=400, detail="Invalid Google Form link.")

    target_user_id = payload.user_id or x_user_id or "default_user"
    profile_data = resolve_candidate_profile(db, target_user_id)

    if payload.custom_answers:
        profile_data["custom_answers"] = {
            **profile_data.get("custom_answers", {}),
            **payload.custom_answers,
        }

    registrant = GoogleFormRegistrant(headless=True)
    result = registrant.register(
        url=url,
        profile_data=profile_data,
        mode=payload.mode or "review",
    )

    return {
        "success": True,
        "result": result,
    }


@router.post("/register-batch")
def register_batch_google_forms(
    payload: BatchRegisterRequest = Body(...),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """
    Sequentially processes a list of Google Form links on candidate's behalf.
    """
    if not payload.urls:
        raise HTTPException(status_code=400, detail="No Google Form URLs provided.")

    target_user_id = payload.user_id or x_user_id or "default_user"
    profile_data = resolve_candidate_profile(db, target_user_id)

    if payload.custom_answers:
        profile_data["custom_answers"] = {
            **profile_data.get("custom_answers", {}),
            **payload.custom_answers,
        }

    registrant = GoogleFormRegistrant(headless=True)
    results = []

    for url in payload.urls:
        clean_url = url.strip()
        if not ("docs.google.com/forms" in clean_url or "forms.gle" in clean_url):
            continue
        res = registrant.register(
            url=clean_url,
            profile_data=profile_data,
            mode=payload.mode or "review",
        )
        results.append(res)

    return {
        "success": True,
        "total_requested": len(payload.urls),
        "total_processed": len(results),
        "results": results,
    }
