import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON
from backend.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def get_utc_now():
    return datetime.now(timezone.utc)

class TailoredResume(Base):
    __tablename__ = "tailored_resumes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), nullable=False, index=True)
    resume_id = Column(String(36), nullable=False, index=True)
    tailored_json = Column(JSON, default=dict)
    diff_summary = Column(JSON, default=dict)
    file_path = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "job_id": self.job_id,
            "resume_id": self.resume_id,
            "tailored_json": self.tailored_json or {},
            "diff_summary": self.diff_summary or {},
            "file_path": self.file_path,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
