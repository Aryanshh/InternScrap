from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from backend.services.scheduler import get_scheduler_status, execute_sync_and_digest
from backend.services.email_digest import get_latest_digest_html

router = APIRouter(prefix="/api", tags=["scheduler"])

@router.get("/scheduler/status")
def scheduler_status():
    """Returns background scheduler running status, next scheduled run, and last run stats."""
    return get_scheduler_status()

@router.post("/scheduler/trigger")
async def trigger_scheduler_cycle():
    """Manually triggers an immediate background ingestion & email digest cycle."""
    stats = await execute_sync_and_digest(min_score=50.0)
    return {
        "message": "Scheduler cycle executed successfully",
        "stats": stats
    }

@router.get("/digest/html", response_class=HTMLResponse)
def get_digest_html():
    """Returns the latest rendered HTML email digest for iframe preview."""
    html = get_latest_digest_html()
    return HTMLResponse(content=html, status_code=200)

@router.get("/digest/latest")
def get_digest_metadata():
    """Returns metadata and raw HTML of the latest generated email digest."""
    html = get_latest_digest_html()
    return {
        "has_digest": "InternScrap" in html,
        "html": html
    }
