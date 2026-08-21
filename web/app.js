const $ = (id) => document.getElementById(id);
const icons = ["✦", "⌁", "◎", "◫", "◌"];
const THEME_STORAGE_KEY = "aiStockTheme";
const NOTIFICATION_READ_KEY = "aiStockNotificationReadIds";
let currentReport = null;
let available = [];
let stockCatalog = [];
let activeSector = "全部";
let activeIndustry = "全部產業";
let watchlistOnly = false;
let homeScrollPosition = 0;
let betaSession = null;
let activePage = "home";
let detailOriginPage = "home";
let watchlistFilter = "all";
let eventFilter = "all";
let exploreQuery = "";
let exploreSort = "default";
let notificationFilter = "all";

function preferredTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme, {persist = false} = {}) {
  const value = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = value;
  if (persist) localStorage.setItem(THEME_STORAGE_KEY, value);
  const toggle = $("themeToggle");
  if (toggle) {
    const dark = value === "dark";
    toggle.setAttribute("aria-pressed", String(dark));
    toggle.setAttribute("aria-label", dark ? "切換淺色模式" : "切換深色模式");
    toggle.querySelector("span").textContent = dark ? "☀" : "☾";
    toggle.querySelector("b").textContent = dark ? "淺色" : "深色";
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = value === "dark" ? "#111713" : "#f5f1ea";
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", {persist: true});
}

function notificationReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(NOTIFICATION_READ_KEY) || "[]")); }
  catch { return new Set(); }
}

function saveNotificationReadIds(ids) {
  localStorage.setItem(NOTIFICATION_READ_KEY, JSON.stringify([...ids].slice(-1000)));
}

function researchNotifications() {
  const saved = new Set(watchlist());
  const rows = stockCatalog.flatMap(
    (report) => report?.research_notifications?.notifications || []
  );
  const unique = new Map();

  rows.forEach((item) => {
    if (!item?.notification_id || item.affects_health_score !== false) return;

    const stockId = String(item.stock_id || "");
    const visibleToUser = stockId === "MARKET" || saved.has(stockId);
    if (!visibleToUser || unique.has(item.notification_id)) return;

    unique.set(item.notification_id, item);
  });

  const priority = {high: 0, medium: 1, info: 2};
  return [...unique.values()].sort(
    (a, b) =>
      (priority[a.severity] ?? 3) - (priority[b.severity] ?? 3) ||
      String(b.source_date || "").localeCompare(String(a.source_date || ""))
  );
}

function notificationMatches(item) {
  if (notificationFilter === "all") return true;
  if (notificationFilter === "important") return item.severity === "high" || item.severity === "medium";
  return item.type === notificationFilter;
}

function renderNotificationCenter() {
  const rows = researchNotifications();
  const read = notificationReadIds();
  const unread = rows.filter((item) => !read.has(item.notification_id)).length;
  const badge = $("notificationUnread");
  badge.textContent = unread > 99 ? "99+" : String(unread);
  badge.classList.toggle("hidden", unread === 0);
  $("notificationSummary").textContent = rows.length ? `${unread} 則未讀，共 ${rows.length} 則研究提醒` : "目前沒有需要提醒的研究事項";
  const visible = rows.filter(notificationMatches);
  $("notificationList").innerHTML = visible.length ? visible.map((item) => `
    <button class="notification-item ${read.has(item.notification_id) ? "read" : "unread"} severity-${escapeHtml(item.severity)}" type="button" data-notification-id="${escapeHtml(item.notification_id)}" data-notification-destination="${escapeHtml(item.destination)}" data-notification-stock="${escapeHtml(item.stock_id)}">
      <span class="notification-item-top"><em>${escapeHtml(item.type === "official_event" ? "官方日程" : item.type === "follow_up" ? "持續追蹤" : item.type === "risk_attention" ? "風險注意" : "重要變化")}</em><time>${escapeHtml(item.source_date || "")}</time></span>
      <b>${escapeHtml(item.title_zh)}</b><p>${escapeHtml(item.message_zh)}</p><small>${escapeHtml(item.reason_zh)}</small>
    </button>`).join("") : '<p class="notification-empty">這個分類目前沒有通知。</p>';
}

function setNotificationPanel(open) {
  $("notificationPanel").classList.toggle("hidden", !open);
  $("notificationBackdrop").classList.toggle("hidden", !open);
  $("notificationPanel").setAttribute("aria-hidden", String(!open));
  $("notificationButton").setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("notification-open", open);
  if (open) renderNotificationCenter();
}

function openNotification(item) {
  const read = notificationReadIds(); read.add(item.dataset.notificationId); saveNotificationReadIds(read);
  setNotificationPanel(false); renderNotificationCenter();
  const destination = item.dataset.notificationDestination;
  const stock = item.dataset.notificationStock;
  if (destination === "report" && stock && stock !== "MARKET") loadStock(stock);
  else switchPage(destination === "watchlist" ? "watchlist" : "events");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
}

function setState(state, message = "") {
  $("loadingCard").classList.toggle("hidden", state !== "loading");
  $("errorCard").classList.toggle("hidden", state !== "error");
  $("reportContent").classList.toggle("hidden", state !== "ready");
  $("searchButton").disabled = state === "loading";
  $("searchButton").textContent = state === "loading" ? "讀取中…" : "查看健康";
  if (state === "error") $("errorMessage").textContent = message;
}

function setInviteMessage(message = "", tone = "") {
  $("inviteMessage").textContent = message;
  $("inviteMessage").className = `invite-message ${tone}`.trim();
}

function showInviteGate(message = "") {
  document.body.classList.remove("auth-pending");
  document.body.classList.add("auth-locked");
  $("inviteGate").classList.add("visible");
  $("inviteCode").value = "";
  setInviteMessage(message, message ? "error" : "");
  window.setTimeout(() => $("inviteCode").focus(), 50);
}

function enterBeta(session) {
  betaSession = session;
  document.body.classList.remove("auth-pending", "auth-locked");
  $("inviteGate").classList.remove("visible");
  const code = session?.tester_code || "";
  $("testerBadge").textContent = code;
  $("testerBadge").classList.toggle("hidden", !code || code === "LOCAL-OWNER");
  $("logoutButton").classList.toggle("hidden", !session?.invite_required);
}

async function activateInvite(inviteCode) {
  $("inviteSubmit").disabled = true;
  $("inviteSubmit").textContent = "驗證中…";
  setInviteMessage("正在確認邀請碼…");
  try {
    const response = await fetch("/api/beta/activate", {
      method: "POST",
      headers: {"Content-Type": "application/json", Accept: "application/json"},
      body: JSON.stringify({invite_code: inviteCode}),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "邀請碼驗證失敗");
    enterBeta({invite_required: true, authorized: true, tester_code: payload.tester_code});
    await loadAvailable();
    showToast(`歡迎 ${payload.tester_code}`);
  } catch (error) {
    showInviteGate(error.message || "邀請碼無效，請重新確認");
  } finally {
    $("inviteSubmit").disabled = false;
    $("inviteSubmit").textContent = "驗證並進入";
  }
}

async function logoutBeta() {
  $("logoutButton").disabled = true;
  try {
    await fetch("/api/beta/logout", {method: "POST", headers: {Accept: "application/json"}});
  } finally {
    betaSession = null;
    $("testerBadge").classList.add("hidden");
    $("logoutButton").classList.add("hidden");
    $("logoutButton").disabled = false;
    showInviteGate("已安全登出，請輸入邀請碼重新進入。 ");
  }
}

async function initializeBetaAccess() {
  try {
    const response = await fetch("/api/beta/session", {headers: {Accept: "application/json"}});
    const session = await response.json();
    if (!response.ok) throw new Error("目前無法確認登入狀態");
    if (session.invite_required && !session.authorized) {
      showInviteGate();
      return;
    }
    enterBeta(session);
    await loadAvailable();
  } catch (error) {
    showInviteGate(error.message || "目前無法確認登入狀態，請稍後再試");
  }
}

function showDetailView() {
  if (!$("homeView").classList.contains("hidden")) homeScrollPosition = window.scrollY;
  detailOriginPage = activePage;
  document.body.classList.remove("home-mode");
  $("homeView").classList.add("hidden");
  $("detailNavigation").classList.remove("hidden");
  window.scrollTo({top: 0});
}

function showHomeView({restoreScroll = true} = {}) {
  document.body.classList.add("home-mode");
  $("homeView").classList.remove("hidden");
  $("detailNavigation").classList.add("hidden");
  $("loadingCard").classList.add("hidden");
  $("errorCard").classList.add("hidden");
  $("reportContent").classList.add("hidden");
  $("saveButton").classList.add("hidden");
  renderStockCenter();
  switchPage(activePage, {scroll:false});
  if (restoreScroll) window.requestAnimationFrame(() => window.scrollTo({top: homeScrollPosition, behavior:"smooth"}));
}

function switchPage(page, {scroll = true} = {}) {
  const target = document.querySelector(`[data-page="${page}"]`);
  if (!target) return;
  activePage = page;
  document.querySelectorAll(".app-page").forEach((section) => section.classList.toggle("active", section === target));
  document.querySelectorAll(".mobile-nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === page));
  if (page === "watchlist") renderWatchlistPage();
  if (page === "events") renderEventsPage();
  if (page === "explore") renderStockCenter();
  if (page === "about") renderProfilePage();
  if (scroll) window.scrollTo({top:0, behavior:"smooth"});
}

function levelTone(score) {
  if (score >= 75) return "good";
  if (score >= 55) return "neutral";
  return "watch";
}

function render(report) {
  currentReport = report;
  $("saveButton").classList.remove("hidden");
  $("detailNavigationTitle").textContent = `${report.name}（${report.id}）研究報告`;
  $("stockMeta").textContent = `${report.id} · ${report.industry}`;
  $("stockProfile").textContent = report.stock_profile?.label_zh || "待確認";
  $("stockProfile").title = report.stock_profile?.comparison_group_zh || "一般股票";

  const valuationMetrics = Array.isArray(report.investment_research?.valuation?.metrics)
    ? report.investment_research.valuation.metrics
    : [];
  const latestPriceMetric = valuationMetrics.find((item) =>
    String(item.label_zh || "").includes("收盤價") ||
    String(item.basis_zh || "").includes("最新交易日收盤價")
  );
  const latestPriceValue = Number(latestPriceMetric?.value);
  $("latestPrice").textContent = Number.isFinite(latestPriceValue)
    ? `最新 ${latestPriceValue.toLocaleString("zh-TW")} ${latestPriceMetric?.unit || "元"}`
    : "股價待補";
  $("stockName").textContent = report.name;
  $("assessment").textContent = report.assessment;
  $("healthScore").textContent = Number(report.score).toFixed(1);
  $("scoreRing").style.setProperty("--score-angle", `${Math.min(100, Math.max(0, report.score)) * 3.6}deg`);
  $("scoreRing").classList.remove("score-good", "score-neutral", "score-watch");
  $("scoreRing").classList.add(
    report.score >= 75
      ? "score-good"
      : report.score >= 55
        ? "score-neutral"
        : "score-watch"
  );
  const incomeProfile = report.income_profile || {};
  const growthProfile = report.growth_profile || {};
  const cyclicalProfile = report.cyclical_profile || {};
  const eventProfile = report.event_profile || {};
  const decisionProfile =
    incomeProfile.status === "available" && incomeProfile.decision
      ? incomeProfile
      : growthProfile.status === "available" && growthProfile.decision
        ? growthProfile
        : cyclicalProfile.status === "available" && cyclicalProfile.decision
          ? cyclicalProfile
          : eventProfile.status === "available" && eventProfile.decision
            ? eventProfile
            : null;

  $("researchLabel").textContent = decisionProfile
    ? `${decisionProfile.label_zh}判斷`
    : "AI 研究摘要";

  $("summary").textContent = decisionProfile
    ? `未持有：${decisionProfile.decision.unheld}`
    : report.summary;

  $("incomeDecision").classList.toggle("hidden", !decisionProfile);
  $("heldDecision").textContent = decisionProfile
    ? decisionProfile.decision.held
    : "";

  $("summaryNote").textContent = decisionProfile
    ? decisionProfile.decision.reason_zh
    : "這是研究狀態，不是買進或賣出訊號。";
  const confidenceValue = Math.min(100, Math.max(0, Number(report.confidence) || 0));
  const riskValue = Math.min(100, Math.max(0, Number(report.risk) || 0));

  $("grade").textContent = report.grade;
  $("confidence").textContent = `${Math.round(confidenceValue)} / 100`;
  $("confidenceTone").textContent = report.confidence_level || "待確認";
  $("confidenceBar").style.width = `${confidenceValue}%`;
  $("confidenceBar").parentElement.setAttribute(
    "aria-valuenow",
    String(Math.round(confidenceValue))
  );

  $("risk").textContent = `${Math.round(riskValue)} / 100`;
  $("riskTone").textContent = report.risk_level || "待確認";
  $("riskBar").style.width = `${riskValue}%`;
  $("riskBar").parentElement.setAttribute(
    "aria-valuenow",
    String(Math.round(riskValue))
  );

  $("updated").textContent = report.updated;
  $("priceDate").textContent = report.updated && report.updated !== "—"
    ? `資料日期 ${report.updated}`
    : "資料日期待確認";
  $("source").textContent = report.source === "engine" ? "AI 引擎客戶報告" : "Beta 展示資料";
  $("strategyLabel").textContent = report.strategy?.label_zh || "研究累積中";
  $("strategyCopy").textContent = report.strategy?.message_zh || "系統持續更新與驗證，不會因單日波動任意改變研究門檻。";
  $("disclaimer").textContent = report.disclaimer;
  renderIndicators(report.indicators);
  renderInvestmentResearch(report.investment_research || {});
  renderTodayChanges(report.today_changes || {});
  renderIntegratedDecision(report);
  renderEvidence(report);
  renderHistory(report.score_history || []);
  renderSources(report.data_sources || []);
  refreshSavedButton();
  if (stockCatalog.length) renderStockCenter();
}

function researchStatus(value) {
  return ({available:"資料可用", partial:"部分資料", limited:"資料有限", building:"建置中", unavailable:"暫無資料", relevant:"可納入研究", not_assessed:"尚未評估"})[value] || value || "待確認";
}

function researchMetric(item) {
  const value = item?.value == null ? "—" : `${Number(item.value).toLocaleString("zh-TW", {maximumFractionDigits:2})}${item.unit || ""}`;
  const singlePeriodEps = String(item?.label_zh || "").includes("最新 EPS 參考倍數");
  const label = singlePeriodEps ? "單期 EPS 參考比值" : item.label_zh;
  const warning = singlePeriodEps ? "這不是標準本益比，不能單獨用來判斷便宜或昂貴。" : "";
  return `<div class="research-metric${singlePeriodEps ? " research-metric-caution" : ""}"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><small>${escapeHtml(item.basis_zh || "")}</small><p>${escapeHtml(warning || item.meaning_zh || "")}</p></div>`;
}

function signedPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number >= 0 ? "+" : ""}${number.toFixed(2)}%` : "—";
}

function percentagePoints(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number >= 0 ? "+" : ""}${number.toFixed(2)} 個百分點` : "—";
}

