from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class JobBase(BaseModel):
    title: str
    company: str
    location: Optional[str] = "Unknown"
    remote_type: str = "on-site" # remote, hybrid, on-site
    category: str = "General"
    is_internship: bool = False
    description: str
    apply_urls: List[str] = Field(default_factory=list)
    sources: List[str] = Field(default_factory=list)
    primary_source: str = "manual"
    salary_range: Optional[str] = None
    is_active: bool = True

class JobCreate(JobBase):
    posted_date: Optional[datetime] = None

class ManualJobCreate(BaseModel):
    title: str = Field(..., min_length=2, description="Job title")
    company: str = Field(..., min_length=1, description="Company name")
    location: Optional[str] = "Unknown"
    remote_type: str = "on-site" # remote, hybrid, on-site
    category: Optional[str] = "General"
    is_internship: bool = False
    description: str = Field(..., min_length=10, description="Full job description")
    apply_url: Optional[str] = Field(None, description="Direct URL to apply")
    salary_range: Optional[str] = None

class JobMatchOut(BaseModel):
    keyword_score: float
    semantic_score: float
    blended_score: float
    gap_list: List[str]

class JobOut(BaseModel):
    id: str
    title: str
    company: str
    location: str
    remote_type: str
    category: str
    is_internship: bool
    description: str
    apply_urls: List[str]
    sources: List[str]
    primary_source: str
    posted_date: Optional[datetime]
    salary_range: Optional[str]
    is_active: bool
    is_stale_link: bool
    fingerprint: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    match: Optional[JobMatchOut] = None

    class Config:
        from_attributes = True

class JobListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[JobOut]

class JobStatsResponse(BaseModel):
    total_jobs: int
    active_jobs: int
    remote_jobs: int
    internship_jobs: int
    sources: dict
    categories: dict
