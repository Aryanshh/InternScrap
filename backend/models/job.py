import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, JSON
from backend.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def get_utc_now():
    return datetime.now(timezone.utc)

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False, index=True)
    company = Column(String(255), nullable=False, index=True)
    location = Column(String(255), default="Unknown")
    remote_type = Column(String(50), default="on-site", index=True) # remote, hybrid, on-site
    category = Column(String(100), default="General", index=True)
    is_internship = Column(Boolean, default=False, index=True)
    description = Column(Text, nullable=False)
    
    # Store deduplicated apply links and sources as JSON arrays
    apply_urls = Column(JSON, default=list)
    sources = Column(JSON, default=list) # e.g. ["remotive", "remoteok"]
    primary_source = Column(String(50), default="unknown")
    
    posted_date = Column(DateTime, default=get_utc_now, index=True)
    salary_range = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    is_stale_link = Column(Boolean, default=False)
    
    # Canonical fingerprint used to quickly query potential duplicates
    fingerprint = Column(String(255), nullable=False, index=True)
    
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

    @property
    def apply_url(self) -> str:
        if self.apply_urls and len(self.apply_urls) > 0:
            return self.apply_urls[0] or ""
        return ""

    @apply_url.setter
    def apply_url(self, value: str):
        if value:
            self.apply_urls = [value]
        else:
            self.apply_urls = []

    @property
    def source(self) -> str:
        return self.primary_source or "unknown"

    @source.setter
    def source(self, value: str):
        self.primary_source = value
        if not self.sources:
            self.sources = [value]
        elif value not in self.sources:
            self.sources.append(value)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "remote_type": self.remote_type,
            "category": self.category,
            "is_internship": self.is_internship,
            "description": self.description,
            "apply_url": self.apply_url,
            "apply_urls": self.apply_urls or [],
            "sources": self.sources or [],
            "primary_source": self.primary_source,
            "source": self.source,
            "posted_date": self.posted_date.isoformat() if self.posted_date else None,
            "salary_range": self.salary_range,
            "is_active": self.is_active,
            "is_stale_link": self.is_stale_link,
            "fingerprint": self.fingerprint,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
