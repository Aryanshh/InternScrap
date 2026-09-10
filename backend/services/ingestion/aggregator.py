import asyncio
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from backend.models.job import Job
from backend.services.ingestion.base import NormalizedJob
from backend.services.ingestion.remotive import RemotiveSource
from backend.services.ingestion.arbeitnow import ArbeitnowSource
from backend.services.ingestion.remoteok import RemoteOKSource
from backend.services.ingestion.themuse import TheMuseSource
from backend.services.ingestion.adzuna import AdzunaSource
from backend.services.ingestion.remote_talent import RemoteTalentSource
from backend.services.dedup import (
    generate_fingerprint,
    compute_similarity,
    merge_job_records,
    clean_company_name
)

logger = logging.getLogger(__name__)

SOURCES = [
    RemotiveSource(),
    ArbeitnowSource(),
    RemoteOKSource(),
    TheMuseSource(),
    AdzunaSource(),
    RemoteTalentSource(),
]

class IngestionAggregator:
    def __init__(self, db: Session):
        self.db = db

    async def run(self, limit_per_source: int = 40) -> Dict[str, Any]:
        """
        Fetches jobs concurrently from all sources, normalizes them,
        deduplicates against the existing database, and commits changes.
        """
        tasks = [src.fetch_jobs(limit=limit_per_source) for src in SOURCES]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        total_fetched = 0
        new_jobs_count = 0
        merged_count = 0
        source_counts: Dict[str, int] = {}

        all_normalized: List[NormalizedJob] = []

        for src, res in zip(SOURCES, results):
            if isinstance(res, Exception):
                logger.error(f"Source {src.source_name} failed: {res}")
                source_counts[src.source_name] = 0
            elif isinstance(res, list):
                source_counts[src.source_name] = len(res)
                total_fetched += len(res)
                all_normalized.extend(res)

        # Pre-load existing active jobs to perform fast in-memory candidate matching
        existing_jobs = self.db.query(Job).filter(Job.is_active == True).all()

        for norm in all_normalized:
            fp = generate_fingerprint(norm.title, norm.company, norm.location)
            norm.fingerprint = fp

            # Check for matches among existing jobs
            matched_job = None
            best_score = 0.0

            # 1. Exact fingerprint match check
            for ex in existing_jobs:
                if ex.fingerprint == fp:
                    matched_job = ex
                    best_score = 100.0
                    break

            # 2. If no exact fingerprint, check fuzzy similarity against same-company candidates
            if not matched_job:
                c_norm = clean_company_name(norm.company)
                for ex in existing_jobs:
                    # Quick pre-filter by company token overlap
                    c_ex = clean_company_name(ex.company)
                    if c_norm in c_ex or c_ex in c_norm or not c_norm:
                        score = compute_similarity(
                            norm.title, norm.company, norm.location,
                            ex.title, ex.company, ex.location
                        )
                        if score >= 85.0 and score > best_score:
                            best_score = score
                            matched_job = ex

            if matched_job:
                # Merge into existing record
                incoming_dict = norm.model_dump()
                merge_job_records(matched_job, incoming_dict)
                merged_count += 1
            else:
                # Create new Job record
                new_job = Job(
                    title=norm.title,
                    company=norm.company,
                    location=norm.location,
                    remote_type=norm.remote_type,
                    category=norm.category,
                    is_internship=norm.is_internship,
                    description=norm.description,
                    apply_urls=norm.apply_urls,
                    sources=norm.sources,
                    primary_source=norm.primary_source,
                    posted_date=norm.posted_date,
                    salary_range=norm.salary_range,
                    fingerprint=fp,
                    is_active=True
                )
                self.db.add(new_job)
                self.db.flush() # assign ID and make it part of the session
                existing_jobs.append(new_job)
                new_jobs_count += 1

        self.db.commit()

        return {
            "status": "success",
            "total_fetched": total_fetched,
            "new_jobs_added": new_jobs_count,
            "merged_duplicates": merged_count,
            "source_breakdown": source_counts
        }
