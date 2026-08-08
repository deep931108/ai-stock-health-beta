from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app import app
from client_report_adapter import ClientReportRepository


client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_report_is_customer_safe() -> None:
    response = client.get("/api/stocks/2330")
    assert response.status_code == 200
    report = response.json()["report"]
    assert report["id"] == "2330"
    assert len(report["indicators"]) == 5
    assert "candidate_id" not in report
    assert "holdout" not in report


def test_evidence_history_and_sources_are_exposed_to_customer() -> None:
    response = client.get("/api/stocks/2330")
    assert response.status_code == 200
    report = response.json()["report"]
    assert "score_interval" in report
    assert "score_method" in report
    assert isinstance(report["positive_factors"], list)
    assert isinstance(report["negative_factors"], list)
    assert isinstance(report["score_history"], list)
    assert isinstance(report["data_sources"], list)


def test_evidence_frontend_contains_chart_and_source_sections() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    assert 'id="historyChart"' in html
    assert 'id="positiveFactors"' in html
    assert 'id="negativeFactors"' in html
    assert 'id="sourceGrid"' in html
    assert 'id="scoreBridge"' in html
    assert 'id="impactDefinition"' in html
    assert 'id="factorBreakdown"' in html
    assert 'evidence.css?v=1.5' in html
    assert 'app.js?v=1.5' in html
    assert 'score-evidence-item' in js
    assert 'score-evidence-metrics' in js
    assert "function renderHistory" in js
    assert "function renderEvidence" in js
    assert "health_impact" not in js
    assert "item.impact" in js
    assert 'id="stockCenter"' in html
    assert 'id="stockCenterGrid"' in html
    assert 'id="watchlistOnlyButton"' in html
    assert "function renderStockCenter" in js
    assert 'localStorage.getItem("aiStockWatchlist")' in js
    assert "完整清單將在下一階段加入" not in js


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
