const $ = (id) => document.getElementById(id);
const icons = ["✦", "⌁", "◎", "◫", "◌"];
const feedbackForm = {
  url: "https://docs.google.com/forms/d/e/1FAIpQLSf1aHr1FgfzJATg1C16QTURV9vay1KdBIHTehXiCy_LBcp0XA/viewform",
  testerEntry: "entry.1967805630",
  stockEntry: "entry.1628915144",
};
let currentReport = null;
let available = [];
let activeSector = "全部";
let watchlistOnly = false;
let betaTesterCode = "";

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

function levelTone(score) {
  if (Number(score) >= 75) return "good";
  if (Number(score) >= 55) return "neutral";
  return "watch";
}

function scoreText(score) {
  const value = Number(score);
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}

function render(report) {
  currentReport = report;
  $("stockMeta").textContent = `${report.id} · ${report.industry}`;
  $("stockName").textContent = report.name;
  $("assessment").textContent = report.assessment;
  $("healthScore").textContent = scoreText(report.score);
  $("scoreRing").style.setProperty("--score-angle", `${Math.min(100, Math.max(0, Number(report.score) || 0)) * 3.6}deg`);
  $("summary").textContent = report.summary;
  $("grade").textContent = report.grade;
  $("confidence").textContent = `${Math.round(report.confidence)} · ${report.confidence_level}`;
  $("risk").textContent = `${Math.round(report.risk)} · ${report.risk_level}`;
  $("updated").textContent = report.updated;
  $("source").textContent = report.source === "engine" ? "AI 引擎客戶報告" : "Beta 展示資料";
  $("strategyLabel").textContent = report.strategy?.label_zh || "研究累積中";
  $("strategyCopy").textContent = report.strategy?.message_zh || "系統持續更新與驗證，不會因單日波動任意改變研究門檻。";
  $("disclaimer").textContent = report.disclaimer;
  // The same input also filters the stock center.  Clear it after opening a
  // report so the selected stock does not silently constrain every sector.
  $("stockSearch").value = "";
  renderStockGrid();
  renderIndicators(report.indicators);
  refreshSavedButton();
}

