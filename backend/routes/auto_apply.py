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
    desired_salary: Optional[int] = None
    notice_period: Optional[str] = None
    authorized_to_work: Optional[bool] = None
    require_sponsorship: Optional[bool] = None
    answers: Optional[Dict[str, str]] = None


def resolve_candidate_profile(db: Session, user_id: Optional[str], x_user_id: Optional[str] = None) -> Dict[str, Any]:
    target_id = user_id or x_user_id or "default_user"
    profile = db.query(UserProfile).filter(UserProfile.id == target_id).first()
    if not profile:
        profile = db.query(UserProfile).first()
    
    if profile:
        return {
            "id": profile.id,
            "full_name": profile.full_name or "Aryanshh Srivastava",
            "email": profile.email or "candidate@example.com",
            "phone": profile.phone or "+1 (555) 019-2834",
            "location": profile.location or "San Francisco, CA / Remote Worldwide",
            "headline": profile.headline or "Full-Stack Software Engineer & AI Alignment Evaluator",
            "bio": profile.bio or "",
            "github_url": profile.github_url or "",
            "linkedin_url": profile.linkedin_url or "",
            "portfolio_url": profile.portfolio_url or "",
            "skills": profile.skills or [],
            "experience": profile.experience or [],
            "education": profile.education or [],
            "min_salary": profile.min_salary or 110000,
            "desired_work_mode": profile.desired_work_mode or "remote",
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
        "skills": ["Python", "TypeScript", "JavaScript", "React", "FastAPI", "PostgreSQL", "Docker", "Git"],
        "experience": [],
        "education": [],
        "min_salary": 110000,
    }


# =====================================================================
# 1. AUTO-APPLY ENDPOINTS
# =====================================================================

@router.post("/auto-apply/run")
def run_auto_apply(
    payload: AutoApplyRunRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    """
    Executes automated multi-link application using Playwright and candidate's IIM resume.
    """
    if not payload.urls:
        raise HTTPException(status_code=400, detail="No URLs provided for auto-apply.")

    profile_data = resolve_candidate_profile(db, payload.user_id, x_user_id)
    
    # Generate on-the-fly IIM PDF for this candidate
    try:
        resume_pdf_path = generate_iim_pdf(profile_data)
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
    db: Session = Depends(get_db)
):
    """Fetches candidate application vault data for autofill."""
    profile_data = resolve_candidate_profile(db, user_id, x_user_id)
    return {
        "full_name": profile_data.get("full_name"),
        "email": profile_data.get("email"),
        "phone": profile_data.get("phone"),
        "location": profile_data.get("location"),
        "headline": profile_data.get("headline"),
        "github_url": profile_data.get("github_url"),
        "linkedin_url": profile_data.get("linkedin_url"),
        "portfolio_url": profile_data.get("portfolio_url"),
        "desired_salary": profile_data.get("min_salary", 110000),
        "notice_period": "Immediate (Available within 2 weeks)",
        "authorized_to_work": True,
        "require_sponsorship": False,
        "common_answers": {
            "why_interested": "I am passionate about building scalable, high-throughput systems and high-velocity product features using modern web and AI technologies.",
            "greatest_strength": "Fast learner capable of owning end-to-end full-stack architectures and shipping zero-defect production code.",
            "preferred_work_mode": "Remote / Worldwide",
        }
    }


@router.get("/auto-apply/screenshot/{filename}")
def get_application_screenshot(filename: str):
    """Serves proof-of-application screenshot."""
    # Sanitize filename
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
    db: Session = Depends(get_db)
):
    """Returns HTML preview of candidate's authentic IIM-format resume."""
    profile_data = resolve_candidate_profile(db, user_id, x_user_id)
    html_content = get_iim_html_template(profile_data)
    return HTMLResponse(content=html_content)


@router.get("/resumes/iim-download-pdf")
def download_iim_pdf(
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    """Generates and downloads the candidate's authentic 1-page IIM resume in PDF format."""
    profile_data = resolve_candidate_profile(db, user_id, x_user_id)
    candidate_slug = re.sub(r"[^a-zA-Z0-9_]", "_", profile_data.get("full_name", "candidate")).lower()
    filename = f"IIM_Resume_{candidate_slug}.pdf"
    
    pdf_path = generate_iim_pdf(profile_data, filename=filename)
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
    db: Session = Depends(get_db)
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
