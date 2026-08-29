from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi.testclient import TestClient

import app as app_module
from app import app
from beta_access import BetaAccessStore
from beta_insights import BetaInsightsStore
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
    assert 'event.target.closest("[data-save-stock], [data-compare-stock], [data-open-stock]")' in js
    assert 'data-compare-stock="${item.id}"' in js
    assert 'data-open-stock="${item.id}"' in js
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
    assert "Web v3.6.1 Beta" in html
    assert 'id="integratedDecision"' in html
    assert 'id="integratedReasonGrid"' in html
    assert 'id="integratedFollowUpList"' in html
    assert 'id="integratedTrendChart"' in html
    assert "function renderIntegratedDecision" in js
    assert "renderIntegratedDecision(report);" in js
    assert "function stockDecisionProfile" in js
    assert 'financial_income: item.income_profile' in js
    assert 'growth_quality: item.growth_profile' in js
    assert 'cyclical: item.cyclical_profile' in js
    assert 'high_volatility_event: item.event_profile' in js
    assert 'item.stock_profile?.profile_id === activeSector' in js
    assert 'class="stock-card-profile"' in js
    assert 'class="stock-card-decision"' in js
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
    assert "function reportEventGroups" in js
    assert "function allResearchEventGroups" in js
    assert "let rows = allResearchEventGroups();" in js
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

def test_home_upcoming_events_enforces_lifecycle() -> None:
    root = Path(__file__).parents[1]
    js = (
        root / "web" / "app.js"
    ).read_text(encoding="utf-8")

    assert 'const lifecycleStatus = String(event.status || "")' in js
    assert '["scheduled", "updated"].includes(lifecycleStatus)' in js
    assert 'if (eventDate < todayKey) return' in js
    assert 'const unique = new Map()' in js

def test_beginner_onboarding_is_versioned_and_restartable() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    assert 'id="onboardingDialog"' in html
    assert 'id="onboardingSpotlight"' in html
    assert 'id="restartOnboarding"' in html
    assert 'const ONBOARDING_VERSION = "1"' in js
    assert 'const ONBOARDING_STORAGE_KEY = "aiStockOnboardingVersion"' in js
    assert "function startOnboarding" in js
    assert "function finishOnboarding" in js
    assert "價格位置不是合理價" in js
    assert "不是預測報酬，也不是買賣分數" in js
    assert "不提供明牌、目標價或買賣指令" in js
    assert "/* Beginner onboarding v1 */" in css

def test_research_personality_quiz_contract() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    required_html = [
        'id="personalityPage"',
        'id="personalityIntro"',
        'id="personalityQuiz"',
        'id="personalityResult"',
        'id="personalityOptions"',
        'id="personalityProgressBar"',
        'id="personalityPrevious"',
        'id="personalityNext"',
        'id="personalityRetake"',
        'id="personalityFinish"',
        'id="profilePersonality"',
        'id="profilePersonalityName"',
    ]

    for item in required_html:
        assert item in html

    assert "15 個連續情境" in html
    assert re.search(r"<b>9</b>\s*<span>種研究人格</span>", html)
    assert "只整理研究偏好與風險傾向" in html
    assert "不會改變任何股票的健康分數" in html
    assert "人格只改變閱讀方式，不改變研究結果" in html

    required_profiles = [
        "至準智者",
        "至準智者",
        "光環獵手",
        "光環獵手",
        "估值賢者",
        "估值賢者",
        "盾之守護者",
        "盾之守護者",
        "迷霧刺客",
        "迷霧刺客",
        "培育長老",
        "培育長老",
        "觀市者",
        "觀市者",
        "追星的孩子",
        "追星的孩子",
    ]

    for profile in required_profiles:
        assert profile in js

    required_functions = [
        "function savedPersonalityResult",
        "function openPersonalityPage",
        "function startPersonalityQuiz",
        "function renderPersonalityQuestion",
        "function selectPersonalityOption",
        "function completePersonalityQuiz",
        "function renderPersonalityResult",
        "function renderProfilePersonality",
    ]

    for function_name in required_functions:
        assert function_name in js

    assert 'const PERSONALITY_VERSION = "4"' in js
    assert 'const PERSONALITY_STORAGE_KEY = "aiStockResearchPersonality"' in js
    assert "researchPersonalityQuestions" in js
    assert "const gc9Profiles" in js
    assert "personalityAnswers = Array(12).fill(null)" in js
    assert "affectsHealthScore: false" in js

    required_css = [
        "/* Research personality quiz v1 */",
        ".personality-intro",
        ".personality-quiz",
        ".personality-option",
        ".personality-result-hero",
        ".personality-result-grid",
        ".profile-personality-card",
    ]

    for selector in required_css:
        assert selector in css

