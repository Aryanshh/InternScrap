import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app

client = TestClient(app)

def test_daily_21_drops_retrieval_and_stability():
    # 1. First fetch for demo user
    res1 = client.get("/api/daily-21?user_id=demo")
    assert res1.status_code == 200, f"Failed to get Daily 21 drops: {res1.text}"
    data1 = res1.json()
    assert data1["success"] is True
    assert data1["total"] == 21, f"Expected 21 jobs, got {data1['total']}"
    assert len(data1["jobs"]) == 21

    # Verify attributes of each job
    for j in data1["jobs"]:
        assert j["id"]
        assert j["title"]
        assert j["company"]
        assert j["apply_url"].startswith("http")
        assert j["match_score"] >= 0
        assert j["remote_type"] == "remote"
        assert "application_status" in j

    # 2. Verify stability (second fetch returns the exact same 21 jobs for the day)
    res2 = client.get("/api/daily-21?user_id=demo")
    assert res2.status_code == 200
    data2 = res2.json()
    ids1 = [j["id"] for j in data1["jobs"]]
    ids2 = [j["id"] for j in data2["jobs"]]
    assert ids1 == ids2, "Daily 21 drops must be stable across queries on the same day"

def test_daily_21_apply_all_endpoint_validation():
    # Trigger batch with 1 selected job in review mode
    res_list = client.get("/api/daily-21?user_id=demo")
    assert res_list.status_code == 200
    jobs = res_list.json()["jobs"]
    assert len(jobs) > 0
    sample_id = jobs[0]["id"]

    res = client.post("/api/daily-21/apply-all?user_id=demo", json={
        "mode": "review",
        "theme": "classic",
        "job_ids": [sample_id]
    })
    assert res.status_code == 200, f"Trigger failed: {res.text}"
    data = res.json()
    assert data["success"] is True
    assert "batch_id" in data
    assert data["total"] == 1
    batch_id = data["batch_id"]

    # Check progress
    prog_res = client.get(f"/api/daily-21/progress/{batch_id}")
    assert prog_res.status_code == 200
    prog = prog_res.json()
    assert prog["batch_id"] == batch_id
    assert prog["status"] in ("running", "completed")
    assert prog["total"] == 1
    assert "results" in prog
    assert "logs" in prog
