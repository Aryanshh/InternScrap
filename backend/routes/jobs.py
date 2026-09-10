from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc

from backend.database import get_db
from backend.models.job import Job
from backend.models.resume import Resume
from backend.models.match import Match
from backend.schemas.job import JobOut, JobListResponse, ManualJobCreate, JobStatsResponse, JobMatchOut
from backend.services.ingestion.aggregator import IngestionAggregator
from backend.services.stale_checker import verify_job_links
from backend.services.dedup import generate_fingerprint
from backend.services.matching_engine import evaluate_job_match

router = APIRouter(prefix="/api", tags=["jobs"])

@router.get("/jobs", response_model=JobListResponse)
def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search keyword in title, company, or description"),
    remote_type: Optional[str] = Query(None, description="remote, hybrid, or on-site"),
    category: Optional[str] = Query(None, description="Job category"),
    is_internship: Optional[bool] = Query(None, description="Filter for internships only"),
    source: Optional[str] = Query(None, description="Filter by source"),
    min_match_score: Optional[float] = Query(None, description="Filter jobs with blended match score >= min_match_score"),
    sort_by: str = Query("posted_date_desc", description="posted_date_desc, posted_date_asc, title_asc, match_score_desc"),
    db: Session = Depends(get_db)
):
    query = db.query(Job).filter(Job.is_active == True)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Job.title.ilike(search_pattern),
                Job.company.ilike(search_pattern),
                Job.description.ilike(search_pattern),
                Job.location.ilike(search_pattern)
            )
        )

    if remote_type and remote_type.lower() != "all":
        query = query.filter(Job.remote_type == remote_type.lower())

    if category and category.lower() != "all":
        query = query.filter(Job.category == category)

    if is_internship is not None:
        query = query.filter(Job.is_internship == is_internship)

    if source and source.lower() != "all":
        query = query.filter(Job.primary_source.ilike(f"%{source.strip()}%"))

    # Active resume check for match scoring
    active_resume = db.query(Resume).filter(Resume.is_active == True).first()
    matches_map = {}
    if active_resume:
        existing_matches = db.query(Match).filter(Match.resume_id == active_resume.id).all()
        matches_map = {m.job_id: m for m in existing_matches}

    # Fast path: When not filtering or sorting by match score, paginate in SQL directly
    if min_match_score is None and sort_by != "match_score_desc":
        total = query.count()
        if sort_by == "posted_date_asc":
            query = query.order_by(asc(Job.posted_date))
        elif sort_by == "title_asc":
            query = query.order_by(asc(Job.title))
        else:
            query = query.order_by(desc(Job.posted_date))

        offset = (page - 1) * page_size
        paginated_jobs = query.offset(offset).limit(page_size).all()
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1

        items_out = []
        new_matches = False
        for job in paginated_jobs:
            job_dict = job.to_dict()
            match_out = None
            if active_resume:
                m_rec = matches_map.get(job.id)
                if not m_rec:
                    ev = evaluate_job_match(job.description, active_resume.to_dict())
                    m_rec = Match(
                        job_id=job.id,
                        resume_id=active_resume.id,
                        keyword_score=ev["keyword_score"],
                        semantic_score=ev["semantic_score"],
                        blended_score=ev["blended_score"],
                        gap_list=ev["gap_list"]
                    )
                    db.add(m_rec)
                    matches_map[job.id] = m_rec
                    new_matches = True

                match_out = JobMatchOut(
                    keyword_score=round(m_rec.keyword_score, 1),
                    semantic_score=round(m_rec.semantic_score, 1),
                    blended_score=round(m_rec.blended_score, 1),
                    gap_list=m_rec.gap_list or []
                )

            job_dict["match"] = match_out
            items_out.append(job_dict)

        if new_matches:
            db.commit()

        return JobListResponse(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=[JobOut.model_validate(item) for item in items_out]
        )

    # Slow path: Full evaluation required for match score filtering or sorting
    all_matching_jobs = query.all()
    items_with_matches = []
    new_matches = False
    for job in all_matching_jobs:
        job_dict = job.to_dict()
        match_out = None
        if active_resume:
            m_rec = matches_map.get(job.id)
            if not m_rec:
                ev = evaluate_job_match(job.description, active_resume.to_dict())
                m_rec = Match(
                    job_id=job.id,
                    resume_id=active_resume.id,
                    keyword_score=ev["keyword_score"],
                    semantic_score=ev["semantic_score"],
                    blended_score=ev["blended_score"],
                    gap_list=ev["gap_list"]
                )
                db.add(m_rec)
                matches_map[job.id] = m_rec
                new_matches = True

            match_out = JobMatchOut(
                keyword_score=round(m_rec.keyword_score, 1),
                semantic_score=round(m_rec.semantic_score, 1),
                blended_score=round(m_rec.blended_score, 1),
                gap_list=m_rec.gap_list or []
            )

        job_dict["match"] = match_out
        
        # Filter by min_match_score if specified
        if min_match_score is not None:
            if not match_out or match_out.blended_score < min_match_score:
                continue

        items_with_matches.append(job_dict)

    if new_matches:
        db.commit()

    # In-memory sorting to support match_score_desc
    if sort_by == "match_score_desc":
        items_with_matches.sort(
            key=lambda j: (j["match"].blended_score if j["match"] else -1),
            reverse=True
        )
    elif sort_by == "posted_date_asc":
        items_with_matches.sort(key=lambda j: j["posted_date"] or "")
    elif sort_by == "title_asc":
        items_with_matches.sort(key=lambda j: j["title"].lower())
    else: # posted_date_desc
        items_with_matches.sort(key=lambda j: j["posted_date"] or "", reverse=True)

    total = len(items_with_matches)
    offset = (page - 1) * page_size
    paginated_items = items_with_matches[offset:offset + page_size]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return JobListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=[JobOut.model_validate(item) for item in paginated_items]
    )