def test_personality_result_has_dimension_report() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    assert 'id="personalityDimensionChart"' in html
    assert 'id="personalityDimensionSummary"' in html
    assert "你的研究風格座標" in html
    assert "這不是金融風險屬性評估" in html

    assert "function personalityDimensionRows" in js
    assert "function renderPersonalityDimensions" in js
    assert "renderPersonalityDimensions(result)" in js

    for label in [
        "守證",
        "探訊",
        "營運",
        "市場",
        "定錨",
        "尋星",
        "築流",
        "應變",
    ]:
        assert label in js

    assert "/* Research personality dimension report v5 */" in css
    assert "--personality-report-bg" in css
    assert ".personality-dimension-chart" in css
    assert ".personality-dimension-track" in css


def test_gc9_personality_axis_contract() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")

    assert "15 個連續情境" in html
    assert '<b>9</b><span>種研究人格</span>' in html
    assert 'const PERSONALITY_VERSION = "4"' in js
    assert "researchPersonalityAxisDefinitions" in js
    assert "const gc9Profiles" in js
    assert 'system: "GC-9"' in js
    assert "axisScores" in js
    assert "personalityDimensionRows(scores)" in js
    assert "averageMargin" in js
    assert "affectsHealthScore: false" in js
    for name in (
        "至準智者", "至準智者", "光環獵手", "光環獵手",
        "估值賢者", "估值賢者", "盾之守護者", "盾之守護者",
        "迷霧刺客", "迷霧刺客", "培育長老", "培育長老",
        "觀市者", "觀市者", "追星的孩子", "追星的孩子",
    ):
        assert name in js



def test_gc9_result_uses_branded_inspection_report() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    for element_id in [
        'id="personalityResultCode"',
        'id="personalityResultClarity"',
        'id="personalityReportMeta"',
        'id="personalityResultSymbol"',
    ]:
        assert element_id in html

    assert "function personalityTotemSvg" in js
    assert 'personalityTotemSvg(`${result.primary}${result.rhythm || "c"}`)' in js
    assert 'result.clarity || "研究方式較為平衡"' in js
    assert "GC-9 personality inspection report v2" in css
    assert "personality-report-meta" in css
    assert "border-top:3px solid #e39a58" in css



def test_gc9_questions_form_one_continuous_everyday_story() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(encoding="utf-8")

    story_markers = [
        "星期一早上 · 一則朋友訊息",
        "星期三早上 9:10 · 股價突然下跌",
        "星期三上午 · 群組消息擴散",
        "星期三午休 · 公司發布說明",
        "三個月後 · 第一份成績單",
        "週末晚上 · 整理這段研究",
    ]

    for marker in story_markers:
        assert marker in js

    question_block = js.split(
        "const researchPersonalityQuestions = [",
        1,
    )[1].split("const onboardingSteps = [", 1)[0]

    assert question_block.count('axis: "') == 12
    assert question_block.count("axisScores:") == 36

    for product_term in [
        "GC",
        "AI Stock Terminal",
        "Guided",
        "Pro",
        "健康分數",
    ]:
        assert product_term not in question_block



