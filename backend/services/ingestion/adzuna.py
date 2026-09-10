import logging
from typing import List
from datetime import datetime, timezone
import httpx
from dateutil import parser as date_parser
from backend.config import settings
from backend.services.ingestion.base import BaseJobSource, NormalizedJob
from backend.services.ingestion.remotive import detect_internship

logger = logging.getLogger(__name__)

class AdzunaSource(BaseJobSource):
    source_name = "adzuna"
    API_URL = "https://api.adzuna.com/v1/api/jobs/us/search/1"

    async def fetch_jobs(self, limit: int = 50) -> List[NormalizedJob]:
        jobs: List[NormalizedJob] = []
        if not settings.ADZUNA_APP_ID or not settings.ADZUNA_APP_KEY:
            logger.info("Adzuna API credentials not configured; skipping Adzuna ingestion.")
            return jobs

        params = {
            "app_id": settings.ADZUNA_APP_ID,
            "app_key": settings.ADZUNA_APP_KEY,
            "results_per_page": min(limit, 50),
            "content-type": "application/json"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(self.API_URL, params=params)
                if resp.status_code != 200:
                    logger.error(f"Adzuna API returned status {resp.status_code}")
                    return jobs

                data = resp.json()
                raw_jobs = data.get("results", [])

                for item in raw_jobs:
                    title = item.get("title", "").strip()
                    comp_obj = item.get("company", {})
                    company = comp_obj.get("display_name", "").strip() if isinstance(comp_obj, dict) else ""
                    if not title or not company:
                        continue

                    loc_obj = item.get("location", {})
                    loc_display = loc_obj.get("display_name", "USA") if isinstance(loc_obj, dict) else "USA"

                    cat_obj = item.get("category", {})
                    category = cat_obj.get("label", "General") if isinstance(cat_obj, dict) else "General"

                    apply_url = item.get("redirect_url", "")
                    description = item.get("description", "")

                    is_remote = "remote" in title.lower() or "remote" in loc_display.lower()
                    remote_type = "remote" if is_remote else "on-site"

                    salary_min = item.get("salary_min")
                    salary_max = item.get("salary_max")
                    salary = None
                    if salary_min and salary_max:
                        salary = f"${int(salary_min):,} - ${int(salary_max):,}"
                    elif salary_min:
                        salary = f"${int(salary_min):,}+"

                    posted_dt = None
                    created_str = item.get("created")
                    if created_str:
                        try:
                            posted_dt = date_parser.parse(created_str)
                        except Exception:
                            posted_dt = datetime.now(timezone.utc)

                    is_intern = detect_internship(title, category)

                    jobs.append(NormalizedJob(
                        title=title,
                        company=company,
                        location=loc_display,
                        remote_type=remote_type,
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
            logger.error(f"Error fetching from Adzuna: {e}")
        return jobs