@router.get("/jobs/stats", response_model=JobStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    active_jobs = db.query(Job).filter(Job.is_active == True).all()
    total = len(active_jobs)
    remote_cnt = sum(1 for j in active_jobs if j.remote_type == "remote")
    intern_cnt = sum(1 for j in active_jobs if j.is_internship)

    source_breakdown = {}
    cat_breakdown = {}

    for j in active_jobs:
        for s in (j.sources or [j.primary_source]):
            source_breakdown[s] = source_breakdown.get(s, 0) + 1
        cat = j.category or "General"
        cat_breakdown[cat] = cat_breakdown.get(cat, 0) + 1

    return JobStatsResponse(
        total_jobs=total,
        active_jobs=total,
        remote_jobs=remote_cnt,
        internship_jobs=intern_cnt,
        sources=source_breakdown,
        categories=cat_breakdown
    )

@router.get("/jobs/categories")
def get_categories(db: Session = Depends(get_db)):
    categories = (
        db.query(Job.category)
        .filter(Job.is_active == True)
        .distinct()
        .all()
    )
    return [c[0] for c in categories if c[0]]

@router.post("/jobs/manual", response_model=JobOut)
def create_manual_job(data: ManualJobCreate, db: Session = Depends(get_db)):
    fp = generate_fingerprint(data.title, data.company, data.location)
    urls = [data.apply_url] if data.apply_url else []

    job = Job(
        title=data.title.strip(),
        company=data.company.strip(),
        location=data.location.strip() if data.location else "Unknown",
        remote_type=data.remote_type.lower(),
        category=data.category or "General",
        is_internship=data.is_internship,
        description=data.description.strip(),
        apply_urls=urls,
        sources=["manual"],
        primary_source="manual",
        salary_range=data.salary_range,
        fingerprint=fp,
        is_active=True
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return JobOut.model_validate(job.to_dict())

@router.post("/ingest")
@router.post("/jobs/ingest")
async def trigger_ingestion(limit_per_source: int = 40, db: Session = Depends(get_db)):
    aggregator = IngestionAggregator(db)
    result = await aggregator.run(limit_per_source=limit_per_source)
    return result

@router.post("/jobs/{job_id}/verify-link")
async def check_link(job_id: str, db: Session = Depends(get_db)):
    result = await verify_job_links(db, job_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