def test_gc9_result_supports_private_safe_social_sharing() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    for element_id in [
        'id="personalityShare"',
        'id="personalityCopy"',
        'id="personalityDownload"',
        'id="personalityShareStatus"',
    ]:
        assert element_id in html

    for function_name in [
        "function personalityShareText",
        "function sharePersonalityResult",
        "function copyPersonalityResult",
        "function personalityShareCanvas",
        "function downloadPersonalityReport",
    ]:
        assert function_name in js

    assert "navigator.share" in js
    assert 'canvas.width = 1080' in js
    assert 'canvas.height = 1350' in js
    assert 'link.download = `GC-9-' in js
    assert "GC-9 result sharing v1" in css
    assert "safe-area-inset-bottom" in css

    share_function = js.split(
        "function personalityShareText",
        1,
    )[1].split("function copyTextSafely", 1)[0]

    for private_term in [
        "aiStockWatchlist",
        "inviteCode",
        "profileTesterCode",
        "stockCatalog",
    ]:
        assert private_term not in share_function



def test_gc9_visible_question_count_matches_fifteen_question_contract() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")

    assert "<b>15</b><span>個連續情境</span>" in html
    assert "第 1 題，共 12 題" in html
    assert 'id="personalityProgressText">8%</b>' in html
    assert "<b>8</b><span>個情境問題</span>" not in html
    assert "第 1 題，共 8 題" not in html



def test_stock_comparison_phase_one_selection_contract() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    for element_id in [
        'id="compareSelectionBar"',
        'id="compareSelectionSlots"',
        'id="openComparisonButton"',
        'id="clearComparisonButton"',
        'id="comparisonPage"',
        'id="comparisonWorkspace"',
        'id="comparisonStockCards"',
        'id="comparisonEmpty"',
    ]:
        assert element_id in html

    for function_name in [
        "function savedComparisonSelection",
        "function saveComparisonSelection",
        "function toggleComparisonStock",
        "function renderComparisonSelectionBar",
        "function renderComparisonPage",
        "function openComparisonPage",
    ]:
        assert function_name in js

    assert 'const COMPARE_STORAGE_KEY = "aiStockComparison"' in js
    assert 'data-compare-stock="${item.id}"' in js
    assert "比較用來理解差異，不是選出一定值得買的股票" in html
    assert "Stock comparison selection v1" in css
    assert "grid-template-columns:repeat(2,minmax(0,1fr))" in css



def test_stock_comparison_phase_two_research_contract() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    for element_id in [
        'id="comparisonContext"',
        'id="comparisonDimensions"',
        'id="comparisonPurpose"',
        'id="comparisonFollowUp"',
    ]:
        assert element_id in html

    for function_name in [
        "function comparisonProfileEvidence",
        "function comparisonPurposeFor",
        "function comparisonDimensionRows",
        "function renderComparisonContext",
        "function renderComparisonDimensions",
        "function renderComparisonPurpose",
        "function renderComparisonFollowUp",
        "function renderFullComparison",
    ]:
        assert function_name in js

    for dimension in [
        "公司目前狀態",
        "目前風險壓力",
        "目前價格位置",
        "判斷把握度",
        "各自最重要的營運證據",
        "最近研究方向",
    ]:
        assert dimension in js

    assert "價格位置不是合理價、目標價或買賣建議" in js
    assert "健康分數較高，也不代表報酬一定較高" in html
    assert "Full stock comparison research v1" in css

def test_comparison_follow_up_uses_profile_specific_evidence() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")

    assert "function comparisonFollowUpItems" in js
    assert 'profileId === "financial_income"' in js
    assert 'profileId === "growth_quality"' in js
    assert 'profileId === "cyclical"' in js
    assert 'profileId === "high_volatility" || profileId === "event_driven"' in js
    assert "股利政策" in js
    assert "資產品質與資本強度" in js
    assert "自由現金流" in js
    assert "景氣循環階段" in js
    assert "正式公告或已確認日程" in js
    assert "return supplied.slice(0, 3)" in js
    assert html.count("3.9.8.1") == 3

