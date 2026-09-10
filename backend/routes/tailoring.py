import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.job import Job
from backend.models.resume import Resume
from backend.models.tailored_resume import TailoredResume
from backend.services.resume_generator import tailor_resume_content, build_tailored_docx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tailoring"])

@router.post("/jobs/{job_id}/tailor")
def generate_job_tailored_resume(job_id: str, db: Session = Depends(get_db)):
    """Generates an ATS-optimized tailored resume for the active resume targeting job_id."""
    resume = db.query(Resume).filter(Resume.is_active == True).order_by(Resume.created_at.desc()).first()
    if not resume:
        raise HTTPException(status_code=400, detail="No active resume uploaded. Please upload a resume first.")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        tailored_data = tailor_resume_content(
            resume_dict=resume.to_dict(),
            job_title=job.title,
            job_company=job.company,
            job_description=job.description
        )

        filename = f"tailored_{job.id[:8]}_{resume.id[:8]}.docx"
        file_path = build_tailored_docx(tailored_data["tailored_json"], filename)

        # Check existing record
        record = db.query(TailoredResume).filter(
            TailoredResume.job_id == job.id,
            TailoredResume.resume_id == resume.id
        ).first()

        if record:
            record.tailored_json = tailored_data["tailored_json"]
            record.diff_summary = tailored_data["diff_summary"]
            record.file_path = file_path
        else:
            record = TailoredResume(
                job_id=job.id,
                resume_id=resume.id,
                tailored_json=tailored_data["tailored_json"],
                diff_summary=tailored_data["diff_summary"],
                file_path=file_path
            )
            db.add(record)

        db.commit()
        db.refresh(record)

        return {
            "id": record.id,
            "job_id": job.id,
            "resume_id": resume.id,
            "job_title": job.title,
            "company": job.company,
            "diff_summary": record.diff_summary,
            "tailored_json": record.tailored_json,
            "download_url": f"/api/resumes/download/{record.id}"
        }
    except Exception as e:
        logger.exception("Failed to generate tailored resume")
        raise HTTPException(status_code=500, detail=f"Failed to generate tailored resume: {str(e)}")

@router.get("/jobs/{job_id}/tailored")
def get_existing_tailored_resume(job_id: str, db: Session = Depends(get_db)):
    """Checks if a tailored resume has already been generated for this job."""
    resume = db.query(Resume).filter(Resume.is_active == True).order_by(Resume.created_at.desc()).first()
    if not resume:
        return {"tailored": False}

    record = db.query(TailoredResume).filter(
        TailoredResume.job_id == job_id,
        TailoredResume.resume_id == resume.id
    ).first()

    if not record:
        return {"tailored": False}

    return {
        "tailored": True,
        "id": record.id,
        "job_id": record.job_id,
        "resume_id": record.resume_id,
        "diff_summary": record.diff_summary,
        "tailored_json": record.tailored_json,
        "download_url": f"/api/resumes/download/{record.id}"
    }

@router.get("/resumes/download/{tailored_id}")
def download_tailored_resume(tailored_id: str, db: Session = Depends(get_db)):
    """Downloads the generated DOCX file for a tailored resume."""
    record = db.query(TailoredResume).filter(TailoredResume.id == tailored_id).first()
    if not record or not record.file_path:
        raise HTTPException(status_code=404, detail="Tailored resume record not found")

    if not os.path.exists(record.file_path):
        raise HTTPException(status_code=404, detail="Resume file not found on disk")

    # Friendly download name
    company = record.diff_summary.get("company", "Company").replace(" ", "_")
    name = record.tailored_json.get("header", {}).get("name", "Candidate").replace(" ", "_")
    download_filename = f"{name}_Tailored_{company}.docx"

    return FileResponse(
        path=record.file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=download_filename
    )
