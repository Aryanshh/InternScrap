import logging
from typing import List
from datetime import datetime, timezone
import httpx
from backend.services.ingestion.base import BaseJobSource, NormalizedJob
from backend.services.ingestion.remotive import detect_internship

logger = logging.getLogger(__name__)

class ArbeitnowSource(BaseJobSource):
    source_name = "arbeitnow"
    API_URL = "https://www.arbeitnow.com/api/job-board-api"

    async def fetch_jobs(self, limit: int = 50) -> List[NormalizedJob]:
        jobs: List[NormalizedJob] = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(self.API_URL)
                if resp.status_code != 200:
                    logger.error(f"Arbeitnow API returned status {resp.status_code}")
                    return jobs
                
                data = resp.json()
                raw_jobs = data.get("data", [])[:limit]

                for item in raw_jobs:
                    title = item.get("title", "").strip()
                    company = item.get("company_name", "").strip()
                    if not title or not company:
                        continue

                    is_remote = bool(item.get("remote", False))
                    remote_type = "remote" if is_remote else "on-site"
                    location = item.get("location", "Remote" if is_remote else "Unknown")
                    tags = item.get("tags", [])
                    category = tags[0] if tags else "General"
                    apply_url = item.get("url", "")
                    description = item.get("description", "")

                    posted_dt = None
                    created_at = item.get("created_at")
                    if isinstance(created_at, (int, float)):
                        try:
                            posted_dt = datetime.fromtimestamp(created_at, timezone.utc)
                        except Exception:
                            posted_dt = datetime.now(timezone.utc)

                    is_intern = detect_internship(title, category, tags)

                    jobs.append(NormalizedJob(
                        title=title,
                        company=company,
                        location=location,
                        remote_type=remote_type,
                        category=category,
                        is_internship=is_intern,
                        description=description,
                        apply_urls=[apply_url] if apply_url else [],
                        sources=[self.source_name],
                        primary_source=self.source_name,
                        posted_date=posted_dt,
                        salary_range=None
                    ))
        except Exception as e:
            logger.error(f"Error fetching from Arbeitnow: {e}")
        return jobs
