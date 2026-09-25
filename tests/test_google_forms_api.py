import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app

client = TestClient(app)

def test_google_forms_jobs_listing():
    res = client.get("/api/google-forms/jobs")
    assert res.status_code == 200, f"Failed: {res.text}"
    data = res.json()
    assert "count" in data
    assert "jobs" in data
    assert data["count"] > 0
    assert len(data["jobs"]) > 0

    first_job = data["jobs"][0]
    assert first_job["title"]
    assert first_job["company"]
    assert any("docs.google.com/forms" in u or "forms.gle" in u for u in first_job.get("apply_urls", []))

def test_google_forms_parse_url_validation():
    # Invalid URL format rejected
    invalid_res = client.post("/api/google-forms/parse-url", json={"url": "https://randomsite.com/apply"})
    assert invalid_res.status_code == 400

    # Valid format accepted
    valid_res = client.post("/api/google-forms/parse-url", json={
        "url": "https://docs.google.com/forms/d/e/1FAIpQLSc7z8w4H1e7t6A5m8Y2p4r9s1d0f3g5h7j9k1l/viewform"
    })
    assert valid_res.status_code == 200
    res_data = valid_res.json()
    assert res_data["success"] is True
    assert "job" in res_data
    assert res_data["job"]["primary_source"] == "Google Forms"