function renderIndicators(indicators) {
  $("indicatorGrid").innerHTML = indicators.map((item, index) => `
    <button class="indicator-card ${index === 0 ? "selected" : ""}" data-index="${index}" type="button">
      <span class="indicator-icon">${icons[index] || "•"}</span>
      <span class="indicator-name">${escapeHtml(item.label)}</span>
      <strong>${scoreText(item.score)}</strong>
      <span class="level ${levelTone(item.score)}">${escapeHtml(item.level)}</span>
      <span class="bar"><i style="width:${Math.min(100, Math.max(0, Number(item.score) || 0))}%"></i></span>
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

function resolveSearch(value) {
  const query = String(value || "").trim().toLowerCase();
  if (!query) return null;
  if (/^\d{4}$/.test(query)) return query;
  const exact = available.find((stock) => stock.name.toLowerCase() === query);
  const partial = available.find((stock) => stock.name.toLowerCase().includes(query));
  return (exact || partial)?.id || null;
}

async function loadStock(stockId, {scroll = true, updateUrl = true} = {}) {
  if (!/^\d{4}$/.test(stockId)) {
    $("formHint").textContent = "請輸入股票中文名稱或四位數代號";
    return;
  }
  setState("loading");
  $("formHint").textContent = "正在取得最新研究報告…";
  try {
    const response = await fetch(`/api/stocks/${encodeURIComponent(stockId)}`, {headers: {Accept: "application/json"}});
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "暫時無法取得研究報告");
    render(payload.report);
    setState("ready");
    $("formHint").textContent = `已顯示 ${payload.report.name}（${payload.report.id}）`;
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("stock", payload.report.id);
      history.pushState({stock: payload.report.id}, "", url);
    }
    if (scroll) $("reportAnchor").scrollIntoView({behavior: "smooth", block: "start"});
  } catch (error) {
    setState("error", error.message || "暫時無法取得研究報告");
    $("formHint").textContent = "請確認名稱、代號或稍後再試";
  }
}

function watchlist() {
  try { return JSON.parse(localStorage.getItem("aiStockWatchlist") || "[]"); } catch { return []; }
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
  localStorage.setItem("aiStockWatchlist", JSON.stringify([...saved]));
  refreshSavedButton();
  renderStockGrid();
  showToast(adding ? `已將 ${currentReport.name} 加入自選` : `已將 ${currentReport.name} 移出自選`);
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => $("toast").classList.remove("show"), 2200);
}

function openFeedback() {
  let testerCode = betaTesterCode || localStorage.getItem("aiStockBetaTesterCode") || "";
  if (!testerCode) {
    testerCode = window.prompt("請輸入你的 Beta 測試者代號", "")?.trim() || "";
    if (!testerCode) {
      showToast("需要測試者代號才能送出回饋");
      return;
    }
    if (testerCode.length > 40) {
      showToast("測試者代號過長，請重新輸入");
      return;
    }
    localStorage.setItem("aiStockBetaTesterCode", testerCode);
  }
  const url = new URL(feedbackForm.url);
  url.searchParams.set("usp", "pp_url");
  url.searchParams.set(feedbackForm.testerEntry, testerCode);
  url.searchParams.set(feedbackForm.stockEntry, currentReport?.id || "");
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

function showAccessGate(message = "") {
  $("accessGate").classList.remove("hidden");
  document.body.classList.add("gate-open");
  $("accessMessage").textContent = message;
  window.setTimeout(() => $("inviteCode").focus(), 50);
}

function hideAccessGate(testerCode = "") {
  $("accessGate").classList.add("hidden");
  document.body.classList.remove("gate-open");
  betaTesterCode = testerCode === "LOCAL-OWNER" ? "" : testerCode;
  if (betaTesterCode) {
    localStorage.setItem("aiStockBetaTesterCode", betaTesterCode);
    $("testerBadge").textContent = betaTesterCode;
    $("testerBadge").classList.remove("hidden");
  }
}

async function checkBetaAccess() {
  try {
    const response = await fetch("/api/beta/session", {headers: {Accept: "application/json"}});
    const payload = await response.json();
    if (!response.ok || !payload.authorized) {
      showAccessGate();
      return false;
    }
    hideAccessGate(payload.tester_code || "");
    return true;
  } catch {
    showAccessGate("目前無法確認測試資格，請稍後重新整理。");
    return false;
  }
}

async function activateBeta(event) {
  event.preventDefault();
  if (!$("betaConsent").checked) {
    $("accessMessage").textContent = "請先確認研究用途聲明。";
    return;
  }
  const inviteCode = $("inviteCode").value.trim().toUpperCase();
  $("activateButton").disabled = true;
  $("activateButton").textContent = "驗證中…";
  $("accessMessage").textContent = "";
  try {
    const response = await fetch("/api/beta/activate", {
      method: "POST",
      headers: {"Content-Type": "application/json", Accept: "application/json"},
      body: JSON.stringify({invite_code: inviteCode}),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "邀請碼驗證失敗");
    hideAccessGate(payload.tester_code || "");
    await startApplication();
  } catch (error) {
    $("accessMessage").textContent = error.message || "邀請碼驗證失敗";
  } finally {
    $("activateButton").disabled = false;
    $("activateButton").textContent = "進入 Beta";
  }
}

function renderSectorFilters(sectors) {
  $("sectorFilters").innerHTML = ["全部", ...sectors].map((sector) => `
    <button type="button" class="sector-filter ${sector === activeSector ? "active" : ""}" data-sector="${escapeHtml(sector)}">${escapeHtml(sector)}</button>
  `).join("");
}

function renderStockGrid() {
  const query = $("stockSearch").value.trim().toLowerCase();
  const saved = new Set(watchlist());
  const filtered = available.filter((stock) => {
    const matchesText = !query || stock.id.includes(query) || stock.name.toLowerCase().includes(query);
    const matchesSector = activeSector === "全部" || stock.industry === activeSector;
    const matchesWatchlist = !watchlistOnly || saved.has(stock.id);
    return matchesText && matchesSector && matchesWatchlist;
  });
  $("stockCount").textContent = filtered.length;
  $("stockEmpty").classList.toggle("hidden", filtered.length !== 0);
  $("watchlistFilter").classList.toggle("active", watchlistOnly);
  $("watchlistFilter").textContent = watchlistOnly ? `★ 自選 ${saved.size}` : `☆ 只看自選 ${saved.size ? `(${saved.size})` : ""}`;
  $("stockGrid").innerHTML = filtered.map((stock) => `
    <button class="stock-card" data-stock="${stock.id}" type="button" aria-label="查看 ${escapeHtml(stock.name)} 研究報告">
      <span class="stock-card-head"><span><b>${escapeHtml(stock.name)}</b><small>${stock.id} · ${escapeHtml(stock.industry)}</small></span><i class="mini-score ${levelTone(stock.score)}">${scoreText(stock.score)}</i></span>
      <span class="stock-card-body"><span><small>研究等級</small><b>${escapeHtml(stock.grade)}</b></span><span><small>風險</small><b>${escapeHtml(stock.risk_level)}</b></span></span>
      <span class="stock-card-foot"><span>${escapeHtml(stock.assessment)}</span><span>${saved.has(stock.id) ? "★" : "查看報告 →"}</span></span>
    </button>
  `).join("");
}

async function loadAvailable() {
  try {
    const response = await fetch("/api/stocks", {headers: {Accept: "application/json"}});
    const payload = await response.json();
    if (!response.ok) throw new Error("stock center unavailable");
    available = payload.stocks || [];
    renderSectorFilters(payload.sectors || [...new Set(available.map((stock) => stock.industry))].sort());
    renderStockGrid();
    $("formHint").textContent = available.length ? `目前有 ${available.length} 檔客戶報告可查詢` : "目前尚無可用報告";
  } catch {
    $("formHint").textContent = "股票中心暫時無法載入，可先輸入代號查詢";
    $("stockEmpty").classList.remove("hidden");
  }
}

$("searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const stockId = resolveSearch($("stockSearch").value);
  if (stockId) loadStock(stockId);
  else $("formHint").textContent = "找不到這個名稱或代號，請從股票中心選擇";
});
$("stockSearch").addEventListener("input", renderStockGrid);
$("sectorFilters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-sector]");
  if (!button) return;
  activeSector = button.dataset.sector;
  renderSectorFilters([...new Set(available.map((stock) => stock.industry))].sort());
  renderStockGrid();
});
$("stockGrid").addEventListener("click", (event) => {
  const card = event.target.closest("[data-stock]");
  if (card) loadStock(card.dataset.stock);
});
$("watchlistFilter").addEventListener("click", () => { watchlistOnly = !watchlistOnly; renderStockGrid(); });
$("retryButton").addEventListener("click", () => {
  const stockId = resolveSearch($("stockSearch").value);
  if (stockId) loadStock(stockId);
});
$("saveButton").addEventListener("click", toggleSaved);
$("feedbackButton").addEventListener("click", openFeedback);
$("accessForm").addEventListener("submit", activateBeta);
document.querySelectorAll(".mobile-nav button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".mobile-nav button").forEach((item) => item.classList.toggle("active", item === button));
  if (button.dataset.tab === "watchlist") {
    watchlistOnly = true;
    renderStockGrid();
    $("stockCenter").scrollIntoView({behavior: "smooth"});
  }
  if (button.dataset.tab === "about") document.querySelector(".explain-card").scrollIntoView({behavior: "smooth"});
  if (button.dataset.tab === "home") {
    watchlistOnly = false;
    renderStockGrid();
    $("stockCenter").scrollIntoView({behavior: "smooth"});
  }
}));
window.addEventListener("popstate", () => {
  const stockId = new URLSearchParams(location.search).get("stock");
  if (stockId) loadStock(stockId, {scroll: false, updateUrl: false});
});

async function startApplication() {
  await loadAvailable();
  const requested = new URLSearchParams(location.search).get("stock");
  const initial = /^\d{4}$/.test(requested || "")
    ? requested
    : (available.some((stock) => stock.id === "2330") ? "2330" : (available[0]?.id || "2330"));
  await loadStock(initial, {scroll: false, updateUrl: false});
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/assets/sw.js"));
(async () => {
  if (await checkBetaAccess()) await startApplication();
})();
