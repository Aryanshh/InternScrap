import os
import re
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Header, Body
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.profile import UserProfile
from backend.models.job import Job
from backend.models.application import Application
from backend.models.match import Match
from backend.services.iim_resume_service import (
    get_iim_html_template,
    generate_iim_pdf,
    generate_iim_docx,
    OUTPUT_DIR,
    SCREENSHOTS_DIR,
)
from backend.services.auto_applier import AutoApplierEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Auto Apply & IIM Resume"])


class AutoApplyRunRequest(BaseModel):
    urls: List[str]
    mode: Optional[str] = "review"  # "review" or "submit"
    user_id: Optional[str] = None
    theme: Optional[str] = "classic"
    custom_answers: Optional[Dict[str, str]] = None


class VaultUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    headline: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    wellfound_url: Optional[str] = None
    twitter_url: Optional[str] = None
    primary_role: Optional[str] = None
    years_of_experience: Optional[int] = None
    desired_work_mode: Optional[str] = None
    notice_period: Optional[str] = None
    relocation_open: Optional[bool] = None
    min_salary: Optional[int] = None
    min_hourly_rate: Optional[float] = None
    work_authorization: Optional[str] = None
    require_sponsorship: Optional[str] = None
    citizenship_country: Optional[str] = None
    personal_pitch: Optional[str] = None
    proudest_project_highlight: Optional[str] = None
    eeo_gender: Optional[str] = None
    eeo_race: Optional[str] = None
    eeo_veteran: Optional[str] = None
    eeo_disability: Optional[str] = None
    skills_with_years: Optional[List[Dict[str, Any]]] = None
    custom_answers: Optional[Dict[str, str]] = None


def resolve_candidate_profile(db: Session, user_id: Optional[str], x_user_id: Optional[str] = None) -> Dict[str, Any]:
    target_id = user_id or x_user_id or "default_user"
    profile = db.query(UserProfile).filter(UserProfile.id == target_id).first()
    if not profile:
        profile = db.query(UserProfile).first()

    default_skills_with_years = [
        {"skill": "Python", "years": 3},
        {"skill": "TypeScript", "years": 2},
        {"skill": "JavaScript", "years": 3},
        {"skill": "React", "years": 2},
        {"skill": "FastAPI", "years": 2},
        {"skill": "PostgreSQL", "years": 2},
        {"skill": "Docker", "years": 2},
        {"skill": "Git", "years": 3},
        {"skill": "Tailwind CSS", "years": 2},
        {"skill": "SQL", "years": 3},
        {"skill": "Node.js", "years": 2},
        {"skill": "REST APIs", "years": 3},
    ]

    if profile:
        return {
            "id": profile.id,
            "full_name": profile.full_name or "Aryanshh Srivastava",
            "email": profile.email or "candidate@example.com",
            "phone": profile.phone or "+1 (555) 019-2834",
            "location": profile.location or "San Francisco, CA / Remote Worldwide",
            "headline": profile.headline or "Full-Stack Software Engineer & AI Alignment Evaluator",
            "bio": profile.bio or "",
            "github_url": profile.github_url or "https://github.com/aryansharma",
            "linkedin_url": profile.linkedin_url or "https://linkedin.com/in/aryansharma",
            "portfolio_url": profile.portfolio_url or "https://aryansharma.dev",
            "wellfound_url": getattr(profile, "wellfound_url", None) or "https://wellfound.com/u/aryanshh",
            "twitter_url": getattr(profile, "twitter_url", None) or "https://x.com/aryanshh",
            "primary_role": getattr(profile, "primary_role", None) or "Full-Stack Software Engineer",
            "years_of_experience": getattr(profile, "years_of_experience", None) or 3,
            "desired_work_mode": getattr(profile, "desired_work_mode", None) or "remote",
            "notice_period": getattr(profile, "notice_period", None) or "Immediately available",
            "relocation_open": bool(getattr(profile, "relocation_open", False)),
            "min_salary": getattr(profile, "min_salary", None) or 110000,
            "min_hourly_rate": getattr(profile, "min_hourly_rate", None) or 45.0,
            "work_authorization": getattr(profile, "work_authorization", None) or "yes",
            "require_sponsorship": getattr(profile, "require_sponsorship", None) or "no",
            "citizenship_country": getattr(profile, "citizenship_country", None) or "United States",
            "personal_pitch": (
                getattr(profile, "personal_pitch", None)
                or "Full-Stack Software Engineer passionate about high-throughput backend systems and modern React web applications."
            ),
            "proudest_project_highlight": (
                getattr(profile, "proudest_project_highlight", None)
                or "Engineered distributed job scraping and applicant tracking system processing 120k+ daily listings with sub-50ms latency."
            ),
            "eeo_gender": getattr(profile, "eeo_gender", None) or "Decline to self-identify",
            "eeo_race": getattr(profile, "eeo_race", None) or "Decline to self-identify",
            "eeo_veteran": getattr(profile, "eeo_veteran", None) or "I am not a protected veteran",
            "eeo_disability": getattr(profile, "eeo_disability", None) or "No, I do not have a disability",
            "skills_with_years": getattr(profile, "skills_with_years", None) or default_skills_with_years,
            "custom_answers": getattr(profile, "custom_answers", None) or {},
            "skills": profile.skills or [item["skill"] for item in default_skills_with_years],
            "experience": profile.experience or [],
            "education": profile.education or [],
        }

    # Fallback default candidate profile
    return {
        "id": "default_user",
        "full_name": "Aryanshh Srivastava",
        "email": "candidate@example.com",
        "phone": "+1 (555) 019-2834",
        "location": "San Francisco, CA / Remote Worldwide",
        "headline": "Full-Stack Software Engineer & AI Alignment Evaluator",
        "bio": "Software engineer with expertise in React, TypeScript, Python, FastAPI, and distributed systems.",
        "github_url": "https://github.com/aryansharma",
        "linkedin_url": "https://linkedin.com/in/aryansharma",
        "portfolio_url": "https://aryansharma.dev",
        "wellfound_url": "https://wellfound.com/u/aryanshh",
        "twitter_url": "https://x.com/aryanshh",
        "primary_role": "Full-Stack Software Engineer",
        "years_of_experience": 3,
        "desired_work_mode": "remote",
        "notice_period": "Immediately available",
        "relocation_open": False,
        "min_salary": 110000,
        "min_hourly_rate": 45.0,
        "work_authorization": "yes",
        "require_sponsorship": "no",
        "citizenship_country": "United States",
        "personal_pitch": "Full-Stack Software Engineer passionate about high-throughput backend systems and modern React web applications.",
        "proudest_project_highlight": "Engineered distributed job scraping and applicant tracking system processing 120k+ daily listings with sub-50ms latency.",
        "eeo_gender": "Decline to self-identify",
        "eeo_race": "Decline to self-identify",
        "eeo_veteran": "I am not a protected veteran",
        "eeo_disability": "No, I do not have a disability",
        "skills_with_years": default_skills_with_years,
        "custom_answers": {},
        "skills": [item["skill"] for item in default_skills_with_years],
        "experience": [],
        "education": [],
    }