def test_pro_research_has_professional_executive_overview() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    for item in [
        'id="proExecutiveOverview"',
        'id="proProfileLabel"',
        'id="proThesisTitle"',
        'id="proThesisState"',
        'id="proMonitoringGrid"',
    ]:
        assert item in html

    for function_name in [
        "function proResearchProfileThesis",
        "function proResearchMonitoring",
        "function renderProExecutiveOverview",
    ]:
        assert function_name in js

    assert "核心研究命題" in html
    assert "主要驅動" in js
    assert "核心風險" in js
    assert "後續驗證" in js
    assert "renderProExecutiveOverview(report)" in js
    assert "收入成長能否轉化為獲利與現金流" in js
    assert "配息能否由獲利、資本品質與合理估值" in js
    assert "營運是否正處於可延續的循環轉折" in js
    assert ".pro-thesis-hero" in css
    assert ".pro-monitoring-grid" in css
    assert html.count("3.9.8.1") == 3

def test_pro_overview_is_positioned_and_profile_specific() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    assert "function positionProResearchWorkspace" in js
    assert "positionProResearchWorkspace();" in js
    assert "收入與獲利成長品質" in js
    assert "股利收益與資本品質" in js
    assert "景氣循環與營運轉折" in js
    assert "事件進度與營運落地" in js
    assert 'html[data-research-mode="pro"] .integrated-decision' in css
    assert "overflow-x:clip" in css
    assert "overflow-wrap:anywhere" in css
    assert html.count("3.9.8.1") == 3

def test_pro_valuation_uses_profile_specific_frameworks() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    for item in [
        'id="proValuationFramework"',
        'id="proValuationMetrics"',
        'id="proValuationBenchmark"',
        'id="proValuationSupport"',
        'id="proValuationChallenge"',
        'id="proValuationValidation"',
    ]:
        assert item in html
    assert "function proValuationProfile" in js
    assert "function renderProValuation" in js
    assert "成長調整估值" in js
    assert "收益與資本估值" in js
    assert "循環正常化估值" in js
    assert "情境估值" in js
    assert "價格位置不是合理價" in html
    assert "不提供目標價、預期報酬或買賣指令" in html
    assert ".pro-valuation-case-grid" in css
    assert html.count("3.9.8.1") == 3

def test_pro_research_ui_is_localized_and_theme_safe() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    for label in [
        "專業研究",
        "價格位置",
        "核心估值指標",
        "比較基準",
        "預期驗證",
        "支持證據",
        "反對證據",
        "後續驗證",
    ]:
        assert label in html or label in js

    for old_label in [
        "VALUATION POSITION",
        "CORE METRICS",
        "EXPECTATION TEST",
        "GROWTH-ADJUSTED VALUATION",
        "CYCLE-NORMALIZED VALUATION",
    ]:
        assert old_label not in html
        assert old_label not in js

    assert "Pro research unified theme v2" in css
    assert 'html[data-theme="light"] .pro-research-workspace' in css
    assert "border:none!important" in css
    assert html.count("3.9.8.1") == 3


def test_pro_judgment_evidence_report_contract() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")

    assert 'id="proEvidenceReport"' in html
    assert "function renderProEvidenceReport" in js
    assert "function proEvidenceFactors" in js
    assert "function proEvidenceDimensions" in js
    assert "function proEvidenceAuditRows" in js
    assert "renderProEvidenceReport(report, scoreChange);" in js
    assert "這個分數是怎麼形成的？" in js
    assert "哪些資料正在加分或扣分？" in js
    assert "五大研究面向的權重與貢獻" in js
    assert "目前判斷有哪些限制？" in js
    assert "逐項查看計算依據" in js
    assert ".pro-evidence-score-flow" in css
    assert ".pro-evidence-dimension-grid" in css
    assert ".pro-evidence-quality-grid" in css
    assert html.count("3.9.8.1") == 3
def test_gc9_uses_three_core_axes_and_separate_rhythm() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")

    assert '<b>9</b><span>種研究人格</span>' in html
    assert 'system: "GC-9"' in js
    assert 'const PERSONALITY_VERSION = "4"' in js
    assert 'const coreDimensions = dimensions.slice(0, 3)' in js
    assert 'const rhythm = scores.compound >= scores.react ? "c" : "r"' in js
    assert 'rhythmName' in js
    assert js.count('id: "GC9-') >= 9
    assert 'GC-16' not in html
    assert 'GC16-' not in js
    for archetype in (
        "precision_sage",
        "halo_hunter",
        "valuation_sage",
        "shield_guardian",
        "mist_assassin",
        "cultivation_elder",
        "market_observer",
        "star_child",
        "fatal_hunter",
    ):
        assert f"  {archetype}: {{" in js
