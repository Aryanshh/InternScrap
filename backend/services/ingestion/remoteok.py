import logging
from typing import List
from datetime import datetime, timezone
import httpx
from dateutil import parser as date_parser
from backend.services.ingestion.base import BaseJobSource, NormalizedJob
from backend.services.ingestion.remotive import detect_internship

logger = logging.getLogger(__name__)

class RemoteOKSource(BaseJobSource):
    source_name = "remoteok"
    API_URL = "https://remoteok.com/api"

    async def fetch_jobs(self, limit: int = 50) -> List[NormalizedJob]:
        jobs: List[NormalizedJob] = []
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 JobAggregator/1.0"
        }
        try:
            async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
                resp = await client.get(self.API_URL)
                if resp.status_code != 200:
                    logger.error(f"RemoteOK API returned status {resp.status_code}")
                    return jobs
                
                data = resp.json()
                if not isinstance(data, list):
                    return jobs

                for item in data:
                    if len(jobs) >= limit:
                        break
                    
                    # RemoteOK's first element is usually a disclaimer metadata object
                    if not isinstance(item, dict) or not item.get("company"):
                        continue

                    title = (item.get("position") or item.get("title") or "").strip()
                    company = item.get("company", "").strip()
                    if not title or not company:
                        continue

                    location = item.get("location") or "Worldwide (Remote)"
                    tags = item.get("tags") or []
                    category = tags[0].capitalize() if tags else "General"
                    
                    apply_url = item.get("apply_url") or item.get("url") or ""
                    description = item.get("description", "")
                    
                    # Format salary range if available
                    salary = None
                    s_min = item.get("salary_min")
                    s_max = item.get("salary_max")
                    if s_min and s_max:
                        salary = f"${s_min:,} - ${s_max:,}"
                    elif s_min:
                        salary = f"${s_min:,}+"

                    posted_dt = None
                    date_str = item.get("date")
                    if date_str:
                        try:
                            posted_dt = date_parser.parse(date_str)
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
            logger.error(f"Error fetching from RemoteOK: {e}")
        return jobs