function relativeLabel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "資料待補";
  if (number > 1) return "同期表現較強";
  if (number < -1) return "同期表現較弱";
  return "同期表現相近";
}

function sectorPosition(rank, sampleSize) {
  const position = Number(rank);
  const total = Number(sampleSize);
  if (!Number.isFinite(position) || !Number.isFinite(total) || total < 1) return "樣本建立中";
  if (position <= Math.ceil(total / 3)) return "位於產業前段";
  if (position > Math.ceil(total * 2 / 3)) return "位於產業後段";
  return "位於產業中段";
}

function comparisonValues(items) {
  return `<dl class="comparison-values">${items.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join("")}</dl>`;
}

function renderIntegratedDecision(report) {
  const profileId = report.stock_profile?.profile_id || "default";
  const profile = stockDecisionProfile(report);
  const metrics = profile.metrics || {};
  const decision = profile.decision || {};
  const available = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const number = (value, digits = 2, suffix = "") => available(value) ? `${Number(value).toFixed(digits)}${suffix}` : "資料待補";
  const rank = (position, count) => available(position) && available(count) ? `第 ${Number(position)} / ${Number(count)} 名` : "排名待補";
  const reason = (tone, title, primary, secondary, copy, source) => ({tone, title, primary, secondary, copy, source});

  let reasons = [];
  let followUp = [];

  if (profileId === "financial_income") {
    reasons = [
      reason("positive", "股息吸引力", number(metrics.dividend_yield_pct, 2, "%"), rank(metrics.dividend_yield_rank, metrics.peer_count), "和其他金融收益型股票比較目前殖利率位置。", "TWSE 殖利率與同組比較"),
      reason("neutral", "估值位置", number(metrics.pb_ratio, 2, " 倍"), rank(metrics.pb_rank, metrics.peer_count), "股價淨值比用來輔助判斷收益型股票是否昂貴。", "TWSE 股價淨值比"),
      reason("caution", "目前判斷", decision.unheld || "等待更多證據", decision.held || "續抱觀察", decision.reason_zh || "仍需確認配息品質與估值。", "收益型研究模型"),
    ];
    followUp = ["歷年配息是否穩定", "最新 ROE 是否支持股息品質", "估值是否回到同組合理區間"];
  } else if (profileId === "growth_quality") {
    reasons = [
      reason("positive", "成長仍強", number(metrics.revenue_yoy_pct, 2, "%"), number(metrics.eps_growth_yoy_pct, 2, "%"), "營收與 EPS 年增率用來確認成長是否仍在延續。", "公開財報與營收資料"),
      reason("neutral", "價格位置", number(metrics.pe_ratio, 2, " 倍"), rank(metrics.pe_rank, metrics.peer_count), "成長良好不代表任何價格都適合追進。", "TWSE 估值與同組比較"),
      reason("caution", "短期動能", rank(metrics.sector_rank, metrics.sector_peer_count), number(metrics.relative_market_pct_point, 2, " 個百分點"), decision.reason_zh || "目前仍需等待價格確認。", "近 20 日市場與同組比較"),
    ];
    followUp = ["營收與 EPS 成長是否延續", "價格是否回到合理區間", "ROE、自由現金流與負債資料是否補齊"];
  } else if (profileId === "cyclical") {
    reasons = [
      reason("positive", "景氣與營運", number(metrics.revenue_yoy_pct, 2, "%"), number(metrics.revenue_mom_pct, 2, "%"), "營收年增與月增用來觀察循環是否正在轉強。", "公開營收資料"),
      reason("neutral", "價格趨勢", number(metrics.return_20d_pct, 2, "%"), number(metrics.rsi_14, 2), "漲幅與 RSI 一起判斷趨勢強度及是否過熱。", "交易所價格資料"),
      reason("caution", "籌碼風險", number(metrics.margin_change_5d_pct, 2, "%"), decision.unheld || "等待循環確認", decision.reason_zh || "仍需留意追價與籌碼反轉。", "法人與融資資料"),
    ];
    followUp = ["營收循環是否持續改善", "RSI 過熱是否降溫", "融資與法人籌碼是否反轉"];
  } else if (profileId === "high_volatility_event") {
    reasons = [
      reason("positive", "同組表現", number(metrics.return_20d_pct, 2, "%"), rank(metrics.sector_rank, metrics.sector_peer_count), "近期漲幅僅代表相對表現，不代表事件已被證實。", "近 20 日同組比較"),
      reason("caution", "波動風險", number(metrics.volatility_20d_pct, 2, "%"), number(metrics.atr_14_pct, 2, "%"), "高波動股票需要同時確認可能回撤的幅度。", "交易所價格資料"),
      reason("neutral", "公司事件", `${Number(metrics.confirmed_company_event_count || 0)} 項`, decision.unheld || "等待事件確認", decision.reason_zh || "目前仍需等待公司專屬事件證據。", "已確認官方事件"),
    ];
    followUp = ["是否出現已確認的公司專屬事件", "成交量是否支持價格突破", "高波動是否出現反轉"];
  } else {
    const indicators = Array.isArray(report.indicators) ? report.indicators.slice(0, 3) : [];
    reasons = indicators.map((item) => reason("neutral", item.label || "研究證據", number(item.score, 1, " 分"), item.level || "待確認", item.description || "等待更多研究資料。", item.source_label_zh || "公開資料"));
    followUp = ["補齊股票類型資料", "確認主要風險來源", "等待更多同組比較證據"];
  }

  $("integratedDecisionType").textContent = report.stock_profile?.label_zh || "依股票類型整理";
  $("integratedReasonGrid").innerHTML = reasons.slice(0, 3).map((item, index) => `
    <article class="integrated-reason ${item.tone}">
      <span>理由 ${index + 1}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <div class="integrated-reason-values"><b>${escapeHtml(item.primary)}</b><em>${escapeHtml(item.secondary)}</em></div>
      <p>${escapeHtml(item.copy)}</p>
      <small>資料來源：${escapeHtml(item.source)}</small>
    </article>
  `).join("");

  const missing = Array.isArray(profile.missing_evidence_zh) ? profile.missing_evidence_zh : [];
  const tracking = [...new Set([...followUp, ...missing])].slice(0, 3);
  $("integratedFollowUpList").innerHTML = tracking.map((item, index) => `<li><b>${index + 1}</b><span>${escapeHtml(item)}</span></li>`).join("");

  const history = (Array.isArray(report.score_history) ? report.score_history : [])
    .slice(-10)
    .map((item) => ({
      date: String(item.date || ""),
      score: Number(item.score),
    }))
    .filter((item) => Number.isFinite(item.score));

  if (history.length < 2) {
    $("integratedTrendChart").innerHTML = "";
    $("integratedTrendSummary").textContent = "累積至少兩個不同日期後，即可顯示趨勢。";
    return;
  }

  const width = 1000;
  const height = 82;
  const paddingY = 12;
  const scores = history.map((item) => item.score);
  const minimum = Math.min(...scores);
  const maximum = Math.max(...scores);
  const range = maximum - minimum || 1;

  const coordinates = history.map((item, index) => {
    const x = (index + 0.5) * (width / history.length);
    const y = height - paddingY - ((item.score - minimum) / range) * (height - paddingY * 2);
    return {x, y, ...item};
  });

  const points = coordinates
    .map((item) => `${item.x.toFixed(1)},${item.y.toFixed(1)}`)
    .join(" ");

  const circles = coordinates.map((item, index) => `
    <circle
      cx="${item.x.toFixed(1)}"
      cy="${item.y.toFixed(1)}"
      r="${index === coordinates.length - 1 ? 5 : 3.5}"
      class="${index === coordinates.length - 1 ? "latest" : ""}">
    </circle>
  `).join("");

  const valueItems = history.map((item, index) => `
    <span class="${index === history.length - 1 ? "latest" : ""}">
      <b>${item.score.toFixed(1)}</b>
      <small>${escapeHtml(item.date.slice(5).replace("-", "/"))}</small>
    </span>
  `).join("");

  $("integratedTrendChart").innerHTML = `
    <div class="integrated-trend-inner">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="近 10 日研究分數">
        <polyline
          points="${points}"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round">
        </polyline>
        ${circles}
      </svg>
      <div class="integrated-trend-values">${valueItems}</div>
    </div>
  `;

  const change = history[history.length - 1].score - history[0].score;
  $("integratedTrendSummary").textContent =
    `最新 ${history[history.length - 1].score.toFixed(1)} 分，較區間起點` +
    `${change >= 0 ? "增加" : "減少"} ${Math.abs(change).toFixed(1)} 分。`;
}
function renderInvestmentResearch(block) {
  const company = block.company_profile || {};
  const valuation = block.valuation || {};
  const comparisons = block.comparisons || {};
  const market = comparisons.market || {};
  const sector = comparisons.sector || {};
  const peers = comparisons.peers || {};
  const fit = block.research_fit || {};
  $("researchContextNotice").textContent = block.score_policy?.message_zh || "本區補充研究背景，目前不直接改變健康分數。";
  $("companyResearchTitle").textContent = `${company.name_zh || currentReport?.name || "這家公司"}在做什麼？`;
  $("companyResearch").innerHTML = `<p class="research-lead">${escapeHtml(company.business_summary_zh || "公司業務資料仍待補齊。")}</p>
    <dl class="research-facts"><div><dt>怎麼賺錢</dt><dd>${escapeHtml(company.revenue_model_zh || "待補")}</dd></div><div><dt>產業怎麼看</dt><dd>${escapeHtml(company.industry_context_zh || "待補")}</dd></div></dl>
    ${company.key_drivers_zh?.length ? `<b>重要成長動力</b><ul>${company.key_drivers_zh.map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>` : ""}
    ${company.key_risks_zh?.length ? `<b>主要風險</b><ul>${company.key_risks_zh.map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>` : ""}
    ${company.source_url ? `<a class="research-link" href="${escapeHtml(company.source_url)}" target="_blank" rel="noopener noreferrer">查看公司公開資訊 ↗</a>` : ""}`;
  $("valuationResearchTitle").textContent = valuation.headline_zh || "估值資料尚未齊全";
  $("valuationResearch").innerHTML = `<span class="research-status">${escapeHtml(researchStatus(valuation.status))}</span>
    <div class="research-metrics">${(valuation.metrics || []).map(researchMetric).join("") || `<p>目前沒有足夠資料計算估值。</p>`}</div>
    <p class="research-interpretation">${escapeHtml(valuation.interpretation_zh || "")}</p>
    ${valuation.missing_items_zh?.length ? `<small class="research-missing">尚缺：${valuation.missing_items_zh.map(escapeHtml).join("、")}</small>` : ""}`;
  const stockName = currentReport?.name || company.name_zh || "這檔股票";
  const marketTitle = `大盤比較｜${relativeLabel(market.relative_return_pct_point)}`;
  const sectorTitle = sector.status === "available" ? `產業比較｜${sectorPosition(sector.rank, sector.sample_size)}` : `產業比較｜${researchStatus(sector.status)}`;
  const peerTitle = peers.status === "limited" ? "單一同業參考" : `同業比較｜${researchStatus(peers.status)}`;
  const peerItems = (peers.items || []).map((item) => `<li><span>${escapeHtml(item.name_zh)}（${escapeHtml(item.stock_id)}）</span><b>${Number(item.return_20d_pct) >= 0 ? "+" : ""}${Number(item.return_20d_pct).toFixed(2)}%</b></li>`).join("");
  $("comparisonResearch").innerHTML = `<div class="comparison-row"><h4>${escapeHtml(marketTitle)}</h4>${comparisonValues([
      {label: stockName, value: signedPercent(market.stock_return_pct)},
      {label: "大盤", value: signedPercent(market.benchmark_return_pct)},
      {label: "同期差距", value: percentagePoints(market.relative_return_pct_point)},
    ])}<small>${escapeHtml(market.interpretation_zh || "資料待補")}</small></div>
    <div class="comparison-row"><h4>${escapeHtml(sectorTitle)}</h4>${comparisonValues([
      {label: stockName, value: signedPercent(sector.stock_return_pct)},
      {label: `${sector.industry_zh || "產業"}中位數`, value: signedPercent(sector.sector_median_return_pct)},
      {label: "產業排名", value: sector.rank && sector.sample_size ? `第 ${Number(sector.rank)}／${Number(sector.sample_size)} 名` : "—"},
    ])}<small>${escapeHtml(sector.interpretation_zh || "")}</small>${sector.sample_size ? `<em>同期間樣本 ${Number(sector.sample_size)} 檔</em>` : ""}</div>
    <div class="comparison-row"><h4>${escapeHtml(peerTitle)}</h4>${comparisonValues([
      {label: stockName, value: signedPercent(peers.stock_return_pct)},
      {label: peers.status === "limited" ? "單一同業" : "同業中位數", value: signedPercent(peers.peer_median_return_pct)},
      {label: "同期差距", value: percentagePoints(peers.relative_to_peer_median_pct_point)},
    ])}<small>${escapeHtml(peers.interpretation_zh || "")}</small>${peerItems ? `<ul class="peer-comparison-list">${peerItems}</ul>` : ""}</div>
    <p class="research-shadow">影子模式：這些比較目前不直接改變健康分數。</p>`;
  $("researchFit").innerHTML = (fit.lenses || []).map((lens) => `<details class="research-lens"><summary><b>${escapeHtml(lens.label_zh)}</b><span>${escapeHtml(researchStatus(lens.status))}</span></summary><p>${escapeHtml(lens.reason_zh || "")}</p>${lens.missing_evidence_zh?.length ? `<small>尚缺：${lens.missing_evidence_zh.map(escapeHtml).join("、")}</small>` : ""}</details>`).join("") || `<p>研究用途資料正在整理。</p>`;
  $("researchFollowUp").innerHTML = (fit.follow_up_items_zh || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("") || `<li>持續累積資料，再進行下一階段判讀。</li>`;
}

function formatEventValue(value, unit = "") {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)} ${unit}`.trim() : "—";
}

function eventDisplayValue(preformatted, value, unit = "") {
  return preformatted || formatEventValue(value, unit);
}

function renderTodayChanges(block) {
  const events = Array.isArray(block.events) ? block.events : [];
  const groups = completeTodayGroups(
    Array.isArray(block.event_groups) && block.event_groups.length
      ? block.event_groups : groupTodayEvents(events)
  );
  const overview = block.event_group_overview || buildGroupOverview(groups);
  $("todayChangesSummary").textContent = block.summary || "今日尚無足夠的可量化事件。";
  $("todayChangesBasis").textContent = block.comparison_available
    ? `與 ${block.comparison_date || "前一交易日"} 相比`
    : "相對中性基準的當期影響";
  $("todayChangesEmpty").classList.toggle("hidden", events.length > 0);
  $("todayChangesGrid").innerHTML = `<details class="today-change-group today-overview ${escapeHtml(overview.direction || "neutral")}">
    <summary>
      <div><small>全部面向</small><h3>${escapeHtml(overview.title || "總分變化總覽")}</h3></div>
      ${renderGroupTotals(overview)}
    </summary>
    <p class="today-group-summary">${escapeHtml(overview.summary || "點開下方五個面向，可查看全部加扣分原因。")}</p>
    <div class="today-overview-list">${groups.map((group) => `<div><b>${escapeHtml(group.label)}</b><span>${Number(group.net_impact || 0) >= 0 ? "+" : ""}${Number(group.net_impact || 0).toFixed(2)} 分</span></div>`).join("")}</div>
  </details>` + groups.map((group) => `<details class="today-change-group ${escapeHtml(group.direction || "neutral")}">
    <summary>
      <div><small>${escapeHtml(group.label || factorNames[group.category] || "其他研究資料")}</small><h3>${escapeHtml(group.headline || "同類因子彙整")}</h3></div>
      ${renderGroupTotals(group)}
    </summary>
    <p class="today-group-summary">${escapeHtml(group.summary || "以下完整列出這個面向的所有變化。")}</p>
    <div class="today-group-events">${(group.events || []).map(renderTodayEvent).join("")}</div>
  </details>`).join("");
}

function renderGroupTotals(group) {
  return `<dl class="today-group-totals">
    <div><dt>加分合計</dt><dd class="is-positive">+${Number(group.positive_impact || 0).toFixed(2)}</dd></div>
    <div><dt>扣分合計</dt><dd class="is-negative">${Number(group.negative_impact || 0).toFixed(2)}</dd></div>
    <div><dt>淨影響</dt><dd>${Number(group.net_impact || 0) >= 0 ? "+" : ""}${Number(group.net_impact || 0).toFixed(2)}</dd></div>
  </dl>`;
}

function completeTodayGroups(groups) {
  const labels = {financial:"財務表現", technical:"技術走勢", institutional:"法人籌碼", market:"市場環境", news:"新聞消息"};
  const byCategory = new Map(groups.map((group) => [group.category, group]));
  return Object.entries(labels).map(([category, label]) => byCategory.get(category) || {
    category, label, direction:"neutral", event_count:0,
    positive_impact:0, negative_impact:0, net_impact:0,
    headline:`${label}目前沒有變化`, summary:"這個面向目前沒有可量化的加扣分變化。", events:[],
  });
}

function buildGroupOverview(groups) {
  const positive = groups.reduce((sum, item) => sum + Number(item.positive_impact || 0), 0);
  const negative = groups.reduce((sum, item) => sum + Number(item.negative_impact || 0), 0);
  const net = positive + negative;
  const count = groups.reduce((sum, item) => sum + Number(item.event_count || 0), 0);
  return {
    title:"總分變化總覽", event_count:count, positive_impact:positive,
    negative_impact:negative, net_impact:net,
    direction:net > 0 ? "positive" : net < 0 ? "negative" : "neutral",
    summary:`全部 ${count} 項變化合計：加分 +${positive.toFixed(2)}、扣分 ${negative.toFixed(2)}，健康分淨影響 ${net >= 0 ? "+" : ""}${net.toFixed(2)} 分。`,
  };
}

function renderTodayEvent(item) {
  return `<article class="today-change ${escapeHtml(item.direction)}">
    <div class="today-change-heading">
      <span class="today-change-dot" aria-hidden="true"></span>
      <div><small>${escapeHtml(factorNames[item.category] || item.category || "研究證據")}</small><h3>${escapeHtml(item.title)}</h3></div>
      <strong>${item.impact >= 0 ? "+" : ""}${Number(item.impact).toFixed(2)} 分</strong>
    </div>
    <dl class="today-change-data">
      <div><dt>現在是多少？</dt><dd>${escapeHtml(eventDisplayValue(item.current_value_zh, item.current_value, item.current_unit))}</dd></div>
      <div><dt>之前／基準是多少？</dt><dd>${escapeHtml(eventDisplayValue(item.baseline_value_zh, item.baseline_value, item.current_unit))}</dd></div>
      <div><dt>比較方式</dt><dd>${escapeHtml(item.comparison_window || "—")}</dd></div>
    </dl>
    <div class="today-change-explain">
      <section><b>發生什麼？</b><p>${escapeHtml(item.what_happened || item.reason)}</p></section>
      <section><b>這代表什麼？</b><p>${escapeHtml(item.meaning)}</p></section>
      <section><b>為什麼影響分數？</b><p>${escapeHtml(item.score_reason || item.reason)}</p></section>
    </div>
    <footer><span>來源：${escapeHtml(item.source)}${item.source_time ? `｜${escapeHtml(item.source_time)}` : ""}｜信心 ${escapeHtml(item.confidence)}</span>${item.source_link_available ? `<a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">查看原始資料 ↗</a>` : `<span class="source-unavailable">此來源暫無可驗證連結</span>`}</footer>
  </article>`;
}

function groupTodayEvents(events) {
  const order = ["financial", "technical", "institutional", "market", "news"];
  const buckets = new Map();
  events.forEach((item) => {
    const category = item.category || "other";
    if (!buckets.has(category)) buckets.set(category, []);
    buckets.get(category).push(item);
  });
  return [...buckets.entries()].sort(([a], [b]) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  }).map(([category, rows]) => {
    const positive = rows.reduce((sum, item) => sum + Math.max(0, Number(item.impact) || 0), 0);
    const negative = rows.reduce((sum, item) => sum + Math.min(0, Number(item.impact) || 0), 0);
    const net = positive + negative;
    const label = factorNames[category] || "其他研究資料";
    return {
      category, label, events: rows,
      positive_impact: positive, negative_impact: negative, net_impact: net,
      direction: net > 0 ? "positive" : net < 0 ? "negative" : "neutral",
      headline: `${label}整體${net > 0 ? "加分" : net < 0 ? "扣分" : "影響持平"} ${Math.abs(net).toFixed(2)} 分`,
      summary: `本組共有 ${rows.length} 項變化；加分 +${positive.toFixed(2)}、扣分 ${negative.toFixed(2)}，淨影響 ${net >= 0 ? "+" : ""}${net.toFixed(2)} 分。`,
    };
  });
}

const factorNames = {financial:"財務健康",technical:"技術健康",institutional:"法人籌碼",market:"市場環境",news:"新聞情緒"};

function factorRows(items, emptyText) {
  if (!items?.length) return `<p class="factor-empty">${escapeHtml(emptyText)}</p>`;
  return items.map((item) => `<article class="score-evidence-item">
    <header class="score-evidence-head">
      <b class="score-evidence-name">${escapeHtml(item.label)}</b>
      <em class="score-evidence-impact ${item.impact >= 0 ? "is-positive" : "is-negative"}">${item.impact >= 0 ? "+" : ""}${Number(item.impact).toFixed(2)} 分</em>
    </header>
    <ul class="score-evidence-metrics">
      <li>${escapeHtml(factorNames[item.factor] || item.factor)}子指標 ${Number(item.score).toFixed(1)} 分</li>
      <li>子項權重 ${Number(item.sub_weight_pct).toFixed(1)}%</li>
      <li>面向權重 ${Number(item.factor_weight_pct).toFixed(1)}%</li>
    </ul>
    <p class="score-evidence-reason">${escapeHtml(item.reason)}</p>
    <p class="score-evidence-source">資料來源：${escapeHtml(item.source)}</p>
  </article>`).join("");
}

function renderEvidence(report) {
  $("scoreInterval").textContent = `目前區間 ${report.score_interval || "—"}`;
  $("scoreMethod").textContent = report.score_method || "分數用於一致比較，不代表未來漲跌。";
  const raw = Number(report.score_v1), shown = Number(report.score_v2 ?? report.score);
  $("scoreBridge").innerHTML = Number.isFinite(raw)
    ? `<b>展示分 ${shown.toFixed(1)}</b><span>原始加權分 ${raw.toFixed(1)}</span><span>校準調整 ${shown-raw >= 0 ? "+" : ""}${(shown-raw).toFixed(1)}</span>`
    : `<b>展示分 ${Number(report.score).toFixed(1)}</b>`;
  $("impactDefinition").textContent = report.impact_definition || "影響值以中性 50 分為基準，顯示各子指標對原始健康分的實際影響。";
  $("positiveFactors").innerHTML = factorRows(report.detailed_positive, "目前沒有可量化的加分因素。");
  $("negativeFactors").innerHTML = factorRows(report.detailed_negative, "目前沒有可量化的扣分因素。");
  $("weightAdjustments").innerHTML = (report.weight_adjustments || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  $("weightBox").classList.toggle("hidden", !(report.weight_adjustments || []).length);
  $("factorBreakdown").innerHTML = report.indicators.map((item) => `<details>
    <summary><b>${escapeHtml(item.label)} ${Number(item.score).toFixed(1)} 分</b><span>面向權重 ${Number(item.weight_pct).toFixed(1)}% · 原始分貢獻 ${Number(item.weighted_contribution).toFixed(2)} · 覆蓋 ${Number(item.coverage_pct).toFixed(1)}%</span></summary>
    <div>${factorRows(item.contributions, "這個面向尚無子指標明細。")}${item.missing_features?.length ? `<p class="missing-note">尚缺資料：${item.missing_features.map(escapeHtml).join("、")}</p>` : ""}</div>
  </details>`).join("");
}

function renderHistory(history) {
  const points = (history || []).filter((item) => item?.date && Number.isFinite(Number(item.score)));
  const chart = $("historyChart");
  const empty = $("historyEmpty");
  const summary = $("historySummary");
  if (points.length < 2) {
    chart.innerHTML = "";
    chart.classList.add("hidden");
    empty.classList.remove("hidden");
    summary.textContent = points.length ? `目前已累積 1 筆：${Number(points[0].score).toFixed(1)} 分。` : "歷史資料正在累積。";
    return;
  }
  chart.classList.remove("hidden");
  empty.classList.add("hidden");
  const width = 760, height = 250, left = 42, right = 18, top = 22, bottom = 38;
  const scores = points.map((item) => Number(item.score));
  const rawMin = Math.min(...scores), rawMax = Math.max(...scores);
  const min = Math.max(0, Math.floor((rawMin - 5) / 10) * 10);
  const max = Math.min(100, Math.max(min + 10, Math.ceil((rawMax + 5) / 10) * 10));
  const x = (index) => left + index * ((width - left - right) / (points.length - 1));
  const y = (score) => top + (max - score) * ((height - top - bottom) / (max - min));
  const line = points.map((item, index) => `${x(index)},${y(Number(item.score))}`).join(" ");
  const grid = [0, .5, 1].map((ratio) => {
    const value = Math.round(max - (max - min) * ratio);
    const gy = top + ratio * (height - top - bottom);
    return `<line x1="${left}" y1="${gy}" x2="${width-right}" y2="${gy}"/><text x="4" y="${gy+4}">${value}</text>`;
  }).join("");
  const dots = points.map((item, index) => `<g><circle cx="${x(index)}" cy="${y(Number(item.score))}" r="5"/><text class="point-score" x="${x(index)}" y="${y(Number(item.score))-12}" text-anchor="middle">${Number(item.score).toFixed(1)}</text><text class="point-date" x="${x(index)}" y="${height-10}" text-anchor="middle">${escapeHtml(item.date.slice(5))}</text></g>`).join("");
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><g class="chart-grid">${grid}</g><polyline points="${line}"/>${dots}</svg>`;
  const delta = scores.at(-1) - scores.at(-2);
  const direction = delta > 0 ? "上升" : delta < 0 ? "下降" : "持平";
  summary.innerHTML = `<b>最新 ${scores.at(-1).toFixed(1)} 分</b><span>較前次${direction} ${Math.abs(delta).toFixed(1)} 分；目前共 ${points.length} 個有效日期。</span>`;
}

function renderSources(sources) {
  $("sourceGrid").innerHTML = (sources || []).map((item) => `<article><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.source)}</span></article>`).join("") || "<p class=\"factor-empty\">資料來源正在整理。</p>";
}

function renderIndicators(indicators) {
  $("indicatorGrid").innerHTML = indicators.map((item, index) => `
    <button class="indicator-card ${index === 0 ? "selected" : ""}" data-index="${index}" type="button">
      <span class="indicator-icon">${icons[index] || "•"}</span>
      <span class="indicator-name">${escapeHtml(item.label)}</span>
      <strong>${Number(item.score).toFixed(1)}</strong>
      <span class="level ${levelTone(item.score)}">${escapeHtml(item.level)}</span>
      <span class="bar"><i style="width:${Math.min(100, Math.max(0, item.score))}%"></i></span>
    </button>`).join("");
  selectIndicator(0);
  document.querySelectorAll(".indicator-card").forEach((button) => {
    button.addEventListener("click", () => selectIndicator(Number(button.dataset.index)));
  });
}

function selectIndicator(index) {
  if (!currentReport?.indicators[index]) return;
  document.querySelectorAll(".indicator-card").forEach((card, cardIndex) => card.classList.toggle("selected", cardIndex === index));
  const item = currentReport.indicators[index];
  $("indicatorDetail").innerHTML = `<b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.note)}</span>`;
}

async function loadStock(stockId) {
  if (!/^\d{4}$/.test(stockId)) {
    $("formHint").textContent = "請輸入四位數台股代號";
    return;
  }
  showDetailView();
  setState("loading");
  $("formHint").textContent = "正在取得最新研究報告…";
  try {
    const response = await fetch(`/api/stocks/${encodeURIComponent(stockId)}`, {headers: {Accept: "application/json"}});
    const payload = await response.json();
    if (response.status === 401) {
      showInviteGate("登入已逾期，請重新輸入邀請碼。 ");
      return;
    }
    if (!response.ok) throw new Error(payload.detail || "暫時無法取得研究報告");
    render(payload.report);
    setState("ready");
    $("formHint").textContent = `已顯示 ${payload.report.name}（${payload.report.id}）`;
  } catch (error) {
    setState("error", error.message || "暫時無法取得研究報告");
    $("formHint").textContent = "請確認代號或稍後再試";
  }
}

function watchlist() {
  try {
    const saved = JSON.parse(localStorage.getItem("aiStockWatchlist") || "[]");
    return Array.isArray(saved) ? [...new Set(saved.map(String).filter((id) => /^\d{4}$/.test(id)))] : [];
  } catch { return []; }
}

function saveWatchlist(items) {
  localStorage.setItem("aiStockWatchlist", JSON.stringify([...new Set(items.map(String))]));
  refreshWatchlistUI();
  renderNotificationCenter();
}

function refreshSavedButton() {
  const saved = currentReport && watchlist().includes(currentReport.id);
  $("saveButton").classList.toggle("saved", Boolean(saved));
  $("saveButton").textContent = saved ? "★ 已加入自選" : "☆ 加入自選";
}

function toggleSaved() {
  if (!currentReport) return;
  const saved = new Set(watchlist());
  const adding = !saved.has(currentReport.id);
  adding ? saved.add(currentReport.id) : saved.delete(currentReport.id);
  saveWatchlist([...saved]);
  showToast(adding ? `已將 ${currentReport.name} 加入自選` : `已將 ${currentReport.name} 移出自選`);
}

function sectorName(industry) {
  const value = String(industry || "");
  if (/半導體/.test(value)) return "半導體業";
  if (/生技|醫療|製藥/.test(value)) return "生技醫療業";
  if (/航運|海運|航空/.test(value)) return "航運業";
  if (/金融|保險|銀行|金控|證券/.test(value)) return "金融保險業";
  if (/電子|電腦|光電|通信|網路/.test(value)) return "AI電子業";
  return "傳統產業";
}

function stockDecisionProfile(item) {
  const profileId = item.stock_profile?.profile_id || "default";
  const profiles = {
    financial_income: item.income_profile,
    growth_quality: item.growth_profile,
    cyclical: item.cyclical_profile,
    high_volatility_event: item.event_profile,
  };
  return profiles[profileId] || {};
}

function renderSectorFilters() {
  const preferred = [
    {id: "全部", label: "全部"},
    {id: "financial_income", label: "收益"},
    {id: "growth_quality", label: "成長"},
    {id: "cyclical", label: "循環"},
    {id: "high_volatility_event", label: "事件"},
  ];
  const present = new Set(stockCatalog.map((item) => item.stock_profile?.profile_id));
  const types = preferred.filter((item) => item.id === "全部" || present.has(item.id));
  const preferredIndustries = ["全部產業", "AI電子業", "傳統產業", "半導體業", "生技醫療業", "航運業", "金融保險業"];
  const presentIndustries = new Set(stockCatalog.map((item) => item.sector));
  const industries = preferredIndustries.filter((item) => item === "全部產業" || presentIndustries.has(item));
  $("industryFilter").innerHTML = industries.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  $("industryFilter").value = activeIndustry;
  $("sectorFilters").innerHTML = types.map((item) => `<button type="button" class="sector-filter ${item.id === activeSector ? "active" : ""}" data-sector="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("");
  document.querySelectorAll(".sector-filter").forEach((button) => button.addEventListener("click", () => {
    activeSector = button.dataset.sector;
    renderSectorFilters();
    renderStockCenter();
  }));
}

function renderStockCenter() {
  const saved = new Set(watchlist());
  const query = exploreQuery.trim().toLowerCase();
  const riskOrder = (item) => Number(item.risk || 0);
  const rows = stockCatalog.filter((item) => (activeSector === "全部" || item.stock_profile?.profile_id === activeSector)
    && (activeIndustry === "全部產業" || item.sector === activeIndustry)
    && (!watchlistOnly || saved.has(item.id))
    && (!query || item.id.includes(query) || String(item.name).toLowerCase().includes(query) || String(item.industry).toLowerCase().includes(query)))
    .sort((a, b) => exploreSort === "score-desc" ? Number(b.score) - Number(a.score)
      : exploreSort === "score-asc" ? Number(a.score) - Number(b.score)
      : exploreSort === "risk" ? riskOrder(b) - riskOrder(a) : 0);
  $("stockCenterCount").textContent = rows.length;
  $("watchlistCount").textContent = saved.size;
  $("watchlistOnlyButton").classList.toggle("active", watchlistOnly);
  $("watchlistOnlyButton").setAttribute("aria-pressed", String(watchlistOnly));
  $("stockCenterGrid").innerHTML = rows.map((item) => `<article class="stock-center-card ${currentReport?.id === item.id ? "current" : ""}" data-stock-card="${item.id}" role="link" tabindex="0" aria-label="查看 ${escapeHtml(item.name)}（${item.id}）研究報告">
    <div class="stock-card-title"><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.id)} · ${escapeHtml(item.industry)}</small><em class="stock-card-profile">${escapeHtml(item.stock_profile?.label_zh || "待確認")}</em></div><strong class="stock-card-score ${levelTone(item.score)}">${Number(item.score).toFixed(1)}</strong></div>
    <p class="stock-card-decision">${escapeHtml(stockDecisionProfile(item).decision?.unheld || "等待更多證據")}</p><div class="stock-card-meta"><span>研究等級<b>${escapeHtml(item.grade)}</b></span><span>風險<b>${escapeHtml(item.risk_level)}</b></span></div>
    <div class="stock-card-actions"><span class="stock-card-assessment">${escapeHtml(item.assessment)}</span><button type="button" data-save-stock="${item.id}" aria-label="${saved.has(item.id) ? "移出" : "加入"}${escapeHtml(item.name)}自選">${saved.has(item.id) ? "★ 已自選" : "☆ 加入自選"}</button><button type="button" data-open-stock="${item.id}">查看報告 →</button></div>
  </article>`).join("");
  $("stockCenterEmpty").classList.toggle("hidden", rows.length > 0);
  const openCard = async (card) => {
    const id = card.dataset.stockCard;
    $("stockSearch").value = id;
    await loadStock(id);
    document.querySelector(".dashboard-grid")?.scrollIntoView({behavior:"smooth", block:"start"});
  };
  document.querySelectorAll("[data-stock-card]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-save-stock]")) return;
      openCard(card);
    });
    card.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !event.target.closest("[data-save-stock]")) {
        event.preventDefault();
        openCard(card);
      }
    });
  });
  document.querySelectorAll("[data-save-stock]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.saveStock;
    const savedItems = new Set(watchlist());
    const adding = !savedItems.has(id);
    adding ? savedItems.add(id) : savedItems.delete(id);
    saveWatchlist([...savedItems]);
    const stock = stockCatalog.find((item) => item.id === id);
    showToast(`${stock?.name || id}${adding ? " 已加入自選" : " 已移出自選"}`);
  }));
}

function refreshWatchlistUI() {
  refreshSavedButton();
  renderStockCenter();
  renderHomeDashboard();
  renderWatchlistPage();
  renderProfilePage();
}

function formatHomeDate(value = new Date()) {
  return new Intl.DateTimeFormat("zh-TW", {month:"long", day:"numeric", weekday:"long"}).format(value);
}

function reportEvents(report) {
  const events = report?.today_changes?.events;
  return Array.isArray(events) ? events : [];
}

function scoreChange(report) {
  const history = Array.isArray(report?.score_history) ? report.score_history : [];
  if (history.length < 2) return null;
  const current = Number(history.at(-1)?.score);
  const previous = Number(history.at(-2)?.score);
  return Number.isFinite(current) && Number.isFinite(previous) ? current - previous : null;
}

function homeDirection(report) {
  const net = reportEvents(report).reduce((total, item) => total + Number(item.score_impact || item.impact || 0), 0);
  if (net > 0.05) return {label:"正向", tone:"positive", arrow:"↑"};
  if (net < -0.05) return {label:"注意", tone:"negative", arrow:"↓"};
  return {label:"持續追蹤", tone:"neutral", arrow:"→"};
}

function reportNetImpact(report) {
  return reportEvents(report).reduce((total, item) => total + Number(item.score_impact || item.impact || 0), 0);
}

function categoryLabel(value) {
  const labels = {financial:"財務表現", technical:"技術走勢", institutional:"法人籌碼", market:"市場環境", news:"新聞消息"};
  return labels[String(value || "").toLowerCase()] || value || "研究資料";
}

function latestPrice(report) {
  const metrics = report?.investment_research?.valuation?.metrics || [];
  const item = metrics.find((metric) => /最新收盤|股價/.test(metric.label_zh || ""));
  return Number.isFinite(Number(item?.value)) ? Number(item.value) : null;
}

function scoreSparkline(report) {
  const points = (Array.isArray(report?.score_history) ? report.score_history : []).map((item) => Number(item.score)).filter(Number.isFinite).slice(-8);
  if (points.length < 2) return `<span class="mini-trend-empty">趨勢建立中</span>`;
  const min = Math.min(...points), max = Math.max(...points), range = Math.max(max - min, 1);
  const coordinates = points.map((value, index) => `${(index / (points.length - 1) * 100).toFixed(1)},${(28 - ((value - min) / range * 24)).toFixed(1)}`).join(" ");
  const tone = points.at(-1) >= points[0] ? "positive" : "negative";
  return `<svg class="mini-trend ${tone}" viewBox="0 0 100 32" role="img" aria-label="近期健康分數趨勢"><polyline points="${coordinates}"></polyline></svg>`;
}

function marketHomeSummary() {
  const summaries = stockCatalog
    .map((report) => report.market_home_summary)
    .filter((item) => item && item.version === "MarketHomeSummary-v1.0");

  return (
    summaries.find((item) => item.status === "available") ||
    summaries.find((item) => item.status === "stale") ||
    summaries[0] ||
    null
  );
}

function renderMarketHomeSummary() {
  const market = marketHomeSummary();
  const available = market?.status === "available";
  const stale = market?.status === "stale";
  $("dailyConclusionTitle").textContent = market?.headline_zh || "市場資料正在建立";
  $("dailyConclusionCopy").textContent = market?.summary_zh || "大盤指數與市場風險尚未接入首頁合約；目前不顯示推測數字。";
  $("marketDataStatus").textContent = available ? "官方資料" : stale ? "資料需更新" : "資料建立中";
  $("marketDataStatus").classList.toggle("stale", stale);
  $("marketIndexValue").textContent = Number.isFinite(Number(market?.close)) ? Number(market.close).toLocaleString("zh-TW", {maximumFractionDigits:2}) : "—";
  const change = Number(market?.daily_change_pct);
  $("marketIndexChange").textContent = Number.isFinite(change) ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "等待可比較交易日";
  $("marketIndexChange").className = Number.isFinite(change) ? (change >= 0 ? "positive" : "negative") : "";
  $("marketRiskValue").textContent = market?.risk_level_zh || "尚未評估";
  $("marketRiskNote").textContent = market?.market_regime_zh ? `市場趨勢 ${market.market_regime_zh}` : "不使用個股資料代替";
  $("marketConfidenceValue").textContent = available ? ({high:"高", medium:"中", low:"低"}[market.confidence] || "可用") : stale ? "過期" : "建立中";
  $("marketDataDate").textContent = market?.data_date ? `資料 ${market.data_date}` : "完成後自動更新";
  const values = (Array.isArray(market?.history) ? market.history : []).map((item) => Number(item.close)).filter(Number.isFinite).slice(-20);
  if (values.length < 2) { $("marketPreview").innerHTML = ""; return; }
  const min = Math.min(...values), max = Math.max(...values), range = Math.max(max - min, 1);
  const points = values.map((value, index) => `${(index / (values.length - 1) * 266 + 2).toFixed(1)},${(70 - ((value - min) / range * 62)).toFixed(1)}`).join(" ");
  const tone = values.at(-1) >= values[0] ? "positive" : "negative";
  $("marketPreview").innerHTML = `<polyline class="${tone}" points="${points}"></polyline>`;
}

function allUpcomingEvents() {
  const unique = new Map();
  stockCatalog.forEach((report) => {
    const block = report?.upcoming_events;
    if (!block || block.version !== "UpcomingEvents-v1.0") return;
    (Array.isArray(block.events) ? block.events : []).forEach((event) => {
      if (!event?.verified || event.affects_health_score !== false) return;
      const key = event.event_id || `${event.stock_id}:${event.event_type}:${event.event_date}`;
      unique.set(key, {...event, stock_id:event.stock_id || report.id, stock_name:event.stock_name || report.name});
    });
  });
  return Array.from(unique.values()).sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)) || String(a.stock_id).localeCompare(String(b.stock_id)));
}

function formatEventDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return "日期待確認";
  const weekday = ["日", "一", "二", "三", "四", "五", "六"];
  const parsed = new Date(`${value}T12:00:00`);
  return `${Number(match[2])}/${Number(match[3])}（${weekday[parsed.getDay()]}）`;
}

function upcomingEventLabel(type) {
  return ({
    ex_dividend:"除息", ex_right:"除權", ex_right_dividend:"除權息",
    shareholder_meeting:"股東會", investor_conference:"法說會",
    financial_report_board:"財報", central_bank_meeting:"央行",
    consumer_price_release:"物價", gdp_release:"總經",
    employment_release:"就業", export_orders_release:"外銷訂單",
    industrial_production_release:"產業", trade_release:"進出口",
    foreign_reserves_release:"外匯"
  })[type] || "重要日程";
}

function renderUpcomingEvents() {
  const contracts = stockCatalog.map((report) => report?.upcoming_events).filter((block) => block?.version === "UpcomingEvents-v1.0");
  const events = allUpcomingEvents();
  const status = $("futureEventsStatus");
  if (events.length) {
    status.textContent = `${events.length} 項已確認`;
    $("futureEvents").innerHTML = events.slice(0, 4).map((event) => `<article class="warm-card future-event-card">
      <button type="button" ${event.stock_id === "MARKET" ? "" : `data-home-stock="${escapeHtml(event.stock_id)}"`}>
        <time datetime="${escapeHtml(event.event_date)}">${escapeHtml(formatEventDate(event.event_date))}</time>
        <span class="future-event-type">${escapeHtml(upcomingEventLabel(event.event_type))}</span>
        <h3>${escapeHtml(event.title_zh || `${event.stock_name} 重要日程`)}</h3>
        <p>${escapeHtml(event.beginner_explanation_zh || "日期本身不是買賣訊號，請查看官方內容後再判斷。")}</p>
        <small>${escapeHtml(event.stock_id === "MARKET" ? (event.source_name_zh || "官方市場資料") : `${event.stock_name || ""} ${event.stock_id || ""}`)}</small>
      </button>
      ${event.source_url ? `<a href="${escapeHtml(event.source_url)}" target="_blank" rel="noopener noreferrer">查看官方資料 ↗</a>` : ""}
    </article>`).join("");
    document.querySelectorAll("#futureEvents [data-home-stock]").forEach((button) => button.addEventListener("click", () => loadStock(button.dataset.homeStock)));
    return;
  }
  const ready = contracts.some((block) => block.status === "empty" || block.status === "available");
  status.textContent = ready ? "已完成檢查" : "資料建立中";
  $("futureEvents").innerHTML = `<article class="warm-card event-placeholder"><time>${ready ? "未來 7 天" : "尚未建立"}</time><span>${ready ? "沒有已確認的官方事件" : "官方預定事件資料尚未接入"}</span><p>${ready ? "目前不需要因為預定日程採取動作；系統每日更新後會重新檢查。" : "不顯示推測日期，完成官方來源更新後會自動出現。"}</p></article>`;
}

function renderMaterialNewsHome() {
  const container = $("materialNewsHome");
  const status = $("materialNewsStatus");

  if (!container || !status) return;

  const severityOrder = {high: 0, medium: 1};

  const rankedItems = stockCatalog
    .flatMap((report) => {
      const newsItems = Array.isArray(report.material_news?.items)
        ? report.material_news.items
        : [];

      return newsItems.map((item) => ({
        ...item,
        stock_id: report.id,
        stock_name: report.name,
      }));
    })
    .filter((item) => {
      if (!item.title || !item.source_url) return false;

      const sourceCount = Number(item.confirmed_by_count || 1);
      const sourceText = `${item.source_name || ""} ${item.title || ""}`;

      const lowAuthority =
        /CMoney|\u6295\u8cc7\u7db2\u8a8c|\u80a1\u5e02\u7206\u6599|\u81ea\u5b78\u7db2|\u65b9\u683c\u5b50|Vocus|facebook/i
          .test(sourceText);

      const commentary =
        /\u63db\u80a1|\u80fd\u5426|\u8a72\u8cb7\u55ce|\u52a0\u78bc|\u7372\u5229\u6a21\u5f0f|\u8b77\u57ce\u6cb3\u9084\u5728|\u89c0\u5bdf\u9019\u4e9b\u6578\u64da/i
          .test(item.title);

      return sourceCount > 1 && !commentary;
    })
    .sort((a, b) => {
      const severity =
        (severityOrder[a.severity] ?? 9) -
        (severityOrder[b.severity] ?? 9);

      if (severity !== 0) return severity;

      return String(b.published_at || "")
        .localeCompare(String(a.published_at || ""));
    })
    .slice(0, 100);

  const seenStocks = new Set();
  const seenEvents = new Set();

  const uniqueItems = rankedItems.filter((item) => {
    const eventKey = String(item.title || "")
      .toLowerCase()
      .replace(/[^0-9a-z\u4e00-\u9fff]+/g, "");

    if (seenStocks.has(item.stock_id)) return false;
    if (seenEvents.has(eventKey)) return false;

    seenStocks.add(item.stock_id);
    seenEvents.add(eventKey);
    return true;
  });
  const items = uniqueItems.slice(0, 5);

  status.textContent = materialNewsPageItems().length ? `${materialNewsPageItems().length} 項` : "近 7 日";

  if (!items.length) {
    container.innerHTML =
      '<div class="warm-card home-empty">近 7 日未發現值得確認的公司重大消息。</div>';
    return;
  }

  container.innerHTML = items.map((item) => {
    const date = String(item.published_at || "")
      .slice(5, 10)
      .replace("-", "/");

    const high = item.severity === "high";
    const sourceCount = Number(item.confirmed_by_count || 1);

    return `
      <article class="material-news-card warm-card ${high ? "high" : "medium"}">
        <button type="button" data-material-stock="${escapeHtml(item.stock_id)}">
          <div class="material-news-meta">
            <span>${escapeHtml(item.stock_name)} · ${escapeHtml(item.stock_id)}</span>
            <time>${escapeHtml(date)}</time>
          </div>
          <div class="material-news-labels">
            <em>${
              high
                ? sourceCount > 1
                  ? "\u591a\u4f86\u6e90\u91cd\u8981"
                  : "\u512a\u5148\u78ba\u8a8d"
                : "\u503c\u5f97\u7559\u610f"
            }</em>
            <span>${escapeHtml(item.category_label_zh || "公司消息")}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.reason_zh || "這項消息值得進一步確認。")}</p>
          <small>
            ${escapeHtml(item.source_name || "新聞來源")} ·
            ${sourceCount > 1
              ? `${sourceCount} 個來源報導`
              : "單一來源，待確認"}
          </small>
        </button>
        <a href="${escapeHtml(item.source_url)}"
           target="_blank"
           rel="noopener noreferrer">查看原文 ↗</a>
      </article>
    `;
  }).join("");

  document
    .querySelectorAll("[data-material-stock]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        loadStock(button.dataset.materialStock);
      });
    });
}
function materialNewsPageItems() {
  const severityOrder = {high: 0, medium: 1};
  const seenEvents = new Set();

  return stockCatalog
    .flatMap((report) => {
      const items = Array.isArray(report.material_news?.items)
        ? report.material_news.items
        : [];

      return items.map((item) => ({
        ...item,
        stock_id: report.id,
        stock_name: report.name,
      }));
    })
    .filter((item) => {
      if (!item.title || !item.source_url) return false;

      const sourceCount = Number(item.confirmed_by_count || 1);
      const commentary =
        /\u63db\u80a1|\u80fd\u5426|\u8a72\u8cb7\u55ce|\u52a0\u78bc|\u7372\u5229\u6a21\u5f0f|\u8b77\u57ce\u6cb3\u9084\u5728|\u89c0\u5bdf\u9019\u4e9b\u6578\u64da|\u4eca\u65e5\u6700\u592f\u80a1|\u5e02\u5834\u7126\u9ede|\u80a1\u50f9\u8d70\u9ad8|\u53e9\u95dc\u524d\u9ad8|\u6cd5\u4eba\u770b\u6cd5|\u5916\u8cc7\u5927\u8cb7|\u9078\u80a1|\u76e4\u52e2/i
          .test(item.title);

      return sourceCount > 1 && !commentary;
    })
    .sort((a, b) => {
      const severity =
        (severityOrder[a.severity] ?? 9) -
        (severityOrder[b.severity] ?? 9);

      if (severity !== 0) return severity;

      return String(b.published_at || "")
        .localeCompare(String(a.published_at || ""));
    })
    .filter((item) => {
      const eventKey = String(item.title || "")
        .toLowerCase()
        .replace(/[^0-9a-z\u4e00-\u9fff]+/g, "");

      if (!eventKey || seenEvents.has(eventKey)) return false;

      seenEvents.add(eventKey);
      return true;
    });
}

function renderMaterialNewsPage() {
  const container = $("materialNewsPageGrid");
  const count = $("materialNewsPageCount");
  const stockFilter = $("materialNewsStockFilter");
  const categoryFilter = $("materialNewsCategoryFilter");

  if (!container || !count || !stockFilter || !categoryFilter) return;

  const allItems = materialNewsPageItems();
  const selectedStock = stockFilter.value || "all";
  const selectedCategory = categoryFilter.value || "all";

  const stocks = [...new Map(
    allItems.map((item) => [
      item.stock_id,
      {id: item.stock_id, name: item.stock_name},
    ])
  ).values()].sort((a, b) => a.id.localeCompare(b.id));

  const categories = [...new Set(
    allItems.map((item) => item.category_label_zh || "公司消息")
  )].sort();

  stockFilter.innerHTML = [
    '<option value="all">全部股票</option>',
    ...stocks.map((item) =>
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.id)}</option>`
    ),
  ].join("");

  categoryFilter.innerHTML = [
    '<option value="all">全部類型</option>',
    ...categories.map((item) =>
      `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`
    ),
  ].join("");

  stockFilter.value = stocks.some((item) => item.id === selectedStock)
    ? selectedStock
    : "all";

  categoryFilter.value = categories.includes(selectedCategory)
    ? selectedCategory
    : "all";

  const items = allItems.filter((item) =>
    (stockFilter.value === "all" || item.stock_id === stockFilter.value) &&
    (
      categoryFilter.value === "all" ||
      (item.category_label_zh || "公司消息") === categoryFilter.value
    )
  );

  count.textContent = `${items.length} 項`;

  if (!items.length) {
    container.innerHTML =
      '<div class="warm-card home-empty">目前沒有符合篩選條件的重要消息。</div>';
    return;
  }

  container.innerHTML = items.map((item) => {
    const date = String(item.published_at || "")
      .slice(5, 10)
      .replace("-", "/");

    const sourceCount = Number(item.confirmed_by_count || 1);
    const high = item.severity === "high";

    return `
      <article class="material-news-card warm-card ${high ? "high" : "medium"}">
        <button type="button" data-news-page-stock="${escapeHtml(item.stock_id)}">
          <div class="material-news-meta">
            <span>${escapeHtml(item.stock_name)} · ${escapeHtml(item.stock_id)}</span>
            <time>${escapeHtml(date)}</time>
          </div>
          <div class="material-news-labels">
            <em>${high ? "多來源重要" : "值得留意"}</em>
            <span>${escapeHtml(item.category_label_zh || "公司消息")}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.reason_zh || "這項消息值得進一步確認。")}</p>
          <small>
            ${escapeHtml(item.source_name || "新聞來源")} ·
            ${sourceCount} 個來源報導
          </small>
        </button>
        <a href="${escapeHtml(item.source_url)}"
           target="_blank"
           rel="noopener noreferrer">查看原文 ↗</a>
      </article>
    `;
  }).join("");

  document
    .querySelectorAll("[data-news-page-stock]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        loadStock(button.dataset.newsPageStock);
      });
    });
}
function renderHomeDashboard() {
  $("homeDate").textContent = formatHomeDate();
  const updates = stockCatalog.map((report) => report.updated).filter((value) => value && value !== "—").sort();
  $("homeLastUpdated").textContent = updates.length ? `資料 ${updates.at(-1)}` : "等待更新";
  renderMarketHomeSummary();
  renderUpcomingEvents();
  renderDailyResearch();
  renderMaterialNewsHome();

  const digestRows = stockCatalog.filter((report) => reportEvents(report).length)
    .sort((a, b) => Math.abs(reportNetImpact(b)) - Math.abs(reportNetImpact(a)) || reportEvents(b).length - reportEvents(a).length).slice(0, 3);
  $("todayDigest").innerHTML = digestRows.length ? digestRows.map((report) => {
    const direction = homeDirection(report);
    const event = reportEvents(report)[0] || {};
    return `<button class="digest-row" type="button" data-home-stock="${report.id}">
      <span class="digest-icon">${escapeHtml(sectorName(report.industry).slice(0, 1))}</span>
      <span class="digest-copy"><b>${escapeHtml(report.name)} <small>${report.id}</small></b><em>${escapeHtml(event.title_zh || event.title || `${reportEvents(report).length} 項研究變化`)}</em></span>
      <span class="digest-tag">${reportEvents(report).length} 項</span>
      <span class="digest-direction ${direction.tone}">${direction.arrow} ${direction.label}</span>
      <span class="digest-confidence">信心 ${Math.round(Number(report.confidence || 0))}%</span><span class="digest-arrow">›</span>
    </button>`;
  }).join("") : `<p class="home-empty">目前沒有可顯示的今日變化；報告更新後會自動出現在這裡。</p>`;

  const saved = new Set(watchlist());
  const savedReports = stockCatalog.filter((report) => saved.has(report.id)).slice(0, 4);
  $("homeWatchlistNotice").textContent = savedReports.length ? `${savedReports.length} 檔自選` : "尚未加入";
  $("watchlistPreview").innerHTML = savedReports.length ? savedReports.map((report) => {
    const delta = scoreChange(report);
    return `<button class="watch-preview-card warm-card" type="button" data-home-stock="${report.id}">
      <span><b>${escapeHtml(report.name)}</b><small>${report.id}</small></span><strong>${Number(report.score).toFixed(1)}</strong><em>健康分數</em>
      <i class="${delta == null ? "neutral" : delta >= 0 ? "positive" : "negative"}">${delta == null ? "等待第二個日期" : `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)} 分`}</i>
    </button>`;
  }).join("") : `<div class="warm-card home-empty">加入自選股後，這裡會顯示健康分數與最新變化。</div>`;

  document.querySelectorAll("[data-home-stock]").forEach((button) => button.addEventListener("click", () => loadStock(button.dataset.homeStock)));
  renderProfilePage();
}