def test_gc9_personalizes_daily_research_order() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(
        encoding="utf-8"
    )
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )
    css = (root / "web" / "home.css").read_text(
        encoding="utf-8"
    )

    assert 'id="dailyResearchPersonality"' in html
    assert "function personalityDailyResearchPlan" in js
    assert "const orderedSteps = [...contract.steps]" in js
    assert "orderedSteps.map((step)" in js
    assert "renderDailyResearch();" in js
    assert "affectsHealthScore: false" in js
    assert "GC-9 Phase 2 final theme v1" in css
def test_gc9_daily_research_can_restore_default_order() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )
    css = (root / "web" / "home.css").read_text(
        encoding="utf-8"
    )

    assert "PERSONALITY_ORDER_STORAGE_KEY" in js
    assert "function personalityResearchOrderEnabled" in js
    assert "function setPersonalityResearchOrder" in js
    assert 'id="dailyResearchOrderToggle"' in js
    assert '"original"' in js
    assert "GC-9 Phase 2 final theme v1" in css
def test_gc9_personalizes_detail_report_navigation() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")
    assert 'id="personalityReportGuide"' in html
    assert 'id="personalityReportGuideList"' in html
    assert "function personalityReportGuideItems" in js
    assert "function personalityReportTarget" in js
    assert "function renderPersonalityReportGuide" in js
    assert "scrollIntoView" in js
    assert "personality-guide-target" in css
    assert "GC-9 Phase 2 final theme v1" in css
def test_gc9_report_navigation_switches_pro_tabs_and_goes_back() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")
    assert 'id="personalityReportGuideBack"' not in html
    assert "setProResearchTab(destination.tab)" in js
    assert '$("backToCenterButton")' in js
    assert "GC-9 Phase 2 final theme v1" in css
    assert 'html[data-theme="light"] .mobile-nav' in css
    assert 'html[data-theme="dark"] .mobile-nav' in css
def test_gc9_report_navigation_uses_top_level_back_and_delegated_jump() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")
    assert 'id="personalityReportGuideBack"' not in html
    assert 'id="backToCenterButton"' in html
    assert "list.onclick = (event)" in js
    assert "navigationHeight" in js
    assert "section.getBoundingClientRect().top + window.scrollY" in js
    assert "showHomeView({restoreScroll:true})" in js
    assert "GC-9 Phase 2 final theme v1" in css
def test_gc9_report_uses_quick_personality_modal_and_aligned_cards() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")
    assert 'id="personalityQuickModal"' in html
    assert 'id="personalityQuickClose"' in html
    assert "function openPersonalityQuickView" in js
    assert "function closePersonalityQuickView" in js
    assert "navigationHeight" in js
    assert "openPersonalityQuickView" in js
    assert ".guided-core-card>strong" in css
    assert "GC-9 Phase 2 final theme v1" in css

def test_gc9_report_navigation_targets_visible_sections() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    assert '"近期變化": ["#integratedTrendTitle"' in js
    assert '"價格位置": ["#guidedValuation"' in js
    assert '"判斷把握度": ["#confidence"' in js
    assert 'selectors: ["#proValuationTitle"' in js
    assert 'selectors: ["#proEvidenceReport"]' in js
    assert 'selectors: ["#proHistorySummary"' in js

def test_mobile_navigation_stays_single_row_and_supports_back_to_top() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")
    assert 'id="backToTopButton"' in html
    assert "function initializeBackToTop" in js
    assert 'grid-template-columns: repeat(5, minmax(0, 1fr))' in css
    assert "GC-9 Phase 2 final theme v1" in css
def test_personality_report_guide_is_first_report_card() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )

    assert "function placePersonalityReportGuideFirst" in js
    assert 'guide.previousElementSibling' in js
    assert 'guide.parentElement.insertBefore(guide, overview)' in js
    assert "placePersonalityReportGuideFirst();" in js
