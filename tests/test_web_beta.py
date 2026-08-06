from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

import app as app_module
from app import app
from beta_access import BetaAccessStore
from client_report_adapter import ClientReportRepository


client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert "report_root" not in response.json()


def test_stock_center_returns_customer_safe_summaries() -> None:
    response = client.get("/api/stocks")
    assert response.status_code == 200
    payload = response.json()
    assert payload["counts"]["stocks"] == len(payload["stocks"])
    assert payload["counts"]["sectors"] == len(payload["sectors"])
    assert payload["stocks"]
    first = payload["stocks"][0]
    assert {"id", "name", "industry", "score", "assessment", "grade", "risk_level", "updated"} <= set(first)
    assert "candidate_id" not in first
    assert "holdout" not in first


def test_feedback_form_is_prefilled_without_server_secrets() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    javascript = (root / "web" / "app.js").read_text(encoding="utf-8")
    assert 'id="feedbackButton"' in html
    assert "entry.1967805630" in javascript
    assert "entry.1628915144" in javascript
    assert "TESTER_CODE" not in javascript


def test_invites_are_hashed_and_sessions_expire(tmp_path: Path) -> None:
    store = BetaAccessStore(tmp_path / "beta.sqlite3")
    invite = store.create_invites(1)[0]
    with sqlite3.connect(store.database_path) as connection:
        stored = connection.execute("SELECT invite_hash FROM beta_invites").fetchone()[0]
    assert stored != invite["invite_code"]
    assert len(stored) == 64
    token, session = store.activate(invite["invite_code"])
    assert session.tester_code == invite["tester_code"]
    assert store.validate(token) is not None
    assert store.revoke(session.tester_code)
    assert store.validate(token) is None


def test_invite_mode_protects_stock_api(tmp_path: Path) -> None:
    original_store = app_module.beta_access
    original_required = app_module.REQUIRE_INVITE
    try:
        store = BetaAccessStore(tmp_path / "beta.sqlite3")
        invite = store.create_invites(1)[0]
        app_module.beta_access = store
        app_module.REQUIRE_INVITE = True
        gated = TestClient(app)
        assert gated.get("/api/stocks").status_code == 401
        activated = gated.post(
            "/api/beta/activate", json={"invite_code": invite["invite_code"]}
        )
        assert activated.status_code == 200
        assert activated.json()["tester_code"] == invite["tester_code"]
        assert gated.get("/api/stocks").status_code == 200
    finally:
        app_module.beta_access = original_store
        app_module.REQUIRE_INVITE = original_required


def test_report_is_customer_safe() -> None:
    response = client.get("/api/stocks/2330")
    assert response.status_code == 200
    report = response.json()["report"]
    assert report["id"] == "2330"
    assert len(report["indicators"]) == 5
    assert "candidate_id" not in report
    assert "holdout" not in report


def test_invalid_stock_id_is_rejected() -> None:
    assert client.get("/api/stocks/23A0").status_code == 400


def test_unknown_stock_returns_404() -> None:
    assert client.get("/api/stocks/9999").status_code == 404


def test_repository_prefers_and_normalizes_engine_report(tmp_path: Path) -> None:
    target = tmp_path / "database" / "client_reports" / "2330"
    target.mkdir(parents=True)
    source = Path(__file__).parents[1] / "sample_reports" / "2330.json"
    payload = json.loads(source.read_text(encoding="utf-8"))
    payload["stock"]["display_name"] = "TSMC (2330)"
    payload["stock"]["industry"] = ""
    payload["health_indicators"] = list(payload["health_indicators"].values())
    payload["health_indicators"][0]["key"] = "financial"
    payload["health_indicators"][0]["description"] = "EPS contribution"
    payload["health_indicators"][0].pop("summary_zh", None)
    (target / "latest.json").write_text(json.dumps(payload), encoding="utf-8")

    repository = ClientReportRepository(tmp_path, Path(__file__).parents[1] / "sample_reports")
    report = repository.load("2330")
    assert report is not None
    assert report["name"] != "TSMC (2330)"
    assert report["industry"] != ""
    assert report["indicators"][0]["note"] == "EPS contribution"
    assert report["source"] == "engine"
