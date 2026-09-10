from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.job import Job
from backend.models.application import Application
from backend.models.match import Match
from backend.models.resume import Resume
from backend.models.tailored_resume import TailoredResume

router = APIRouter(prefix="/api", tags=["tracker"])

class ApplicationCreate(BaseModel):
    job_id: str
    status: Optional[str] = "saved"
    notes: Optional[str] = ""
    applied_date: Optional[str] = None

class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    applied_date: Optional[str] = None
    tailored_resume_id: Optional[str] = None

def enrich_application(app_record: Application, db: Session) -> Dict[str, Any]:
    data = app_record.to_dict()
    job = db.query(Job).filter(Job.id == app_record.job_id).first()
    
    data["job"] = job.to_dict() if job else None

    # Attach match score if available
    active_resume = db.query(Resume).filter(Resume.is_active == True).first()
    if active_resume and job:
        match_rec = db.query(Match).filter(
            Match.job_id == job.id,
            Match.resume_id == active_resume.id
        ).first()
        if match_rec:
            data["match"] = match_rec.to_dict()
        else:
            data["match"] = None

        # Check tailored resume
        tailored = db.query(TailoredResume).filter(
            TailoredResume.job_id == job.id,
            TailoredResume.resume_id == active_resume.id
        ).first()
        if tailored:
            data["tailored_resume"] = {
                "id": tailored.id,
                "download_url": f"/api/resumes/download/{tailored.id}"
            }
        else:
            data["tailored_resume"] = None
    else:
        data["match"] = None
        data["tailored_resume"] = None

    return data

@router.get("/applications")
def list_applications(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Application)
    if status and status.lower() != "all":
        query = query.filter(Application.status == status.lower())
    
    apps = query.order_by(Application.updated_at.desc()).all()
    return [enrich_application(a, db) for a in apps]

@router.post("/applications")
def track_application(payload: ApplicationCreate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == payload.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = db.query(Application).filter(Application.job_id == payload.job_id).first()
    if existing:
        if payload.status:
            existing.status = payload.status
        if payload.notes is not None:
            existing.notes = payload.notes
        if payload.applied_date:
            try:
                existing.applied_date = datetime.fromisoformat(payload.applied_date)
            except Exception:
                pass
        db.commit()
        db.refresh(existing)
        return enrich_application(existing, db)

    applied_dt = None
    if payload.applied_date:
        try:
            applied_dt = datetime.fromisoformat(payload.applied_date)
        except Exception:
            pass

    new_app = Application(
        job_id=payload.job_id,
        status=payload.status or "saved",
        notes=payload.notes or "",
        applied_date=applied_dt
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return enrich_application(new_app, db)

@router.patch("/applications/{application_id}")
def update_application(application_id: str, payload: ApplicationUpdate, db: Session = Depends(get_db)):
    app_record = db.query(Application).filter(Application.id == application_id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Tracked application not found")

    if payload.status is not None:
        app_record.status = payload.status
        if payload.status == "applied" and not app_record.applied_date:
            app_record.applied_date = datetime.now(timezone.utc)
    if payload.notes is not None:
        app_record.notes = payload.notes
    if payload.applied_date is not None:
        try:
            app_record.applied_date = datetime.fromisoformat(payload.applied_date)
        except Exception:
            pass
    if payload.tailored_resume_id is not None:
        app_record.tailored_resume_id = payload.tailored_resume_id

    db.commit()
    db.refresh(app_record)
    return enrich_application(app_record, db)

@router.delete("/applications/{application_id}")
def delete_application(application_id: str, db: Session = Depends(get_db)):
    app_record = db.query(Application).filter(Application.id == application_id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Tracked application not found")

    db.delete(app_record)
    db.commit()
    return {"success": True, "deleted_id": application_id}