def test_gc9_uses_nine_archetypes_and_hidden_fatal_hunter() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(encoding="utf-8")

    assert 'const PERSONALITY_VERSION = "4";' in js
    assert "const gc9Profiles" in js
    assert js.count('id: "GC9-') >= 9
    for name in [
        "至準智者",
        "光環獵手",
        "估值賢者",
        "盾之守護者",
        "迷霧刺客",
        "培育長老",
        "觀市者",
        "追星的孩子",
        "亡命獵手",
    ]:
        assert name in js
    assert "function gc9ArchetypeScores" in js
    assert "function gc9FatalHunterUnlocked" in js
    assert "risk.extreme >= 2" in js
    assert 'system: "GC-9"' in js
    assert "researchPersonalityQuestions.push(" in js
    assert "hiddenArchetypeUnlocked" in js
def test_gc9_share_data_contains_dimensions() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(
        encoding="utf-8"
    )
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )

    assert '<b>15</b><span>個連續情境</span>' in html

    gc9_marker = js.rfind(
        "function currentPersonalityShareData()"
    )
    assert gc9_marker >= 0

    gc9_share = js[gc9_marker:]
    assert "const profile = gc9Profile(result);" in gc9_share
    assert "const dimensions = personalityDimensionRows(" in gc9_share
    assert "dimensions," in gc9_share
    assert "order: [...profile.order]" in gc9_share
def test_gc9_profile_page_uses_archetype() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )

    marker = js.index(
        "function renderProfilePersonality()"
    )
    renderer = js[
        marker:
        js.index(
            "\n}",
            marker
        ) + 2
    ]

    assert "const profile = gc9Profile(result);" in renderer
    assert "完成 15 題" in renderer
    assert "result.archetype" in renderer
    assert "researchPersonalityProfiles" not in renderer
def test_gc9_removes_legacy_gc8_runtime() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )

    for term in [
        "researchPersonalityProfileRows",
        "researchPersonalityProfiles",
        "基石驗證者",
        "曙光驗證者",
        "價格校準者",
        "趨勢驗證者",
        "企業巡航者",
        "成長探勘者",
        "市場導航者",
        "動能偵察者",
    ]:
        assert term not in js

    for function_name in [
        "completePersonalityQuiz",
        "renderPersonalityResult",
        "openPersonalityQuickView",
        "personalityReportGuideItems",
        "currentPersonalityShareData",
    ]:
        assert js.count(
            f"function {function_name}("
        ) == 1

    assert "const gc9Profiles" in js
    assert "function gc9ArchetypeScores" in js
    assert "function gc9FatalHunterUnlocked" in js
def test_gc9_personalizes_notification_priority() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(
        encoding="utf-8"
    )
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )
    css = (root / "web" / "home.css").read_text(
        encoding="utf-8"
    )

    assert 'id="notificationOrderToggle"' in html
    assert "function personalityNotificationOrderEnabled" in js
    assert "function setPersonalityNotificationOrder" in js
    assert "function gc9NotificationPriority" in js
    assert "aiStockPersonalityNotificationOrder" in js
    assert "notification-personality-reason" in js
    assert "不改變健康分數" in html
    assert "GC-9 personalized notifications v1" in css
    assert "fatal_hunter" in js
    assert "失敗條件與風險上限" in js
def test_gc9_personalizes_watchlist_priority() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(
        encoding="utf-8"
    )
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )
    css = (root / "web" / "home.css").read_text(
        encoding="utf-8"
    )

    assert 'id="watchlistOrderToggle"' in html
    assert 'id="watchlistPersonalityBar"' in html
    assert "function personalityWatchlistOrderEnabled" in js
    assert "function setPersonalityWatchlistOrder" in js
    assert "function gc9WatchlistPriority" in js
    assert "function personalizedWatchlistRows" in js
    assert "aiStockPersonalityWatchlistOrder" in js
    assert "watch-personality-reason" in js
    assert "watch-preview-personality" in js
    assert "GC-9 personalized watchlist v1" in css
    assert "不改變股票分數" in html