function dailyResearchContract() {
  const contracts = stockCatalog.map((report) => report.daily_research).filter((block) => /^DailyResearch-v1\./.test(block?.version || ""));
  if (!contracts.length) return null;
  const dataDate = contracts.map((block) => block.data_date).filter(Boolean).sort().at(-1) || formatHomeDate();
  const order = ["new", "change", "follow_up", "evidence"];
  const steps = order.map((key) => {
    const candidates = contracts.flatMap((block) => block.steps || []).filter((step) => step.key === key);
    const availableStep = candidates.find((step) => step.available) || candidates[0];
    if (!availableStep) return null;
    let itemCount = candidates.reduce((sum, step) => sum + Number(step.item_count || 0), 0);
    if (!itemCount && candidates.some((step) => step.available)) itemCount = candidates.filter((step) => step.available).length;
    if (key === "new") itemCount = allUpcomingEvents().length;
    if (["change", "follow_up", "evidence"].includes(key)) {
      itemCount = contracts.filter((block) => (block.steps || []).some((step) => step.key === key && step.available)).length;
    }
    const unit = {new:"個日程", change:"檔股票", follow_up:"檔股票", evidence:"份報告"}[key] || availableStep.unit_zh;
    return {...availableStep, item_count:itemCount, unit_zh:unit, available:itemCount > 0};
  }).filter(Boolean);
  return {data_date:dataDate, steps, notice_zh:contracts[0].notice_zh, estimated_minutes:Math.max(...contracts.map((block) => Number(block.estimated_minutes || 0)))};
}

