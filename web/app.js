const $ = (id) => document.getElementById(id);
const icons = ["✦", "⌁", "◎", "◫", "◌"];
let currentReport = null;
let available = [];

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
  if (score >= 75) return "good";
  if (score >= 55) return "neutral";
  return "watch";
}

function render(report) {
  currentReport = report;
  $("stockMeta").textContent = `${report.id} · ${report.industry}`;
  $("stockName").textContent = report.name;
  $("assessment").textContent = report.assessment;
  $("healthScore").textContent = Number(report.score).toFixed(1);
  $("scoreRing").style.setProperty("--score-angle", `${Math.min(100, Math.max(0, report.score)) * 3.6}deg`);
  $("summary").textContent = report.summary;
  $("grade").textContent = report.grade;
  $("confidence").textContent = `${Math.round(report.confidence)} · ${report.confidence_level}`;
  $("risk").textContent = `${Math.round(report.risk)} · ${report.risk_level}`;
  $("updated").textContent = report.updated;
  $("source").textContent = report.source === "engine" ? "AI 引擎客戶報告" : "Beta 展示資料";
  $("strategyLabel").textContent = report.strategy?.label_zh || "研究累積中";
  $("strategyCopy").textContent = report.strategy?.message_zh || "系統持續更新與驗證，不會因單日波動任意改變研究門檻。";
  $("disclaimer").textContent = report.disclaimer;
  renderIndicators(report.indicators);
  renderEvidence(report);
  renderHistory(report.score_history || []);
  renderSources(report.data_sources || []);
  refreshSavedButton();
}

function factorRows(items, emptyText) {
  if (!items?.length) return `<p class="factor-empty">${escapeHtml(emptyText)}</p>`;
  return items.map((item) => `<div class="factor-row">
    <div><b>${escapeHtml(item.label)}</b><span>${Number(item.score).toFixed(1)} 分</span></div>
    <p>${escapeHtml(item.reason)}</p><small>來源：${escapeHtml(item.source)}</small>
  </div>`).join("");
}

function renderEvidence(report) {
  $("scoreInterval").textContent = `目前區間 ${report.score_interval || "—"}`;
  $("scoreMethod").textContent = report.score_method || "分數用於一致比較，不代表未來漲跌。";
  $("positiveFactors").innerHTML = factorRows(report.positive_factors, "目前沒有明顯加分因素。");
  $("negativeFactors").innerHTML = factorRows(report.negative_factors, "目前沒有明顯扣分因素。");
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
  setState("loading");
  $("formHint").textContent = "正在取得最新研究報告…";
  try {
    const response = await fetch(`/api/stocks/${encodeURIComponent(stockId)}`, {headers: {Accept: "application/json"}});
    const payload = await response.json();
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
  showToast(adding ? `已將 ${currentReport.name} 加入自選` : `已將 ${currentReport.name} 移出自選`);
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
    available = payload.stocks || [];
    $("formHint").textContent = available.length ? `目前有 ${available.length} 檔客戶報告可查詢` : "目前尚無可用報告";
  } catch {
    $("formHint").textContent = "可先試用 2330、2891";
  }
}

$("searchForm").addEventListener("submit", (event) => { event.preventDefault(); loadStock($("stockSearch").value.trim()); });
$("retryButton").addEventListener("click", () => loadStock($("stockSearch").value.trim()));
$("saveButton").addEventListener("click", toggleSaved);
document.querySelectorAll(".mobile-nav button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".mobile-nav button").forEach((item) => item.classList.toggle("active", item === button));
  if (button.dataset.tab === "watchlist") showToast(`自選股 ${watchlist().length} 檔；完整清單將在下一階段加入`);
  if (button.dataset.tab === "about") document.querySelector(".explain-card").scrollIntoView({behavior: "smooth"});
  if (button.dataset.tab === "home") window.scrollTo({top: 0, behavior: "smooth"});
}));

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/assets/sw.js"));
loadAvailable();
loadStock("2330");
