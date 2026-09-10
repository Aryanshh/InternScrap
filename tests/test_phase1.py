import asyncio
import os
import sys

# Ensure unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import Base, engine, SessionLocal
from backend.models.job import Job
from backend.services.dedup import (
    compute_similarity,
    clean_company_name,
    clean_title,
    generate_fingerprint,
    merge_job_records
)
from backend.services.ingestion.remotive import RemotiveSource
from backend.services.ingestion.arbeitnow import ArbeitnowSource
from backend.services.ingestion.remoteok import RemoteOKSource
from backend.services.ingestion.aggregator import IngestionAggregator

def test_dedup_logic():
    print("--- 1. Testing Deduplication & Similarity Logic ---", flush=True)
    
    # 1. Company name cleaning
    c1 = clean_company_name("Acme Corp.")
    c2 = clean_company_name("Acme Inc")
    print(f"Company clean: '{c1}' vs '{c2}'", flush=True)
    assert c1 == c2 == "acme", f"Expected 'acme', got '{c1}' and '{c2}'"

    # 2. Title cleaning
    t1 = clean_title("Senior Python Engineer (Remote)")
    t2 = clean_title("Senior Python Engineer")
    print(f"Title clean: '{t1}' vs '{t2}'", flush=True)
    assert t1 == t2 == "senior python engineer", f"Expected 'senior python engineer', got '{t1}' and '{t2}'"

    # 3. Similarity check
    score = compute_similarity(
        "Senior Frontend Engineer", "Stripe Inc.", "Remote",
        "Senior Frontend Engineer (Remote)", "Stripe", "Worldwide"
    )
    print(f"Similarity Score: {score:.1f}%", flush=True)
    assert score >= 85.0, f"Expected score >= 85, got {score}"

    print(" Deduplication logic unit tests PASSED!\n", flush=True)

async def test_sources_individually():
    print("--- 2. Testing Sources Individually ---", flush=True)

    print("Testing Remotive...", flush=True)
    remotive = RemotiveSource()
    r_jobs = await remotive.fetch_jobs(limit=3)
    print(f" Remotive returned: {len(r_jobs)} jobs", flush=True)

    print("Testing Arbeitnow...", flush=True)
    arbeit = ArbeitnowSource()
    a_jobs = await arbeit.fetch_jobs(limit=3)
    print(f" Arbeitnow returned: {len(a_jobs)} jobs", flush=True)

    print("Testing RemoteOK...", flush=True)
    rok = RemoteOKSource()
    rok_jobs = await rok.fetch_jobs(limit=3)
    print(f" RemoteOK returned: {len(rok_jobs)} jobs", flush=True)

async def test_aggregator():
    print("\n--- 3. Testing Aggregator and Database Persistence ---", flush=True)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        aggregator = IngestionAggregator(db)
        print("Running IngestionAggregator.run(limit_per_source=10)...", flush=True)
        summary = await aggregator.run(limit_per_source=10)
        print(f" Aggregator result: {summary}", flush=True)

        count = db.query(Job).count()
        print(f" Total jobs stored in DB: {count}", flush=True)
        assert count > 0, "No jobs saved in database"

        sample = db.query(Job).first()
        print(f" Sample Job: '{sample.title}' at '{sample.company}' | Sources: {sample.sources} | ApplyURLs: {sample.apply_urls}", flush=True)
        print("\n ALL VERIFICATIONS PASSED!", flush=True)
    finally:
        db.close()

if __name__ == "__main__":
    test_dedup_logic()
    asyncio.run(test_sources_individually())
    asyncio.run(test_aggregator())
