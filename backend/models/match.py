import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, JSON, ForeignKey
from backend.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def get_utc_now():
    return datetime.now(timezone.utc)

class Match(Base):
    __tablename__ = "matches"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), nullable=False, index=True)
    resume_id = Column(String(36), nullable=False, index=True)
    keyword_score = Column(Float, default=0.0)
    semantic_score = Column(Float, default=0.0)
    blended_score = Column(Float, default=0.0, index=True)
    gap_list = Column(JSON, default=list) # List of missing requirements
    created_at = Column(DateTime, default=get_utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "job_id": self.job_id,
            "resume_id": self.resume_id,
            "keyword_score": round(self.keyword_score, 1),
            "semantic_score": round(self.semantic_score, 1),
            "blended_score": round(self.blended_score, 1),
            "gap_list": self.gap_list or [],
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