function dailyResearchStorageKey(dataDate) {
  return `aiStockDailyResearch:${dataDate}`;
}

function completedDailyResearch(dataDate) {
  try { return new Set(JSON.parse(localStorage.getItem(dailyResearchStorageKey(dataDate)) || "[]")); }
  catch { return new Set(); }
}

function completeDailyResearchStep(key, dataDate) {
  const completed = completedDailyResearch(dataDate);
  completed.add(key);
  localStorage.setItem(dailyResearchStorageKey(dataDate), JSON.stringify([...completed]));
  renderDailyResearch();
  renderMaterialNewsHome();
}

function startDailyResearchStep(key, dataDate) {
  if (key === "new") {
    activePage = "home";
    showHomeView({restoreScroll:false});
    switchPage("home", {scroll:false});
    window.setTimeout(() => $("futureEvents").scrollIntoView({behavior:"smooth", block:"start"}), 30);
  } else if (key === "change") {
    showHomeView({restoreScroll:false});
    switchPage("events");
  } else if (key === "follow_up") {
    showHomeView({restoreScroll:false});
    switchPage("watchlist");
  } else if (key === "evidence") {
    const report = stockCatalog.filter((item) => reportEvents(item).length).sort((a, b) => Math.abs(reportNetImpact(b)) - Math.abs(reportNetImpact(a)))[0] || stockCatalog[0];
    if (report) loadStock(report.id);
  }
  completeDailyResearchStep(key, dataDate);
}

