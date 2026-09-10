import logging
from typing import List
from datetime import datetime, timezone
import httpx
from dateutil import parser as date_parser
from backend.config import settings
from backend.services.ingestion.base import BaseJobSource, NormalizedJob
from backend.services.ingestion.remotive import detect_internship

logger = logging.getLogger(__name__)

class TheMuseSource(BaseJobSource):
    source_name = "themuse"
    API_URL = "https://www.themuse.com/api/public/jobs"

    async def fetch_jobs(self, limit: int = 50) -> List[NormalizedJob]:
        jobs: List[NormalizedJob] = []
        params = {"page": 1}
        if settings.THEMUSE_API_KEY:
            params["api_key"] = settings.THEMUSE_API_KEY

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(self.API_URL, params=params)
                if resp.status_code != 200:
                    logger.error(f"The Muse API returned status {resp.status_code}")
                    return jobs
                
                data = resp.json()
                raw_jobs = data.get("results", [])[:limit]

                for item in raw_jobs:
                    title = item.get("name", "").strip()
                    comp_obj = item.get("company", {})
                    company = comp_obj.get("name", "").strip() if isinstance(comp_obj, dict) else ""
                    if not title or not company:
                        continue

                    # Locations
                    loc_list = [l.get("name") for l in item.get("locations", []) if isinstance(l, dict) and l.get("name")]
                    location = ", ".join(loc_list) if loc_list else "Flexible / Various"

                    # Check remote status
                    is_remote = "flexible" in location.lower() or "remote" in location.lower()
                    remote_type = "remote" if is_remote else "on-site"

                    # Categories & Levels
                    cat_list = [c.get("name") for c in item.get("categories", []) if isinstance(c, dict) and c.get("name")]
                    category = cat_list[0] if cat_list else "General"

                    levels = [lvl.get("name") for lvl in item.get("levels", []) if isinstance(lvl, dict) and lvl.get("name")]
                    is_intern = any("intern" in lvl.lower() for lvl in levels) or detect_internship(title, category, levels)

                    refs = item.get("refs", {})
                    apply_url = refs.get("landing_page", "") if isinstance(refs, dict) else ""
                    description = item.get("contents", "")

                    posted_dt = None
                    pub_date = item.get("publication_date")
                    if pub_date:
                        try:
                            posted_dt = date_parser.parse(pub_date)
                        except Exception:
                            posted_dt = datetime.now(timezone.utc)

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
            logger.error(f"Error fetching from The Muse: {e}")
        return jobs
