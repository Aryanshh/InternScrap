import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.resume import Resume
from backend.models.job import Job
from backend.models.match import Match
from backend.services.resume_parser import parse_resume
from backend.services.matching_engine import evaluate_job_match

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["resumes"])

@router.post("/resumes/upload")
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    
    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".pdf") or filename_lower.endswith(".docx") or filename_lower.endswith(".txt")):
        raise HTTPException(status_code=400, detail="Supported formats: PDF, DOCX, TXT")

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    parsed_result = parse_resume(contents, file.filename)
    if not parsed_result["raw_text"]:
        raise HTTPException(status_code=400, detail="Could not extract text from uploaded document")

    # Set existing resumes to inactive
    db.query(Resume).update({Resume.is_active: False})

    # Clear cached matches for fresh evaluation
    db.query(Match).delete()

    new_resume = Resume(
        filename=file.filename,
        raw_text=parsed_result["raw_text"],
        parsed_json=parsed_result["parsed_json"],
        is_active=True
    )
    db.add(new_resume)
    db.commit()
    db.refresh(new_resume)

    return new_resume.to_dict()

@router.get("/resumes/active")
def get_active_resume(db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.is_active == True).order_by(Resume.created_at.desc()).first()
    if not resume:
        return None
    return resume.to_dict()

@router.get("/resumes")
def list_resumes(db: Session = Depends(get_db)):
    resumes = db.query(Resume).order_by(Resume.created_at.desc()).all()
    return [r.to_dict() for r in resumes]

@router.post("/resumes/{resume_id}/activate")
def activate_resume(resume_id: str, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    db.query(Resume).update({Resume.is_active: False})
    resume.is_active = True
    db.query(Match).delete() # Reset matches cache
    db.commit()
    return resume.to_dict()

@router.get("/jobs/{job_id}/match")
def get_job_match(job_id: str, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.is_active == True).first()
    if not resume:
        return {"error": "No active resume uploaded"}

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check match cache
    cached = db.query(Match).filter(Match.job_id == job_id, Match.resume_id == resume.id).first()
    if cached:
        return cached.to_dict()

    evaluation = evaluate_job_match(job.description, resume.to_dict())
    new_match = Match(
        job_id=job.id,
        resume_id=resume.id,
        keyword_score=evaluation["keyword_score"],
        semantic_score=evaluation["semantic_score"],
        blended_score=evaluation["blended_score"],
        gap_list=evaluation["gap_list"]
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)

    res = new_match.to_dict()
    res["matched_skills"] = evaluation["matched_skills"]
    res["disclaimer"] = evaluation["disclaimer"]
    return res

@router.get("/matches")
def get_all_matches(db: Session = Depends(get_db)):
    """
    Returns map of job_id -> match stats for all active jobs against the active resume.
    Computes matches if not yet in cache.
    """
    resume = db.query(Resume).filter(Resume.is_active == True).first()
    if not resume:
        return {}

    resume_dict = resume.to_dict()
    jobs = db.query(Job).filter(Job.is_active == True).all()
    cached_matches = {m.job_id: m for m in db.query(Match).filter(Match.resume_id == resume.id).all()}

    results = {}
    for job in jobs:
        if job.id in cached_matches:
            results[job.id] = cached_matches[job.id].to_dict()
        else:
            ev = evaluate_job_match(job.description, resume_dict)
            match_rec = Match(
                job_id=job.id,
                resume_id=resume.id,
                keyword_score=ev["keyword_score"],
                semantic_score=ev["semantic_score"],
                blended_score=ev["blended_score"],
                gap_list=ev["gap_list"]
            )
            db.add(match_rec)
            cached_matches[job.id] = match_rec
            results[job.id] = match_rec.to_dict()

    db.commit()
    return results
