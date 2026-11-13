import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import Base, get_db
from backend.main import app
from backend.routes.threads_radar import THREADS_RADAR_CONFIG
from backend.services.ingestion.threads_scanner import (
    classify_threads_post,
    fetch_via_meta_api,
    inspect_threads_url,
    is_valid_threads_url,
)


@pytest.fixture()
def isolated_client(tmp_path):
    """Provides a FastAPI TestClient backed by an isolated temporary SQLite DB."""
    db_file = tmp_path / "threads_test.db"
    test_engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
        test_engine.dispose()


def test_threads_url_validation():
    assert is_valid_threads_url("https://www.threads.net/@studio/post/C9abc123") is True
    assert is_valid_threads_url("https://threads.com/@builder/post/XYZ999") is True
    assert is_valid_threads_url("https://evilthreads.net/@user/post/1") is False
    assert is_valid_threads_url("https://instagram.com/p/123") is False
    assert is_valid_threads_url("not-a-url") is False


def test_classifier_verticals_and_self_promo_filtering():
    graphic_post = (
        "We're hiring a freelance Graphic Designer & Brand Identity specialist for a rebrand. "
        "Figma + logo concepts needed. Budget $1,500 - $2,500. DM me your portfolio!"
    )
    res_g = classify_threads_post(graphic_post, author="brand_studio")
    assert res_g["is_opportunity"] is True
    assert res_g["primary_vertical"] == "graphic"
    assert "$1,500" in (res_g["compensation_hint"] or "")

    tech_post = (
        "Hiring a Python FastAPI & React Software Engineer intern! $45/hr remote. "
        "Apply via https://docs.google.com/forms/d/e/testform/viewform"
    )
    res_t = classify_threads_post(tech_post, author="ai_startup")
    assert res_t["is_opportunity"] is True
    assert res_t["primary_vertical"] == "tech"
    assert res_t["is_internship"] is True

    project_post = (
        "Looking for a freelancer for a paid MVP project on Shopify + landing page sprint. "
        "Fixed price $2,000. Send your portfolio."
    )
    res_p = classify_threads_post(project_post, author="founder")
    assert res_p["is_opportunity"] is True
    assert res_p["primary_vertical"] == "project"

    self_promo = (
        "Available for hire! Commissions open for graphic design and logo concepts. "
        "Check out my recent work and portfolio."
    )
    res_noise = classify_threads_post(self_promo, author="freelancer")
    assert res_noise["is_opportunity"] is False
    assert res_noise["rejected_reason"] is not None


def test_meta_api_fetcher_and_oembed_inspection_mocked():
    async def _run():
        mock_meta_resp = MagicMock()
        mock_meta_resp.status_code = 200
        mock_meta_resp.json.return_value = {
            "data": [
                {
                    "id": "17900112233",
                    "text": "Hiring a Graphic Designer for packaging and brand identity. Paid gig $900.",
                    "permalink": "https://www.threads.net/@brandlab/post/D1234",
                    "timestamp": "2026-11-11T10:00:00+0000",
                    "username": "brandlab",
                }
            ]
        }

        with patch("backend.services.ingestion.threads_scanner.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_meta_resp
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)

            posts, status_info = await fetch_via_meta_api(
                access_token="dummy_token_123456",
                queries=["hiring graphic designer"],
                limit=10,
            )
            assert status_info["status"] == "ok"
            assert len(posts) == 1
            assert posts[0]["username"] == "brandlab"

        mock_oembed_resp = MagicMock()
        mock_oembed_resp.status_code = 200
        mock_oembed_resp.json.return_value = {
            "author_name": "design_lead",
            "html": "<blockquote><p>Looking for a React TypeScript developer for a 2-week paid project ($1800).</p></blockquote>",
        }

        with patch("backend.services.ingestion.threads_scanner.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_oembed_resp
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)

            inspected = await inspect_threads_url("https://www.threads.net/@design_lead/post/C9demoInspect")
            assert inspected["classification"]["is_opportunity"] is True
            assert inspected["classification"]["primary_vertical"] in ("tech", "project")
            assert inspected["normalized"].primary_source == "Threads"

    asyncio.run(_run())


def test_threads_radar_api_endpoints(isolated_client):
    # Seed deterministically in demo mode so API checks never depend on live Fediverse availability
    seed_res = isolated_client.post("/api/threads/scan", json={"mode": "demo", "send_alerts": False})
    assert seed_res.status_code == 200, seed_res.text

    res_all = isolated_client.get("/api/threads/opportunities?vertical=all&auto_seed=false")
    assert res_all.status_code == 200, res_all.text
    data_all = res_all.json()
    assert data_all["count"] >= 6
    assert data_all["vertical_counts"]["graphic"] >= 2
    assert data_all["vertical_counts"]["tech"] >= 2
    assert data_all["vertical_counts"]["project"] >= 2

    # Ensure filtered self-promo post never appears in opportunities
    for opp in data_all["opportunities"]:
        assert "random_portfolio_promo" not in opp["company"]

    # Vertical filter checks
    for v in ("graphic", "tech", "project"):
        res_v = isolated_client.get(f"/api/threads/opportunities?vertical={v}")
        assert res_v.status_code == 200
        items_v = res_v.json()["opportunities"]
        assert len(items_v) >= 2
        assert all(item["vertical"] == v for item in items_v)

    # Manual scan in demo mode (idempotent deduplication)
    scan_res = isolated_client.post("/api/threads/scan", json={"mode": "demo", "send_alerts": False})
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["success"] is True
    assert scan_data["newly_added"] == 0
    assert scan_data["scan_report"]["self_promo_filtered_count"] >= 1

    # Invalid mode rejected
    bad_scan = isolated_client.post("/api/threads/scan", json={"mode": "unsupported_mode"})
    assert bad_scan.status_code == 400

    # Invalid URL rejected
    bad_url = isolated_client.post("/api/threads/parse-url", json={"url": "https://example.com/not-threads"})
    assert bad_url.status_code == 400


def test_threads_config_masking_and_test_alert(isolated_client):
    orig_token = THREADS_RADAR_CONFIG["access_token"]
    orig_interval = THREADS_RADAR_CONFIG["scan_interval_minutes"]
    try:
        update_res = isolated_client.put(
            "/api/threads/config",
            json={
                "access_token": "secret_threads_token_7890",
                "scan_interval_minutes": 45,
                "enabled_verticals": ["graphic", "tech", "project"],
            },
        )
        assert update_res.status_code == 200
        cfg = update_res.json()["config"]
        assert cfg["scan_interval_minutes"] == 45
        assert cfg["providers"]["meta_api_configured"] is True
        assert cfg["providers"]["meta_api_token_preview"] == "***7890"
        assert "secret_threads_token" not in str(cfg)

        alert_res = isolated_client.post("/api/threads/test-alert")
        assert alert_res.status_code == 200
        alert_data = alert_res.json()
        assert alert_data["success"] is True
        assert alert_data["delivery"]["sent_count"] >= 1
    finally:
        THREADS_RADAR_CONFIG["access_token"] = orig_token
        THREADS_RADAR_CONFIG["scan_interval_minutes"] = orig_interval