function renderDailyResearch() {
  if (!$("dailyResearchSteps")) return;
  const contract = dailyResearchContract();
  if (!contract) {
    $("dailyResearchProgress").textContent = "等待報告更新";
    $("dailyResearchSteps").innerHTML = '<p class="home-empty">今日研究合約尚未建立；更新客戶報告後會自動出現。</p>';
    return;
  }
  const availableSteps = contract.steps.filter((step) => step.available);
  const completed = completedDailyResearch(contract.data_date);
  const completedCount = availableSteps.filter((step) => completed.has(step.key)).length;
  const total = availableSteps.length;
  const percentage = total ? completedCount / total * 100 : 0;
  const countFor = (key) => Number(contract.steps.find((step) => step.key === key)?.item_count || 0);
  const summaryParts = [];
  if (countFor("new")) summaryParts.push(`${countFor("new")} 個確認日程`);
  if (countFor("change")) summaryParts.push(`${countFor("change")} 檔股票有變化`);
  if (countFor("follow_up")) summaryParts.push(`${countFor("follow_up")} 檔股票待追蹤`);
  $("dailyResearchSummary").textContent = summaryParts.length ? `今天整理出 ${summaryParts.join("、")}；照順序看完即可。` : "今天沒有新增待看內容，可以回到自選股查看目前狀態。";
  $("dailyResearchCount").textContent = `${completedCount} / ${total}`;
  $("dailyResearchProgress").textContent = total && completedCount === total ? "今日研究完成" : `${completedCount} / ${total} 完成`;
  $("dailyResearchBar").style.width = `${percentage}%`;
  $("dailyResearchEstimate").textContent = total && completedCount === total ? "今天的重要內容已看完" : `預計剩餘 ${Math.max(1, (total - completedCount) * 2)} 分鐘`;
  $("dailyResearchNotice").textContent = contract.notice_zh || "只安排閱讀順序，不提供交易指令，也不改變健康分數。";
  $("dailyResearchSteps").innerHTML = contract.steps.map((step) => {
    const done = completed.has(step.key);
    const countText = step.available ? `${Number(step.item_count || 0)} ${escapeHtml(step.unit_zh || "項")}` : "今天沒有";
    return `<button class="daily-task ${done ? "done" : ""} ${step.available ? "" : "unavailable"}" type="button" data-daily-task="${escapeHtml(step.key)}" ${step.available ? "" : "disabled"}><span class="daily-task-top"><span class="daily-task-label">${escapeHtml(step.label_zh || step.label)}</span><em>${countText}</em></span><b>${escapeHtml(step.title_zh)}</b><p>${escapeHtml(step.why_it_matters_zh || step.description_zh)}</p><span class="daily-task-state">${step.available ? (done ? "✓ 已看完" : "去看看 ›") : "目前不用處理"}</span></button>`;
  }).join("");
  document.querySelectorAll("[data-daily-task]").forEach((button) => button.addEventListener("click", () => startDailyResearchStep(button.dataset.dailyTask, contract.data_date)));
}

