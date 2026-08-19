from __future__ import annotations

import json
import re
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
    assert "investment_research" in report
    assert report["upcoming_events"]["version"] == "UpcomingEvents-v1.0"
    assert report["upcoming_events"]["score_policy"]["affects_health_score"] is False


def test_evidence_frontend_contains_chart_and_source_sections() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    adapter = (root / "client_report_adapter.py").read_text(encoding="utf-8")
    assert 'id="historyChart"' in html
    assert 'id="positiveFactors"' in html
    assert 'id="negativeFactors"' in html
    assert 'id="sourceGrid"' in html
    assert 'id="scoreBridge"' in html
    assert 'id="impactDefinition"' in html
    assert 'id="factorBreakdown"' in html
    asset_versions = re.findall(r'/assets/(?:evidence\.css|home\.css|app\.js)\?v=([^"\']+)', html)
    assert len(asset_versions) == 3
    assert len(set(asset_versions)) == 1
    assert 'id="todayChangesGrid"' in html
    assert "function renderTodayChanges" in js
    assert 'class="today-change-explain"' in js
    assert '查看原始資料 ↗' in js
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
    assert 'id="homeView"' in html
    assert 'id="detailNavigation"' in html
    assert 'id="backToCenterButton"' in html
    assert 'id="brandHomeLink"' in html
    assert "function showDetailView" in js
    assert "function showHomeView" in js
    assert 'loadStock("2330");' not in js
    assert 'data-stock-card=' in js
    assert 'role="link"' in js
    assert 'event.target.closest("[data-save-stock]")' in js
    assert 'id="inviteGate"' in html
    assert 'id="inviteForm"' in html
    assert 'id="inviteCode"' in html
    assert 'id="logoutButton"' in html
    assert "function initializeBetaAccess" in js
    assert 'fetch("/api/beta/activate"' in js
    assert 'fetch("/api/beta/logout"' in js
    assert 'id="companyResearch"' in html
    assert 'id="valuationResearch"' in html
    assert 'id="comparisonResearch"' in html
    assert 'id="researchFit"' in html
    assert "function renderInvestmentResearch" in js
    assert "sector_median_return_pct" in js
    assert "relative_to_peer_median_pct_point" in js
    assert "peer-comparison-list" in js
    assert "function signedPercent" in js
    assert "function sectorPosition" in js
    assert '單一同業參考' in js
    assert 'class="comparison-values"' in js
    assert '單期 EPS 參考比值' in js
    assert 'id="dailyConclusionTitle"' in html
    assert 'id="todayDigest"' in html
    assert 'id="watchlistPreview"' in html
    assert 'id="futureEvents"' in html
    assert 'id="futureEventsStatus"' in html
    assert "function renderUpcomingEvents" in js
    assert "function allUpcomingEvents" in js
    assert "UpcomingEvents-v1.0" in js
    assert "查看官方資料 ↗" in js
    assert "affects_health_score !== false" in js
    assert 'data-tab="events"' in html
    assert 'data-tab="explore"' in html
    assert "function renderHomeDashboard" in js
    assert 'id="dailyResearchSection"' in html
    assert 'id="dailyResearchSteps"' in html
    assert "DailyResearch-v1" in js
    assert "function renderDailyResearch" in js
    assert 'localStorage.getItem(dailyResearchStorageKey(dataDate))' in js
    assert "function startDailyResearchStep" in js
    assert "Web v3.4.4 Preview" in html
    assert 'id="notificationPanel"' in html
    assert 'id="notificationUnread"' in html
    assert 'class="notification-bell"' in html
    assert "function renderNotificationCenter" in js
    assert '"income_profile":' in adapter
    assert '"growth_profile":' in adapter
    assert '"cyclical_profile":' in adapter
    assert '"event_profile":' in adapter
    assert 'id="incomeDecision"' in html
    assert 'incomeProfile.status === "available"' in js
    assert 'growthProfile.status === "available"' in js
    assert 'cyclicalProfile.status === "available"' in js
    assert 'eventProfile.status === "available"' in js
    assert 'classList.remove("score-good", "score-neutral", "score-watch")' in js
    assert 'aiStockNotificationReadIds' in js
    assert 'research_notifications' in adapter
    assert 'const saved = new Set(watchlist());' in js
    assert 'stockId === "MARKET" || saved.has(stockId)' in js
    assert "refreshWatchlistUI();\n  renderNotificationCenter();" in js
    assert 'id="themeToggle"' in html
    assert 'localStorage.getItem("aiStockTheme")' in html
    assert 'const THEME_STORAGE_KEY = "aiStockTheme"' in js
    assert "function applyTheme" in js
    assert "function toggleTheme" in js
    assert 'document.documentElement.dataset.theme' in js
    assert 'id="dailyResearchSummary"' in html
    assert "why_it_matters_zh" in js
    assert "item_count" in js
    assert "今天整理出" in js
    assert 'change:"檔股票"' in js
    assert 'follow_up:"檔股票"' in js
    assert "檔股票有變化" in js
    assert "function homeDirection" in js
    assert 'id="homePage"' in html
    assert 'id="watchlistPage"' in html
    assert 'id="eventsPage"' in html
    assert 'id="profilePage"' in html
    assert 'id="exploreSearch"' in html
    assert 'id="exploreSort"' in html
    assert "function switchPage" in js
    assert "function renderWatchlistPage" in js
    assert "function renderEventsPage" in js
    assert "function renderProfilePage" in js
    assert "function allResearchEvents" in js
    asset_versions = re.findall(r'/assets/(?:evidence\.css|home\.css|app\.js)\?v=([^"\']+)', html)
    assert len(asset_versions) == 3
    assert len(set(asset_versions)) == 1
    assert "function reportNetImpact" in js
    assert "function categoryLabel" in js
    assert "function scoreSparkline" in js


