import logging
import httpx
from typing import Dict, Any
from sqlalchemy.orm import Session
from backend.models.job import Job

logger = logging.getLogger(__name__)

async def verify_job_links(db: Session, job_id: str) -> Dict[str, Any]:
    """
    Checks the vitality of a job's apply URLs via HEAD/GET requests.
    Updates is_stale_link on the Job record if all URLs fail.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return {"error": "Job not found"}

    urls = job.apply_urls or []
    if not urls:
        job.is_stale_link = True
        db.commit()
        return {"is_stale": True, "results": []}

    results = []
    has_at_least_one_live = False

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }

    async with httpx.AsyncClient(timeout=8.0, headers=headers, follow_redirects=True) as client:
        for u in urls:
            try:
                # Try HEAD first
                resp = await client.head(u)
                if resp.status_code in [404, 410]:
                    results.append({"url": u, "status": resp.status_code, "live": False})
                elif resp.status_code < 400 or resp.status_code in [403, 405]:
                    # 403 or 405 often means bot protection or method disallowed, but endpoint exists
                    results.append({"url": u, "status": resp.status_code, "live": True})
                    has_at_least_one_live = True
                else:
                    results.append({"url": u, "status": resp.status_code, "live": False})
            except Exception as e:
                # Fallback to quick GET with stream
                try:
                    resp = await client.get(u)
                    is_live = resp.status_code < 400 or resp.status_code in [403, 405]
                    results.append({"url": u, "status": resp.status_code, "live": is_live})
                    if is_live:
                        has_at_least_one_live = True
                except Exception as e2:
                    results.append({"url": u, "error": str(e2), "live": False})

    job.is_stale_link = not has_at_least_one_live
    db.commit()

    return {
        "job_id": job.id,
        "is_stale": job.is_stale_link,
        "results": results
    }