function watchlistCard(report) {
  const delta = scoreChange(report);
  const direction = homeDirection(report);
  const price = latestPrice(report);
  return `<article class="watchlist-detail-card warm-card">
    <button type="button" data-home-stock="${report.id}" aria-label="查看 ${escapeHtml(report.name)}">
      <div><span class="watch-stock-name"><b>${escapeHtml(report.name)}</b><small>${report.id} · ${escapeHtml(report.industry)}</small></span><strong>${Number(report.score).toFixed(1)}</strong></div>
      <p>${escapeHtml(report.summary || "持續追蹤最新研究變化。")}</p>
      <div class="watch-price-row"><span>${price == null ? "最新股價待補" : `最新股價 ${price.toLocaleString("zh-TW")} 元`}</span>${scoreSparkline(report)}</div>
      <dl><div><dt>健康變化</dt><dd class="${delta == null ? "neutral" : delta >= 0 ? "positive" : "negative"}">${delta == null ? "基準建立中" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} 分`}</dd></div><div><dt>風險</dt><dd>${escapeHtml(report.risk_level || "待確認")}</dd></div><div><dt>今日事件</dt><dd>${reportEvents(report).length} 項</dd></div></dl>
      <span class="watch-card-state ${direction.tone}">${direction.arrow} ${direction.label}</span>
    </button><button type="button" class="remove-watch" data-remove-watch="${report.id}">移出自選</button>
  </article>`;
}

function renderWatchlistPage() {
  const saved = new Set(watchlist());
  let rows = stockCatalog.filter((report) => saved.has(report.id));
  if (watchlistFilter === "changed") rows = rows.filter((report) => reportEvents(report).length > 0);
  if (watchlistFilter === "risk") rows = rows.filter((report) => Number(report.risk || 0) >= 50 || /高/.test(report.risk_level || ""));
  if (watchlistFilter === "down") rows = rows.filter((report) => Number(scoreChange(report)) < 0);
  $("watchlistPageSummary").innerHTML = `<div><span>自選總數</span><b>${saved.size} 檔</b></div><div><span>今日有變化</span><b>${stockCatalog.filter((report) => saved.has(report.id) && reportEvents(report).length).length} 檔</b></div><div><span>需要注意</span><b>${stockCatalog.filter((report) => saved.has(report.id) && homeDirection(report).tone === "negative").length} 檔</b></div>`;
  $("watchlistPageGrid").innerHTML = rows.map(watchlistCard).join("");
  $("watchlistPageEmpty").classList.toggle("hidden", rows.length > 0);
  document.querySelectorAll("#watchlistPage [data-home-stock]").forEach((button) => button.addEventListener("click", () => loadStock(button.dataset.homeStock)));
  document.querySelectorAll("[data-remove-watch]").forEach((button) => button.addEventListener("click", () => {
    saveWatchlist(watchlist().filter((id) => id !== button.dataset.removeWatch));
    showToast("已移出自選");
  }));
}

function allResearchEvents() {
  return stockCatalog.flatMap((report) => reportEvents(report).map((event) => ({...event, stock_id:report.id, stock_name:report.name, report})));
}

function eventTone(event) {
  const impact = Number(event.score_impact || event.impact || 0);
  return impact > 0 ? "positive" : impact < 0 ? "negative" : "neutral";
}

function renderEventsPage() {
  const saved = new Set(watchlist());
  let rows = allResearchEvents();
  if (eventFilter === "positive" || eventFilter === "negative") rows = rows.filter((event) => eventTone(event) === eventFilter);
  if (eventFilter === "watchlist") rows = rows.filter((event) => saved.has(event.stock_id));
  rows.sort((a, b) => Math.abs(Number(b.score_impact || b.impact || 0)) - Math.abs(Number(a.score_impact || a.impact || 0)));
  $("eventsPageList").innerHTML = rows.slice(0, 80).map((event) => {
    const tone = eventTone(event);
    const impact = Number(event.score_impact || event.impact || 0);
    const title = event.title_zh || event.title || event.what_happened || "研究事件";
    const explanation = event.beginner_explanation_zh || event.explanation_zh || event.meaning || event.reason || "點入股票查看完整證據。";
    return `<article class="event-list-card warm-card ${tone}"><button type="button" data-home-stock="${event.stock_id}"><span class="event-stock">${escapeHtml(event.stock_name)} <small>${event.stock_id}</small></span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(explanation)}</p><div class="event-card-meta"><span>${escapeHtml(event.category_zh || categoryLabel(event.category))}</span><b>${impact ? `${impact > 0 ? "+" : ""}${impact.toFixed(2)} 分` : "持續追蹤"}</b></div></button>${event.source_url ? `<a href="${escapeHtml(event.source_url)}" target="_blank" rel="noopener noreferrer">查看來源 ↗</a>` : ""}</article>`;
  }).join("");
  $("eventsPageEmpty").classList.toggle("hidden", rows.length > 0);
  document.querySelectorAll("#eventsPage [data-home-stock]").forEach((button) => button.addEventListener("click", () => loadStock(button.dataset.homeStock)));
}

function renderProfilePage() {
  if (!$("profileTesterCode")) return;
  $("profileTesterCode").textContent = betaSession?.tester_code || "本機擁有者";
  $("profileWatchlistCount").textContent = `${watchlist().length} 檔`;
  $("profileReportCount").textContent = `${stockCatalog.length} 份`;
  const updates = stockCatalog.map((report) => report.updated).filter((value) => value && value !== "—").sort();
  $("profileUpdatedAt").textContent = updates.length ? `最新資料 ${updates.at(-1)}` : "等待報告更新";
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => $("toast").classList.remove("show"), 2200);
}

async function loadAvailable() {
  try {
    const response = await fetch("/api/stocks");
    const payload = await response.json();
    if (response.status === 401) {
      showInviteGate("登入已逾期，請重新輸入邀請碼。 ");
      return;
    }
    if (!response.ok) throw new Error(payload.detail || "股票中心目前無法讀取");
    available = payload.stocks || [];
    $("formHint").textContent = available.length ? `目前有 ${available.length} 檔客戶報告可查詢` : "目前尚無可用報告";
    const reports = await Promise.all(available.map(async (item) => {
      try {
        const result = await fetch(`/api/stocks/${encodeURIComponent(item.id)}`, {headers:{Accept:"application/json"}});
        if (!result.ok) return null;
        return (await result.json()).report;
      } catch { return null; }
    }));
    stockCatalog = reports.filter(Boolean).map((report) => ({...report, sector:sectorName(report.industry)}));
    $("stockCenterLoading").classList.add("hidden");
    renderSectorFilters();
    renderStockCenter();
    renderHomeDashboard();
    renderWatchlistPage();
    renderEventsPage();
    renderProfilePage();
    renderNotificationCenter();
  } catch {
    $("formHint").textContent = "可先試用 2330、2891";
    $("stockCenterLoading").textContent = "股票中心目前無法讀取，請稍後重新整理。";
  }
}

$("searchForm").addEventListener("submit", (event) => { event.preventDefault(); loadStock($("stockSearch").value.trim()); });
$("retryButton").addEventListener("click", () => loadStock($("stockSearch").value.trim()));
$("saveButton").addEventListener("click", toggleSaved);
$("backToCenterButton").addEventListener("click", () => { activePage = detailOriginPage; showHomeView({restoreScroll:false}); });
$("brandHomeLink").addEventListener("click", (event) => { event.preventDefault(); activePage = "home"; showHomeView({restoreScroll:false}); window.scrollTo({top:0, behavior:"smooth"}); });
$("watchlistOnlyButton").addEventListener("click", () => { watchlistOnly = !watchlistOnly; renderStockCenter(); });
$("viewAllChanges").addEventListener("click", () => switchPage("events"));
$("viewAllMaterialNews").addEventListener("click", () => {
  renderMaterialNewsPage();
  switchPage("news");
});
$("materialNewsStockFilter").addEventListener("change", () => renderMaterialNewsPage());
$("materialNewsCategoryFilter").addEventListener("change", () => renderMaterialNewsPage());
$("viewWatchlist").addEventListener("click", () => switchPage("watchlist"));
$("addWatchlistStock").addEventListener("click", () => switchPage("explore"));
$("exploreSearch").addEventListener("input", (event) => { exploreQuery = event.target.value; renderStockCenter(); });
$("exploreSort").addEventListener("change", (event) => { exploreSort = event.target.value; renderStockCenter(); });
$("industryFilter").addEventListener("change", (event) => { activeIndustry = event.target.value; renderStockCenter(); });
document.querySelectorAll("[data-watch-filter]").forEach((button) => button.addEventListener("click", () => { watchlistFilter = button.dataset.watchFilter; document.querySelectorAll("[data-watch-filter]").forEach((item) => item.classList.toggle("active", item === button)); renderWatchlistPage(); }));
document.querySelectorAll("[data-event-filter]").forEach((button) => button.addEventListener("click", () => { eventFilter = button.dataset.eventFilter; document.querySelectorAll("[data-event-filter]").forEach((item) => item.classList.toggle("active", item === button)); renderEventsPage(); }));
$("notificationButton").addEventListener("click", () => setNotificationPanel($("notificationPanel").classList.contains("hidden")));
$("notificationClose").addEventListener("click", () => setNotificationPanel(false));
$("notificationBackdrop").addEventListener("click", () => setNotificationPanel(false));
$("notificationReadAll").addEventListener("click", () => { const read = notificationReadIds(); researchNotifications().forEach((item) => read.add(item.notification_id)); saveNotificationReadIds(read); renderNotificationCenter(); });
$("notificationList").addEventListener("click", (event) => { const item = event.target.closest("[data-notification-id]"); if (item) openNotification(item); });
document.querySelectorAll("[data-notification-filter]").forEach((button) => button.addEventListener("click", () => { notificationFilter = button.dataset.notificationFilter; document.querySelectorAll("[data-notification-filter]").forEach((item) => item.classList.toggle("active", item === button)); renderNotificationCenter(); }));
$("profileFeedback").addEventListener("click", () => showToast("Beta 回饋表單將在下一階段接入"));
$("profileDataSources").addEventListener("click", () => showToast("請進入個股報告查看各項原始資料來源"));
$("profileLogout").addEventListener("click", () => betaSession?.invite_required ? logoutBeta() : showToast("本機擁有者模式不需要登出"));
$("inviteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const code = $("inviteCode").value.trim().toUpperCase();
  if (code.length < 5) {
    setInviteMessage("請輸入完整邀請碼。", "error");
    return;
  }
  activateInvite(code);
});
$("logoutButton").addEventListener("click", logoutBeta);
$("themeToggle").addEventListener("click", toggleTheme);
document.querySelectorAll(".mobile-nav button").forEach((button) => button.addEventListener("click", () => {
  showHomeView({restoreScroll:false});
  switchPage(button.dataset.tab);
}));

$("homeDate").textContent = formatHomeDate();
applyTheme(preferredTheme());

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
  if (!localStorage.getItem(THEME_STORAGE_KEY)) applyTheme(event.matches ? "dark" : "light");
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/assets/sw.js"));
initializeBetaAccess();