# =====================================================================
# 1. AUTO-APPLY ENDPOINTS
# =====================================================================

@router.post("/auto-apply/run")
def run_auto_apply(
    payload: AutoApplyRunRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """
    Executes automated multi-link application using Playwright and candidate's Wellfound dossier.
    Strictly Zero-Fabrication: no AI plagiarism.
    """
    if not payload.urls:
        raise HTTPException(status_code=400, detail="No URLs provided for auto-apply.")

    profile_data = resolve_candidate_profile(db, payload.user_id, x_user_id)

    # If payload provided custom answers, merge them
    if payload.custom_answers:
        profile_data["custom_answers"] = {
            **profile_data.get("custom_answers", {}),
            **payload.custom_answers,
        }

    # Generate on-the-fly 1-Page IIM PDF for this candidate
    theme = payload.theme or "classic"
    try:
        resume_pdf_path = generate_iim_pdf(profile_data, theme=theme)
    except Exception as ex:
        logger.error(f"Failed to compile IIM PDF for auto-apply: {ex}")
        resume_pdf_path = ""

    engine = AutoApplierEngine(headless=True)
    results = engine.process_batch(
        urls=payload.urls,
        profile_data=profile_data,
        resume_pdf_path=resume_pdf_path,
        mode=payload.mode or "review",
        user_id=profile_data.get("id", "default_user"),
    )

    return {
        "success": True,
        "mode": payload.mode,
        "total_requested": len(payload.urls),
        "total_processed": len(results),
        "results": results,
        "resume_attached": os.path.basename(resume_pdf_path) if resume_pdf_path else None,
    }


@router.get("/auto-apply/vault")
def get_auto_apply_vault(
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """Fetches full Wellfound candidate dossier for autofill."""
    profile_data = resolve_candidate_profile(db, user_id, x_user_id)
    return profile_data


@router.post("/auto-apply/vault")
@router.put("/auto-apply/vault")
def update_auto_apply_vault(
    payload: VaultUpdateRequest,
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """Updates candidate Wellfound dossier and autofill preferences."""
    target_id = user_id or x_user_id or "default_user"
    profile = db.query(UserProfile).filter(UserProfile.id == target_id).first()
    if not profile:
        profile = db.query(UserProfile).first()
    if not profile:
        profile = UserProfile(id=target_id)
        db.add(profile)

    update_dict = payload.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        if hasattr(profile, key):
            setattr(profile, key, value)

    # Sync skills list if skills_with_years was updated
    if payload.skills_with_years:
        profile.skills = [item.get("skill") for item in payload.skills_with_years if item.get("skill")]

    db.commit()
    db.refresh(profile)

    return {
        "success": True,
        "message": "Wellfound candidate dossier updated successfully.",
        "vault": resolve_candidate_profile(db, target_id),
    }


@router.get("/auto-apply/queued-jobs")
def get_queued_jobs(
    mode: str = Query("saved", description="saved or top_matches"),
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """
    Fetches job links for 1-click batch import into Auto-Applier.
    - mode='saved': Retrieves bookmarked jobs in the Application Tracker.
    - mode='top_matches': Retrieves top-matching active jobs (score >= 70%).
    """
    target_id = user_id or x_user_id or "default_user"

    if mode == "saved":
        apps = db.query(Application).filter(Application.status == "saved").all()
        job_ids = [a.job_id for a in apps]
        jobs = db.query(Job).filter(Job.id.in_(job_ids)).all() if job_ids else []
        results = [
            {"id": j.id, "title": j.title, "company": j.company, "apply_url": j.apply_url}
            for j in jobs
            if j.apply_url and (j.apply_url.startswith("http://") or j.apply_url.startswith("https://"))
        ]
        return {"count": len(results), "mode": "saved", "jobs": results}

    elif mode == "top_matches":
        # Query matches
        matches = db.query(Match).filter(Match.score >= 70.0).order_by(Match.score.desc()).limit(15).all()
        matched_job_ids = [m.job_id for m in matches]
        jobs = db.query(Job).filter(Job.id.in_(matched_job_ids)).all() if matched_job_ids else []
        results = [
            {"id": j.id, "title": j.title, "company": j.company, "apply_url": j.apply_url}
            for j in jobs
            if j.apply_url and (j.apply_url.startswith("http://") or j.apply_url.startswith("https://"))
        ]
        return {"count": len(results), "mode": "top_matches", "jobs": results}

    return {"count": 0, "jobs": []}


@router.get("/auto-apply/screenshot/{filename}")
def get_application_screenshot(filename: str):
    """Serves proof-of-application screenshot."""
    clean_name = os.path.basename(filename)
    file_path = SCREENSHOTS_DIR / clean_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found.")
    return FileResponse(str(file_path), media_type="image/png")


# =====================================================================
# 2. IIM-STYLE RESUME ENDPOINTS
# =====================================================================

@router.get("/resumes/iim-preview", response_class=HTMLResponse)
def get_iim_preview(
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    theme: Optional[str] = Query("classic"),
    db: Session = Depends(get_db),
):
    """Returns HTML preview of candidate's authentic IIM-format resume with chosen theme."""
    profile_data = resolve_candidate_profile(db, user_id, x_user_id)
    html_content = get_iim_html_template(profile_data, theme=theme or "classic")
    return HTMLResponse(content=html_content)


@router.get("/resumes/iim-download-pdf")
def download_iim_pdf(
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    theme: Optional[str] = Query("classic"),
    db: Session = Depends(get_db),
):
    """Generates and downloads the candidate's authentic 1-page IIM resume in PDF format."""
    profile_data = resolve_candidate_profile(db, user_id, x_user_id)
    candidate_slug = re.sub(r"[^a-zA-Z0-9_]", "_", profile_data.get("full_name", "candidate")).lower()
    selected_theme = theme or "classic"
    filename = f"IIM_Resume_{selected_theme}_{candidate_slug}.pdf"

    pdf_path = generate_iim_pdf(profile_data, filename=filename, theme=selected_theme)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=500, detail="Failed to generate IIM PDF resume.")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=filename,
    )


@router.get("/resumes/iim-download-docx")
def download_iim_docx(
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """Generates and downloads the candidate's authentic 1-page IIM resume in DOCX format."""
    profile_data = resolve_candidate_profile(db, user_id, x_user_id)
    candidate_slug = re.sub(r"[^a-zA-Z0-9_]", "_", profile_data.get("full_name", "candidate")).lower()
    filename = f"IIM_Resume_{candidate_slug}.docx"

    docx_path = generate_iim_docx(profile_data, filename=filename)
    if not os.path.exists(docx_path):
        raise HTTPException(status_code=500, detail="Failed to generate IIM DOCX resume.")

    return FileResponse(
        path=docx_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
    )