def test_gc9_personalizes_research_summary() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(
        encoding="utf-8"
    )
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )
    css = (root / "web" / "home.css").read_text(
        encoding="utf-8"
    )

    assert 'id="summaryPersonalityBar"' in html
    assert 'id="summaryPersonalityToggle"' in html
    assert "function personalityResearchSummaryEnabled" in js
    assert "function setPersonalityResearchSummary" in js
    assert "function gc9ResearchSummaryReason" in js
    assert "function renderPersonalityResearchSummary" in js
    assert "aiStockPersonalitySummaryMode" in js
    assert "renderPersonalityResearchSummary(report);" in js
    assert "GC-9 personalized research summary v1" in css
def test_gc9_report_guide_has_defined_items() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )
    css = (root / "web" / "home.css").read_text(
        encoding="utf-8"
    )

    assert "const guideDescriptions = {" in js
    assert "profile.order.map(" in js
    assert "index: index + 1" in js
    assert "order," in js
    assert "GC-9 report guide and navigation correction v1" in css
    assert "border: 0 !important;" in css
def test_beta_insights_store_and_admin_summary(tmp_path: Path, monkeypatch) -> None:
    store = BetaInsightsStore(tmp_path / "beta-insights.sqlite3")
    monkeypatch.setattr(app_module, "REQUIRE_INVITE", False)
    monkeypatch.setattr(app_module, "ADMIN_TOKEN", "test-admin-token")
    monkeypatch.setattr(app_module, "beta_insights", store)
    beta_client = TestClient(app_module.app)

    event = beta_client.post(
        "/api/beta/events",
        json={"event_name": "page_view", "page": "home", "mode": "guided"},
    )
    assert event.status_code == 200

    feedback = beta_client.post(
        "/api/beta/feedback",
        json={
            "category": "usability",
            "rating": 4,
            "message": "The home page is clear, but the toggle can be clearer.",
            "page": "home",
            "stock_id": "2330",
        },
    )
    assert feedback.status_code == 200
    assert feedback.json()["feedback_id"] == 1

    invalid_event = beta_client.post(
        "/api/beta/events",
        json={"event_name": "arbitrary_private_data", "page": "home"},
    )
    assert invalid_event.status_code == 400
    assert beta_client.get("/api/admin/beta/summary").status_code == 404

    summary = beta_client.get(
        "/api/admin/beta/summary?days=7",
        headers={"X-Admin-Token": "test-admin-token"},
    )
    assert summary.status_code == 200
    payload = summary.json()["insights"]
    assert payload["active_testers"] == 1
    assert payload["event_counts"]["page_view"] == 1
    assert payload["feedback_count"] == 1
    assert payload["average_rating"] == 4.0


def test_beta_insights_rejects_sensitive_shapes(tmp_path: Path) -> None:
    store = BetaInsightsStore(tmp_path / "privacy.sqlite3")
    for kwargs in (
        {"event_name": "portfolio_uploaded", "page": "home"},
        {"event_name": "page_view", "page": "private_portfolio"},
    ):
        try:
            store.record_event(tester_code="BETA-001", **kwargs)
        except ValueError:
            pass
        else:
            raise AssertionError("unsupported telemetry must be rejected")
def test_beta_feedback_ui_and_telemetry() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")
    insights = (root / "beta_insights.py").read_text(encoding="utf-8")

    for element_id in (
        'id="betaFeedbackModal"', 'id="betaFeedbackForm"',
        'id="betaFeedbackCategory"', 'id="betaFeedbackMessage"',
        'id="betaFeedbackSubmit"', 'id="betaFeedbackStatus"',
    ):
        assert element_id in html

    for function_name in (
        "function trackBetaEvent", "function openBetaFeedback",
        "function closeBetaFeedback", "function submitBetaFeedback",
    ):
        assert function_name in js

    assert 'fetch("/api/beta/events"' in js
    assert 'fetch("/api/beta/feedback"' in js
    assert 'trackBetaEvent("session_started"' in js
    assert 'trackBetaEvent("page_view"' in js
    assert 'trackBetaEvent("stock_opened"' in js
    assert "Beta Infrastructure feedback v1" in css
    assert '"news"' in insights


