from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class NormalizedJob(BaseModel):
    title: str
    company: str
    location: str = "Unknown"
    remote_type: str = "on-site" # remote, hybrid, on-site
    category: str = "General"
    is_internship: bool = False
    description: str
    apply_urls: List[str] = Field(default_factory=list)
    sources: List[str] = Field(default_factory=list)
    primary_source: str
    posted_date: Optional[datetime] = None
    salary_range: Optional[str] = None
    fingerprint: Optional[str] = None

class BaseJobSource(ABC):
    source_name: str

    @abstractmethod
    async def fetch_jobs(self, limit: int = 50) -> List[NormalizedJob]:
        """Fetch and return a list of normalized job listings."""
        pass