def test_invite_gate_activation_and_logout(tmp_path: Path, monkeypatch) -> None:
    store = BetaAccessStore(tmp_path / "beta.sqlite3")
    invitation = store.create_invites(1)[0]
    monkeypatch.setattr(app_module, "REQUIRE_INVITE", True)
    monkeypatch.setattr(app_module, "SECURE_COOKIE", False)
    monkeypatch.setattr(app_module, "beta_access", store)
    gated = TestClient(app_module.app)

    assert gated.get("/api/beta/session").json()["authorized"] is False
    assert gated.get("/api/stocks").status_code == 401

    activated = gated.post("/api/beta/activate", json={"invite_code": invitation["invite_code"]})
    assert activated.status_code == 200
    assert activated.json()["tester_code"] == "BETA-001"
    assert gated.get("/api/beta/session").json()["authorized"] is True
    assert gated.get("/api/stocks").status_code == 200

    assert gated.post("/api/beta/logout").status_code == 200
    assert gated.get("/api/beta/session").json()["authorized"] is False


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


def test_today_change_cards_keep_questions_and_use_dated_official_links(tmp_path: Path) -> None:
    target = tmp_path / "database" / "client_reports" / "2330"
    target.mkdir(parents=True)
    source = Path(__file__).parents[1] / "sample_reports" / "2330.json"
    payload = json.loads(source.read_text(encoding="utf-8"))
    payload["today_changes"] = {
        "summary_zh": "共有兩項變化。",
        "events": [
            {
                "event_id": "T1", "category": "technical", "title_zh": "技術變化",
                "source_time": "2026-08-10", "source_url": "https://www.twse.com.tw/zh/trading/historical/stock-day.html",
                "six_questions": {"what_happened_zh": "股價站回均線。", "meaning_zh": "短期走勢改善。", "score_reason_zh": "因此增加 0.2 分。"},
            },
            {
                "event_id": "I1", "category": "institutional", "title_zh": "法人變化",
                "source_time": "2026-08-10", "source_url": "https://www.twse.com.tw/zh/trading/foreign/t86.html",
            },
        ],
    }
    (target / "latest.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    report = ClientReportRepository(tmp_path, source.parent).load("2330")
    assert report is not None
    events = report["today_changes"]["events"]
    assert events[0]["what_happened"] == "股價站回均線。"
    assert events[0]["source_url"].endswith("/company/stock.html?code=2330")
    assert events[1]["source_url"].endswith("/company/investors.html?code=2330")
    assert len(events) == 2


def test_upcoming_event_adapter_only_keeps_verified_non_scoring_events(tmp_path: Path) -> None:
    target = tmp_path / "database" / "client_reports" / "2330"
    target.mkdir(parents=True)
    source = Path(__file__).parents[1] / "sample_reports" / "2330.json"
    payload = json.loads(source.read_text(encoding="utf-8"))
    payload["upcoming_events"] = {
        "version": "UpcomingEvents-v1.0", "status": "available",
        "score_policy": {"affects_health_score": False, "mode": "context_only"},
        "events": [
            {"event_id": "safe", "verified": True, "affects_health_score": False},
            {"event_id": "guess", "verified": False, "affects_health_score": False},
            {"event_id": "scored", "verified": True, "affects_health_score": True},
        ],
    }
    (target / "latest.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    report = ClientReportRepository(tmp_path, source.parent).load("2330")
    assert report is not None
    assert [item["event_id"] for item in report["upcoming_events"]["events"]] == ["safe"]
    assert report["upcoming_events"]["event_count"] == 1
