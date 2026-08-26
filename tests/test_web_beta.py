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
    assert "Web v3.6.0 Beta" in html
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

    assert "12 個連續情境" in html
    assert re.search(r"<b>16</b>\s*<span>種研究人格</span>", html)
    assert "不評估金融風險承受度" in html
    assert "不會改變任何股票的健康分數" in html
    assert "人格只改變閱讀方式，不改變研究結果" in html

    required_profiles = [
        "地基守衡者",
        "價值校準師",
        "長曜培育者",
        "曙光驗證者",
        "星盤定衡者",
        "逆勢校準者",
        "長軌觀測者",
        "星軌驗證者",
        "地訊守值者",
        "事件定價師",
        "萌星培育者",
        "躍遷尋星者",
        "雷達定錨者",
        "轉折測繪者",
        "新軌領航者",
        "星訊先鋒者",
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

    assert 'const PERSONALITY_VERSION = "2"' in js
    assert 'const PERSONALITY_STORAGE_KEY = "aiStockResearchPersonality"' in js
    assert "researchPersonalityQuestions" in js
    assert "researchPersonalityProfiles" in js
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


def test_gc16_personality_axis_contract() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")

    assert "12 個連續情境" in html
    assert '<b>16</b><span>種研究人格</span>' in html
    assert 'const PERSONALITY_VERSION = "2"' in js
    assert "researchPersonalityAxisDefinitions" in js
    assert "researchPersonalityProfileRows" in js
    assert 'system: "GC-16"' in js
    assert "axisScores" in js
    assert "personalityDimensionRows(scores)" in js
    assert "averageMargin" in js
    assert "affectsHealthScore: false" in js
    for name in (
        "地基守衡者", "價值校準師", "長曜培育者", "曙光驗證者",
        "星盤定衡者", "逆勢校準者", "長軌觀測者", "星軌驗證者",
        "地訊守值者", "事件定價師", "萌星培育者", "躍遷尋星者",
        "雷達定錨者", "轉折測繪者", "新軌領航者", "星訊先鋒者",
    ):
        assert name in js



def test_gc16_result_uses_branded_inspection_report() -> None:
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
    assert "personalityTotemSvg(result.primary)" in js
    assert 'result.clarity || "研究方式較為平衡"' in js
    assert "GC-16 personality inspection report v2" in css
    assert "personality-report-meta" in css
    assert "border-top:3px solid #e39a58" in css



def test_gc16_questions_form_one_continuous_everyday_story() -> None:
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



def test_gc16_result_supports_private_safe_social_sharing() -> None:
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
    assert 'link.download = `GC-16-' in js
    assert "GC-16 result sharing v1" in css
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



def test_gc16_visible_question_count_matches_twelve_question_contract() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")

    assert "<b>12</b><span>個連續情境</span>" in html
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
    assert html.count("3.6.0.8") == 3
