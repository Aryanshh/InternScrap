import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from backend.database import SessionLocal
from backend.models.job import Job
from backend.models.resume import Resume
from backend.models.match import Match
from backend.services.ingestion.aggregator import IngestionAggregator
from backend.services.matching_engine import evaluate_job_match
from backend.services.email_digest import render_digest_html, send_email_digest, save_digest_record

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

scheduler_state = {
    "is_running": False,
    "interval_hours": 4,
    "last_run": None,
    "last_run_stats": {
        "new_jobs_ingested": 0,
        "high_matches_found": 0,
        "digest_sent": False
    },
    "alert_min_score": 60.0 # Blended score threshold for email alerts
}

async def execute_sync_and_digest(min_score: float = 60.0, skip_ingest: bool = False) -> Dict[str, Any]:
    """
    Executes a complete ingestion and alert cycle:
    1. Ingests fresh listings across ToS-compliant APIs.
    2. Matches newly found listings against candidate's active resume.
    3. Triggers email digest if high-match listings are found.
    """
    logger.info("Scheduler: Starting background sync and digest job...")
    db = SessionLocal()
    stats = {
        "new_jobs_ingested": 0,
        "high_matches_found": 0,
        "digest_sent": False,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    try:
        # 1. Run Aggregator Ingestion
        if not skip_ingest:
            aggregator = IngestionAggregator(db)
            ingest_res = await aggregator.run(limit_per_source=20)
            stats["new_jobs_ingested"] = ingest_res.get("created", 0)

        # 2. Check for active resume
        active_resume = db.query(Resume).filter(Resume.is_active == True).order_by(Resume.created_at.desc()).first()
        if not active_resume:
            logger.info("Scheduler: No active resume found. Ingestion complete, skipping digest.")
            scheduler_state["last_run"] = datetime.now(timezone.utc).isoformat()
            scheduler_state["last_run_stats"] = stats
            return stats

        resume_dict = active_resume.to_dict()
        candidate_name = "Candidate"
        if active_resume.raw_text:
            first_line = active_resume.raw_text.splitlines()[0].strip()
            if first_line and len(first_line) < 40:
                candidate_name = first_line

        # 3. Find jobs without matches or high matches
        all_jobs = db.query(Job).filter(Job.is_active == True).all()
        high_match_jobs = []
        new_matches_to_add = []

        for j in all_jobs:
            m_rec = db.query(Match).filter(
                Match.job_id == j.id,
                Match.resume_id == active_resume.id
            ).first()

            if not m_rec:
                eval_res = evaluate_job_match(j.description, resume_dict)
                m_rec = Match(
                    job_id=j.id,
                    resume_id=active_resume.id,
                    keyword_score=eval_res["keyword_score"],
                    semantic_score=eval_res["semantic_score"],
                    blended_score=eval_res["blended_score"],
                    gap_list=eval_res["gap_list"]
                )
                new_matches_to_add.append(m_rec)

            if m_rec.blended_score >= min_score:
                j_dict = j.to_dict()
                j_dict["match"] = m_rec.to_dict()
                high_match_jobs.append(j_dict)

        if new_matches_to_add:
            db.add_all(new_matches_to_add)
            db.commit()

        # Sort high match jobs by score descending
        high_match_jobs.sort(key=lambda x: x["match"]["blended_score"], reverse=True)
        stats["high_matches_found"] = len(high_match_jobs)

        # 4. Generate & Deliver Email Digest
        if high_match_jobs:
            html = render_digest_html(
                candidate_name=candidate_name,
                candidate_headline="Software Engineer & Machine Learning Enthusiast",
                high_match_jobs=high_match_jobs[:8]
            )
            save_digest_record(html, len(high_match_jobs))
            send_email_digest(
                subject=f"InternScrap Alert: {len(high_match_jobs)} High-Match Listings Found!",
                html_content=html,
                recipient="candidate@example.com"
            )
            stats["digest_sent"] = True
            logger.info(f"Scheduler: Successfully compiled and sent digest with {len(high_match_jobs)} high-match jobs.")
        else:
            logger.info("Scheduler: No jobs met the high-match threshold.")

        scheduler_state["last_run"] = datetime.now(timezone.utc).isoformat()
        scheduler_state["last_run_stats"] = stats
        return stats

    except Exception as e:
        logger.exception(f"Scheduler error during sync: {e}")
        stats["error"] = str(e)
        return stats
    finally:
        db.close()

def start_scheduler():
    """Starts the APScheduler background thread."""
    if not scheduler.running:
        scheduler.add_job(
            execute_sync_and_digest,
            trigger=IntervalTrigger(hours=scheduler_state["interval_hours"]),
            id="periodic_job_sync",
            name="Periodic Ingestion & Email Digest Alert",
            replace_existing=True
        )
        scheduler.start()
        scheduler_state["is_running"] = True
        logger.info("APScheduler started successfully.")

def shutdown_scheduler():
    """Gracefully shuts down APScheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        scheduler_state["is_running"] = False
        logger.info("APScheduler shut down gracefully.")

def get_scheduler_status() -> Dict[str, Any]:
    """Returns current status and scheduled jobs."""
    job = scheduler.get_job("periodic_job_sync") if scheduler.running else None
    next_run = job.next_run_time.isoformat() if job and job.next_run_time else None
    
    return {
        "is_running": scheduler.running,
        "interval_hours": scheduler_state["interval_hours"],
        "next_run_time": next_run,
        "last_run": scheduler_state["last_run"],
        "last_run_stats": scheduler_state["last_run_stats"],
        "alert_min_score": scheduler_state["alert_min_score"]
    }
