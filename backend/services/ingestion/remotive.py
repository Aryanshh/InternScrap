import re
import logging
from typing import List
from datetime import datetime, timezone
import httpx
from dateutil import parser as date_parser
from backend.services.ingestion.base import BaseJobSource, NormalizedJob

logger = logging.getLogger(__name__)

INTERN_REGEX = re.compile(r"\b(intern|internship|interns|co-op|coop|trainee|fellow|fellowship|apprentice|apprenticeship)\b", re.IGNORECASE)

def detect_internship(title: str, category: str = "", tags: List[str] = None) -> bool:
    content = f"{title} {category} {' '.join(tags or [])}"
    return bool(INTERN_REGEX.search(content))

class RemotiveSource(BaseJobSource):
    source_name = "remotive"
    API_URL = "https://remotive.com/api/remote-jobs"

    async def fetch_jobs(self, limit: int = 50) -> List[NormalizedJob]:
        jobs: List[NormalizedJob] = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{self.API_URL}?limit={limit}")
                if resp.status_code != 200:
                    logger.error(f"Remotive API returned status {resp.status_code}")
                    return jobs
                
                data = resp.json()
                raw_jobs = data.get("jobs", [])[:limit]

                for item in raw_jobs:
                    title = item.get("title", "").strip()
                    company = item.get("company_name", "").strip()
                    if not title or not company:
                        continue

                    location = item.get("candidate_required_location", "Worldwide (Remote)")
                    category = item.get("category", "Software Development")
                    tags = item.get("tags", [])
                    apply_url = item.get("url", "")
                    description = item.get("description", "")
                    salary = item.get("salary") or None

                    posted_dt = None
                    pub_date = item.get("publication_date")
                    if pub_date:
                        try:
                            posted_dt = date_parser.parse(pub_date)
                        except Exception:
                            posted_dt = datetime.now(timezone.utc)

                    is_intern = detect_internship(title, category, tags)

                    jobs.append(NormalizedJob(
                        title=title,
                        company=company,
                        location=location,
                        remote_type="remote",
                        category=category,
                        is_internship=is_intern,
                        description=description,
                        apply_urls=[apply_url] if apply_url else [],
                        sources=[self.source_name],
                        primary_source=self.source_name,
                        posted_date=posted_dt,
                        salary_range=salary
                    ))
        except Exception as e:
            logger.error(f"Error fetching from Remotive: {e}")
        return jobs