def test_beta_initialization_remains_async() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )

    assert "async function initializeBetaAccess()" in js
    assert "function betaTelemetryPage()" in js
    assert "async function betaTelemetryPage()" not in js


def test_beta_phase2a_readiness_and_backup_contract(tmp_path) -> None:
    import sqlite3
    from contextlib import closing
    from types import SimpleNamespace

    from beta_maintenance import (
        backup_database,
        database_readiness,
        report_readiness,
        restore_database,
        verify_database,
    )

    database = tmp_path / "beta.sqlite3"
    assert database_readiness(database) == {
        "writable": True,
        "integrity": "ok",
    }

    with closing(sqlite3.connect(database)) as connection:
        connection.execute("CREATE TABLE sample(value TEXT)")
        connection.execute("INSERT INTO sample(value) VALUES('before')")
        connection.commit()

    backup = backup_database(database, tmp_path / "backup.sqlite3")
    assert verify_database(backup)

    with closing(sqlite3.connect(database)) as connection:
        connection.execute("UPDATE sample SET value = 'after'")
        connection.commit()

    restore_database(backup, database, confirmed=True)
    with closing(sqlite3.connect(database)) as connection:
        assert connection.execute("SELECT value FROM sample").fetchone()[0] == "before"

    report_root = tmp_path / "reports"
    report_path = report_root / "2330" / "latest.json"
    report_path.parent.mkdir(parents=True)
    report_path.write_text(
        '{"data_as_of":"2026-08-29"}',
        encoding="utf-8",
    )
    repository = SimpleNamespace(report_root=report_root, sample_dir=None)
    assert report_readiness(repository) == {
        "available": True,
        "count": 1,
        "latest_data_date": "2026-08-29",
    }


def test_beta_health_endpoint_exposes_safe_readiness_contract() -> None:
    root = Path(__file__).parents[1]
    app_source = (root / "app.py").read_text(encoding="utf-8")

    assert 'version="1.6.0"' in app_source
    assert '"ready": ready' in app_source
    assert '"database": database' in app_source
    assert '"reports": report_data' in app_source
    assert 'response.status_code = 503' in app_source
    assert 'str(BETA_DATABASE_PATH)' not in app_source



def test_beta_database_maintenance_cli_resolves_project_root(tmp_path) -> None:
    import subprocess
    import sys

    root = Path(__file__).parents[1]
    script = root / "scripts" / "beta_database_maintenance.py"
    result = subprocess.run(
        [sys.executable, str(script), "--help"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "GC Beta SQLite backup utility" in result.stdout



def test_beta_phase2b_frontend_reliability_contract() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")
    sw = (root / "web" / "sw.js").read_text(encoding="utf-8")

    assert 'id="networkStatusBar"' in html
    assert 'id="networkRetryButton"' in html
    assert 'id="dataFreshnessBar"' in html
    assert 'id="stockCenterRetry"' in html
    assert "class BetaRequestError extends Error" in js
    assert "async function fetchBetaJson" in js
    assert "new AbortController()" in js
    assert '"timeout"' in js
    assert '"offline"' in js
    assert "function renderDataFreshness" in js
    assert 'window.addEventListener("offline"' in js
    assert 'window.addEventListener("online"' in js
    assert '$("notificationButton").focus();' in js
    assert "Beta Infrastructure Phase 2B reliability states" in css
    assert 'const CACHE = "ai-stock-health-beta-v6-reliability"' in sw
    assert 'url.pathname.startsWith("/api/")' in sw
    assert 'caches.open(CACHE).then((cache) => cache.put(event.request, copy))' in sw
    api_guard = sw.index('url.pathname.startsWith("/api/")')
    cache_write = sw.index('caches.open(CACHE).then((cache) => cache.put(event.request, copy))')
    assert api_guard < cache_write
    assert "evidence.css?v=3.9.8.1" in sw
    assert "home.css?v=3.9.8.1" in sw
    assert "app.js?v=3.9.8.1" in sw
