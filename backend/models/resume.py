import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, JSON
from backend.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def get_utc_now():
    return datetime.now(timezone.utc)

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    filename = Column(String(255), nullable=False)
    raw_text = Column(Text, nullable=False)
    parsed_json = Column(JSON, default=dict) # skills, experience, projects, education, tools
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=get_utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "raw_text": self.raw_text,
            "parsed_json": self.parsed_json or {},
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
