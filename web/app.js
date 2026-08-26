const $ = (id) => document.getElementById(id);
const icons = ["✦", "⌁", "◎", "◫", "◌"];
const THEME_STORAGE_KEY = "aiStockTheme";
const RESEARCH_MODE_STORAGE_KEY = "aiStockResearchMode";
const NOTIFICATION_READ_KEY = "aiStockNotificationReadIds";
const ONBOARDING_STORAGE_KEY = "aiStockOnboardingVersion";
const ONBOARDING_VERSION = "1";
const PERSONALITY_STORAGE_KEY = "aiStockResearchPersonality";
const PERSONALITY_VERSION = "2";
let personalityQuestionIndex = 0;
let personalityAnswers = Array(12).fill(null);
let onboardingStepIndex = 0;
let onboardingActive = false;
let onboardingTarget = null;
let currentReport = null;
let available = [];
let stockCatalog = [];
const COMPARE_STORAGE_KEY = "aiStockComparison";
let comparisonSelection = [];
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

function preferredResearchMode() {
  return localStorage.getItem(RESEARCH_MODE_STORAGE_KEY) === "pro"
    ? "pro"
    : "guided";
}

function applyResearchMode(mode, {persist = false, announce = false} = {}) {
  const value = mode === "pro" ? "pro" : "guided";
  const guided = value === "guided";

  document.documentElement.dataset.researchMode = value;

  if (persist) {
    localStorage.setItem(RESEARCH_MODE_STORAGE_KEY, value);
  }

  const shortcut = $("researchModeShortcut");
  if (shortcut) {
    shortcut.querySelector("b").textContent = guided ? "Guided" : "Pro";
    shortcut.classList.toggle("pro", !guided);
    shortcut.setAttribute(
      "aria-label",
      guided
        ? "目前為 Guided，引導研究模式；前往模式設定"
        : "目前為 Pro，專業研究模式；前往模式設定"
    );
  }

  document
    .querySelectorAll("[data-research-mode-option]")
    .forEach((button) => {
      const selected = button.dataset.researchModeOption === value;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

  const status = $("researchModeStatus");
  if (status) {
    status.textContent = guided
      ? "目前使用 Guided，引導你完成每天真正重要的研究。"
      : "目前使用 Pro，顯示完整指標、比較基準與研究證據。";
  }

  if (announce && typeof showToast === "function") {
    showToast(
      guided
        ? "已切換為 Guided 引導研究模式"
        : "已切換為 Pro 專業研究模式"
    );
  }
}

function setResearchMode(mode) {
  applyResearchMode(mode, {persist: true, announce: true});
  renderProfilePage();
}
const researchPersonalityAxisDefinitions = [
  {
    key: "evidence",
    leftKey: "verify",
    leftLabel: "守證",
    rightKey: "scan",
    rightLabel: "探訊",
    description: "面對新資訊時，你偏向先等待證據完整，或先追蹤可能正在形成的訊號。",
  },
  {
    key: "focus",
    leftKey: "business",
    leftLabel: "營運",
    rightKey: "market",
    rightLabel: "市場",
    description: "理解公司變化時，你較常先看營運數字，或市場、法人與相對表現。",
  },
  {
    key: "opportunity",
    leftKey: "anchor",
    leftLabel: "定錨",
    rightKey: "growth",
    rightLabel: "尋星",
    description: "判斷研究機會時，你更重視價格基準，或成長空間與改善速度。",
  },
  {
    key: "cadence",
    leftKey: "compound",
    leftLabel: "築流",
    rightKey: "react",
    rightLabel: "應變",
    description: "持續研究時，你偏向長期累積紀錄，或快速回應新的轉折與變化。",
  },
];

const researchPersonalityProfileRows = [
  ["vbac", "地基守衡者", "用長期營運證據與價格基準，建立穩固而可反覆檢查的研究地基。", "能讓判斷建立在營運與價格基準上", "你會等待數字形成一致方向，也會確認目前價格是否仍有支撐。", "可能較晚注意正在形成的新變化", "當證據尚未完整時，你可能暫時忽略值得提前追蹤的早期訊號。"],
  ["vbar", "價值校準師", "當公司營運出現變化時，你會快速重新校準目前的價格位置。", "能把營運改變轉成清楚的價格檢查", "你不會只看股價漲跌，而會先確認公司數字是否足以改變估值基準。", "可能過度等待正式數字才採取研究行動", "部分市場轉折會早於財報出現，需要保留追蹤早期訊號的空間。"],
  ["vbgc", "長曜培育者", "你尋找能經過多期驗證、持續累積的品質成長。", "能分辨短期成長與長期品質", "你會要求收入與獲利反覆證明成長，而不是只看單期亮眼表現。", "可能錯過成長剛開始加速的階段", "等待多期確認能降低誤判，也可能讓新趨勢較晚進入你的研究範圍。"],
  ["vbgr", "曙光驗證者", "你會在新成長獲得營運數字證實時，迅速辨認公司的轉折。", "能抓住剛被財報確認的營運改善", "你重視正式證據，也願意在證據出現後快速調整原有看法。", "可能把單次改善看成完整轉折", "第一道曙光仍需後續數字延續，避免只靠一季表現建立長期結論。"],
  ["vmac", "星盤定衡者", "你用市場相對表現與長期價格基準，判斷公司目前的位置。", "能把市場方向放進可比較的座標", "你會比較大盤、同業與歷史位置，不容易被單一漲跌帶走。", "可能低估公司內部正在發生的改變", "相對表現是市場結果，仍需要回頭確認營運原因與正式來源。"],
  ["vmar", "逆勢校準者", "當市場錯價或相對位置快速改變時，你會重新評估研究基準。", "能辨識價格與市場共識的落差", "你會先確認比較基準，再判斷反轉是否值得進一步研究。", "可能過早假設價格終將回到原有基準", "產業結構與公司品質可能已經改變，歷史價格不一定仍是有效錨點。"],
  ["vmgc", "長軌觀測者", "你追蹤市場與基本面共同確認、能夠長期延續的成長軌跡。", "能觀察趨勢是否具有持續性", "你不只看價格強勢，也會確認營運是否支撐長期方向。", "可能等到趨勢成熟後才開始重視", "高度確認能提升理解，但也會降低對早期轉折的敏感度。"],
  ["vmgr", "星軌驗證者", "確認市場趨勢獲得證據支撐後，你會快速調整研究方向。", "能交叉驗證市場訊號與公司證據", "你擅長辨認價格先行、法人變化與營運改善是否逐漸會合。", "可能把市場共識看得過於重要", "市場與法人方向仍可能反轉，不能取代收入、獲利與正式公告。"],
  ["sbac", "地訊守值者", "你會提早注意公司變化，同時用價格紀律限制過度期待。", "能提早追蹤又不失去價格基準", "你願意研究早期公司訊號，但不會因一則消息忽略目前價格。", "可能長時間追蹤尚未落實的線索", "早期訊號需要設定明確的後續驗證條件，避免研究議題無限延伸。"],
  ["sbar", "事件定價師", "你關心公司事件是否足以改變營運，並造成市場重新定價。", "能快速連結事件、營運與價格", "你會追查正式來源，並思考事件是否真的改變公司的獲利基礎。", "可能高估單一事件的重新定價效果", "市場關注不等於長期價值改變，仍需等待後續營運數字證實。"],
  ["sbgc", "萌星培育者", "你會提早發現成長萌芽，再觀察它能否逐期形成穩定軌跡。", "能看到尚未被廣泛注意的成長線索", "你願意長期追蹤收入、產品或產業中的早期改善。", "可能對尚未獲利的成長保有太多耐心", "早期成長需要明確里程碑，避免只因故事仍在就持續等待。"],
  ["sbgr", "躍遷尋星者", "你尋找事件與營運同步轉強、可能快速改變公司的成長躍遷。", "能迅速辨認營運加速與新催化劑", "你對收入、獲利與重大事件同時轉強的情境特別敏感。", "可能把短期加速外推成長期成長", "快速躍遷仍可能回落，需要確認成長品質與後續延續性。"],
  ["smac", "雷達定錨者", "你會掃描市場新訊號，但仍以價格與比較基準限制判斷。", "能兼顧早期市場訊號與價格紀律", "你會注意法人、同業與大盤的異常，同時避免在價格失去支撐時追逐熱度。", "可能把太多市場波動列入研究", "不是每個異常都是有效訊號，需要設定重要性與持續時間門檻。"],
  ["smar", "轉折測繪者", "你擅長測繪錯價、反轉與市場方向正在改變的位置。", "能快速發現相對強弱與市場轉折", "你會比較價格、法人與同業，找出市場共識開始移動的地方。", "容易把短期反彈誤認為完整反轉", "轉折需要營運或更長時間的市場證據，不能只靠一段價格變化。"],
  ["smgc", "新軌領航者", "你會提早識別新趨勢，並觀察它能否逐步形成長期軌道。", "能在市場早期辨認值得追蹤的新方向", "你願意先建立觀察，再等待市場與營運共同形成趨勢。", "可能長期追蹤最後沒有形成的題材", "新軌道需要退出條件，當營運沒有跟上時應降低研究優先度。"],
  ["smgr", "星訊先鋒者", "你最快捕捉市場、事件與成長訊號交會所形成的研究轉折。", "能快速整合多種正在變化的訊號", "你對市場方向、事件催化與成長加速的同時出現非常敏感。", "容易受到快速變化與市場情緒干擾", "反應速度不能取代證據品質，需要持續核對正式來源與營運結果。"],
];

function personalityReadingOrder(code) {
  const order = [];
  order.push(code[1] === "b" ? "健康狀態" : "近期變化");
  order.push(code[2] === "a" ? "價格位置" : "成長與獲利");
  order.push(code[0] === "v" ? "判斷把握度" : "重要事件");
  order.push(code[3] === "c" ? "歷史與持續追蹤" : "目前風險");
  return [...new Set(order)].slice(0, 4);
}

const researchPersonalityProfiles = Object.fromEntries(
  researchPersonalityProfileRows.map((row, index) => {
    const [
      key,
      name,
      summary,
      strengthTitle,
      strengthCopy,
      blindSpotTitle,
      blindSpotCopy,
    ] = row;

    const preferPro = key[1] === "m" || key[3] === "r";

    return [key, {
      id: `GC16-${String(index + 1).padStart(2, "0")}`,
      name,
      symbol: "GC",
      axes: {
        evidence: key[0] === "v" ? "verify" : "scan",
        focus: key[1] === "b" ? "business" : "market",
        opportunity: key[2] === "a" ? "anchor" : "growth",
        cadence: key[3] === "c" ? "compound" : "react",
      },
      summary,
      strengthTitle,
      strengthCopy,
      blindSpotTitle,
      blindSpotCopy,
      readingOrder: personalityReadingOrder(key),
      modeTitle: preferPro
        ? "先用 Guided 掌握方向，再用 Pro 核對完整證據"
        : "先用 Guided 建立固定研究順序",
      modeCopy: preferPro
        ? "市場、事件與快速轉折需要比較基準；先讀白話摘要，再到 Pro 核對數字、歷史與來源。"
        : "依照建議順序完成每日研究；需要核對完整數字時，再切換 Pro 查看證據。",
    }];
  })
);

const researchPersonalityQuestions = [
  {
    axis: "evidence",
    kicker: "星期一早上 · 一則朋友訊息",
    title: "通勤途中，朋友傳來一檔最近很熱門的股票，問你要不要一起研究。",
    copy: "你對這家公司幾乎沒有印象，聊天室裡卻已經有人說它可能是下一波熱門股。你通常會從哪裡開始？",
    options: [
      {
        label: "我先找公司資料與正式公告，弄清楚它靠什麼賺錢",
        copy: "在相信任何說法以前，我想先建立可以核對的基本認識。",
        axisScores: {verify: 2},
      },
      {
        label: "我先看看市場在討論什麼，再把有用的線索記下來",
        copy: "我想快速理解大家注意它的原因，再決定哪些內容值得查證。",
        axisScores: {scan: 2},
      },
      {
        label: "我會兩邊都看一點，先判斷它值不值得花時間",
        copy: "先取得基本輪廓，不急著把所有資料一次查完。",
        axisScores: {verify: 1, scan: 1},
      },
    ],
  },
  {
    axis: "focus",
    kicker: "星期一晚上 · 第一次做功課",
    title: "回到家後，你真的打開資料，準備花半小時認識這家公司。",
    copy: "時間不算多，你不可能把所有內容看完。今晚你最想先弄懂哪一件事？",
    options: [
      {
        label: "它的收入、獲利和產品到底有沒有持續變好",
        copy: "我想先知道公司的基本狀況，而不是先看股價熱度。",
        axisScores: {business: 2},
      },
      {
        label: "最近股價、法人與同業為什麼同時開始有動靜",
        copy: "我想先掌握市場目前正在反映什麼。",
        axisScores: {market: 2},
      },
      {
        label: "我先各看幾個重點，確認營運和市場有沒有互相呼應",
        copy: "公司的數字與市場反應，我都不想完全忽略。",
        axisScores: {business: 1, market: 1},
      },
    ],
  },
  {
    axis: "opportunity",
    kicker: "星期二晚上 · 加入觀察名單",
    title: "初步看完後，你覺得公司有些亮點，但股價也已經漲了一段。",
    copy: "你決定先觀察，不急著下結論。接下來什麼最容易吸引你的注意？",
    options: [
      {
        label: "目前價格和同業、歷史相比，是否還站得住腳",
        copy: "再好的故事，我也希望有一個可以比較的價格基準。",
        axisScores: {anchor: 2},
      },
      {
        label: "新的產品和市場空間，可能把公司帶到多大的規模",
        copy: "我更想知道現在的數字還沒反映哪些未來可能性。",
        axisScores: {growth: 2},
      },
      {
        label: "我會一邊看成長空間，一邊提醒自己不要忽略價格",
        copy: "機會與基準都重要，我會先保留彈性。",
        axisScores: {anchor: 1, growth: 1},
      },
    ],
  },
  {
    axis: "cadence",
    kicker: "星期三早上 9:10 · 股價突然下跌",
    title: "你剛拿起手機，就看到這檔股票下跌 7%，群組訊息不斷跳出來。",
    copy: "你暫時不知道真正原因。面對這個突然變化，你第一個反應比較接近哪一種？",
    options: [
      {
        label: "我先回到原本的觀察紀錄，看長期條件是否真的改變",
        copy: "單日波動很大，但我不想立刻推翻原本的研究。",
        axisScores: {compound: 2},
      },
      {
        label: "我會立刻重新查資料，確認是不是出現需要反應的新狀況",
        copy: "突然的變化值得快速檢查，避免錯過重要轉折。",
        axisScores: {react: 2},
      },
      {
        label: "我先確認有沒有重大事件，再決定要不要調整原本看法",
        copy: "先做必要檢查，但不因價格本身立刻改變結論。",
        axisScores: {compound: 1, react: 1},
      },
    ],
  },
  {
    axis: "evidence",
    kicker: "星期三上午 · 群組消息擴散",
    title: "有人在群組裡說「主力正在出貨」，還貼了一張沒有來源的截圖。",
    copy: "這個說法傳得很快，也有人開始恐慌。你接下來比較可能怎麼做？",
    options: [
      {
        label: "我先找公司公告與可信來源，確認到底發生了什麼",
        copy: "在事件內容被證實以前，我不想被群組說法帶著走。",
        axisScores: {verify: 2},
      },
      {
        label: "我先蒐集不同人的說法，看看是否出現一致線索",
        copy: "市場消息未必全錯，我會先從多方反應找出值得追查的方向。",
        axisScores: {scan: 2},
      },
      {
        label: "我會記下這個說法，同時等待更可靠的資訊出現",
        copy: "既不直接相信，也不完全忽略可能有用的早期訊號。",
        axisScores: {verify: 1, scan: 1},
      },
    ],
  },
  {
    axis: "focus",
    kicker: "星期三午休 · 公司發布說明",
    title: "公司公告營運照常，但你發現股價沒有立刻回到下跌前的位置。",
    copy: "正式說明已經出現，市場仍然有疑慮。你會把注意力放在哪裡？",
    options: [
      {
        label: "我回頭檢查收入、獲利與財務狀態，確認公司是否真的沒變",
        copy: "公告只是起點，我更在意營運證據能不能支持它。",
        axisScores: {business: 2},
      },
      {
        label: "我觀察成交量、法人與同業反應，看市場是否接受這份說明",
        copy: "市場怎麼消化消息，也能反映目前仍有哪些疑問。",
        axisScores: {market: 2},
      },
      {
        label: "我同時看營運與市場，等兩邊出現比較一致的方向",
        copy: "只有一邊改善，還不足以讓我完全放心。",
        axisScores: {business: 1, market: 1},
      },
    ],
  },
  {
    axis: "opportunity",
    kicker: "星期四晚上 · 數字開始分歧",
    title: "最新月收入增加了，但最近一季獲利沒有跟上，股價卻快速反彈。",
    copy: "你原本只是觀察，現在必須決定下一步最值得追蹤的問題。",
    options: [
      {
        label: "獲利還沒跟上時，目前價格是否已經反映太多期待",
        copy: "我想先確認價格與已有成果之間是否出現落差。",
        axisScores: {anchor: 2},
      },
      {
        label: "收入成長能不能在接下來幾季真正轉成獲利",
        copy: "短期落差可以接受，但我要看到成長逐步兌現。",
        axisScores: {growth: 2},
      },
      {
        label: "我先保留判斷，同時追蹤價格壓力與獲利兌現速度",
        copy: "現在還不足以只採用其中一種解釋。",
        axisScores: {anchor: 1, growth: 1},
      },
    ],
  },
  {
    axis: "cadence",
    kicker: "隔週 · 市場重新轉熱",
    title: "法人連續買進，討論熱度升高，股價很快突破前一波高點。",
    copy: "原本的疑慮還沒有完全消失，但市場方向已明顯改變。你通常會怎麼處理？",
    options: [
      {
        label: "我維持原本追蹤節奏，等營運結果逐步補上再調整判斷",
        copy: "市場變熱不代表研究條件已經全部成熟。",
        axisScores: {compound: 2},
      },
      {
        label: "我提高追蹤頻率，重新評估這次突破是否代表新的階段",
        copy: "方向快速改變時，我願意更快更新自己的研究。",
        axisScores: {react: 2},
      },
      {
        label: "我先記錄市場轉強，但仍用下一份營運數字決定是否改觀",
        copy: "先承認變化存在，再等待更完整的確認。",
        axisScores: {compound: 1, react: 1},
      },
    ],
  },
  {
    axis: "evidence",
    kicker: "月底 · 法說會提出新計畫",
    title: "公司宣布要進入新市場，簡報裡的成長目標很吸引人。",
    copy: "媒體很快用了「下一個成長引擎」當標題。你怎麼判斷這個計畫的分量？",
    options: [
      {
        label: "我先看投入金額、時程與正式說明，確認計畫是否具體",
        copy: "目標可以很大，但我需要能持續核對的里程碑。",
        axisScores: {verify: 2},
      },
      {
        label: "我先追蹤產業消息、競爭者與市場回應，理解機會有多大",
        copy: "新市場還沒有完整數字，外部線索能幫我提早建立輪廓。",
        axisScores: {scan: 2},
      },
      {
        label: "我先記下公司的承諾，再用後續消息與數字逐步驗證",
        copy: "現在先不急著相信或否定，讓證據慢慢累積。",
        axisScores: {verify: 1, scan: 1},
      },
    ],
  },
  {
    axis: "focus",
    kicker: "三個月後 · 第一份成績單",
    title: "新計畫帶來一些訂單，但成本也上升，整體獲利只小幅改善。",
    copy: "結果不是失敗，也還稱不上完全成功。你會先用什麼角度理解這份成績？",
    options: [
      {
        label: "我拆解收入、成本與獲利，確認商業模式能不能逐步成立",
        copy: "我想知道成長是否能留下真正的營運成果。",
        axisScores: {business: 2},
      },
      {
        label: "我比較股價、法人與同業表現，看市場如何評價這份結果",
        copy: "數字公布後的相對反應，能顯示市場原本期待有多高。",
        axisScores: {market: 2},
      },
      {
        label: "我把營運成果和市場反應放在一起，找出兩邊的落差",
        copy: "公司做到了多少，以及市場原本期待多少，都值得比較。",
        axisScores: {business: 1, market: 1},
      },
    ],
  },
  {
    axis: "opportunity",
    kicker: "同一天晚上 · 配息與投資計畫",
    title: "公司宣布配息，同時準備投入一筆大型投資，未來幾季現金可能變少。",
    copy: "這項決定可能影響短期回報，也可能換來下一段成長。你最在意什麼？",
    options: [
      {
        label: "這筆投資的回報與風險，是否符合目前價格和財務能力",
        copy: "我希望公司在可承受的範圍內使用資金。",
        axisScores: {anchor: 2},
      },
      {
        label: "這筆投資能否打開更大的市場，建立下一段成長曲線",
        copy: "短期現金減少可以理解，關鍵是未來空間是否值得。",
        axisScores: {growth: 2},
      },
      {
        label: "我會同時檢查資金壓力與成長潛力，不先偏向其中一邊",
        copy: "投資計畫既要有想像，也要有承受失敗的能力。",
        axisScores: {anchor: 1, growth: 1},
      },
    ],
  },
  {
    axis: "cadence",
    kicker: "週末晚上 · 整理這段研究",
    title: "從朋友傳來股票到現在，你已經看過下跌、消息、公告、反彈與第一份成果。",
    copy: "你準備關掉電腦，為這檔股票留下下一步。哪一種做法最像你？",
    options: [
      {
        label: "建立固定檢查清單，按月或按季確認原本條件是否延續",
        copy: "我偏好用一致節奏累積證據，不讓每天的波動打亂研究。",
        axisScores: {compound: 2},
      },
      {
        label: "設定重要事件提醒，只要方向改變就立即重新整理判斷",
        copy: "我希望在新狀況出現時快速反應，不錯過關鍵轉折。",
        axisScores: {react: 2},
      },
      {
        label: "保留固定追蹤，同時為重大事件設定額外檢查點",
        copy: "平常維持節奏，真的出現變化時再提高研究頻率。",
        axisScores: {compound: 1, react: 1},
      },
    ],
  },
];

const onboardingSteps = [
  {
    anchor: "#top",
    kicker: "歡迎使用 GC",
    title: "先認識今天的研究首頁",
    copy: "GC 是投資研究工具，幫你整理發生什麼、哪裡改變與後續要追蹤什麼；不提供明牌、目標價或買賣指令。",
    prepare: async () => {
      showHomeView({restoreScroll: false});
      switchPage("home", {scroll: false});
    },
  },
  {
    anchor: "#dailyResearchSection",
    kicker: "每天先看這裡",
    title: "今日研究幫你安排閱讀順序",
    copy: "新事件、重要變化、持續追蹤與判斷依據會分開呈現，不需要一次翻完所有資料。",
    prepare: async () => {
      showHomeView({restoreScroll: false});
      switchPage("home", {scroll: false});
    },
  },
  {
    anchor: "#futureEvents",
    kicker: "未來 7 天",
    title: "只顯示仍有效的正式日程",
    copy: "已過期事件不會留在這裡；沒有新事件時也會明確說明。事件存在本身不會改變健康分數。",
    prepare: async () => {
      showHomeView({restoreScroll: false});
      switchPage("home", {scroll: false});
    },
  },
  {
    anchor: "#stockCenter",
    scrollBlock: "start",
    kicker: "選擇研究標的",
    title: "從探索頁進入個股報告",
    copy: "你可以搜尋股票、依產業瀏覽或加入自選。不同股票類型會使用不同的研究框架。",
    prepare: async () => {
      showHomeView({restoreScroll: false});
      switchPage("explore", {scroll: false});
    },
  },
  {
    anchor: ".hero-card",
    scrollBlock: "start",
    kicker: "Guided 個股報告",
    title: "先看健康分數與四個重要判斷",
    copy: "圓形數字是健康分數，用來整理公司目前的營運、市場與風險狀態，不是預測報酬，也不是買賣分數。下面再分別說明健康狀態、風險、價格位置與判斷把握度；價格位置不是合理價，也不代表適合買進或賣出。",
    prepare: async () => {
      const stockId =
        stockCatalog.find((report) => report?.id === "2330")?.id ||
        stockCatalog[0]?.id ||
        "2330";

      if (!currentReport || String(currentReport.id) !== String(stockId)) {
        await loadStock(stockId);
      }

      applyResearchMode("guided");
    },
  },
  {
    anchor: "#researchModeShortcut",
    kicker: "選擇資訊深度",
    title: "需要完整資料時再切換 Pro",
    copy: "Guided 與 Pro 使用同一套研究結果。Guided 用白話帶你閱讀；Pro 顯示完整指標、基準、權重與歷史證據。",
    prepare: async () => {},
  },
];

function onboardingCompleted() {
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === ONBOARDING_VERSION;
}

function waitForOnboardingTarget(selector, timeout = 5000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    const find = () => {
      const target = document.querySelector(selector);

      if (
        target &&
        target.getClientRects().length &&
        getComputedStyle(target).visibility !== "hidden"
      ) {
        resolve(target);
        return;
      }

      if (Date.now() - startedAt >= timeout) {
        resolve(null);
        return;
      }

      window.requestAnimationFrame(find);
    };

    find();
  });
}

function positionOnboarding(target) {
  if (!onboardingActive || !target) return;

  const spotlight = $("onboardingSpotlight");
  const dialog = $("onboardingDialog");
  const rect = target.getBoundingClientRect();
  const padding = 12;
  const spotlightLeft = Math.max(8, rect.left - padding);
  const spotlightTop = Math.max(8, rect.top - padding);
  const spotlightRight = Math.min(
    window.innerWidth - 8,
    rect.right + padding
  );
  const spotlightBottom = Math.min(
    window.innerHeight - 8,
    rect.bottom + padding
  );

  spotlight.style.left = `${spotlightLeft}px`;
  spotlight.style.top = `${spotlightTop}px`;
  spotlight.style.width =
    `${Math.max(24, spotlightRight - spotlightLeft)}px`;
  spotlight.style.height =
    `${Math.max(24, spotlightBottom - spotlightTop)}px`;

  dialog.classList.remove("above", "below");

  const dialogRect = dialog.getBoundingClientRect();
  const roomBelow = window.innerHeight - rect.bottom;
  const placeBelow =
    roomBelow >= dialogRect.height + 30 ||
    rect.top < dialogRect.height + 30;

  const top = placeBelow
    ? Math.min(
        window.innerHeight - dialogRect.height - 16,
        rect.bottom + 18
      )
    : Math.max(16, rect.top - dialogRect.height - 18);

  const left = Math.min(
    window.innerWidth - dialogRect.width - 16,
    Math.max(16, rect.left)
  );

  dialog.style.top = `${top}px`;
  dialog.style.left = `${left}px`;
  dialog.classList.add(placeBelow ? "below" : "above");
}

async function showOnboardingStep(index) {
  if (!onboardingActive) return;

  onboardingStepIndex = Math.max(
    0,
    Math.min(index, onboardingSteps.length - 1)
  );

  const step = onboardingSteps[onboardingStepIndex];

  await step.prepare();

  onboardingTarget = await waitForOnboardingTarget(step.anchor);

  if (!onboardingTarget) {
    if (onboardingStepIndex < onboardingSteps.length - 1) {
      await showOnboardingStep(onboardingStepIndex + 1);
    } else {
      finishOnboarding();
    }
    return;
  }

  const documentRoot = document.documentElement;
  const previousScrollBehavior =
    documentRoot.style.scrollBehavior;

  documentRoot.style.scrollBehavior = "auto";

  onboardingTarget.scrollIntoView({
    block: step.scrollBlock || "center",
    inline: "nearest",
  });

  await new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });

  documentRoot.style.scrollBehavior =
    previousScrollBehavior;

  $("onboardingStepLabel").textContent =
    `第 ${onboardingStepIndex + 1} 步，共 ${onboardingSteps.length} 步`;
  $("onboardingKicker").textContent = step.kicker;
  $("onboardingTitle").textContent = step.title;
  $("onboardingCopy").textContent = step.copy;
  $("onboardingPrevious").disabled = onboardingStepIndex === 0;
  $("onboardingNext").textContent =
    onboardingStepIndex === onboardingSteps.length - 1
      ? "完成導覽"
      : "下一步";

  positionOnboarding(onboardingTarget);
  $("onboardingDialog").focus({preventScroll: true});
}

async function startOnboarding({force = false} = {}) {
  if (!force && onboardingCompleted()) return;

  onboardingActive = true;
  onboardingStepIndex = 0;

  $("onboardingBackdrop").classList.remove("hidden");
  $("onboardingSpotlight").classList.remove("hidden");
  $("onboardingDialog").classList.remove("hidden");
  document.body.classList.add("onboarding-open");

  await showOnboardingStep(0);
}

function finishOnboarding({skipped = false} = {}) {
  if (!onboardingActive) return;

  onboardingActive = false;
  onboardingTarget = null;

  localStorage.setItem(
    ONBOARDING_STORAGE_KEY,
    ONBOARDING_VERSION
  );

  $("onboardingBackdrop").classList.add("hidden");
  $("onboardingSpotlight").classList.add("hidden");
  $("onboardingDialog").classList.add("hidden");
  document.body.classList.remove("onboarding-open");

  showToast(skipped ? "已略過新手導覽" : "新手導覽完成");
}

function savedPersonalityResult() {
  try {
    const result = JSON.parse(
      localStorage.getItem(PERSONALITY_STORAGE_KEY) || "null"
    );

    return result?.version === PERSONALITY_VERSION
      ? result
      : null;
  } catch {
    return null;
  }
}

function setPersonalityView(view) {
  $("personalityIntro").classList.toggle(
    "hidden",
    view !== "intro"
  );
  $("personalityQuiz").classList.toggle(
    "hidden",
    view !== "quiz"
  );
  $("personalityResult").classList.toggle(
    "hidden",
    view !== "result"
  );
}

function openPersonalityPage() {
  showHomeView({restoreScroll: false});
  switchPage("personality", {scroll: false});

  const result = savedPersonalityResult();

  if (result) {
    renderPersonalityResult(result);
  } else {
    setPersonalityView("intro");
    window.scrollTo({top: 0, behavior: "smooth"});
  }
}

function startPersonalityQuiz() {
  personalityQuestionIndex = 0;
  personalityAnswers = Array(
    researchPersonalityQuestions.length
  ).fill(null);

  setPersonalityView("quiz");
  renderPersonalityQuestion();
  window.scrollTo({top: 0, behavior: "smooth"});
}

function renderPersonalityQuestion() {
  const question =
    researchPersonalityQuestions[personalityQuestionIndex];

  const questionNumber = personalityQuestionIndex + 1;
  const progress = Math.round(
    questionNumber /
    researchPersonalityQuestions.length *
    100
  );

  $("personalityQuestionLabel").textContent =
    `第 ${questionNumber} 題，共 ${researchPersonalityQuestions.length} 題`;
  $("personalityProgressText").textContent =
    `${progress}%`;
  $("personalityProgressBar").style.width =
    `${progress}%`;
  $("personalityQuestionKicker").textContent =
    question.kicker;
  $("personalityQuestionTitle").textContent =
    question.title;
  $("personalityQuestionCopy").textContent =
    question.copy;

  const selected =
    personalityAnswers[personalityQuestionIndex];

  $("personalityOptions").innerHTML =
    question.options.map((option, index) => `
      <button class="personality-option ${
        selected === index ? "selected" : ""
      }" type="button" role="radio"
        aria-checked="${selected === index}"
        data-personality-option="${index}">
        <span>${String.fromCharCode(65 + index)}</span>
        <div>
          <b>${escapeHtml(option.label)}</b>
          <small>${escapeHtml(option.copy)}</small>
        </div>
      </button>
    `).join("");

  $("personalityPrevious").disabled =
    personalityQuestionIndex === 0;
  $("personalityNext").disabled =
    selected === null;
  $("personalityNext").textContent =
    personalityQuestionIndex ===
      researchPersonalityQuestions.length - 1
      ? "查看結果"
      : "下一題";
}

function selectPersonalityOption(index) {
  const question =
    researchPersonalityQuestions[personalityQuestionIndex];

  if (!question.options[index]) return;

  personalityAnswers[personalityQuestionIndex] = index;
  renderPersonalityQuestion();
}

function completePersonalityQuiz() {
  const scores = {
    verify: 0,
    scan: 0,
    business: 0,
    market: 0,
    anchor: 0,
    growth: 0,
    compound: 0,
    react: 0,
  };

  personalityAnswers.forEach((answer, questionIndex) => {
    const option =
      researchPersonalityQuestions[questionIndex]
        ?.options?.[answer];

    Object.entries(option?.axisScores || {})
      .forEach(([key, points]) => {
        if (Object.hasOwn(scores, key)) {
          scores[key] += Number(points || 0);
        }
      });
  });

  const dimensions = personalityDimensionRows(scores);

  const primary = [
    scores.verify >= scores.scan ? "v" : "s",
    scores.business >= scores.market ? "b" : "m",
    scores.anchor >= scores.growth ? "a" : "g",
    scores.compound >= scores.react ? "c" : "r",
  ].join("");

  const weakestDimension = [...dimensions]
    .sort((left, right) =>
      left.margin - right.margin
    )[0];

  const secondaryCharacters = primary.split("");

  if (weakestDimension) {
    const index = weakestDimension.index;
    const alternatives = [
      ["v", "s"],
      ["b", "m"],
      ["a", "g"],
      ["c", "r"],
    ];
    const pair = alternatives[index];
    secondaryCharacters[index] =
      secondaryCharacters[index] === pair[0]
        ? pair[1]
        : pair[0];
  }

  const secondary = secondaryCharacters.join("");
  const averageMargin = dimensions.length
    ? dimensions.reduce(
        (total, row) => total + row.margin,
        0
      ) / dimensions.length
    : 0;

  const clarity = averageMargin >= 50
    ? "輪廓非常清楚"
    : averageMargin >= 30
      ? "輪廓清楚"
      : averageMargin >= 16
        ? "具有明顯傾向"
        : "研究方式較為平衡";

  const result = {
    version: PERSONALITY_VERSION,
    system: "GC-16",
    primary,
    secondary,
    scores,
    dimensions,
    clarity,
    answers: [...personalityAnswers],
    completedAt: new Date().toISOString(),
    affectsHealthScore: false,
  };

  localStorage.setItem(
    PERSONALITY_STORAGE_KEY,
    JSON.stringify(result)
  );

  renderPersonalityResult(result);
  renderProfilePage();
}

function personalityDimensionRows(scores = {}) {
  const score = (key) => {
    const value = Number(scores?.[key] || 0);
    return Number.isFinite(value) ? value : 0;
  };

  return researchPersonalityAxisDefinitions.map(
    (axis, index) => {
      const leftScore = score(axis.leftKey);
      const rightScore = score(axis.rightKey);
      const total = leftScore + rightScore;
      const leftPercent = total > 0
        ? Math.round(leftScore / total * 100)
        : 50;
      const rightPercent = 100 - leftPercent;

      return {
        index,
        key: axis.key,
        leftKey: axis.leftKey,
        leftLabel: axis.leftLabel,
        leftScore,
        leftPercent,
        rightKey: axis.rightKey,
        rightLabel: axis.rightLabel,
        rightScore,
        rightPercent,
        margin: Math.abs(leftPercent - rightPercent),
        description: axis.description,
      };
    }
  );
}

function renderPersonalityDimensions(result) {
  const chart = $("personalityDimensionChart");
  const summary = $("personalityDimensionSummary");

  if (!chart || !summary) return;

  const rows = personalityDimensionRows(
    result?.scores || {}
  );

  const strongest = rows
    .flatMap((row) => [
      {
        label: row.leftLabel,
        percent: row.leftPercent,
      },
      {
        label: row.rightLabel,
        percent: row.rightPercent,
      },
    ])
    .sort((a, b) => b.percent - a.percent)[0];

  summary.textContent = strongest
    ? `你的研究習慣最明顯偏向「${strongest.label}」，但仍會搭配其他方向交叉確認。`
    : "根據十二個研究情境，整理你做判斷時自然偏重的方向。";

  chart.innerHTML = rows.map((row) => `
    <article class="personality-dimension-row">
      <div class="personality-dimension-labels">
        <span>
          <b>${escapeHtml(row.leftLabel)}</b>
          <strong>${row.leftPercent}%</strong>
        </span>
        <span>
          <strong>${row.rightPercent}%</strong>
          <b>${escapeHtml(row.rightLabel)}</b>
        </span>
      </div>

      <div class="personality-dimension-track"
        role="img"
        aria-label="${escapeHtml(
          `${row.leftLabel} ${row.leftPercent}%，` +
          `${row.rightLabel} ${row.rightPercent}%`
        )}">
        <i style="width:${row.leftPercent}%"></i>
        <em style="width:${row.rightPercent}%"></em>
        <u></u>
      </div>

      <p>${escapeHtml(row.description)}</p>
    </article>
  `).join("");
}


function personalityTotemSvg(typeKey = "vbac") {
  const key = /^[vs][bm][ag][cr]$/.test(String(typeKey))
    ? String(typeKey)
    : "vbac";

  const verifies = key[0] === "v";
  const business = key[1] === "b";
  const anchored = key[2] === "a";
  const compounds = key[3] === "c";
  const accent = "currentColor";

  const evidenceShape = verifies
    ? `<path d="M24 49 34 24h28l10 25-24 23Z" />`
    : `<circle cx="48" cy="48" r="28" />
       <path d="M19 48h10M67 48h10M48 19v10M48 67v10" />`;

  const focusShape = business
    ? `<path d="M34 57V43M48 57V32M62 57V38" />`
    : `<path d="M28 55c8-15 17 8 25-7s13-3 17-10" />`;

  const opportunityShape = anchored
    ? `<circle cx="48" cy="48" r="8" />
       <path d="M48 35v26M35 48h26" />`
    : `<path d="m48 31 4.2 10.8L64 43l-9 7.5L58 62l-10-6.3L38 62l3-11.5L32 43l11.8-1.2Z" />`;

  const cadenceShape = compounds
    ? `<path d="M26 73c13 7 31 7 44 0M31 79c10 5 24 5 34 0" />`
    : `<path d="m70 66-12-1 5-11-17 15 12 1-5 11Z" />`;

  return `
    <svg viewBox="0 0 96 96" role="img"
      aria-label="${escapeHtml(key.toUpperCase())} 研究人格圖騰"
      fill="none" stroke="${accent}" stroke-width="2.4"
      stroke-linecap="round" stroke-linejoin="round">
      <circle class="totem-orbit" cx="48" cy="48" r="42" />
      ${evidenceShape}
      ${focusShape}
      ${opportunityShape}
      ${cadenceShape}
      <circle class="totem-star" cx="77" cy="24" r="2.5" fill="${accent}" stroke="none" />
    </svg>
  `;
}

function renderPersonalityResult(result) {
  const primary =
    researchPersonalityProfiles[result?.primary];
  const secondary =
    researchPersonalityProfiles[result?.secondary];

  if (!primary) {
    setPersonalityView("intro");
    return;
  }

  renderPersonalityDimensions(result);

  const resultCode = `${primary.id} · ${String(result.primary).toUpperCase()}`;

  $("personalityResultSymbol").innerHTML =
    personalityTotemSvg(result.primary);
  $("personalityResultCode").textContent = resultCode;
  $("personalityResultClarity").textContent =
    result.clarity || "研究方式較為平衡";
  $("personalityResultTitle").textContent =
    primary.name;
  $("personalityResultSummary").textContent =
    primary.summary;
  $("personalitySecondaryType").textContent =
    secondary
      ? `次要傾向：${secondary.name}`
      : "研究風格已完成";

  $("personalityStrengthTitle").textContent =
    primary.strengthTitle;
  $("personalityStrengthCopy").textContent =
    primary.strengthCopy;
  $("personalityBlindSpotTitle").textContent =
    primary.blindSpotTitle;
  $("personalityBlindSpotCopy").textContent =
    primary.blindSpotCopy;
  $("personalityReadingOrder").innerHTML =
    primary.readingOrder
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
  $("personalityModeTitle").textContent =
    primary.modeTitle;
  $("personalityModeCopy").textContent =
    primary.modeCopy;

  document.documentElement.dataset.researchPersonality =
    result.primary;

  setPersonalityView("result");
  window.scrollTo({top: 0, behavior: "smooth"});
}


function currentPersonalityShareData() {
  const result = savedPersonalityResult();
  const profile = researchPersonalityProfiles[result?.primary];

  if (!result || !profile) return null;

  const dimensions = personalityDimensionRows(result.scores || {});

  return {
    result,
    profile,
    dimensions,
    code: `${profile.id} · ${String(result.primary).toUpperCase()}`,
  };
}

function personalityShareText(data = currentPersonalityShareData()) {
  if (!data) return "";

  const axes = data.dimensions
    .map((row) => {
      const preferred = row.leftPercent >= row.rightPercent
        ? `${row.leftLabel} ${row.leftPercent}%`
        : `${row.rightLabel} ${row.rightPercent}%`;
      return preferred;
    })
    .join("｜");

  return [
    `我的研究人格是「${data.profile.name}」`,
    data.profile.summary,
    `研究座標：${axes}`,
    `結果清晰度：${data.result.clarity || "研究方式較為平衡"}`,
    "人格只改變閱讀方式，不改變任何股票的研究結果。",
    "#GC研究人格 #投資研究",
  ].join("\n");
}

async function copyTextSafely(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function setPersonalityShareStatus(message) {
  const status = $("personalityShareStatus");
  if (status) status.textContent = message;
}

async function sharePersonalityResult() {
  const data = currentPersonalityShareData();
  if (!data) {
    showToast("請先完成人格測驗");
    return;
  }

  const text = personalityShareText(data);

  if (navigator.share) {
    try {
      await navigator.share({
        title: `我的研究人格｜${data.profile.name}`,
        text,
        url: window.location.origin,
      });
      setPersonalityShareStatus("已開啟系統分享選單");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyTextSafely(`${text}\n${window.location.origin}`);
    setPersonalityShareStatus("這個瀏覽器不支援直接分享，已改為複製文字");
    showToast("結果文字已複製");
  } catch (_error) {
    setPersonalityShareStatus("目前無法開啟分享，請改用下載報告圖");
  }
}

async function copyPersonalityResult() {
  const text = personalityShareText();
  if (!text) {
    showToast("請先完成人格測驗");
    return;
  }

  try {
    await copyTextSafely(text);
    setPersonalityShareStatus("結果文字已複製，可貼到 Threads、LINE 或其他社群");
    showToast("結果文字已複製");
  } catch (_error) {
    setPersonalityShareStatus("瀏覽器未允許複製，請改用系統分享");
  }
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function canvasWrappedLines(context, text, maxWidth) {
  const characters = Array.from(String(text || ""));
  const lines = [];
  let current = "";

  characters.forEach((character) => {
    const next = current + character;
    if (current && context.measureText(next).width > maxWidth) {
      lines.push(current);
      current = character;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines;
}

function drawPersonalityTotem(context, typeKey, centerX, centerY, size) {
  const key = /^[vs][bm][ag][cr]$/.test(String(typeKey))
    ? String(typeKey)
    : "vbac";
  const scale = size / 96;
  const point = (value) => value * scale;

  context.save();
  context.translate(centerX - size / 2, centerY - size / 2);
  context.strokeStyle = "#e39a58";
  context.fillStyle = "#e39a58";
  context.lineWidth = point(2.4);
  context.lineCap = "round";
  context.lineJoin = "round";

  context.globalAlpha = .35;
  context.beginPath();
  context.arc(point(48), point(48), point(42), 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;

  if (key[0] === "v") {
    context.beginPath();
    context.moveTo(point(24), point(49));
    context.lineTo(point(34), point(24));
    context.lineTo(point(62), point(24));
    context.lineTo(point(72), point(49));
    context.lineTo(point(48), point(72));
    context.closePath();
    context.stroke();
  } else {
    context.beginPath();
    context.arc(point(48), point(48), point(28), 0, Math.PI * 2);
    context.stroke();
    [[19,48,29,48],[67,48,77,48],[48,19,48,29],[48,67,48,77]]
      .forEach(([x1,y1,x2,y2]) => {
        context.beginPath();
        context.moveTo(point(x1), point(y1));
        context.lineTo(point(x2), point(y2));
        context.stroke();
      });
  }

  context.beginPath();
  if (key[1] === "b") {
    [[34,57,34,43],[48,57,48,32],[62,57,62,38]]
      .forEach(([x1,y1,x2,y2]) => {
        context.moveTo(point(x1), point(y1));
        context.lineTo(point(x2), point(y2));
      });
  } else {
    context.moveTo(point(28), point(55));
    context.bezierCurveTo(point(36),point(40),point(45),point(63),point(53),point(48));
    context.bezierCurveTo(point(61),point(33),point(66),point(45),point(70),point(38));
  }
  context.stroke();

  if (key[2] === "a") {
    context.beginPath();
    context.arc(point(48), point(48), point(8), 0, Math.PI * 2);
    context.stroke();
    [[48,35,48,61],[35,48,61,48]].forEach(([x1,y1,x2,y2]) => {
      context.beginPath();
      context.moveTo(point(x1),point(y1));
      context.lineTo(point(x2),point(y2));
      context.stroke();
    });
  } else {
    const star = [[48,31],[52,42],[64,43],[55,51],[58,62],[48,56],[38,62],[41,51],[32,43],[44,42]];
    context.beginPath();
    star.forEach(([x,y], index) => {
      if (index === 0) context.moveTo(point(x),point(y));
      else context.lineTo(point(x),point(y));
    });
    context.closePath();
    context.stroke();
  }

  context.beginPath();
  if (key[3] === "c") {
    context.moveTo(point(26),point(73));
    context.quadraticCurveTo(point(48),point(84),point(70),point(73));
    context.moveTo(point(31),point(79));
    context.quadraticCurveTo(point(48),point(87),point(65),point(79));
  } else {
    [[70,66],[58,65],[63,54],[46,69],[58,70],[53,81]].forEach(([x,y], index) => {
      if (index === 0) context.moveTo(point(x),point(y));
      else context.lineTo(point(x),point(y));
    });
  }
  context.stroke();

  context.beginPath();
  context.arc(point(77),point(24),point(2.5),0,Math.PI*2);
  context.fill();
  context.restore();
}

function personalityShareCanvas(data) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");

  context.fillStyle = "#08110d";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(540, 190, 20, 540, 190, 560);
  glow.addColorStop(0, "rgba(227,154,88,.14)");
  glow.addColorStop(1, "rgba(8,17,13,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, 760);

  context.fillStyle = "#75c59d";
  context.font = "700 24px Arial, sans-serif";
  context.fillText("GC RESEARCH PERSONALITY REPORT", 72, 82);

  context.textAlign = "right";
  context.fillStyle = "#e8c9a7";
  context.font = "600 22px Consolas, monospace";
  context.fillText(data.code, 1008, 82);
  context.textAlign = "left";

  drawPersonalityTotem(context, data.result.primary, 540, 235, 190);

  context.textAlign = "center";
  context.fillStyle = "#e39a58";
  context.font = "700 22px Arial, sans-serif";
  context.fillText("你的研究人格", 540, 380);

  context.fillStyle = "#f4efe7";
  context.font = "800 66px Arial, sans-serif";
  context.fillText(data.profile.name, 540, 468);

  context.fillStyle = "#b8c4bb";
  context.font = "400 28px Arial, sans-serif";
  const summaryLines = canvasWrappedLines(context, data.profile.summary, 840).slice(0, 2);
  summaryLines.forEach((line, index) => context.fillText(line, 540, 528 + index * 42));

  context.textAlign = "left";
  let y = 650;
  data.dimensions.forEach((row) => {
    context.fillStyle = "#f4efe7";
    context.font = "700 25px Arial, sans-serif";
    context.fillText(`${row.leftLabel}  ${row.leftPercent}%`, 80, y);
    context.textAlign = "right";
    context.fillText(`${row.rightPercent}%  ${row.rightLabel}`, 1000, y);
    context.textAlign = "left";

    context.fillStyle = "#27372f";
    drawRoundedRect(context, 80, y + 24, 920, 18, 9);
    context.fill();

    context.fillStyle = "#e39a58";
    drawRoundedRect(context, 80, y + 24, 920 * row.leftPercent / 100, 18, 9);
    context.fill();

    context.fillStyle = "#80c7a3";
    drawRoundedRect(
      context,
      80 + 920 * row.leftPercent / 100,
      y + 24,
      920 * row.rightPercent / 100,
      18,
      9
    );
    context.fill();
    y += 120;
  });

  context.fillStyle = "#111c16";
  drawRoundedRect(context, 72, 1110, 936, 130, 24);
  context.fill();
  context.strokeStyle = "#30443a";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "#819187";
  context.font = "500 20px Arial, sans-serif";
  context.fillText("RESULT CLARITY", 104, 1155);
  context.fillStyle = "#f4efe7";
  context.font = "700 30px Arial, sans-serif";
  context.fillText(data.result.clarity || "研究方式較為平衡", 104, 1204);

  context.textAlign = "center";
  context.fillStyle = "#718078";
  context.font = "400 19px Arial, sans-serif";
  context.fillText("人格只改變閱讀方式，不改變股票研究結果", 540, 1300);
  context.textAlign = "left";

  return canvas;
}

function downloadPersonalityReport() {
  const data = currentPersonalityShareData();
  if (!data) {
    showToast("請先完成人格測驗");
    return;
  }

  const canvas = personalityShareCanvas(data);
  const link = document.createElement("a");
  link.download = `GC-16-${String(data.result.primary).toUpperCase()}-${data.profile.name}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  setPersonalityShareStatus("1080 × 1350 人格報告圖已下載");
  showToast("人格報告圖已下載");
}

function renderProfilePersonality() {
  const result = savedPersonalityResult();
  const profile =
    researchPersonalityProfiles[result?.primary];

  $("profilePersonalityName").textContent =
    profile?.name || "尚未測驗";
  $("profilePersonalityNote").textContent =
    profile
      ? "已建立個人化閱讀順序，可隨時重新測驗"
      : "完成 12 題，建立個人化閱讀順序";
  $("profilePersonality").textContent =
    profile
      ? "查看我的研究人格"
      : "了解我的研究人格";

  if (profile) {
    document.documentElement.dataset.researchPersonality =
      result.primary;
  }
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

  const summaryProfile = stockDecisionProfile(report);
  const summaryMetrics = summaryProfile?.metrics || {};
  const summaryProfileId =
    report.stock_profile?.profile_id || "default";

  const summaryAvailable = (value) =>
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value));

  const summaryNumber = (value, digits = 1) =>
    summaryAvailable(value)
      ? Number(value).toFixed(digits)
      : null;

  let summaryTitle = "";
  let summaryCopy = "";
  let summaryBasis = "";

  if (summaryProfileId === "growth_quality") {
    const growthHistoricalCategories =
      report.historical_context?.categories || {};

    const growthHistoricalRevenue =
      growthHistoricalCategories.revenue || {};

    const growthHistoricalFinancial =
      growthHistoricalCategories.financial || {};

    const monthlyRevenueGrowth =
      summaryAvailable(growthHistoricalRevenue.year_over_year_pct)
        ? Number(growthHistoricalRevenue.year_over_year_pct)
        : null;

    const incomeChange =
      summaryAvailable(growthHistoricalFinancial.income_change_yoy_pct)
        ? Number(growthHistoricalFinancial.income_change_yoy_pct)
        : null;

    const usualMonthlyRevenueGrowth =
      summaryAvailable(
        growthHistoricalRevenue.historical_yoy_median_pct
      )
        ? Number(
            growthHistoricalRevenue.historical_yoy_median_pct
          )
        : null;

    const revenueMonthCount =
      Number(growthHistoricalRevenue.sample_count || 0);

    const revenueComparisonCount =
      Number(growthHistoricalRevenue.yoy_sample_count || 0);

    const financialQuarterCount =
      Number(growthHistoricalFinancial.quarter_sample_count || 0);

    if (
      monthlyRevenueGrowth !== null &&
      incomeChange !== null
    ) {
      if (
        monthlyRevenueGrowth > 0 &&
        incomeChange > 0
      ) {
        summaryTitle =
          "公司的收入和獲利仍在成長";

        summaryCopy =
          `最新一個月收入比去年同期增加 ${monthlyRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利也增加 ${incomeChange.toFixed(1)}%。`;

        if (
          usualMonthlyRevenueGrowth !== null &&
          monthlyRevenueGrowth > usualMonthlyRevenueGrowth
        ) {
          summaryCopy +=
            `目前收入成長也高於過去常見的 ${usualMonthlyRevenueGrowth.toFixed(1)}%。`;
        }
      } else if (
        monthlyRevenueGrowth > 0 &&
        incomeChange <= 0
      ) {
        summaryTitle =
          "收入仍在增加，但獲利尚未跟上";

        summaryCopy =
          `最新一個月收入比去年同期增加 ${monthlyRevenueGrowth.toFixed(1)}%，` +
          `但最近四季獲利減少 ${Math.abs(incomeChange).toFixed(1)}%。`;
      } else if (
        monthlyRevenueGrowth <= 0 &&
        incomeChange > 0
      ) {
        summaryTitle =
          "獲利仍在增加，但收入正在放慢";

        summaryCopy =
          `最近四季獲利比一年前增加 ${incomeChange.toFixed(1)}%，` +
          `但最新一個月收入減少 ${Math.abs(monthlyRevenueGrowth).toFixed(1)}%。`;
      } else {
        summaryTitle =
          "公司的收入和獲利都在減少";

        summaryCopy =
          `最新一個月收入比去年同期減少 ${Math.abs(monthlyRevenueGrowth).toFixed(1)}%，` +
          `最近四季獲利也減少 ${Math.abs(incomeChange).toFixed(1)}%。`;
      }
    } else {
      summaryTitle =
        "公司的成長歷史尚未形成完整比較";

      summaryCopy =
        "收入年度比較或最近四季獲利仍有一項尚未形成，GC 暫時不判定公司的成長方向。";
    }

    const basis = [
      `${revenueMonthCount} 個月收入歷史`,
      `${revenueComparisonCount} 次年度比較`,
      `${financialQuarterCount} 季財報`,
    ];

    if (monthlyRevenueGrowth !== null) {
      basis.push(
        `最新單月收入 ${monthlyRevenueGrowth >= 0 ? "+" : ""}${monthlyRevenueGrowth.toFixed(1)}%`
      );
    }

    if (incomeChange !== null) {
      basis.push(
        `最近四季獲利 ${incomeChange >= 0 ? "+" : ""}${incomeChange.toFixed(1)}%`
      );
    }

    summaryBasis =
      `比較資料：${basis.join("｜")}`;
  } else if (summaryProfileId === "financial_income") {
    const financialHistory =
      report.historical_context?.categories?.financial || {};


    const incomeChange =
      summaryAvailable(financialHistory.income_change_yoy_pct)
        ? Number(financialHistory.income_change_yoy_pct)
        : null;

    const currentRoe =
      summaryAvailable(financialHistory.roe_pct)
        ? Number(financialHistory.roe_pct)
        : null;

    const usualRoe =
      summaryAvailable(financialHistory.historical_roe_median_pct)
        ? Number(financialHistory.historical_roe_median_pct)
        : null;

    if (incomeChange !== null && incomeChange <= -5) {
      summaryTitle = "最近四季獲利比一年前少";

      summaryCopy =
        `最近四季合計獲利比一年前減少 ${Math.abs(incomeChange).toFixed(1)}%。` +
        (
          currentRoe !== null && usualRoe !== null
            ? `目前每 100 元股東資金約賺回 ${currentRoe.toFixed(1)} 元，` +
              `低於公司過去常見的 ${usualRoe.toFixed(1)} 元。`
            : ""
        );
    } else if (incomeChange !== null && incomeChange >= 5) {
      summaryTitle = "最近四季獲利比一年前多";

      summaryCopy =
        `最近四季合計獲利比一年前增加 ${incomeChange.toFixed(1)}%。` +
        "GC 會繼續比較這項改善能不能延續。";
    } else {
      summaryTitle = "最近四季獲利和一年前接近";

      summaryCopy =
        "最近四季合計獲利沒有明顯增加或減少，" +
        "目前經營表現大致維持原來水準。";
    }

    const financialBasis = [];

    if (currentRoe !== null && usualRoe !== null) {
      financialBasis.push(
        `目前每 100 元股東資金約賺回 ${currentRoe.toFixed(1)} 元`
      );
      financialBasis.push(
        `過去常見約 ${usualRoe.toFixed(1)} 元`
      );
    }

    if (summaryAvailable(summaryMetrics.dividend_yield_pct)) {
      financialBasis.push(
        `目前殖利率 ${Number(summaryMetrics.dividend_yield_pct).toFixed(2)}%`
      );
    }

    summaryBasis =
      financialBasis.length
        ? `比較資料：${financialBasis.join("｜")}`
        : "比較資料：公司季度財報與交易所正式資料";
  } else if (summaryProfileId === "cyclical") {
    const cyclicalHistory =
      report.historical_context?.categories || {};

    const cyclicalRevenue =
      cyclicalHistory.revenue || {};

    const cyclicalFinancial =
      cyclicalHistory.financial || {};

    const cyclicalPrice =
      cyclicalHistory.price || {};

    const cyclicalInstitutional =
      cyclicalHistory.institutional || {};

    const cyclicalRevenueGrowth =
      summaryAvailable(cyclicalRevenue.year_over_year_pct)
        ? Number(cyclicalRevenue.year_over_year_pct)
        : null;

    const cyclicalIncomeChange =
      summaryAvailable(cyclicalFinancial.income_change_yoy_pct)
        ? Number(cyclicalFinancial.income_change_yoy_pct)
        : null;

    const cyclicalPrice30d =
      summaryAvailable(cyclicalPrice.changes?.["30d_pct"])
        ? Number(cyclicalPrice.changes["30d_pct"])
        : null;

    const cyclicalInstitutional20d =
      summaryAvailable(cyclicalInstitutional.windows?.["20d_net_buy"])
        ? Number(cyclicalInstitutional.windows["20d_net_buy"])
        : null;

    const operatingCycleConfirmed =
      cyclicalRevenueGrowth !== null &&
      cyclicalIncomeChange !== null &&
      cyclicalRevenueGrowth > 0 &&
      cyclicalIncomeChange > 0;

    const marketSignalsPositive =
      cyclicalPrice30d !== null &&
      cyclicalPrice30d > 10 &&
      cyclicalInstitutional20d !== null &&
      cyclicalInstitutional20d > 0;

    if (operatingCycleConfirmed) {
      summaryTitle = "收入與獲利一起改善，營運循環正在轉強";
      summaryCopy =
        `最新收入比去年同期增加 ${cyclicalRevenueGrowth.toFixed(1)}%，` +
        `最近四季獲利也增加 ${cyclicalIncomeChange.toFixed(1)}%。` +
        "收入與獲利同時改善，才支持營運回溫的判斷。";
    } else if (marketSignalsPositive) {
      summaryTitle = "股價與法人買盤轉強，但營運循環尚未確認";
      summaryCopy =
        `近 30 個交易日股價上漲 ${cyclicalPrice30d.toFixed(1)}%，` +
        "法人近一個月也買進多於賣出。" +
        "但收入與獲利尚未一起改善，因此不能把市場轉強直接當成生意回溫。";
    } else {
      summaryTitle = "目前還不能確認公司的營運循環已經轉強";
      summaryCopy =
        "目前沒有看到收入與獲利一起改善，GC 不會只靠股價或單一指標判定景氣回溫。";
    }

    const cyclicalBasis = [];

    if (cyclicalPrice30d !== null) {
      cyclicalBasis.push(
        `近 30 日股價變化 ${cyclicalPrice30d.toFixed(1)}%`
      );
    }

    if (summaryAvailable(cyclicalInstitutional.percentile_20d)) {
      cyclicalBasis.push(
        `法人近 20 日買賣位於自身歷史第 ${Number(cyclicalInstitutional.percentile_20d).toFixed(1)} 百分位`
      );
    }

    cyclicalBasis.push(
      `營收年度比較 ${Number(cyclicalRevenue.yoy_sample_count || 0)} 次`
    );

    summaryBasis =
      `比較資料：${cyclicalBasis.join("｜")}`;
  } else if (summaryProfileId === "high_volatility_event") {
    const eventHistoricalCategories =
      report.historical_context?.categories || {};

    const eventHistoricalRevenue =
      eventHistoricalCategories.revenue || {};

    const eventHistoricalFinancial =
      eventHistoricalCategories.financial || {};

    const eventRevenueGrowth =
      summaryAvailable(eventHistoricalRevenue.year_over_year_pct)
        ? Number(eventHistoricalRevenue.year_over_year_pct)
        : null;

    const eventIncomeChange =
      summaryAvailable(eventHistoricalFinancial.income_change_yoy_pct)
        ? Number(eventHistoricalFinancial.income_change_yoy_pct)
        : null;

    const confirmedEventCount =
      Number(summaryMetrics.confirmed_company_event_count || 0);

    const eventRevenueMonths =
      Number(eventHistoricalRevenue.sample_count || 0);

    const eventRevenueComparisons =
      Number(eventHistoricalRevenue.yoy_sample_count || 0);

    const eventFinancialQuarters =
      Number(eventHistoricalFinancial.quarter_sample_count || 0);

    if (
      eventRevenueGrowth !== null &&
      eventIncomeChange !== null
    ) {
      if (
        eventRevenueGrowth > 0 &&
        eventIncomeChange > 0
      ) {
        summaryTitle =
          confirmedEventCount > 0
            ? "重要事件出現後，收入與獲利都在改善"
            : "收入與獲利都在改善，目前沒有新的重大事件";

        summaryCopy =
          `最新一個月收入比去年同期增加 ${eventRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利也增加 ${eventIncomeChange.toFixed(1)}%。` +
          (
            confirmedEventCount > 0
              ? `目前另有 ${confirmedEventCount} 項重要公司事件需要持續追蹤。`
              : "目前的改善主要來自實際營運資料，不是單一消息。"
          );
      } else if (
        eventRevenueGrowth > 0 &&
        eventIncomeChange <= 0
      ) {
        summaryTitle =
          "收入增加，但獲利尚未同步改善";

        summaryCopy =
          `最新一個月收入增加 ${eventRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利變化 ${eventIncomeChange >= 0 ? "+" : ""}${eventIncomeChange.toFixed(1)}%。` +
          (
            confirmedEventCount > 0
              ? `目前有 ${confirmedEventCount} 項重要事件，但尚未看到獲利同步改善。`
              : "目前沒有新的重大事件足以改變這項營運判斷。"
          );
      } else if (
        eventRevenueGrowth <= 0 &&
        eventIncomeChange > 0
      ) {
        summaryTitle =
          "獲利改善，但收入尚未回升";

        summaryCopy =
          `最近四季獲利增加 ${eventIncomeChange.toFixed(1)}%，` +
          `但最新一個月收入變化 ${eventRevenueGrowth >= 0 ? "+" : ""}${eventRevenueGrowth.toFixed(1)}%。`;
      } else {
        summaryTitle =
          confirmedEventCount > 0
            ? "重要事件尚未帶動收入與獲利改善"
            : "目前沒有重大事件，收入與獲利也尚未改善";

        summaryCopy =
          `最新一個月收入變化 ${eventRevenueGrowth >= 0 ? "+" : ""}${eventRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利變化 ${eventIncomeChange >= 0 ? "+" : ""}${eventIncomeChange.toFixed(1)}%。` +
          "GC 不會只靠股價或消息判定公司的營運已經轉好。";
      }
    } else {
      summaryTitle =
        confirmedEventCount > 0
          ? "有重要公司事件，但營運影響尚未形成完整比較"
          : "目前沒有新的重大事件";

      summaryCopy =
        "收入年度比較或最近四季獲利仍有一項尚未形成，因此目前只描述已確認事件，不推測事件已改善營運。";
    }

    summaryBasis =
      `比較資料：${eventRevenueMonths} 個月收入歷史｜` +
      `${eventRevenueComparisons} 次年度比較｜` +
      `${eventFinancialQuarters} 季財報｜` +
      `${confirmedEventCount} 項確認公司事件`;  } else {
    summaryTitle =
      Number(report.score) >= 75
        ? "公司目前的整體狀況不錯"
        : Number(report.score) >= 55
          ? "公司目前的整體狀況還算穩定"
          : "公司目前有幾個地方需要注意";

    summaryCopy =
      "GC 已整理公司的收入、獲利、股價與重要消息，並依目前資料判斷公司的整體狀況。";

    summaryBasis =
      `判斷依據：公司財務、股價與公開消息｜綜合分數 ${Number(report.score).toFixed(1)}`;
  }

  $("researchLabel").textContent = "GC 整理後的結果";
  $("summary").textContent = summaryTitle;

  $("incomeDecision").classList.add("hidden");
  $("heldDecision").textContent = "";

  $("summaryNote").textContent = summaryCopy;

  if ($("summaryBasis")) {
    $("summaryBasis").textContent = summaryBasis;
  }

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

  renderGuidedCore(report);

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
  renderProResearch(report);
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

function renderGuidedCore(report) {
  if (!$("guidedHealth")) return;

  const clamp = (value) =>
    Math.min(100, Math.max(0, Number(value) || 0));

  const score = clamp(report.score);
  const risk = clamp(report.risk);
  const confidence = clamp(report.confidence);

  const profile = stockDecisionProfile(report);
  const profileId =
    report.stock_profile?.profile_id ||
    report.stock_profile?.id ||
    "default";

  const metrics = profile?.metrics || {};

  const historicalCategories =
    report.historical_context?.categories || {};

  const historicalPrice =
    historicalCategories.price || {};

  const historicalRevenue =
    historicalCategories.revenue || {};

  const historicalFinancial =
    historicalCategories.financial || {};
  const historicalInstitutional =
    historicalCategories.institutional || {};

  const historicalMargin =
    historicalCategories.margin || {};

  const historicalDividend =
    historicalCategories.dividend || {};

  const available = (value) =>
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value));

  const percent = (value) =>
    available(value) ? `${Number(value).toFixed(1)}%` : null;

  const number = (value, digits = 2) =>
    available(value) ? Number(value).toFixed(digits) : null;

  const history = (
    Array.isArray(report.score_history)
      ? report.score_history
      : []
  )
    .map((item) => Number(item.score))
    .filter(Number.isFinite);

  const change =
    history.length > 1
      ? history[history.length - 1] - history[0]
      : null;

  const revenueGrowth = percent(metrics.revenue_yoy_pct);
  const epsGrowth = percent(metrics.eps_growth_yoy_pct);
  const sectorRank = available(metrics.sector_rank)
    ? Number(metrics.sector_rank)
    : null;
  const sectorCount = available(metrics.sector_peer_count)
    ? Number(metrics.sector_peer_count)
    : null;
  const marketLead = number(metrics.relative_market_pct_point, 2);
  const peRatio = number(metrics.pe_ratio, 2);

  let healthTitle = "";
  let healthCopy = "";
  let healthBasis = "";

  if (profileId === "growth_quality") {
    const growthRevenueChange =
      available(historicalRevenue.year_over_year_pct)
        ? Number(historicalRevenue.year_over_year_pct)
        : null;

    const growthIncomeChange =
      available(historicalFinancial.income_change_yoy_pct)
        ? Number(historicalFinancial.income_change_yoy_pct)
        : null;

    if (
      growthRevenueChange !== null &&
      growthIncomeChange !== null
    ) {
      if (
        growthRevenueChange > 0 &&
        growthIncomeChange > 0
      ) {
        healthTitle =
          "收入與獲利都比一年前增加";

        healthCopy =
          `最新一個月收入增加 ${growthRevenueChange.toFixed(1)}%，` +
          `最近四季獲利也增加 ${growthIncomeChange.toFixed(1)}%。` +
          "兩項營運資料同時成長。";
      } else if (
        growthRevenueChange > 0 &&
        growthIncomeChange <= 0
      ) {
        healthTitle =
          "收入增加，但獲利尚未跟上";

        healthCopy =
          `最新一個月收入增加 ${growthRevenueChange.toFixed(1)}%，` +
          `但最近四季獲利減少 ${Math.abs(growthIncomeChange).toFixed(1)}%。`;
      } else if (
        growthRevenueChange <= 0 &&
        growthIncomeChange > 0
      ) {
        healthTitle =
          "獲利增加，但收入正在放慢";

        healthCopy =
          `最近四季獲利增加 ${growthIncomeChange.toFixed(1)}%，` +
          `但最新一個月收入減少 ${Math.abs(growthRevenueChange).toFixed(1)}%。`;
      } else {
        healthTitle =
          "收入與獲利都比一年前減少";

        healthCopy =
          `最新一個月收入減少 ${Math.abs(growthRevenueChange).toFixed(1)}%，` +
          `最近四季獲利也減少 ${Math.abs(growthIncomeChange).toFixed(1)}%。`;
      }
    } else {
      healthTitle =
        "成長歷史尚未形成完整比較";

      healthCopy =
        "收入年度比較或最近四季獲利仍有一項尚未形成，因此暫時不判定成長方向。";
    }

    const growthHealthFacts = [
      `${Number(historicalRevenue.sample_count || 0)} 個月收入歷史`,
      `${Number(historicalRevenue.yoy_sample_count || 0)} 次年度比較`,
      `${Number(historicalFinancial.quarter_sample_count || 0)} 季財報`,
    ];

    healthBasis =
      `比較資料：${growthHealthFacts.join("｜")}`;
  } else if (profileId === "financial_income") {
    const incomeChange =
      available(historicalFinancial.income_change_yoy_pct)
        ? Number(historicalFinancial.income_change_yoy_pct)
        : null;

    const currentRoe =
      available(historicalFinancial.roe_pct)
        ? Number(historicalFinancial.roe_pct)
        : null;

    const usualRoe =
      available(historicalFinancial.historical_roe_median_pct)
        ? Number(historicalFinancial.historical_roe_median_pct)
        : null;

    if (incomeChange !== null && incomeChange <= -5) {
      healthTitle = "最近四季獲利比一年前少";

      healthCopy =
        `最近四季合計獲利比一年前減少 ${Math.abs(incomeChange).toFixed(1)}%。` +
        (
          currentRoe !== null && usualRoe !== null
            ? `目前用股東資金賺錢的效率，也低於公司過去常見水準。`
            : ""
        );
    } else if (incomeChange !== null && incomeChange >= 5) {
      healthTitle = "最近四季獲利比一年前多";

      healthCopy =
        `最近四季合計獲利比一年前增加 ${incomeChange.toFixed(1)}%，` +
        "目前賺錢能力正在改善。";
    } else {
      healthTitle = "最近四季獲利大致穩定";

      healthCopy =
        "最近四季合計獲利和一年前接近，沒有明顯增加或減少。";
    }

    const financialFacts = [];

    if (currentRoe !== null) {
      financialFacts.push(
        `目前每 100 元股東資金約賺回 ${currentRoe.toFixed(1)} 元`
      );
    }

    if (usualRoe !== null) {
      financialFacts.push(
        `過去常見約 ${usualRoe.toFixed(1)} 元`
      );
    }

    if (available(historicalFinancial.quarter_sample_count)) {
      financialFacts.push(
        `${Number(historicalFinancial.quarter_sample_count)} 季財報`
      );
    }

    healthBasis =
      financialFacts.length
        ? `比較資料：${financialFacts.join("｜")}`
        : "比較資料：公司季度財務報告";
  } else if (profileId === "cyclical") {
    const cyclicalRevenueGrowth =
      available(historicalRevenue.year_over_year_pct)
        ? Number(historicalRevenue.year_over_year_pct)
        : null;

    const cyclicalIncomeChange =
      available(historicalFinancial.income_change_yoy_pct)
        ? Number(historicalFinancial.income_change_yoy_pct)
        : null;

    if (
      cyclicalRevenueGrowth === null ||
      cyclicalIncomeChange === null
    ) {
      healthTitle = "營運歷史尚未形成完整比較";
      healthCopy =
        "目前收入年度比較或最近四季獲利仍有一項尚未形成。" +
        "因此 GC 不會只靠股價或法人買盤判定生意回溫。";
    } else if (
      cyclicalRevenueGrowth > 0 &&
      cyclicalIncomeChange > 0
    ) {
      healthTitle = "收入與獲利一起改善";
      healthCopy =
        `最新收入比去年同期增加 ${cyclicalRevenueGrowth.toFixed(1)}%，` +
        `最近四季獲利增加 ${cyclicalIncomeChange.toFixed(1)}%。` +
        "兩項營運資料同時改善，支持營運循環正在回溫。";
    } else if (
      cyclicalRevenueGrowth > 0 &&
      cyclicalIncomeChange <= 0
    ) {
      healthTitle = "收入增加，但獲利尚未跟上";
      healthCopy =
        `最新收入比去年同期增加 ${cyclicalRevenueGrowth.toFixed(1)}%，` +
        `但最近四季獲利比一年前減少 ${Math.abs(cyclicalIncomeChange).toFixed(1)}%。` +
        "生意規模正在增加，但獲利尚未同步改善，因此還不能確認營運回溫。";
    } else if (
      cyclicalRevenueGrowth <= 0 &&
      cyclicalIncomeChange > 0
    ) {
      healthTitle = "獲利改善，但收入尚未回升";
      healthCopy =
        `最近四季獲利比一年前增加 ${cyclicalIncomeChange.toFixed(1)}%，` +
        `但最新收入比去年同期減少 ${Math.abs(cyclicalRevenueGrowth).toFixed(1)}%。` +
        "獲利已有改善，但生意規模尚未一起回升。";
    } else {
      healthTitle = "收入與獲利都還沒有回升";
      healthCopy =
        `最新收入比去年同期減少 ${Math.abs(cyclicalRevenueGrowth).toFixed(1)}%，` +
        `最近四季獲利比一年前減少 ${Math.abs(cyclicalIncomeChange).toFixed(1)}%。` +
        "兩項營運資料都尚未支持景氣回溫。";
    }

    const cyclicalHealthFacts = [
      `${Number(historicalRevenue.sample_count || 0)} 個月收入歷史資料`,
      `${Number(historicalRevenue.yoy_sample_count || 0)} 次年度比較`,
    ];

    if (available(historicalFinancial.quarter_sample_count)) {
      cyclicalHealthFacts.push(
        `${Number(historicalFinancial.quarter_sample_count)} 季財報資料`
      );
    } else {
      cyclicalHealthFacts.push("財報歷史尚未形成比較");
    }

    healthBasis =
      `比較資料：${cyclicalHealthFacts.join("｜")}`;
  } else if (profileId === "high_volatility_event") {
    const eventRevenueGrowth =
      available(historicalRevenue.year_over_year_pct)
        ? Number(historicalRevenue.year_over_year_pct)
        : null;

    const eventIncomeChange =
      available(historicalFinancial.income_change_yoy_pct)
        ? Number(historicalFinancial.income_change_yoy_pct)
        : null;

    const confirmedEventCount =
      Number(metrics.confirmed_company_event_count || 0);

    if (
      eventRevenueGrowth !== null &&
      eventIncomeChange !== null
    ) {
      if (
        eventRevenueGrowth > 0 &&
        eventIncomeChange > 0
      ) {
        healthTitle =
          "收入與獲利都比一年前增加";

        healthCopy =
          `最新一個月收入增加 ${eventRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利也增加 ${eventIncomeChange.toFixed(1)}%。` +
          "這項改善有實際營運資料支持，不只來自股價或消息。";
      } else if (
        eventRevenueGrowth > 0 &&
        eventIncomeChange <= 0
      ) {
        healthTitle =
          "收入增加，但獲利尚未跟上";

        healthCopy =
          `最新一個月收入增加 ${eventRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利變化 ${eventIncomeChange >= 0 ? "+" : ""}${eventIncomeChange.toFixed(1)}%。`;
      } else if (
        eventRevenueGrowth <= 0 &&
        eventIncomeChange > 0
      ) {
        healthTitle =
          "獲利增加，但收入尚未回升";

        healthCopy =
          `最近四季獲利增加 ${eventIncomeChange.toFixed(1)}%，` +
          `最新一個月收入變化 ${eventRevenueGrowth >= 0 ? "+" : ""}${eventRevenueGrowth.toFixed(1)}%。`;
      } else {
        healthTitle =
          "收入與獲利都尚未改善";

        healthCopy =
          `最新一個月收入變化 ${eventRevenueGrowth >= 0 ? "+" : ""}${eventRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利變化 ${eventIncomeChange >= 0 ? "+" : ""}${eventIncomeChange.toFixed(1)}%。`;
      }

      if (confirmedEventCount > 0) {
        healthCopy +=
          ` 目前另有 ${confirmedEventCount} 項重要公司事件需要追蹤，` +
          "但事件本身不能取代營運證據。";
      } else {
        healthCopy +=
          " 目前沒有新的重大公司事件改變這項判斷。";
      }
    } else {
      healthTitle =
        confirmedEventCount > 0
          ? "重要事件的營運影響尚未形成完整比較"
          : "目前沒有新的重大公司事件";

      healthCopy =
        "GC 只呈現已確認的公司事件；收入或獲利比較尚未形成時，不推測事件已經改變營運。";
    }

    healthBasis =
      `比較資料：${Number(historicalRevenue.sample_count || 0)} 個月收入歷史｜` +
      `${Number(historicalRevenue.yoy_sample_count || 0)} 次年度比較｜` +
      `${Number(historicalFinancial.quarter_sample_count || 0)} 季財報｜` +
      `${confirmedEventCount} 項確認公司事件`;
  } else {
    healthTitle =
      score >= 75
        ? "公司目前的狀況不錯"
        : score >= 55
          ? "公司目前的狀況還算穩定"
          : "公司目前有幾個地方需要注意";

    healthCopy =
      score >= 75
        ? "目前多數資料沒有出現明顯轉弱。"
        : score >= 55
          ? "目前有些表現不錯，也有部分狀況需要留意。"
          : "目前較弱的地方比較多，整體狀況不像之前穩定。";

    healthBasis =
      `比較資料：收入、獲利、股價與公司消息｜綜合分數 ${score.toFixed(1)}`;
  }

  if (change != null && Math.abs(change) >= 1) {
    healthCopy +=
      change > 0
        ? " 和前一段時間相比，整體表現正在變好。"
        : " 和前一段時間相比，整體表現有些轉弱。";

    healthBasis +=
      `｜近期變化 ${change > 0 ? "+" : ""}${change.toFixed(1)} 分`;
  }

  if (
    profileId === "growth_quality" &&
    historicalRevenue.status === "available" &&
    available(historicalRevenue.year_over_year_pct)
  ) {
    const latestRevenueGrowth =
      Number(historicalRevenue.year_over_year_pct);

    const usualRevenueGrowth =
      available(historicalRevenue.historical_yoy_median_pct)
        ? Number(historicalRevenue.historical_yoy_median_pct)
        : null;

    if (usualRevenueGrowth !== null) {
      if (latestRevenueGrowth > usualRevenueGrowth + 5) {
        healthCopy +=
          ` 目前收入成長速度也明顯高於過去常見的 ${usualRevenueGrowth.toFixed(1)}%。`;
      } else if (
        latestRevenueGrowth >= usualRevenueGrowth - 5
      ) {
        healthCopy +=
          ` 目前收入變化接近過去常見的 ${usualRevenueGrowth.toFixed(1)}%。`;
      } else {
        healthCopy +=
          ` 目前收入變化低於過去常見的 ${usualRevenueGrowth.toFixed(1)}%。`;
      }

      healthBasis +=
        `｜過去收入典型增幅 ${usualRevenueGrowth.toFixed(1)}%`;
    }
  }
  $("guidedHealthTone").textContent = "公司最近表現";
  $("guidedHealth").textContent = healthTitle;
  $("guidedHealthCopy").textContent = healthCopy;
  $("guidedHealthScore").textContent = healthBasis;

  let riskTitle = "";
  let riskCopy = "";
  const riskFacts = [];

  if (
    sectorRank !== null &&
    sectorCount !== null &&
    sectorCount > 0 &&
    sectorRank <= Math.ceil(sectorCount / 2)
  ) {
    riskTitle = "最近股價表現比較強";
    riskCopy =
      "最近的股價比大盤和不少同類公司漲得更快。股價漲得快不代表公司突然變得更會賺錢，GC 會繼續比較兩者的變化。";

    riskFacts.push(`近 20 日同組第 ${sectorRank}/${sectorCount} 名`);

    if (marketLead !== null) {
      riskFacts.push(`比大盤多漲 ${marketLead} 個百分點`);
    }
  } else if (risk >= 65) {
    riskTitle = "目前有幾個明顯風險";
    riskCopy =
      "最近同時出現多項不利變化，短期內股價更容易出現較大的起伏。";
  } else if (risk >= 40) {
    riskTitle = "目前有幾個地方需要小心";
    riskCopy =
      "現在有一些不利因素，但還沒有看到公司的整體狀況全面轉差。";
  } else {
    riskTitle = "目前沒有特別突出的風險";
    riskCopy =
      "現有資料沒有顯示風險明顯升高，但 GC 仍會持續檢查新的公司與市場變化。";
  }


  riskFacts.push(`風險程度 ${Math.round(risk)}/100`);

  const price90d =
    available(historicalPrice.changes?.["90d_pct"])
      ? Number(historicalPrice.changes["90d_pct"])
      : null;

  const institutional20d =
    available(
      historicalInstitutional.windows?.["20d_net_buy"]
    )
      ? Number(
          historicalInstitutional.windows["20d_net_buy"]
        )
      : null;

  const institutionalPercentile =
    available(historicalInstitutional.percentile_20d)
      ? Number(historicalInstitutional.percentile_20d)
      : null;

  const margin20d =
    available(historicalMargin.changes?.["20d_pct"])
      ? Number(historicalMargin.changes["20d_pct"])
      : null;

  const guidedDividendYears =
    available(historicalDividend.consecutive_dividend_years)
      ? Number(historicalDividend.consecutive_dividend_years)
      : null;

  const guidedLatestCashDividend =
    available(historicalDividend.latest_cash_dividend)
      ? Number(historicalDividend.latest_cash_dividend)
      : null;

  const guidedFiveYearDividendAverage =
    available(historicalDividend.average_cash_dividend_5y)
      ? Number(historicalDividend.average_cash_dividend_5y)
      : null;

  const guidedDividendFreshness =
    String(historicalDividend.dividend_freshness || "");

  const guidedDividendType =
    String(historicalDividend.latest_dividend_type || "");

  const guidedLatestDividendYear =
    available(historicalDividend.latest_dividend_year)
      ? Number(historicalDividend.latest_dividend_year)
      : null;

  const guidedLatestStockDividend =
    available(historicalDividend.latest_stock_dividend)
      ? Number(historicalDividend.latest_stock_dividend)
      : null;

  if (
    price90d !== null &&
    price90d > 10 &&
    institutional20d !== null &&
    institutional20d < 0
  ) {
    riskTitle =
      "股價漲得快，法人沒有跟著買";

    riskCopy =
      `近 90 個交易日股價上漲 ${price90d.toFixed(1)}%，` +
      "但法人近一個月略偏向賣出。";

    if (
      institutionalPercentile !== null &&
      institutionalPercentile >= 35 &&
      institutionalPercentile <= 65
    ) {
      riskCopy +=
        " 這個程度仍接近過去常態。";
    }
  } else if (price90d !== null) {
    riskFacts.push(
      `近 90 個交易日股價` +
      `${price90d >= 0 ? "上漲" : "下跌"} ` +
      `${Math.abs(price90d).toFixed(1)}%`
    );
  }

  if (institutional20d !== null) {
    riskFacts.push(
      `法人近一個月` +
      `${institutional20d >= 0 ? "買進較多" : "賣出較多"}`
    );
  }

  if (margin20d !== null) {
    riskFacts.push(
      `借錢買股票的部位近一個月` +
      `${margin20d >= 0 ? "增加" : "減少"} ` +
      `${Math.abs(margin20d).toFixed(1)}%`
    );

    if (margin20d < -10) {
      riskCopy +=
        " 借錢買股票的部位也在減少，短期追價的人比之前少。";
    }
  }

  if (profileId === "growth_quality") {
    const growthRiskRevenueChange =
      available(historicalRevenue.year_over_year_pct)
        ? Number(historicalRevenue.year_over_year_pct)
        : null;

    const growthRiskIncomeChange =
      available(historicalFinancial.income_change_yoy_pct)
        ? Number(historicalFinancial.income_change_yoy_pct)
        : null;

    const growthRiskPrice30d =
      available(historicalPrice.changes?.["30d_pct"])
        ? Number(historicalPrice.changes["30d_pct"])
        : null;

    const growthRiskPrice90d =
      available(historicalPrice.changes?.["90d_pct"])
        ? Number(historicalPrice.changes["90d_pct"])
        : null;

    const growthOperatingAvailable =
      growthRiskRevenueChange !== null &&
      growthRiskIncomeChange !== null;

    if (!growthOperatingAvailable) {
      riskTitle =
        "成長比較尚未形成完整結果";

      riskCopy =
        "收入年度比較或最近四季獲利仍有一項尚未形成，" +
        "因此目前不直接判定公司的成長方向。";
    } else if (
      growthRiskRevenueChange > 0 &&
      growthRiskIncomeChange > 0
    ) {
      if (
        growthRiskPrice30d !== null &&
        growthRiskPrice30d <= -10
      ) {
        riskTitle =
          "營運仍在成長，但近期股價明顯回檔";

        riskCopy =
          `收入比去年同期增加 ${growthRiskRevenueChange.toFixed(1)}%，` +
          `最近四季獲利增加 ${growthRiskIncomeChange.toFixed(1)}%，` +
          `但近 30 個交易日股價下跌 ${Math.abs(growthRiskPrice30d).toFixed(1)}%。`;

        if (
          growthRiskPrice90d !== null &&
          growthRiskPrice90d >= 30
        ) {
          riskCopy +=
            ` 雖然近 90 個交易日仍上漲 ${growthRiskPrice90d.toFixed(1)}%，` +
            "但近期價格已開始回落。";
        }

        riskCopy +=
          "營運與短期市場方向不同，仍要確認回檔是否只是價格修正。";
      } else if (
        growthRiskPrice30d !== null &&
        growthRiskPrice30d >= 15
      ) {
        riskTitle =
          "營運正在成長，但股價也漲得很快";

        riskCopy =
          `收入比去年同期增加 ${growthRiskRevenueChange.toFixed(1)}%，` +
          `最近四季獲利增加 ${growthRiskIncomeChange.toFixed(1)}%，` +
          `近 30 個交易日股價上漲 ${growthRiskPrice30d.toFixed(1)}%。` +
          "目前股價與營運方向一致，但短期漲幅可能已反映部分成長期待。";
      } else if (
        growthRiskPrice90d !== null &&
        growthRiskPrice90d >= 50
      ) {
        riskTitle =
          "營運仍在成長，但中期股價漲幅已大";

        riskCopy =
          `收入比去年同期增加 ${growthRiskRevenueChange.toFixed(1)}%，` +
          `最近四季獲利增加 ${growthRiskIncomeChange.toFixed(1)}%，` +
          `近 90 個交易日股價上漲 ${growthRiskPrice90d.toFixed(1)}%。` +
          "成長有營運資料支持，但仍要確認後續獲利能否跟上市場期待。";
      } else {
        riskTitle =
          "營運仍在成長，主要風險是成長能否延續";

        riskCopy =
          `收入比去年同期增加 ${growthRiskRevenueChange.toFixed(1)}%，` +
          `最近四季獲利增加 ${growthRiskIncomeChange.toFixed(1)}%。`;

        if (growthRiskPrice30d !== null) {
          riskCopy +=
            ` 近 30 個交易日股價` +
            `${growthRiskPrice30d >= 0 ? "上漲" : "下跌"} ` +
            `${Math.abs(growthRiskPrice30d).toFixed(1)}%。`;
        }

        riskCopy +=
          "目前沒有明顯的價格先行問題，後續要確認收入與獲利是否持續成長。";
      }
    } else if (
      growthRiskRevenueChange > 0 &&
      growthRiskIncomeChange <= 0
    ) {
      riskTitle =
        growthRiskPrice30d !== null &&
        growthRiskPrice30d >= 10
          ? "股價正在上漲，但獲利尚未跟上"
          : "收入增加，但獲利正在減少";

      riskCopy =
        `收入比去年同期增加 ${growthRiskRevenueChange.toFixed(1)}%，` +
        `但最近四季獲利減少 ${Math.abs(growthRiskIncomeChange).toFixed(1)}%。`;

      if (growthRiskPrice30d !== null) {
        riskCopy +=
          ` 近 30 個交易日股價` +
          `${growthRiskPrice30d >= 0 ? "上漲" : "下跌"} ` +
          `${Math.abs(growthRiskPrice30d).toFixed(1)}%。`;
      }

      riskCopy +=
        "目前收入規模成長，但還不能確認成長已經轉化成更多獲利。";
    } else if (
      growthRiskRevenueChange <= 0 &&
      growthRiskIncomeChange > 0
    ) {
      riskTitle =
        "獲利增加，但收入成長已經轉弱";

      riskCopy =
        `最近四季獲利增加 ${growthRiskIncomeChange.toFixed(1)}%，` +
        `但收入比去年同期減少 ${Math.abs(growthRiskRevenueChange).toFixed(1)}%。` +
        "獲利可能受到成本或比較基期影響，仍要確認收入能否重新成長。";
    } else {
      riskTitle =
        "收入與獲利都在減少";

      riskCopy =
        `收入比去年同期減少 ${Math.abs(growthRiskRevenueChange).toFixed(1)}%，` +
        `最近四季獲利減少 ${Math.abs(growthRiskIncomeChange).toFixed(1)}%。`;

      if (
        growthRiskPrice90d !== null &&
        growthRiskPrice90d >= 30
      ) {
        riskCopy +=
          ` 但近 90 個交易日股價仍上漲 ${growthRiskPrice90d.toFixed(1)}%，` +
          "目前價格方向與營運變化不一致。";
      } else if (growthRiskPrice30d !== null) {
        riskCopy +=
          ` 近 30 個交易日股價` +
          `${growthRiskPrice30d >= 0 ? "上漲" : "下跌"} ` +
          `${Math.abs(growthRiskPrice30d).toFixed(1)}%。`;
      }

      riskCopy +=
        "目前營運資料尚未支持成長仍在延續。";
    }

    if (
      institutional20d !== null &&
      institutional20d < 0
    ) {
      riskCopy +=
        " 法人近一個月賣出多於買進，短期市場資金也偏弱。";
    } else if (
      institutional20d !== null &&
      institutional20d > 0
    ) {
      riskCopy +=
        " 法人近一個月買進多於賣出，但市場買盤不能取代獲利成長。";
    }

    if (
      margin20d !== null &&
      margin20d >= 20
    ) {
      riskCopy +=
        ` 借錢買股票的部位增加 ${margin20d.toFixed(1)}%，` +
        "需要留意短期追價壓力。";
    }

    if (growthRiskPrice30d !== null) {
      riskFacts.push(
        `近 30 日股價 ` +
        `${growthRiskPrice30d >= 0 ? "+" : ""}` +
        `${growthRiskPrice30d.toFixed(1)}%`
      );
    }

    if (growthRiskRevenueChange !== null) {
      riskFacts.push(
        `收入年變化 ` +
        `${growthRiskRevenueChange >= 0 ? "+" : ""}` +
        `${growthRiskRevenueChange.toFixed(1)}%`
      );
    }

    if (growthRiskIncomeChange !== null) {
      riskFacts.push(
        `最近四季獲利 ` +
        `${growthRiskIncomeChange >= 0 ? "+" : ""}` +
        `${growthRiskIncomeChange.toFixed(1)}%`
      );
    }
  }
  if (profileId === "high_volatility_event") {
    const eventVolatility20d =
      available(historicalPrice.volatility_20d_pct)
        ? Number(historicalPrice.volatility_20d_pct)
        : (
            available(metrics.volatility_20d_pct)
              ? Number(metrics.volatility_20d_pct)
              : null
          );

    const eventAtr14 =
      available(metrics.atr_14_pct)
        ? Number(metrics.atr_14_pct)
        : null;

    const eventPrice30d =
      available(historicalPrice.changes?.["30d_pct"])
        ? Number(historicalPrice.changes["30d_pct"])
        : null;

    const eventPrice90d =
      available(historicalPrice.changes?.["90d_pct"])
        ? Number(historicalPrice.changes["90d_pct"])
        : null;

    const eventPriceChange =
      eventPrice30d !== null
        ? eventPrice30d
        : eventPrice90d;

    const eventPriceWindow =
      eventPrice30d !== null
        ? "近 30 個交易日"
        : "近 90 個交易日";

    const confirmedEventCount =
      Number(metrics.confirmed_company_event_count || 0);

    if (
      eventVolatility20d !== null &&
      eventVolatility20d >= 50
    ) {
      riskTitle =
        eventPriceChange !== null &&
        eventPriceChange >= 10
          ? "股價上漲很快，也可能快速回吐"
          : eventPriceChange !== null &&
              eventPriceChange <= -10
            ? "股價起伏很大，近期跌幅也較明顯"
            : "股價起伏很大，短期可能快速反轉";

      riskCopy =
        `依最近 20 個交易日價格換算，股價波動程度約 ${eventVolatility20d.toFixed(1)}%。`;

      if (eventPriceChange !== null) {
        riskCopy +=
          ` ${eventPriceWindow}股價` +
          `${eventPriceChange >= 0 ? "上漲" : "下跌"} ` +
          `${Math.abs(eventPriceChange).toFixed(1)}%。`;
      }

      riskCopy +=
        "即使營運方向判斷正確，短期價格仍可能出現明顯反向變化。";
    } else if (
      eventVolatility20d !== null &&
      eventVolatility20d >= 35
    ) {
      riskTitle =
        "股價起伏偏大，仍要留意短期反轉";

      riskCopy =
        `最近 20 個交易日的波動程度約 ${eventVolatility20d.toFixed(1)}%。`;

      if (eventPriceChange !== null) {
        riskCopy +=
          ` ${eventPriceWindow}股價` +
          `${eventPriceChange >= 0 ? "上漲" : "下跌"} ` +
          `${Math.abs(eventPriceChange).toFixed(1)}%。`;
      }

      riskCopy +=
        "價格變化仍可能快於公司的營運變化。";
    } else if (
      eventPriceChange !== null &&
      Math.abs(eventPriceChange) >= 10
    ) {
      riskTitle =
        eventPriceChange >= 0
          ? "近期股價上漲較快"
          : "近期股價下跌較多";

      riskCopy =
        `${eventPriceWindow}股價` +
        `${eventPriceChange >= 0 ? "上漲" : "下跌"} ` +
        `${Math.abs(eventPriceChange).toFixed(1)}%。` +
        "這是市場價格變化，不代表公司的營運已經同步改變。";
    } else if (
      institutional20d !== null &&
      institutional20d < 0 &&
      margin20d !== null &&
      margin20d > 0
    ) {
      riskTitle =
        "法人偏向賣出，融資部位卻在增加";

      riskCopy =
        "法人近一個月賣出多於買進，" +
        `但借錢買股票的部位增加 ${Math.abs(margin20d).toFixed(1)}%。` +
        "市場資金方向不一致，需要留意短期承接力道。";
    } else {
      riskTitle =
        "目前價格沒有出現明顯的極端變化";

      riskCopy =
        eventVolatility20d !== null
          ? `最近 20 個交易日的波動程度約 ${eventVolatility20d.toFixed(1)}%。`
          : "目前可用的價格資料沒有顯示極端波動。";

      if (eventPriceChange !== null) {
        riskCopy +=
          ` ${eventPriceWindow}股價` +
          `${eventPriceChange >= 0 ? "上漲" : "下跌"} ` +
          `${Math.abs(eventPriceChange).toFixed(1)}%。`;
      }
    }

    if (institutional20d !== null) {
      riskCopy +=
        ` 法人近一個月` +
        `${institutional20d >= 0 ? "買進多於賣出" : "賣出多於買進"}。`;
    }

    if (margin20d !== null) {
      riskCopy +=
        ` 借錢買股票的部位近一個月` +
        `${margin20d >= 0 ? "增加" : "減少"} ` +
        `${Math.abs(margin20d).toFixed(1)}%。`;
    }

    if (confirmedEventCount === 0) {
      riskCopy +=
        "目前沒有新的重大公司事件可解釋這項價格變化。";
    } else {
      riskCopy +=
        `目前另有 ${confirmedEventCount} 項重要公司事件需要持續追蹤。`;
    }

    if (eventVolatility20d !== null) {
      riskFacts.push(
        `近 20 日波動 ${eventVolatility20d.toFixed(1)}%`
      );
    }

    if (eventPriceChange !== null) {
      riskFacts.push(
        `${eventPriceWindow.replace("個交易日", "日")}漲跌 ` +
        `${eventPriceChange >= 0 ? "+" : ""}` +
        `${eventPriceChange.toFixed(1)}%`
      );
    }
  }
  if (profileId === "financial_income") {
    const financialIncomeChange =
      available(historicalFinancial.income_change_yoy_pct)
        ? Number(historicalFinancial.income_change_yoy_pct)
        : null;

    const financialCurrentRoe =
      available(historicalFinancial.roe_pct)
        ? Number(historicalFinancial.roe_pct)
        : null;

    const financialUsualRoe =
      available(historicalFinancial.historical_roe_median_pct)
        ? Number(historicalFinancial.historical_roe_median_pct)
        : null;

    const financialRiskPrice90d =
      available(historicalPrice.changes?.["90d_pct"])
        ? Number(historicalPrice.changes["90d_pct"])
        : null;

    const dividendYield =
      available(metrics.dividend_yield_pct)
        ? Number(metrics.dividend_yield_pct)
        : null;

    const dividendRank =
      available(metrics.dividend_yield_rank)
        ? Number(metrics.dividend_yield_rank)
        : null;

    const dividendPeerCount =
      available(metrics.peer_count)
        ? Number(metrics.peer_count)
        : null;

    const lowDividendPosition =
      dividendRank !== null &&
      dividendPeerCount !== null &&
      dividendPeerCount > 0 &&
      dividendRank > Math.ceil(dividendPeerCount * 0.65);

    const guidedDividendIsCurrent =
      guidedDividendFreshness === "current";

    riskFacts.length = 0;

    if (
      financialIncomeChange !== null &&
      financialIncomeChange < -5
    ) {
      riskTitle =
        "最近四季獲利正在減少";

      riskCopy =
        `最近四季獲利比一年前少 ${Math.abs(financialIncomeChange).toFixed(1)}%。` +
        "這是目前最需要留意的變化。";

      if (lowDividendPosition) {
        riskTitle =
          "獲利正在減少，目前股息比例也偏低";

        riskCopy +=
          dividendYield !== null
            ? ` 目前殖利率約 ${dividendYield.toFixed(2)}%，` +
              `在 ${dividendPeerCount} 家同組公司中排名第 ${dividendRank}。`
            : ` 目前殖利率在 ${dividendPeerCount} 家同組公司中排名第 ${dividendRank}。`;
      }
    } else if (
      margin20d !== null &&
      margin20d >= 50
    ) {
      riskTitle =
        "融資部位快速增加，需要留意追價壓力";

      riskCopy =
        `借錢買股票的部位近一個月增加 ${margin20d.toFixed(1)}%。`;

      if (financialIncomeChange !== null) {
        riskCopy +=
          ` 同期間可比較的最近四季獲利變化為 ` +
          `${financialIncomeChange >= 0 ? "+" : ""}` +
          `${financialIncomeChange.toFixed(1)}%。`;
      }

      riskCopy +=
        "融資增加不代表公司獲利同步改善，短期價格反轉時也可能放大賣壓。";
    } else if (lowDividendPosition) {
      riskTitle =
        "目前股息比例低於多數同組公司";

      riskCopy =
        dividendYield !== null
          ? `目前殖利率約 ${dividendYield.toFixed(2)}%，` +
            `在 ${dividendPeerCount} 家同組公司中排名第 ${dividendRank}。`
          : `目前殖利率在 ${dividendPeerCount} 家同組公司中排名第 ${dividendRank}。`;

      if (financialIncomeChange !== null) {
        riskCopy +=
          ` 最近四季獲利變化為 ` +
          `${financialIncomeChange >= 0 ? "+" : ""}` +
          `${financialIncomeChange.toFixed(1)}%。`;
      }
    } else if (
      financialRiskPrice90d !== null &&
      financialRiskPrice90d >= 30
    ) {
      riskTitle =
        "獲利沒有明顯轉弱，但股價中期漲幅已大";

      riskCopy =
        `近 90 個交易日股價上漲 ${financialRiskPrice90d.toFixed(1)}%。`;

      if (financialIncomeChange !== null) {
        riskCopy +=
          ` 最近四季獲利比一年前` +
          `${financialIncomeChange >= 0 ? "增加" : "減少"} ` +
          `${Math.abs(financialIncomeChange).toFixed(1)}%。`;
      }

      riskCopy +=
        "金融股仍要一起比較獲利、股利與價格，不能只看近期漲幅。";
    } else if (
      financialCurrentRoe !== null &&
      financialUsualRoe !== null &&
      financialCurrentRoe < financialUsualRoe - 0.5
    ) {
      riskTitle =
        "目前賺錢效率低於公司過去常見水準";

      riskCopy =
        `目前每 100 元股東資金約賺回 ${financialCurrentRoe.toFixed(1)} 元，` +
        `低於過去常見的 ${financialUsualRoe.toFixed(1)} 元。` +
        "後續要確認獲利效率是否恢復。";
    } else if (financialIncomeChange !== null) {
      riskTitle =
        financialIncomeChange > 0
          ? "獲利正在改善，仍要確認能否延續"
          : "獲利大致持平，仍要觀察後續變化";

      riskCopy =
        `最近四季獲利比一年前` +
        `${financialIncomeChange >= 0 ? "增加" : "減少"} ` +
        `${Math.abs(financialIncomeChange).toFixed(1)}%。`;

      if (
        financialCurrentRoe !== null &&
        financialUsualRoe !== null
      ) {
        riskCopy +=
          ` 目前每 100 元股東資金約賺回 ${financialCurrentRoe.toFixed(1)} 元，` +
          `過去常見約 ${financialUsualRoe.toFixed(1)} 元。`;
      }

      riskCopy +=
        "金融股的獲利與股利可能隨景氣和利率環境改變，仍要確認下一期表現。";
    } else {
      riskTitle =
        "金融獲利比較尚未形成完整結果";

      riskCopy =
        "最近四季獲利比較尚未形成，因此目前不直接判定獲利方向。";
    }

    if (
      guidedDividendIsCurrent &&
      guidedDividendYears !== null
    ) {
      if (
        financialIncomeChange !== null &&
        financialIncomeChange < -5
      ) {
        riskTitle =
          `獲利正在減少，但已連續 ${guidedDividendYears} 個年度發放股利`;

        riskCopy +=
          ` 公司已連續 ${guidedDividendYears} 個年度發放股利，` +
          "過去股利紀錄提供一些支撐，但不能抵銷目前獲利轉弱。";
      }

      riskFacts.push(
        `${guidedDividendYears} 個連續股利年度`
      );

      if (
        guidedLatestCashDividend !== null &&
        (
          guidedDividendType === "cash" ||
          guidedDividendType === "cash_and_stock"
        )
      ) {
        riskFacts.push(
          `最新現金股利 ${guidedLatestCashDividend.toFixed(2)} 元`
        );
      }

      if (
        guidedLatestStockDividend !== null &&
        (
          guidedDividendType === "stock" ||
          guidedDividendType === "cash_and_stock"
        )
      ) {
        riskFacts.push(
          `最新股票股利 ${guidedLatestStockDividend.toFixed(2)} 股`
        );
      }

      if (
        guidedLatestCashDividend !== null &&
        guidedFiveYearDividendAverage !== null &&
        guidedDividendType !== "stock"
      ) {
        riskFacts.push(
          `近 5 年平均現金股利 ${guidedFiveYearDividendAverage.toFixed(2)} 元`
        );
      }
    } else if (guidedLatestDividendYear !== null) {
      riskFacts.push(
        `股利資料可驗證至 ${guidedLatestDividendYear} 年`
      );

      riskCopy +=
        " 股利歷史已有資料，但最新年度尚未接續，" +
        "因此不把過去紀錄直接視為目前配息仍穩定。";
    }

    if (financialIncomeChange !== null) {
      riskFacts.unshift(
        `最近四季獲利 ` +
        `${financialIncomeChange >= 0 ? "+" : ""}` +
        `${financialIncomeChange.toFixed(1)}%`
      );
    }

    if (
      dividendRank !== null &&
      dividendPeerCount !== null
    ) {
      riskFacts.push(
        `殖利率同組第 ${dividendRank}/${dividendPeerCount}`
      );
    }

    if (financialRiskPrice90d !== null) {
      riskFacts.push(
        `近 90 日股價 ` +
        `${financialRiskPrice90d >= 0 ? "+" : ""}` +
        `${financialRiskPrice90d.toFixed(1)}%`
      );
    }

    riskFacts.push(
      `風險程度 ${Math.round(risk)}/100`
    );
  }
  if (profileId === "cyclical") {
    const cyclicalRiskRevenueGrowth =
      available(historicalRevenue.year_over_year_pct)
        ? Number(historicalRevenue.year_over_year_pct)
        : null;

    const cyclicalRiskIncomeChange =
      available(historicalFinancial.income_change_yoy_pct)
        ? Number(historicalFinancial.income_change_yoy_pct)
        : null;

    const cyclicalPrice30d =
      available(historicalPrice.changes?.["30d_pct"])
        ? Number(historicalPrice.changes["30d_pct"])
        : null;

    const cyclicalOperatingAvailable =
      cyclicalRiskRevenueGrowth !== null &&
      cyclicalRiskIncomeChange !== null;

    if (!cyclicalOperatingAvailable) {
      riskTitle =
        "營運比較尚未形成完整結果";

      riskCopy =
        "收入年度比較或最近四季獲利仍有一項尚未形成，" +
        "因此目前不直接判定景氣方向。";

      if (cyclicalPrice30d !== null) {
        riskCopy +=
          ` 近 30 個交易日股價` +
          `${cyclicalPrice30d >= 0 ? "上漲" : "下跌"} ` +
          `${Math.abs(cyclicalPrice30d).toFixed(1)}%，` +
          "但價格變化不能取代營運比較。";
      }
    } else if (
      cyclicalRiskRevenueGrowth > 0 &&
      cyclicalRiskIncomeChange > 0
    ) {
      if (
        cyclicalPrice30d !== null &&
        cyclicalPrice30d >= 10
      ) {
        riskTitle =
          "營運正在改善，但要留意股價漲得太快";

        riskCopy =
          `收入比去年同期增加 ${cyclicalRiskRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利增加 ${cyclicalRiskIncomeChange.toFixed(1)}%，` +
          `近 30 個交易日股價也上漲 ${cyclicalPrice30d.toFixed(1)}%。` +
          "市場與營運方向一致，但短期漲幅可能已反映部分改善。";
      } else if (
        cyclicalPrice30d !== null &&
        cyclicalPrice30d <= -10
      ) {
        riskTitle =
          "營運正在改善，但市場價格仍在走弱";

        riskCopy =
          `收入比去年同期增加 ${cyclicalRiskRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利增加 ${cyclicalRiskIncomeChange.toFixed(1)}%，` +
          `但近 30 個交易日股價下跌 ${Math.abs(cyclicalPrice30d).toFixed(1)}%。` +
          "營運與市場方向不同，仍要確認是否有其他風險尚未反映在財報中。";
      } else {
        riskTitle =
          "營運正在改善，仍要確認改善能否延續";

        riskCopy =
          `收入比去年同期增加 ${cyclicalRiskRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利增加 ${cyclicalRiskIncomeChange.toFixed(1)}%。`;

        if (cyclicalPrice30d !== null) {
          riskCopy +=
            ` 近 30 個交易日股價` +
            `${cyclicalPrice30d >= 0 ? "上漲" : "下跌"} ` +
            `${Math.abs(cyclicalPrice30d).toFixed(1)}%。`;
        }

        riskCopy +=
          "景氣型公司的獲利變化可能較大，後續仍要確認下一期收入與獲利是否延續。";
      }
    } else if (
      cyclicalRiskRevenueGrowth > 0 &&
      cyclicalRiskIncomeChange <= 0
    ) {
      riskTitle =
        cyclicalPrice30d !== null &&
        cyclicalPrice30d >= 10
          ? "股價已經先漲，但獲利尚未跟上"
          : "收入增加，但獲利仍在減少";

      riskCopy =
        `收入比去年同期增加 ${cyclicalRiskRevenueGrowth.toFixed(1)}%，` +
        `但最近四季獲利減少 ${Math.abs(cyclicalRiskIncomeChange).toFixed(1)}%。`;

      if (cyclicalPrice30d !== null) {
        riskCopy +=
          ` 近 30 個交易日股價` +
          `${cyclicalPrice30d >= 0 ? "上漲" : "下跌"} ` +
          `${Math.abs(cyclicalPrice30d).toFixed(1)}%。`;
      }

      riskCopy +=
        "營收規模雖然增加，但目前還不能確認獲利循環已經回升。";
    } else if (
      cyclicalRiskRevenueGrowth <= 0 &&
      cyclicalRiskIncomeChange > 0
    ) {
      riskTitle =
        "獲利增加，但收入尚未明顯回升";

      riskCopy =
        `最近四季獲利增加 ${cyclicalRiskIncomeChange.toFixed(1)}%，` +
        `但收入比去年同期減少 ${Math.abs(cyclicalRiskRevenueGrowth).toFixed(1)}%。`;

      if (cyclicalPrice30d !== null) {
        riskCopy +=
          ` 近 30 個交易日股價` +
          `${cyclicalPrice30d >= 0 ? "上漲" : "下跌"} ` +
          `${Math.abs(cyclicalPrice30d).toFixed(1)}%。`;
      }

      riskCopy +=
        "獲利改善可能受到成本、業外或比較基期影響，仍要等待收入同步回升。";
    } else {
      riskTitle =
        "收入與獲利都還沒有回升";

      riskCopy =
        `收入比去年同期減少 ${Math.abs(cyclicalRiskRevenueGrowth).toFixed(1)}%，` +
        `最近四季獲利減少 ${Math.abs(cyclicalRiskIncomeChange).toFixed(1)}%。`;

      if (cyclicalPrice30d !== null) {
        riskCopy +=
          ` 近 30 個交易日股價` +
          `${cyclicalPrice30d >= 0 ? "上漲" : "下跌"} ` +
          `${Math.abs(cyclicalPrice30d).toFixed(1)}%。`;
      }

      riskCopy +=
        "目前營運資料尚未支持景氣循環回升。";
    }

    if (
      institutional20d !== null &&
      institutional20d > 0
    ) {
      riskCopy +=
        " 法人近一個月買進多於賣出，但市場買盤不能取代營運改善。";
    } else if (
      institutional20d !== null &&
      institutional20d < 0
    ) {
      riskCopy +=
        " 法人近一個月賣出多於買進，市場資金方向也偏弱。";
    }

    if (
      margin20d !== null &&
      margin20d >= 20
    ) {
      riskCopy +=
        ` 借錢買股票的部位增加 ${margin20d.toFixed(1)}%，` +
        "需要留意短期追價壓力。";
    }

    if (cyclicalPrice30d !== null) {
      riskFacts.push(
        `近 30 日股價 ` +
        `${cyclicalPrice30d >= 0 ? "+" : ""}` +
        `${cyclicalPrice30d.toFixed(1)}%`
      );
    }

    if (cyclicalRiskRevenueGrowth !== null) {
      riskFacts.push(
        `收入年變化 ` +
        `${cyclicalRiskRevenueGrowth >= 0 ? "+" : ""}` +
        `${cyclicalRiskRevenueGrowth.toFixed(1)}%`
      );
    }

    if (cyclicalRiskIncomeChange !== null) {
      riskFacts.push(
        `最近四季獲利 ` +
        `${cyclicalRiskIncomeChange >= 0 ? "+" : ""}` +
        `${cyclicalRiskIncomeChange.toFixed(1)}%`
      );
    }
  }
  $("riskTone").textContent = "現在要小心什麼";
  $("risk").textContent = riskTitle;
  $("guidedRiskCopy").textContent = riskCopy;
  $("guidedRiskScore").textContent =
    `比較資料：${riskFacts.join("｜")}`;

  const valuation =
    report.investment_research?.valuation || {};

  const valuationText =
    `${valuation.headline_zh || ""} ${valuation.interpretation_zh || ""}`;

  const valuationPeRatio =
    available(metrics.pe_ratio)
      ? Number(metrics.pe_ratio)
      : null;

  const pbRatio =
    available(metrics.pb_ratio)
      ? Number(metrics.pb_ratio)
      : null;

  const peerCount =
    available(metrics.peer_count)
      ? Number(metrics.peer_count)
      : null;

  const valuationRanks = [
    metrics.pe_rank,
    metrics.pb_rank,
  ]
    .filter(available)
    .map(Number);

  const averageValuationRank =
    valuationRanks.length
      ? valuationRanks.reduce((sum, value) => sum + value, 0) /
        valuationRanks.length
      : null;

  const relativeValuationPosition =
    averageValuationRank !== null &&
    peerCount &&
    peerCount > 0
      ? averageValuationRank / peerCount
      : null;

  let valuationTitle = "";
  let valuationCopy = "";
  let valuationBasis = "";

  if (
    profileId === "growth_quality" &&
    valuationPeRatio !== null &&
    peerCount
  ) {
    if (relativeValuationPosition >= 0.65) {
      valuationTitle =
        "同組公司中，目前價格偏高";

      valuationCopy =
        "用公司賺到的錢與擁有的資產比較，目前價格高於多數同組公司。這代表市場期待較高，不代表股價一定會下跌。";
    } else if (relativeValuationPosition <= 0.35) {
      valuationTitle =
        "同組公司中，目前價格偏低";

      valuationCopy =
        "用公司賺到的錢與擁有的資產比較，目前價格低於多數同組公司，但仍要一起看公司的經營狀況。";
    } else {
      valuationTitle =
        "同組公司中，目前價格接近中間";

      valuationCopy =
        "用公司賺到的錢與擁有的資產比較，目前價格接近多數同組公司的中間位置。";
    }

    const valuationFacts = [];

    valuationFacts.push(
      `股價約為每股獲利的 ${valuationPeRatio.toFixed(2)} 倍`
    );

    if (available(metrics.pe_rank)) {
      valuationFacts.push(
        `這項比較同組第 ${Number(metrics.pe_rank)}/${peerCount} 名`
      );
    }

    if (pbRatio !== null) {
      valuationFacts.push(
        `股價約為每股公司資產的 ${pbRatio.toFixed(2)} 倍`
      );
    }

    if (available(metrics.pb_rank)) {
      valuationFacts.push(
        `這項比較同組第 ${Number(metrics.pb_rank)}/${peerCount} 名`
      );
    }

    valuationBasis =
      `比較資料：${valuationFacts.join("｜")}`;
  } else if (
    profileId === "financial_income" &&
    valuation.status === "available"
  ) {
    const financialPeRank =
      available(metrics.pe_rank)
        ? Number(metrics.pe_rank)
        : null;

    const financialPbRank =
      available(metrics.pb_rank)
        ? Number(metrics.pb_rank)
        : null;

    if (valuation.position === "high") {
      valuationTitle =
        "目前價格高於多數同組公司";

      valuationCopy =
        "用公司賺到的錢和公司擁有的資產一起比較，目前價格高於多數同組金融公司。這代表市場給的期待較高，不代表股價一定會下跌。";
    } else if (valuation.position === "low") {
      valuationTitle =
        "目前價格低於多數同組公司";

      valuationCopy =
        "用公司賺到的錢和公司擁有的資產一起比較，目前價格低於多數同組金融公司，但仍要一起看公司的獲利是否穩定。";
    } else {
      valuationTitle =
        "目前價格大約在同組公司的中間";

      valuationCopy =
        "用公司賺到的錢和公司擁有的資產一起比較，目前價格沒有明顯高於或低於多數同組金融公司。";
    }

    const financialValuationFacts = [];

    if (valuationPeRatio !== null) {
      financialValuationFacts.push(
        `本益比 ${valuationPeRatio.toFixed(2)} 倍`
      );
    }

    if (pbRatio !== null) {
      financialValuationFacts.push(
        `股價淨值比 ${pbRatio.toFixed(2)} 倍`
      );
    }

    if (
      financialPeRank !== null &&
      peerCount !== null
    ) {
      financialValuationFacts.push(
        `本益比同組第 ${financialPeRank}/${peerCount}`
      );
    }

    if (
      financialPbRank !== null &&
      peerCount !== null
    ) {
      financialValuationFacts.push(
        `股價淨值比同組第 ${financialPbRank}/${peerCount}`
      );
    }

    valuationBasis =
      financialValuationFacts.length
        ? `比較資料：${financialValuationFacts.join("｜")}`
        : "比較資料：交易所正式估值與同類金融公司";
  } else if (
    valuation.status === "available" &&
    valuation.comparison_scope === "historical_price_position"
  ) {
    const historicalPriceMetrics =
      Array.isArray(valuation.metrics)
        ? valuation.metrics
        : [];

    const historicalMetricValue = (label) => {
      const metric = historicalPriceMetrics.find(
        (item) => item?.label_zh === label
      );

      return available(metric?.value)
        ? Number(metric.value)
        : null;
    };

    const historicalPricePercentile =
      available(valuation.historical_price_percentile)
        ? Number(valuation.historical_price_percentile)
        : historicalMetricValue("歷史價格百分位");

    const historicalPriceSampleCount =
      available(valuation.historical_price_sample_count)
        ? Number(valuation.historical_price_sample_count)
        : null;

    const historicalPrice30d =
      historicalMetricValue("近 30 日價格變化");

    const historicalPrice90d =
      historicalMetricValue("近 90 日價格變化");

    valuationTitle =
      valuation.headline_zh ||
      (
        valuation.position === "high"
          ? "目前價格位於自身歷史較高區域"
          : valuation.position === "low"
            ? "目前價格位於自身歷史較低區域"
            : "目前價格位於自身歷史中間區域"
      );

    const historicalPriceCopy = [];

    if (
      historicalPricePercentile !== null &&
      historicalPriceSampleCount !== null
    ) {
      historicalPriceCopy.push(
        `目前收盤價位於 ${historicalPriceSampleCount} 個交易日收盤價的第 ${historicalPricePercentile.toFixed(2)} 百分位`
      );
    }

    if (historicalPrice30d !== null) {
      historicalPriceCopy.push(
        `近 30 日價格${historicalPrice30d >= 0 ? "上漲" : "下跌"} ${Math.abs(historicalPrice30d).toFixed(1)}%`
      );
    }

    if (historicalPrice90d !== null) {
      historicalPriceCopy.push(
        `近 90 日價格${historicalPrice90d >= 0 ? "上漲" : "下跌"} ${Math.abs(historicalPrice90d).toFixed(1)}%`
      );
    }

    valuationCopy =
      (
        historicalPriceCopy.length
          ? `${historicalPriceCopy.join("；")}。`
          : valuation.interpretation_zh
      ) +
      "這只代表公司自身的歷史價格位置，不代表估值便宜、昂貴或適合買進。";

    const historicalPriceFacts = [];

    if (historicalPriceSampleCount !== null) {
      historicalPriceFacts.push(
        `${historicalPriceSampleCount} 個交易日收盤價`
      );
    }

    if (historicalPricePercentile !== null) {
      historicalPriceFacts.push(
        `歷史價格第 ${historicalPricePercentile.toFixed(2)} 百分位`
      );
    }

    valuationBasis =
      historicalPriceFacts.length
        ? `比較資料：${historicalPriceFacts.join("｜")}｜公司自身歷史價格`
        : "比較資料：公司自身歷史收盤價";
  } else if (
    valuation.status === "available" &&
    /偏高|昂貴|高估|較高/.test(valuationText)
  ) {
    valuationTitle = "目前股價位置偏高一些";
    valuationCopy =
      "和公司自己過去或其他相似公司相比，目前市場給的價格比較高。";
    valuationBasis =
      "比較資料：公司過去的價格、賺錢能力與相似公司比較";
  } else if (
    valuation.status === "available" &&
    /偏低|便宜|低估|較低/.test(valuationText)
  ) {
    valuationTitle = "目前股價位置偏低一些";
    valuationCopy =
      "和公司自己過去或其他相似公司相比，目前市場給的價格比較低。";
    valuationBasis =
      "比較資料：公司過去的價格、賺錢能力與相似公司比較";
  } else if (
    valuation.status === "available" &&
    /合理|中位|中間|適中/.test(valuationText)
  ) {
    valuationTitle = "目前股價位置大約在中間";
    valuationCopy =
      "和公司自己過去或其他相似公司相比，目前沒有明顯偏高或偏低。";
    valuationBasis =
      "比較資料：公司過去的價格、賺錢能力與相似公司比較";
  } else {
    const partialValuationMetrics =
      Array.isArray(valuation.metrics)
        ? valuation.metrics
        : [];

    const latestCloseMetric =
      partialValuationMetrics.find(
        (item) => item?.label_zh === "最新收盤價"
      );

    const valuationMissingItems =
      Array.isArray(valuation.missing_items_zh)
        ? valuation.missing_items_zh
        : [];

    valuationTitle =
      valuation.status === "partial"
        ? "目前缺少可驗證的估值比較基準"
        : "目前沒有可發布的估值比較";

    valuationCopy =
      valuation.interpretation_zh ||
      "目前沒有足夠的歷史或同組估值基準，因此不會只靠單一價格判斷股價高低。";

    const partialValuationFacts = [];

    if (available(latestCloseMetric?.value)) {
      partialValuationFacts.push(
        `最新收盤價 ${Number(latestCloseMetric.value).toFixed(2)} 元`
      );
    }

    if (valuationMissingItems.length) {
      partialValuationFacts.push(
        `尚缺 ${valuationMissingItems.join("、")}`
      );
    }

    valuationBasis =
      partialValuationFacts.length
        ? `資料狀態：${partialValuationFacts.join("｜")}`
        : "資料狀態：目前沒有可驗證的歷史或同組估值基準";
  }

  if (
    profileId === "cyclical" &&
    valuation.status === "available" &&
    valuation.comparison_scope === "official_metrics_only"
  ) {
    const officialValuationMetrics =
      Array.isArray(valuation.metrics)
        ? valuation.metrics
        : [];

    const officialMetricValue = (label) => {
      const metric = officialValuationMetrics.find(
        (item) => item?.label_zh === label
      );

      return available(metric?.value)
        ? Number(metric.value)
        : null;
    };

    const officialPe = officialMetricValue("本益比");
    const officialPb = officialMetricValue("股價淨值比");
    const officialYield = officialMetricValue("殖利率");
    const officialFacts = [];

    if (officialPe !== null) {
      officialFacts.push(`本益比 ${officialPe.toFixed(2)} 倍`);
    }

    if (officialPb !== null) {
      officialFacts.push(`股價淨值比 ${officialPb.toFixed(2)} 倍`);
    }

    if (officialYield !== null) {
      officialFacts.push(`殖利率 ${officialYield.toFixed(2)}%`);
    }

    valuationTitle = "已有正式估值數字，但還不能判定高低";
    valuationCopy =
      "交易所正式估值資料已接入，但目前缺少同組排名與公司自身的歷史估值區間。" +
      "因此 GC 只顯示可驗證的數字，不把單一倍數直接解讀成便宜或昂貴。";
    valuationBasis =
      officialFacts.length
        ? `比較資料：${officialFacts.join("｜")}｜來源 TWSE BWIBBU_ALL`
        : "資料狀態：交易所正式估值數字已接入，歷史與同組基準待補";
  }
  $("guidedValuationTone").textContent = "現在算貴還是便宜";
  $("guidedValuation").textContent = valuationTitle;
  $("guidedValuationCopy").textContent = valuationCopy;
  $("guidedValuationEvidence").textContent = valuationBasis;

  let confidenceTitle = "";
  let confidenceCopy = "";

  const confidenceRevenueChange =
    available(historicalRevenue.year_over_year_pct)
      ? Number(historicalRevenue.year_over_year_pct)
      : null;

  const confidenceIncomeChange =
    available(historicalFinancial.income_change_yoy_pct)
      ? Number(historicalFinancial.income_change_yoy_pct)
      : null;

  const confidencePrice30d =
    available(historicalPrice.changes?.["30d_pct"])
      ? Number(historicalPrice.changes["30d_pct"])
      : null;

  const confidenceRevenueComparisons =
    available(historicalRevenue.yoy_sample_count)
      ? Number(historicalRevenue.yoy_sample_count)
      : 0;

  const confidenceFinancialQuarters =
    available(historicalFinancial.quarter_sample_count)
      ? Number(historicalFinancial.quarter_sample_count)
      : 0;

  const confidencePriceSamples =
    available(historicalPrice.sample_count)
      ? Number(historicalPrice.sample_count)
      : 0;

  const confidenceInstitutionalSamples =
    available(historicalInstitutional.sample_count)
      ? Number(historicalInstitutional.sample_count)
      : 0;

  const confidenceMarginSamples =
    available(historicalMargin.sample_count)
      ? Number(historicalMargin.sample_count)
      : 0;

  const confidenceDividendYears =
    available(historicalDividend.dividend_year_sample_count)
      ? Number(historicalDividend.dividend_year_sample_count)
      : 0;

  const confidenceFinancialTier =
    String(historicalFinancial.evidence_tier || "");

  const confidenceDividendFreshness =
    String(historicalDividend.dividend_freshness || "");

  const confidenceEventCount =
    Number(metrics.confirmed_company_event_count || 0);

  const operatingSignalsAvailable =
    confidenceRevenueChange !== null &&
    confidenceIncomeChange !== null;

  const operatingSignalsAgree =
    operatingSignalsAvailable &&
    (
      (
        confidenceRevenueChange > 0 &&
        confidenceIncomeChange > 0
      ) ||
      (
        confidenceRevenueChange <= 0 &&
        confidenceIncomeChange <= 0
      )
    );

  const operatingDirection =
    operatingSignalsAvailable
      ? (
          confidenceRevenueChange > 0 &&
          confidenceIncomeChange > 0
            ? 1
            : (
                confidenceRevenueChange <= 0 &&
                confidenceIncomeChange <= 0
                  ? -1
                  : 0
              )
        )
      : 0;

  const marketDirection =
    confidencePrice30d !== null
      ? (
          confidencePrice30d >= 3
            ? 1
            : confidencePrice30d <= -3
              ? -1
              : 0
        )
      : 0;

  const marketAndOperatingDisagree =
    operatingDirection !== 0 &&
    marketDirection !== 0 &&
    operatingDirection !== marketDirection;

  if (profileId === "financial_income") {
    const confidenceCurrentRoe =
      available(historicalFinancial.roe_pct)
        ? Number(historicalFinancial.roe_pct)
        : null;

    const confidenceUsualRoe =
      available(historicalFinancial.historical_roe_median_pct)
        ? Number(historicalFinancial.historical_roe_median_pct)
        : null;

    if (
      confidenceFinancialQuarters > 0 &&
      confidenceDividendFreshness === "current"
    ) {
      confidenceTitle =
        "財務與股利歷史都很完整";

      confidenceCopy =
        `GC 已比較 ${confidenceFinancialQuarters} 季財報` +
        (
          confidenceDividendYears > 0
            ? `、${confidenceDividendYears} 個股利年度`
            : ""
        ) +
        "和多年市場資料。";

      if (
        confidenceCurrentRoe !== null &&
        confidenceUsualRoe !== null
      ) {
        confidenceCopy +=
          ` 目前每 100 元股東資金約賺回 ${confidenceCurrentRoe.toFixed(1)} 元，` +
          `過去常見約 ${confidenceUsualRoe.toFixed(1)} 元。`;
      }

      confidenceCopy +=
        "目前判斷有足夠歷史依據，但新的財報與股利公告仍可能改變結論。";
    } else if (confidenceFinancialQuarters > 0) {
      confidenceTitle =
        "財務歷史充足，但最新股利年度尚未接續";

      confidenceCopy =
        `GC 已比較 ${confidenceFinancialQuarters} 季財報和多年市場資料，` +
        "但最新一個股利年度尚未取得可驗證紀錄，因此不直接判定目前配息仍延續。";
    } else {
      confidenceTitle =
        "市場歷史充足，但財務比較尚未形成";

      confidenceCopy =
        "GC 有多年價格與市場資料，但季度財務比較尚未形成，因此目前不發布高把握度的財務結論。";
    }
  } else if (profileId === "growth_quality") {
    if (operatingSignalsAgree) {
      confidenceTitle =
        operatingDirection > 0
          ? "歷史資料充足，收入與獲利方向一致"
          : "歷史資料充足，營運轉弱訊號一致";

      confidenceCopy =
        `GC 已比較 ${confidenceRevenueComparisons} 次收入年度變化` +
        `、${confidenceFinancialQuarters} 季財報和多年市場資料。`;

      if (marketAndOperatingDisagree) {
        confidenceCopy +=
          " 目前短期股價與營運方向不同，因此對營運方向的把握高於對短期價格方向的把握。";
      } else {
        confidenceCopy +=
          " 收入與獲利指向相同方向，因此目前營運結論有多項資料支持。";
      }
    } else if (operatingSignalsAvailable) {
      confidenceTitle =
        "歷史資料充足，但收入與獲利方向不同";

      confidenceCopy =
        `GC 已比較 ${confidenceRevenueComparisons} 次收入年度變化` +
        `、${confidenceFinancialQuarters} 季財報和多年市場資料。` +
        "目前收入與獲利沒有指向相同方向，所以資料不是不足，而是公司成長訊號仍有分歧。";
    } else {
      confidenceTitle =
        "市場歷史充足，但成長比較尚未完整";

      confidenceCopy =
        "收入年度比較或最近四季獲利仍有一項尚未形成，因此目前只對已取得的資料發布結論。";
    }
  } else if (profileId === "cyclical") {
    if (operatingSignalsAgree) {
      confidenceTitle =
        operatingDirection > 0
          ? "市場與營運歷史充足，回溫訊號較一致"
          : "市場與營運歷史充足，轉弱訊號較一致";

      confidenceCopy =
        `GC 已比較 ${confidenceRevenueComparisons} 次收入年度變化` +
        `、${confidenceFinancialQuarters} 季財報和多年市場資料。`;

      if (marketAndOperatingDisagree) {
        confidenceCopy +=
          " 但目前股價與營運方向不同，因此不能只看市場價格判定景氣方向。";
      } else {
        confidenceCopy +=
          " 收入與獲利方向一致，景氣循環判斷有多項營運資料支持。";
      }
    } else if (operatingSignalsAvailable) {
      confidenceTitle =
        "歷史資料充足，但景氣訊號尚未一致";

      confidenceCopy =
        `GC 已比較 ${confidenceRevenueComparisons} 次收入年度變化` +
        `、${confidenceFinancialQuarters} 季財報和多年市場資料。` +
        "目前收入與獲利方向不同，因此資料充足，但還不能確認景氣循環已經完全轉向。";
    } else {
      confidenceTitle =
        "市場資料充足，但營運循環仍不能確認";

      confidenceCopy =
        "GC 有多年股價、法人與融資歷史，但收入年度比較或最近四季獲利仍有一項尚未形成。";
    }
  } else if (profileId === "high_volatility_event") {
    if (operatingSignalsAgree) {
      confidenceTitle =
        confidenceEventCount > 0
          ? "營運歷史充足，另有公司事件需要追蹤"
          : "營運歷史充足，目前沒有新的重大事件";

      confidenceCopy =
        `GC 已比較 ${confidenceRevenueComparisons} 次收入年度變化` +
        `、${confidenceFinancialQuarters} 季財報和多年市場資料。`;

      confidenceCopy +=
        confidenceEventCount > 0
          ? ` 目前另有 ${confidenceEventCount} 項確認公司事件，但事件仍要用後續營運資料驗證。`
          : " 目前沒有新的重大公司事件改變營運判斷，這不代表事件資料不足。";
    } else if (operatingSignalsAvailable) {
      confidenceTitle =
        "歷史資料充足，但營運訊號方向不同";

      confidenceCopy =
        `GC 已比較 ${confidenceRevenueComparisons} 次收入年度變化` +
        `、${confidenceFinancialQuarters} 季財報和多年市場資料。` +
        "目前收入與獲利方向不同，因此不把單一消息或股價變化直接當成營運改善。";
    } else {
      confidenceTitle =
        "市場歷史充足，但事件影響尚未形成完整比較";

      confidenceCopy =
        "GC 只呈現已確認的公司事件；收入或獲利比較尚未形成時，不推測事件已經改變營運。";
    }
  } else {
    confidenceTitle =
      confidence >= 75
        ? "這次判斷有多項歷史資料支持"
        : "這次判斷已有足夠資料提供參考";

    confidenceCopy =
      "GC 已比較公司的營運、市場與歷史資料。新的財報或公司公告仍可能改變目前結論。";
  }

  if (
    confidenceFinancialTier === "current_research_only"
  ) {
    confidenceCopy +=
      " 部分財務歷史可供目前研究使用，但尚未完成嚴格歷史回測所需的正式公布日驗證。";
  }

  const historySampleFacts = [];

  if (profileId === "financial_income") {
    if (confidenceFinancialQuarters > 0) {
      historySampleFacts.push(
        `${confidenceFinancialQuarters} 季財報`
      );
    }

    if (confidenceDividendYears > 0) {
      historySampleFacts.push(
        `${confidenceDividendYears} 個股利年度`
      );
    }

    if (confidencePriceSamples > 0) {
      historySampleFacts.push(
        `${confidencePriceSamples} 個交易日股價`
      );
    }
  } else {
    if (confidenceRevenueComparisons > 0) {
      historySampleFacts.push(
        `${confidenceRevenueComparisons} 次收入年度比較`
      );
    }

    if (confidenceFinancialQuarters > 0) {
      historySampleFacts.push(
        `${confidenceFinancialQuarters} 季財報`
      );
    }

    if (confidencePriceSamples > 0) {
      historySampleFacts.push(
        `${confidencePriceSamples} 個交易日股價`
      );
    }

    if (
      profileId === "high_volatility_event" &&
      confidenceEventCount >= 0
    ) {
      historySampleFacts.push(
        `${confidenceEventCount} 項確認公司事件`
      );
    }
  }

  $("confidenceTone").textContent =
    `判斷把握度 ${Math.round(confidence)}/100`;

  $("confidence").textContent =
    confidenceTitle;

  $("guidedConfidenceCopy").textContent =
    confidenceCopy;

  $("confidenceBar").style.width =
    `${Math.round(confidence)}%`;

  $("confidenceBar").parentElement.setAttribute(
    "aria-valuemin",
    "0"
  );

  $("confidenceBar").parentElement.setAttribute(
    "aria-valuemax",
    "100"
  );

  $("confidenceBar").parentElement.setAttribute(
    "aria-valuenow",
    String(Math.round(confidence))
  );

  $("confidenceBar").parentElement.setAttribute(
    "aria-label",
    "GC 判斷把握度"
  );

  $("guidedConfidenceScore").textContent =
    historySampleFacts.length
      ? `比較資料：${historySampleFacts.slice(0, 3).join("｜")}` +
        `｜判斷把握度 ${Math.round(confidence)}/100`
      : `比較資料：資料是否最新、歷史樣本與訊號一致性` +
        `｜判斷把握度 ${Math.round(confidence)}/100`;}
function renderIntegratedDecision(report) {
  const profileId =
    report.stock_profile?.profile_id || "default";

  const profile = stockDecisionProfile(report);
  const metrics = profile.metrics || {};


  const available = (value) =>
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value));

  const integratedHistoricalRevenue =
      report.historical_context?.categories?.revenue || {};

    const integratedMonthlyRevenueGrowth =
      available(
        integratedHistoricalRevenue.year_over_year_pct
      )
        ? Number(
            integratedHistoricalRevenue.year_over_year_pct
          )
        : null;

    const integratedTypicalRevenueGrowth =
      available(
        integratedHistoricalRevenue.historical_yoy_median_pct
      )
        ? Number(
            integratedHistoricalRevenue.historical_yoy_median_pct
          )
        : null;
const number = (value, digits = 2, suffix = "") =>
    available(value)
      ? `${Number(value).toFixed(digits)}${suffix}`
      : "目前沒有可發布的數據";

  const rank = (position, count) =>
    available(position) && available(count)
      ? `第 ${Number(position)}/${Number(count)} 名`
      : "目前沒有可發布的排名";

  const item = (
    tone,
    title,
    copy,
    basis,
    primary,
    secondary,
    source
  ) => ({
    tone,
    title,
    copy,
    basis,
    primary,
    secondary,
    source,
  });

  let reasons = [];
  let followUp = [];
  let typeDescription = "GC 已依公司的實際資料選擇判斷方式";

  if (profileId === "financial_income") {
    typeDescription = "這家公司主要看獲利、目前股息、歷年配息和同類金融公司的價格";

    const financialHistory =
      report.historical_context?.categories?.financial || {};

    const integratedDividendHistory =
      report.historical_context?.categories?.dividend || {};

    const integratedDividendYears =
      available(integratedDividendHistory.consecutive_dividend_years)
        ? Number(integratedDividendHistory.consecutive_dividend_years)
        : null;

    const integratedLatestCashDividend =
      available(integratedDividendHistory.latest_cash_dividend)
        ? Number(integratedDividendHistory.latest_cash_dividend)
        : null;

    const integratedFiveYearDividendAverage =
      available(integratedDividendHistory.average_cash_dividend_5y)
        ? Number(integratedDividendHistory.average_cash_dividend_5y)
        : null;

    const integratedDividendFreshness =
      String(
        integratedDividendHistory.dividend_freshness || ""
      );

    const integratedDividendType =
      String(
        integratedDividendHistory.latest_dividend_type || ""
      );

    const integratedLatestDividendYear =
      available(integratedDividendHistory.latest_dividend_year)
        ? Number(integratedDividendHistory.latest_dividend_year)
        : null;

    const integratedLatestStockDividend =
      available(integratedDividendHistory.latest_stock_dividend)
        ? Number(integratedDividendHistory.latest_stock_dividend)
        : null;

    const incomeChange =
      available(financialHistory.income_change_yoy_pct)
        ? Number(financialHistory.income_change_yoy_pct)
        : null;

    const currentRoe =
      available(financialHistory.roe_pct)
        ? Number(financialHistory.roe_pct)
        : null;

    const usualRoe =
      available(financialHistory.historical_roe_median_pct)
        ? Number(financialHistory.historical_roe_median_pct)
        : null;

    const yieldRank =
      available(metrics.dividend_yield_rank)
        ? Number(metrics.dividend_yield_rank)
        : null;

    const peerCount =
      available(metrics.peer_count)
        ? Number(metrics.peer_count)
        : null;

    const yieldIsLow =
      yieldRank !== null &&
      peerCount !== null &&
      yieldRank > Math.ceil(peerCount * 0.65);

    const integratedDividendIsCurrent =
      integratedDividendFreshness === "current";

    const integratedDividendTitle =
      String(
        integratedDividendHistory.headline_zh ||
        "GC 會持續整理公司的股利紀錄"
      );

    const integratedDividendCopy =
      String(
        integratedDividendHistory.interpretation_zh ||
        "GC 會用公司實際公告的歷年股利，判斷股利是否持續。"
      );

    let integratedDividendBasis =
      "比較資料：公司歷年股利公告";

    let integratedDividendPrimary =
      "最新股利";

    let integratedDividendSecondary =
      "歷史比較";

    if (!integratedDividendIsCurrent) {
      integratedDividendBasis =
        integratedLatestDividendYear !== null
          ? `最近可驗證股利年度 ${integratedLatestDividendYear}`
          : "比較資料：公司歷年股利公告";
    } else if (
      integratedDividendType === "stock" &&
      integratedLatestStockDividend !== null
    ) {
      integratedDividendBasis =
        `最新股票股利 ${integratedLatestStockDividend.toFixed(2)} 股`;

      integratedDividendPrimary =
        `${integratedLatestStockDividend.toFixed(2)} 股`;
    } else if (
      integratedLatestCashDividend !== null
    ) {
      integratedDividendBasis =
        `最新現金股利 ${integratedLatestCashDividend.toFixed(2)} 元`;

      integratedDividendPrimary =
        `${integratedLatestCashDividend.toFixed(2)} 元`;

      if (
        integratedDividendType === "cash_and_stock" &&
        integratedLatestStockDividend !== null
      ) {
        integratedDividendBasis +=
          `｜股票股利 ${integratedLatestStockDividend.toFixed(2)} 股`;
      }

      if (
        integratedFiveYearDividendAverage !== null
      ) {
        integratedDividendBasis +=
          `｜近 5 年平均現金股利 ${integratedFiveYearDividendAverage.toFixed(2)} 元`;

        integratedDividendSecondary =
          `5 年平均 ${integratedFiveYearDividendAverage.toFixed(2)} 元`;
      }
    }

    reasons = [
      item(
        incomeChange !== null && incomeChange < -5
          ? "caution"
          : "positive",
        incomeChange !== null && incomeChange < -5
          ? "最近四季獲利比一年前少"
          : "最近四季獲利沒有明顯轉弱",
        incomeChange !== null && incomeChange < -5
          ? `最近四季合計獲利比一年前減少 ${Math.abs(incomeChange).toFixed(1)}%。`
          : "最近四季合計獲利和一年前相比，沒有明顯減少。",
        currentRoe !== null && usualRoe !== null
          ? `目前每 100 元股東資金約賺回 ${currentRoe.toFixed(1)} 元｜過去常見約 ${usualRoe.toFixed(1)} 元`
          : "比較資料：最近四季獲利與公司季度財報",
        currentRoe !== null
          ? `${currentRoe.toFixed(1)} 元`
          : "目前未納入 ROE 比較",
        usualRoe !== null
          ? `過去 ${usualRoe.toFixed(1)} 元`
          : "歷史比較",
        "公司季度財務報告"
      ),
      item(
        yieldIsLow ? "caution" : "neutral",
        yieldIsLow
          ? "目前股息低於多數同組公司"
          : "目前股息大約在同組中間",
        yieldIsLow
          ? `目前殖利率為 ${number(metrics.dividend_yield_pct, 2, "%")}，在 ${peerCount} 家同組公司中排名第 ${yieldRank}。`
          : "目前殖利率需要和其他金融公司一起比較，不能只看單一數字。",
        `目前殖利率 ${number(metrics.dividend_yield_pct, 2, "%")}｜同組 ${rank(metrics.dividend_yield_rank, metrics.peer_count)}`,
        number(metrics.dividend_yield_pct, 2, "%"),
        rank(metrics.dividend_yield_rank, metrics.peer_count),
        "交易所正式殖利率與同類公司比較"
      ),
      item(
        integratedDividendIsCurrent &&
        integratedDividendYears !== null &&
        integratedDividendYears >= 5
          ? "positive"
          : "neutral",
        integratedDividendTitle,
        integratedDividendCopy,
        integratedDividendBasis,
        integratedDividendPrimary,
        integratedDividendSecondary,
        "公司歷年股利公告資料"
      ),
    ];

    followUp = [
      usualRoe !== null
        ? (
            currentRoe !== null && currentRoe < usualRoe
              ? `GC 會確認下一季用股東資金賺錢的效率，能不能回到過去常見的 ${usualRoe.toFixed(1)} 元`
              : `GC 會確認下一季用股東資金賺錢的效率，能否維持目前水準`
          )
        : "GC 會確認下一季獲利方向是否改變",
      incomeChange !== null && incomeChange < -5
        ? "GC 會追蹤最近四季獲利是否停止減少"
        : incomeChange !== null && incomeChange > 5
          ? "GC 會追蹤最近四季獲利改善能否延續"
          : "GC 會追蹤最近四季獲利是否出現明顯變化",
      !integratedDividendIsCurrent
        ? "取得新的股利公告後，GC 會重新評估目前股利是否延續"
        : (
            integratedDividendType !== "stock" &&
            integratedFiveYearDividendAverage !== null
              ? `如果下一次現金股利低於近 5 年平均的 ${integratedFiveYearDividendAverage.toFixed(2)} 元，GC 會重新評估配息穩定度`
              : "GC 會持續比較最新股利與公司過去的股利水準"
          ),
    ];
  } else if (profileId === "growth_quality") {
    typeDescription = "這家公司主要看收入、獲利和成長速度";

    const growthHistory =
      report.historical_context?.categories || {};

    const growthRevenueHistory =
      growthHistory.revenue || {};

    const growthFinancialHistory =
      growthHistory.financial || {};

    const growthPriceHistory =
      growthHistory.price || {};

    const growthInstitutionalHistory =
      growthHistory.institutional || {};

    const latestMonthlyRevenueGrowth =
      available(growthRevenueHistory.year_over_year_pct)
        ? Number(growthRevenueHistory.year_over_year_pct)
        : null;

    const usualMonthlyRevenueGrowth =
      available(growthRevenueHistory.historical_yoy_median_pct)
        ? Number(growthRevenueHistory.historical_yoy_median_pct)
        : null;

    const latestFourQuarterIncomeChange =
      available(growthFinancialHistory.income_change_yoy_pct)
        ? Number(growthFinancialHistory.income_change_yoy_pct)
        : null;

    const financialQuarterSampleCount =
      available(growthFinancialHistory.quarter_sample_count)
        ? Number(growthFinancialHistory.quarter_sample_count)
        : null;

    const revenueHistorySampleCount =
      available(growthRevenueHistory.sample_count)
        ? Number(growthRevenueHistory.sample_count)
        : null;

    const revenueYoySampleCount =
      available(growthRevenueHistory.yoy_sample_count)
        ? Number(growthRevenueHistory.yoy_sample_count)
        : null;

    const price90dChange =
      available(growthPriceHistory.changes?.["90d_pct"])
        ? Number(growthPriceHistory.changes["90d_pct"])
        : null;

    const institutional20d =
      available(growthInstitutionalHistory.windows?.["20d_net_buy"])
        ? Number(growthInstitutionalHistory.windows["20d_net_buy"])
        : null;

    const institutionalSampleCount =
      available(growthInstitutionalHistory.sample_count)
        ? Number(growthInstitutionalHistory.sample_count)
        : null;

    const institutionalHistoricalPercentile =
      available(growthInstitutionalHistory.percentile_20d)
        ? Number(growthInstitutionalHistory.percentile_20d)
        : null;

    let growthOperatingTone = "caution";
    let growthOperatingTitle =
      "成長歷史尚未形成完整比較";
    let growthOperatingCopy =
      "收入年度比較或最近四季獲利仍有一項尚未形成，因此目前不直接判定公司的成長方向。";

    if (
      latestMonthlyRevenueGrowth !== null &&
      latestFourQuarterIncomeChange !== null
    ) {
      if (
        latestMonthlyRevenueGrowth > 0 &&
        latestFourQuarterIncomeChange > 0
      ) {
        growthOperatingTone = "positive";
        growthOperatingTitle =
          "收入與獲利都在成長";
        growthOperatingCopy =
          `最新一個月收入比去年同期增加 ${latestMonthlyRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利也增加 ${latestFourQuarterIncomeChange.toFixed(1)}%。`;

        if (
          usualMonthlyRevenueGrowth !== null &&
          latestMonthlyRevenueGrowth > usualMonthlyRevenueGrowth
        ) {
          growthOperatingCopy +=
            `目前收入成長也高於過去常見的 ${usualMonthlyRevenueGrowth.toFixed(1)}%。`;
        }
      } else if (
        latestMonthlyRevenueGrowth > 0 &&
        latestFourQuarterIncomeChange <= 0
      ) {
        growthOperatingTitle =
          "收入增加，但獲利尚未跟上";
        growthOperatingCopy =
          `最新一個月收入比去年同期增加 ${latestMonthlyRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利變化 ${latestFourQuarterIncomeChange >= 0 ? "+" : ""}${latestFourQuarterIncomeChange.toFixed(1)}%。`;
      } else if (
        latestMonthlyRevenueGrowth <= 0 &&
        latestFourQuarterIncomeChange > 0
      ) {
        growthOperatingTone = "neutral";
        growthOperatingTitle =
          "獲利增加，但收入正在放慢";
        growthOperatingCopy =
          `最近四季獲利比一年前增加 ${latestFourQuarterIncomeChange.toFixed(1)}%，` +
          `最新一個月收入變化 ${latestMonthlyRevenueGrowth >= 0 ? "+" : ""}${latestMonthlyRevenueGrowth.toFixed(1)}%。`;
      } else {
        growthOperatingTitle =
          "收入與獲利都在減少";
        growthOperatingCopy =
          `最新一個月收入變化 ${latestMonthlyRevenueGrowth >= 0 ? "+" : ""}${latestMonthlyRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利變化 ${latestFourQuarterIncomeChange >= 0 ? "+" : ""}${latestFourQuarterIncomeChange.toFixed(1)}%。`;
      }
    }

    const growthBasisParts = [];

    if (revenueHistorySampleCount !== null) {
      growthBasisParts.push(
        `${revenueHistorySampleCount} 個月收入`
      );
    }

    if (revenueYoySampleCount !== null) {
      growthBasisParts.push(
        `${revenueYoySampleCount} 次年度比較`
      );
    }

    if (financialQuarterSampleCount !== null) {
      growthBasisParts.push(
        `${financialQuarterSampleCount} 季財報`
      );
    }

    const valuationCopyParts = [];

    if (available(metrics.pe_ratio)) {
      valuationCopyParts.push(
        `目前股價約為每股獲利的 ${Number(metrics.pe_ratio).toFixed(2)} 倍`
      );
    }

    if (
      available(metrics.pe_rank) &&
      available(metrics.peer_count)
    ) {
      valuationCopyParts.push(
        `在 ${Number(metrics.peer_count)} 家同組公司中排第 ${Number(metrics.pe_rank)}`
      );
    }

    if (
      available(metrics.pb_rank) &&
      available(metrics.peer_count)
    ) {
      valuationCopyParts.push(
        `股價和公司資產的比例則排第 ${Number(metrics.pb_rank)}/${Number(metrics.peer_count)}`
      );
    }

    const momentumCopyParts = [];

    if (price90dChange !== null) {
      momentumCopyParts.push(
        `近 90 個交易日股價` +
        `${price90dChange >= 0 ? "上漲" : "下跌"} ` +
        `${Math.abs(price90dChange).toFixed(1)}%`
      );
    }

    if (
      available(metrics.sector_rank) &&
      available(metrics.sector_peer_count)
    ) {
      momentumCopyParts.push(
        `近 20 日表現為同組第 ` +
        `${Number(metrics.sector_rank)}/` +
        `${Number(metrics.sector_peer_count)} 名`
      );
    }

    if (institutional20d !== null) {
      const nearHistoricalNorm =
        institutionalHistoricalPercentile !== null &&
        institutionalHistoricalPercentile >= 35 &&
        institutionalHistoricalPercentile <= 65;

      momentumCopyParts.push(
        institutional20d < 0
          ? nearHistoricalNorm
            ? "法人近一個月賣出多於買進，但賣出程度接近過去常態"
            : "法人近一個月賣出多於買進"
          : nearHistoricalNorm
            ? "法人近一個月買進多於賣出，但買進程度接近過去常態"
            : "法人近一個月買進多於賣出"
      );
    }

    reasons = [
      item(
        growthOperatingTone,
        growthOperatingTitle,
        growthOperatingCopy,
        growthBasisParts.length
          ? `比較資料：${growthBasisParts.join("｜")}`
          : "比較資料：公司月收入與季度財報歷史",
        latestMonthlyRevenueGrowth !== null
          ? `收入 ${latestMonthlyRevenueGrowth >= 0 ? "+" : ""}${latestMonthlyRevenueGrowth.toFixed(1)}%`
          : "收入待比較",
        latestFourQuarterIncomeChange !== null
          ? `獲利 ${latestFourQuarterIncomeChange >= 0 ? "+" : ""}${latestFourQuarterIncomeChange.toFixed(1)}%`
          : "獲利待比較",
        "公司月收入與季度財報歷史"
      ),
      item(
        "neutral",
        "公司成長不錯，但目前價格不算低",
        valuationCopyParts.length
          ? `${valuationCopyParts.join("；")}。這只能說明目前在同組中的價格位置，不能直接當成買進或賣出結論。`
          : "公司仍在成長，但目前價格需要和同組公司及公司賺錢速度一起比較。",
        "比較資料：交易所正式本益比、股價淨值比與同組公司排名",
        number(metrics.pe_ratio, 2, " 倍"),
        rank(metrics.pe_rank, metrics.peer_count),
        "交易所正式估值資料與同組公司比較"
      ),
      item(
        "caution",
        institutional20d !== null && institutional20d < 0
          ? "股價表現較強，但法人沒有一起增加買盤"
          : "股價與法人買盤都在變化",
        momentumCopyParts.length
          ? `${momentumCopyParts.join("；")}。`
          : "近期股價表現較強，GC 會同時比較法人買賣與公司營運變化。",
        `比較資料：近 20 日同組 ` +
          `${rank(metrics.sector_rank, metrics.sector_peer_count)}` +
          `｜比大盤多 ${number(metrics.relative_market_pct_point, 2, " 個百分點")}` +
          (institutionalSampleCount !== null
            ? `｜${institutionalSampleCount} 個交易日法人資料`
            : ""),
        rank(metrics.sector_rank, metrics.sector_peer_count),
        number(metrics.relative_market_pct_point, 2, " 個百分點"),
        "歷史股價、三大法人每日買賣與市場比較"
      ),
    ];

    followUp = [
      usualMonthlyRevenueGrowth !== null
        ? `下一次月收入公布後，GC 會比較成長速度是否仍高於過去常見的 ${usualMonthlyRevenueGrowth.toFixed(1)}%`
        : "下一次月收入公布後，GC 會比較成長速度是否延續目前方向",
      latestFourQuarterIncomeChange !== null &&
      latestFourQuarterIncomeChange < 0
        ? "GC 會追蹤下一季財報，確認最近四季獲利是否停止減少"
        : price90dChange !== null && price90dChange > 10
          ? "GC 會檢查獲利成長能否追上近期股價漲幅"
          : "GC 會追蹤下一季財報，確認獲利方向是否延續",
      institutional20d !== null && institutional20d < 0
        ? "GC 會追蹤法人近一個月是否由賣出多於買進，轉為買進多於賣出"
        : institutional20d !== null && institutional20d > 0
          ? "GC 會追蹤法人近一個月買進多於賣出的狀況能否延續"
          : "GC 會追蹤法人近一個月的買賣方向是否出現明顯變化",
    ];
  } else if (profileId === "cyclical") {
    typeDescription = "這家公司容易受到景氣影響，GC 會分開檢查營運、價格與市場資金";

    const cyclicalHistory =
      report.historical_context?.categories || {};

    const cyclicalRevenue =
      cyclicalHistory.revenue || {};

    const cyclicalFinancial =
      cyclicalHistory.financial || {};

    const cyclicalPrice =
      cyclicalHistory.price || {};

    const cyclicalInstitutional =
      cyclicalHistory.institutional || {};

    const cyclicalMargin =
      cyclicalHistory.margin || {};

    const cyclicalRevenueGrowth =
      available(cyclicalRevenue.year_over_year_pct)
        ? Number(cyclicalRevenue.year_over_year_pct)
        : null;

    const cyclicalIncomeChange =
      available(cyclicalFinancial.income_change_yoy_pct)
        ? Number(cyclicalFinancial.income_change_yoy_pct)
        : null;

    const cyclicalPrice30d =
      available(cyclicalPrice.changes?.["30d_pct"])
        ? Number(cyclicalPrice.changes["30d_pct"])
        : null;

    const cyclicalInstitutional20d =
      available(cyclicalInstitutional.windows?.["20d_net_buy"])
        ? Number(cyclicalInstitutional.windows["20d_net_buy"])
        : null;

    const cyclicalInstitutionalPercentile =
      available(cyclicalInstitutional.percentile_20d)
        ? Number(cyclicalInstitutional.percentile_20d)
        : null;

    const cyclicalMargin20d =
      available(cyclicalMargin.changes?.["20d_pct"])
        ? Number(cyclicalMargin.changes["20d_pct"])
        : null;

    let cyclicalOperatingTone = "caution";
    let cyclicalOperatingTitle =
      "營運歷史尚未形成完整比較";
    let cyclicalOperatingCopy =
      "收入年度比較或最近四季獲利仍有一項尚未形成，因此目前不直接判定景氣回溫。";

    if (
      cyclicalRevenueGrowth !== null &&
      cyclicalIncomeChange !== null
    ) {
      if (
        cyclicalRevenueGrowth > 0 &&
        cyclicalIncomeChange > 0
      ) {
        cyclicalOperatingTone = "positive";
        cyclicalOperatingTitle =
          "收入與獲利一起改善";
        cyclicalOperatingCopy =
          `最新收入比去年同期增加 ${cyclicalRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利增加 ${cyclicalIncomeChange.toFixed(1)}%。` +
          "兩項營運資料同時改善，支持營運循環正在回溫。";
      } else if (
        cyclicalRevenueGrowth > 0 &&
        cyclicalIncomeChange <= 0
      ) {
        cyclicalOperatingTitle =
          "收入增加，但獲利尚未跟上";
        cyclicalOperatingCopy =
          `最新收入比去年同期增加 ${cyclicalRevenueGrowth.toFixed(1)}%，` +
          `但最近四季獲利比一年前減少 ${Math.abs(cyclicalIncomeChange).toFixed(1)}%。` +
          "營收規模增加，但獲利尚未同步改善。";
      } else if (
        cyclicalRevenueGrowth <= 0 &&
        cyclicalIncomeChange > 0
      ) {
        cyclicalOperatingTone = "neutral";
        cyclicalOperatingTitle =
          "獲利改善，但收入尚未回升";
        cyclicalOperatingCopy =
          `最近四季獲利比一年前增加 ${cyclicalIncomeChange.toFixed(1)}%，` +
          `但最新收入比去年同期減少 ${Math.abs(cyclicalRevenueGrowth).toFixed(1)}%。`;
      } else {
        cyclicalOperatingTitle =
          "收入與獲利都還沒有回升";
        cyclicalOperatingCopy =
          `最新收入比去年同期減少 ${Math.abs(cyclicalRevenueGrowth).toFixed(1)}%，` +
          `最近四季獲利比一年前減少 ${Math.abs(cyclicalIncomeChange).toFixed(1)}%。`;
      }
    }

    const cyclicalOperatingBasis = [
      `${Number(cyclicalRevenue.sample_count || 0)} 個月收入歷史`,
      `${Number(cyclicalRevenue.yoy_sample_count || 0)} 次年度比較`,
      `${Number(cyclicalFinancial.quarter_sample_count || 0)} 季財報`,
    ].join("｜");

    reasons = [
      item(
        cyclicalOperatingTone,
        cyclicalOperatingTitle,
        cyclicalOperatingCopy,
        cyclicalOperatingBasis,
        cyclicalRevenueGrowth !== null
          ? `${cyclicalRevenueGrowth >= 0 ? "+" : ""}${cyclicalRevenueGrowth.toFixed(1)}%`
          : "收入待比較",
        cyclicalIncomeChange !== null
          ? `${cyclicalIncomeChange >= 0 ? "+" : ""}${cyclicalIncomeChange.toFixed(1)}%`
          : "獲利待比較",
        "公司月收入與季度財報歷史"
      ),
      item(
        cyclicalPrice30d !== null && cyclicalPrice30d > 10
          ? "positive"
          : "neutral",
        "股價與法人買盤已經轉強",
        cyclicalPrice30d !== null && cyclicalInstitutional20d !== null
          ? `近 30 個交易日股價上漲 ${cyclicalPrice30d.toFixed(1)}%，法人近 20 日買進多於賣出。這代表市場反應偏強，但不能取代營運證據。`
          : "近期市場訊號有所變化，但仍要等待營運資料確認。",
        cyclicalInstitutionalPercentile !== null
          ? `近 30 日股價變化 ${cyclicalPrice30d?.toFixed(1) || "—"}%｜法人買賣位於自身歷史第 ${cyclicalInstitutionalPercentile.toFixed(1)} 百分位`
          : `近 30 日股價變化 ${cyclicalPrice30d?.toFixed(1) || "—"}%`,
        cyclicalPrice30d !== null
          ? `${cyclicalPrice30d.toFixed(1)}%`
          : "近 30 日股價變化未提供",
        cyclicalInstitutionalPercentile !== null
          ? `第 ${cyclicalInstitutionalPercentile.toFixed(1)} 百分位`
          : "法人歷史百分位未提供",
        "歷史股價與三大法人每日買賣資料"
      ),
      item(
        cyclicalMargin20d !== null && cyclicalMargin20d < 0
          ? "positive"
          : "neutral",
        cyclicalMargin20d !== null && cyclicalMargin20d < 0
          ? "股價上漲期間，融資部位反而減少"
          : "GC 會持續檢查融資是否快速增加",
        cyclicalMargin20d !== null
          ? `近 20 個交易日融資部位${cyclicalMargin20d >= 0 ? "增加" : "減少"} ${Math.abs(cyclicalMargin20d).toFixed(1)}%。目前${cyclicalMargin20d < 0 ? "不是融資追價主導" : "需要留意借錢追價壓力"}。`
          : "目前沒有可用的近 20 日融資變化。",
        cyclicalMargin20d !== null
          ? `近 20 日融資變化 ${cyclicalMargin20d.toFixed(1)}%`
          : "近 20 日融資變化未提供",
        cyclicalMargin20d !== null
          ? `${cyclicalMargin20d.toFixed(1)}%`
          : "20 日變化未提供",
        `${Number(cyclicalMargin.sample_count || 0)} 個交易日`,
        "交易所融資融券歷史資料"
      ),
    ];

    followUp = [
      cyclicalRevenueGrowth !== null && cyclicalRevenueGrowth > 0
        ? "GC 會追蹤下一次月收入是否延續目前的成長"
        : cyclicalRevenueGrowth !== null
          ? "GC 會追蹤下一次月收入是否停止減少"
          : "GC 會在下一次月收入公布後重新判斷收入方向",
      cyclicalIncomeChange !== null && cyclicalIncomeChange > 0
        ? "GC 會追蹤下一季財報，確認獲利改善能否延續"
        : cyclicalIncomeChange !== null
          ? "GC 會追蹤下一季財報，確認獲利是否停止減少"
          : "GC 會在下一季財報公布後重新判斷獲利方向",
      cyclicalPrice30d !== null &&
      cyclicalPrice30d > 10 &&
      !(
        cyclicalRevenueGrowth !== null &&
        cyclicalRevenueGrowth > 0 &&
        cyclicalIncomeChange !== null &&
        cyclicalIncomeChange > 0
      )
        ? "如果股價持續上漲但收入與獲利沒有一起改善，GC 會提高價格先行的風險提醒"
        : "GC 會持續比較市場價格與營運方向是否一致",
    ];
  } else if (profileId === "high_volatility_event") {
    typeDescription =
      "這家公司容易受到消息影響，GC 會分開檢查營運、事件與市場反應";

    const eventHistory =
      report.historical_context?.categories || {};

    const eventRevenueHistory =
      eventHistory.revenue || {};

    const eventFinancialHistory =
      eventHistory.financial || {};

    const eventRevenueGrowth =
      available(eventRevenueHistory.year_over_year_pct)
        ? Number(eventRevenueHistory.year_over_year_pct)
        : null;

    const eventIncomeChange =
      available(eventFinancialHistory.income_change_yoy_pct)
        ? Number(eventFinancialHistory.income_change_yoy_pct)
        : null;

    const eventRevenueMonths =
      Number(eventRevenueHistory.sample_count || 0);

    const eventRevenueComparisons =
      Number(eventRevenueHistory.yoy_sample_count || 0);

    const eventFinancialQuarters =
      Number(eventFinancialHistory.quarter_sample_count || 0);

    const confirmedEventCount =
      Number(metrics.confirmed_company_event_count || 0);

    const integratedEventPriceHistory =
      report.historical_context?.categories?.price || {};

    const integratedEventVolatility20d =
      available(integratedEventPriceHistory.volatility_20d_pct)
        ? Number(integratedEventPriceHistory.volatility_20d_pct)
        : null;

    const integratedEventPrice30d =
      available(integratedEventPriceHistory.changes?.["30d_pct"])
        ? Number(integratedEventPriceHistory.changes["30d_pct"])
        : null;

    const integratedEventPrice90d =
      available(integratedEventPriceHistory.changes?.["90d_pct"])
        ? Number(integratedEventPriceHistory.changes["90d_pct"])
        : null;

    const integratedEventPriceFacts = [];

    if (integratedEventVolatility20d !== null) {
      integratedEventPriceFacts.push(
        `近 20 日波動 ${integratedEventVolatility20d.toFixed(1)}%`
      );
    }

    if (integratedEventPrice30d !== null) {
      integratedEventPriceFacts.push(
        `近 30 日漲跌 ${integratedEventPrice30d >= 0 ? "+" : ""}` +
        `${integratedEventPrice30d.toFixed(1)}%`
      );
    }

    if (integratedEventPrice90d !== null) {
      integratedEventPriceFacts.push(
        `近 90 日漲跌 ${integratedEventPrice90d >= 0 ? "+" : ""}` +
        `${integratedEventPrice90d.toFixed(1)}%`
      );
    }

    const integratedEventPriceIsHighlyVolatile =
      integratedEventVolatility20d !== null &&
      integratedEventVolatility20d >= 40;

    const integratedEventPriceMovedQuickly =
      (
        integratedEventPrice30d !== null &&
        Math.abs(integratedEventPrice30d) >= 10
      ) ||
      (
        integratedEventPrice90d !== null &&
        Math.abs(integratedEventPrice90d) >= 20
      );

    let integratedEventPriceTone = "neutral";
    let integratedEventPriceTitle =
      "近期價格沒有出現極端變化";
    let integratedEventPriceCopy =
      "近期價格仍可能受到新消息影響，但目前歷史價格沒有顯示極端單向變化。";

    if (integratedEventPriceIsHighlyVolatile) {
      integratedEventPriceTone = "caution";
      integratedEventPriceTitle =
        "股價起伏很大，短期可能快速反轉";
      integratedEventPriceCopy =
        `依最近 20 個交易日價格換算，股價波動程度約 ` +
        `${integratedEventVolatility20d.toFixed(1)}%。` +
        "即使營運方向判斷正確，短期價格仍可能出現明顯反向變化。";
    } else if (integratedEventPriceMovedQuickly) {
      integratedEventPriceTone = "caution";
      integratedEventPriceTitle =
        "近期價格變動較大，仍要留意快速反轉";
      integratedEventPriceCopy =
        "近期股價已出現較大的方向變化，但價格反應不能取代收入與獲利證據。";
    } else if (!integratedEventPriceFacts.length) {
      integratedEventPriceTitle =
        "目前沒有可用的近期價格變化";
      integratedEventPriceCopy =
        "目前沒有可用的近 20 日波動或近 30、90 日價格變化，因此不判定近期價格風險方向。";
    }

    let eventOperatingTone = "caution";
    let eventOperatingTitle =
      "營運歷史尚未形成完整比較";
    let eventOperatingCopy =
      "收入年度比較或最近四季獲利仍有一項尚未形成，因此不直接判定事件已經改變營運。";

    if (
      eventRevenueGrowth !== null &&
      eventIncomeChange !== null
    ) {
      if (
        eventRevenueGrowth > 0 &&
        eventIncomeChange > 0
      ) {
        eventOperatingTone = "positive";
        eventOperatingTitle =
          "收入與獲利都在改善";
        eventOperatingCopy =
          `最新一個月收入增加 ${eventRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利也增加 ${eventIncomeChange.toFixed(1)}%。` +
          "目前營運改善有實際資料支持，不只來自股價或消息。";
      } else if (
        eventRevenueGrowth > 0 &&
        eventIncomeChange <= 0
      ) {
        eventOperatingTitle =
          "收入增加，但獲利尚未跟上";
        eventOperatingCopy =
          `最新一個月收入增加 ${eventRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利變化 ${eventIncomeChange >= 0 ? "+" : ""}${eventIncomeChange.toFixed(1)}%。`;
      } else if (
        eventRevenueGrowth <= 0 &&
        eventIncomeChange > 0
      ) {
        eventOperatingTone = "neutral";
        eventOperatingTitle =
          "獲利增加，但收入尚未回升";
        eventOperatingCopy =
          `最近四季獲利增加 ${eventIncomeChange.toFixed(1)}%，` +
          `最新一個月收入變化 ${eventRevenueGrowth >= 0 ? "+" : ""}${eventRevenueGrowth.toFixed(1)}%。`;
      } else {
        eventOperatingTitle =
          "收入與獲利都尚未改善";
        eventOperatingCopy =
          `最新一個月收入變化 ${eventRevenueGrowth >= 0 ? "+" : ""}${eventRevenueGrowth.toFixed(1)}%，` +
          `最近四季獲利變化 ${eventIncomeChange >= 0 ? "+" : ""}${eventIncomeChange.toFixed(1)}%。`;
      }
    }

    reasons = [
      item(
        eventOperatingTone,
        eventOperatingTitle,
        eventOperatingCopy,
        `比較資料：${eventRevenueMonths} 個月收入歷史｜` +
          `${eventRevenueComparisons} 次年度比較｜` +
          `${eventFinancialQuarters} 季財報`,
        eventRevenueGrowth !== null
          ? `收入 ${eventRevenueGrowth >= 0 ? "+" : ""}${eventRevenueGrowth.toFixed(1)}%`
          : "收入待比較",
        eventIncomeChange !== null
          ? `獲利 ${eventIncomeChange >= 0 ? "+" : ""}${eventIncomeChange.toFixed(1)}%`
          : "獲利待比較",
        "公司月收入與季度財報歷史"
      ),
      item(
        integratedEventPriceTone,
        integratedEventPriceTitle,
        integratedEventPriceCopy,
        integratedEventPriceFacts.length
          ? `比較資料：${integratedEventPriceFacts.join("｜")}`
          : "比較資料：近期歷史價格變化未提供",
        integratedEventVolatility20d !== null
          ? `${integratedEventVolatility20d.toFixed(1)}%`
          : "20 日波動未提供",
        integratedEventPrice30d !== null
          ? `${integratedEventPrice30d >= 0 ? "+" : ""}${integratedEventPrice30d.toFixed(1)}%`
          : (
              integratedEventPrice90d !== null
                ? `${integratedEventPrice90d >= 0 ? "+" : ""}${integratedEventPrice90d.toFixed(1)}%`
                : "近期漲跌未提供"
            ),
        "交易所歷史股價資料"
      ),
      item(
        confirmedEventCount > 0
          ? "caution"
          : "neutral",
        confirmedEventCount > 0
          ? `目前有 ${confirmedEventCount} 項重要公司事件`
          : "目前沒有新的重大公司事件",
        confirmedEventCount > 0
          ? "GC 已找到需要追蹤的重要公司事件，但會等待收入或獲利資料確認事件是否真的改變營運。"
          : "目前確認事件數為 0；這代表沒有新的重大公司事件，不代表事件資料不足。",
        `已確認的重要公司事件 ${confirmedEventCount} 項`,
        `${confirmedEventCount} 項`,
        confirmedEventCount > 0
          ? "等待營運確認"
          : "目前無新事件",
        "公司公告與公開新聞來源"
      ),
    ];

    followUp = [
      confirmedEventCount > 0
        ? "GC 會追蹤已確認事件是否開始影響公司的收入或獲利"
        : "GC 會持續監測是否出現新的重大公司公告",
      eventRevenueGrowth !== null
        ? "GC 會追蹤下一次月收入是否延續目前方向"
        : "GC 會等待收入形成年度比較後再判斷營運方向",
      eventIncomeChange !== null
        ? "GC 會追蹤下一季財報，確認獲利方向是否改變"
        : "GC 會等待季度獲利形成比較後再判斷事件影響",
    ];
  } else {
    const indicators =
      Array.isArray(report.indicators)
        ? report.indicators.slice(0, 3)
        : [];

    reasons = indicators.map((indicator) =>
      item(
        "neutral",
        indicator.label || "目前最重要的公司變化",
        indicator.description || "GC 已整理目前可用的公司與市場資料。",
        `判斷依據：${indicator.source_label_zh || "公司與市場公開資料"}`,
        number(indicator.score, 1, " 分"),
        indicator.level || "目前狀態",
        indicator.source_label_zh || "公開資料"
      )
    );

    followUp = [
      "GC 會追蹤公司的收入和獲利是否出現明顯變化",
      "GC 會檢查目前股價和公司表現是否一致",
      "GC 會在出現重要公司消息時重新整理判斷",
    ];
  }

  $("integratedDecisionType").textContent = typeDescription;

  $("integratedReasonGrid").innerHTML = reasons
    .slice(0, 3)
    .map((reason, index) => `
      <article class="integrated-reason ${reason.tone}">
        <span>重點 ${index + 1}</span>
        <h3>${escapeHtml(reason.title)}</h3>

        <section class="guided-copy-block">
          <p>${escapeHtml(reason.copy)}</p>
        </section>

        <small class="guided-copy-basis">
          ${escapeHtml(reason.basis)}
        </small>

        <details class="guided-evidence-detail">
          <summary>
            查看 GC 的判斷依據
            <span>＋</span>
          </summary>
          <dl>
            <div>
              <dt>主要資料</dt>
              <dd>${escapeHtml(reason.primary)}</dd>
            </div>
            <div>
              <dt>比較結果</dt>
              <dd>${escapeHtml(reason.secondary)}</dd>
            </div>
            <div>
              <dt>資料來源</dt>
              <dd>${escapeHtml(reason.source)}</dd>
            </div>
          </dl>
        </details>
      </article>
    `)
    .join("");

  $("integratedReasonGrid")
    .querySelectorAll(".guided-evidence-detail")
    .forEach((detail) => {
      if (detail.dataset.guidedAccordionBound === "true") return;

      detail.dataset.guidedAccordionBound = "true";

      detail.addEventListener("toggle", () => {
        if (!detail.open) return;

        $("integratedReasonGrid")
          .querySelectorAll(".guided-evidence-detail")
          .forEach((other) => {
            if (other !== detail) {
              other.open = false;
            }
          });
      });
    });

  $("integratedFollowUpList").innerHTML = followUp
    .slice(0, 3)
    .map(
      (trackingItem, index) => `
        <li>
          <b>${index + 1}</b>
          <span>${escapeHtml(trackingItem)}</span>
        </li>
      `
    )
    .join("");

  const history = (Array.isArray(report.score_history) ? report.score_history : [])
    .slice(-10)
    .map((item) => ({
      date: String(item.date || ""),
      score: Number(item.score),
      risk: Number(item.risk),
      confidence: Number(item.confidence),
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
  const firstHistoryItem = history[0];
  const latestHistoryItem = history[history.length - 1];

  const lowestHistoryItem = history.reduce(
    (lowest, item) =>
      item.score < lowest.score
        ? item
        : lowest
  );

  const highestHistoryItem = history.reduce(
    (highest, item) =>
      item.score > highest.score
        ? item
        : highest
  );

  const change =
    latestHistoryItem.score -
    firstHistoryItem.score;

  const absoluteChange =
    Math.abs(change);

  const riskChange =
    Number.isFinite(firstHistoryItem.risk) &&
    Number.isFinite(latestHistoryItem.risk)
      ? latestHistoryItem.risk - firstHistoryItem.risk
      : null;

  const confidenceChange =
    Number.isFinite(firstHistoryItem.confidence) &&
    Number.isFinite(latestHistoryItem.confidence)
      ? latestHistoryItem.confidence - firstHistoryItem.confidence
      : null;

  const trendDimensions = [];

  if (
    riskChange !== null &&
    Math.abs(riskChange) >= 1
  ) {
    trendDimensions.push(
      `同期風險壓力${riskChange > 0 ? "增加" : "減少"} ` +
      `${Math.abs(riskChange).toFixed(1)} 分`
    );
  }

  if (
    confidenceChange !== null &&
    Math.abs(confidenceChange) >= 1
  ) {
    trendDimensions.push(
      `同期判斷把握度${confidenceChange > 0 ? "提高" : "降低"} ` +
      `${Math.abs(confidenceChange).toFixed(1)} 分`
    );
  }

  const trendCategories =
    report.historical_context?.categories || {};

  const trendRevenue =
    trendCategories.revenue || {};

  const trendFinancial =
    trendCategories.financial || {};

  const currentRevenueChange =
    available(trendRevenue.year_over_year_pct)
      ? Number(trendRevenue.year_over_year_pct)
      : null;

  const currentIncomeChange =
    available(trendFinancial.income_change_yoy_pct)
      ? Number(trendFinancial.income_change_yoy_pct)
      : null;

  let currentOperatingSummary = "";

  if (
    currentRevenueChange !== null &&
    currentIncomeChange !== null
  ) {
    if (
      currentRevenueChange > 0 &&
      currentIncomeChange > 0
    ) {
      currentOperatingSummary =
        "目前收入與獲利都比一年前增加。";
    } else if (
      currentRevenueChange > 0 &&
      currentIncomeChange <= 0
    ) {
      currentOperatingSummary =
        "目前收入增加，但獲利尚未同步改善。";
    } else if (
      currentRevenueChange <= 0 &&
      currentIncomeChange > 0
    ) {
      currentOperatingSummary =
        "目前獲利增加，但收入尚未回升。";
    } else {
      currentOperatingSummary =
        "目前收入與獲利都尚未回升。";
    }
  }

  let trendConclusion;

  if (absoluteChange < 3) {
    trendConclusion =
      "最近幾次更新，研究分數大致持平";
  } else if (change >= 8) {
    trendConclusion =
      "最近幾次更新，研究分數明顯上升";
  } else if (change >= 3) {
    trendConclusion =
      "最近幾次更新，研究分數有所上升";
  } else if (change <= -8) {
    trendConclusion =
      "最近幾次更新，研究分數明顯下降";
  } else {
    trendConclusion =
      "最近幾次更新，研究分數有所下降";
  }

  const rebound =
    latestHistoryItem.score -
    lowestHistoryItem.score;

  let trendMovement = "";

  if (
    lowestHistoryItem !== latestHistoryItem &&
    rebound >= 3
  ) {
    trendMovement =
      `期間曾降到 ${lowestHistoryItem.score.toFixed(1)} 分，` +
      `目前已回升到 ${latestHistoryItem.score.toFixed(1)} 分。`;
  } else if (
    highestHistoryItem !== latestHistoryItem &&
    highestHistoryItem.score - latestHistoryItem.score >= 3
  ) {
    trendMovement =
      `期間最高為 ${highestHistoryItem.score.toFixed(1)} 分，` +
      `目前為 ${latestHistoryItem.score.toFixed(1)} 分。`;
  }

  const formatHistoryDate = (value) =>
    String(value || "")
      .slice(5)
      .replace("-", "/");

  $("integratedTrendSummary").innerHTML = `
    <strong>${escapeHtml(trendConclusion)}</strong>
    ${
      trendMovement
        ? `<span>${escapeHtml(trendMovement)}</span>`
        : ""
    }
    ${
      currentOperatingSummary
        ? `<span>${escapeHtml(currentOperatingSummary)}</span>`
        : ""
    }
    ${
      trendDimensions.length
        ? `<span>${escapeHtml(trendDimensions.join("｜"))}</span>`
        : ""
    }
    <small>
      比較期間：
      ${escapeHtml(formatHistoryDate(firstHistoryItem.date))}
      ～
      ${escapeHtml(formatHistoryDate(latestHistoryItem.date))}
      ｜${firstHistoryItem.score.toFixed(1)}
      →
      ${latestHistoryItem.score.toFixed(1)}
      （${change >= 0 ? "+" : ""}${change.toFixed(1)}）
    </small>
  `;
}
function cleanProHtml(html) {
  return String(html || "")
    .replace(/\s+id="[^"]*"/g, "")
    .replace(/\s+aria-labelledby="[^"]*"/g, "");
}

function setProResearchTab(tab) {
  const value = ["overview", "valuation", "evidence", "history"].includes(tab)
    ? tab
    : "overview";

  document.querySelectorAll("[data-pro-tab]").forEach((button) => {
    const active = button.dataset.proTab === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll("[data-pro-panel]").forEach((panel) => {
    const active = panel.dataset.proPanel === value;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}


function proResearchText(value, fallback = "") {
  if (typeof value === "string") return value.trim() || fallback;
  if (!value || typeof value !== "object") return fallback;
  return String(
    value.label_zh || value.title_zh || value.label || value.title ||
    value.name_zh || value.name || value.feature_zh || value.feature || fallback
  ).trim();
}

function proResearchDetail(value, fallback = "") {
  if (!value || typeof value !== "object") return fallback;
  return String(
    value.explanation_zh || value.description_zh || value.reason_zh ||
    value.description || value.reason || value.evidence_zh || fallback
  ).trim();
}

function proResearchProfileThesis(report) {
  const profileId = report?.stock_profile?.profile_id || "default";
  const profile = stockDecisionProfile(report);
  const decision = profile?.decision || {};
  const definitions = {
    financial_income: {
      label: "INCOME & CAPITAL QUALITY",
      question: "配息能否由獲利、資本品質與合理估值共同支撐？",
      method: "以股利延續、ROE、資產品質、資本強度與股價淨值比交叉驗證。",
    },
    growth_quality: {
      label: "GROWTH QUALITY",
      question: "收入成長能否轉化為獲利與現金流，並支撐目前估值？",
      method: "以收入、EPS、自由現金流、同組動能與估值位置交叉驗證。",
    },
    cyclical: {
      label: "CYCLE POSITIONING",
      question: "營運是否正處於可延續的循環轉折，而非短期價格反彈？",
      method: "以收入、獲利、報價／運價、庫存、資金與估值循環交叉驗證。",
    },
    high_volatility: {
      label: "EVENT & VOLATILITY",
      question: "事件影響是否已落地為營運證據，市場反應是否超前？",
      method: "以正式事件、營運落地、波動與事件前後估值變化交叉驗證。",
    },
    event_driven: {
      label: "EVENT VALIDATION",
      question: "重大事件是否正在改變公司的收入、獲利或風險結構？",
      method: "以官方來源、事件進度、營運結果與市場反應交叉驗證。",
    },
  };
  const definition = definitions[profileId] || {
    label: "MULTI-FACTOR RESEARCH",
    question: "公司的營運、風險、價格位置與市場證據是否一致？",
    method: "以目前可用的公司、財務、市場與事件證據建立研究輪廓。",
  };

  return {
    ...definition,
    stance: decision.unheld || report?.overview?.summary_zh || report?.summary || "等待更多證據",
    rationale: decision.reason_zh || definition.method,
  };
}

function proResearchMonitoring(report) {
  const profileId = report?.stock_profile?.profile_id || "default";
  const profile = stockDecisionProfile(report);
  const metrics = profile?.metrics || {};
  const company = report?.investment_research?.company_profile || {};
  const fit = report?.investment_research?.research_fit || {};
  const risks = Array.isArray(company.key_risks_zh) ? company.key_risks_zh : [];
  const followUps = Array.isArray(fit.follow_up_items_zh) ? fit.follow_up_items_zh : [];
  const number = (value, digits = 1, suffix = "%") => {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? `${parsed > 0 ? "+" : ""}${parsed.toFixed(digits)}${suffix}`
      : "—";
  };

  let driver = {
    title: "多因子研究狀態",
    copy: "目前以營運、風險、價格位置與市場證據建立研究輪廓。",
  };
  let risk = {
    title: proResearchText(risks[0], "主要風險仍在確認"),
    copy: proResearchText(risks[1], "下一次資料更新後，確認風險是否擴大或解除。"),
  };
  let validation = {
    title: proResearchText(followUps[0], "等待下一個可驗證資料點"),
    copy: proResearchText(followUps[1], "重新核對研究命題、估值與風險是否改變。"),
  };

  if (profileId === "growth_quality") {
    driver = {
      title: "收入與獲利成長品質",
      copy: `收入年增 ${number(metrics.revenue_yoy_pct)}，EPS 年增 ${number(metrics.eps_growth_yoy_pct)}；下一步核對現金流與成長是否同向。`,
    };
    risk = {
      title: proResearchText(risks[0], "成長與估值預期落差"),
      copy: proResearchText(risks[1], `同組動能排名 ${metrics.sector_rank || "—"}/${metrics.sector_peer_count || "—"}；若獲利未追上價格，估值壓力可能提高。`),
    };
  } else if (profileId === "financial_income") {
    driver = {
      title: "股利收益與資本品質",
      copy: `目前殖利率 ${number(metrics.dividend_yield_pct, 2)}，同組排名 ${metrics.dividend_yield_rank || "—"}/${metrics.peer_count || "—"}；需由盈餘與資本強度共同支撐。`,
    };
    risk = {
      title: proResearchText(risks[0], "股利延續與資產品質"),
      copy: proResearchText(risks[1], `股價淨值比 ${number(metrics.pb_ratio, 2, " 倍")}；高殖利率不能取代 ROE、資產品質與資本風險檢查。`),
    };
  } else if (profileId === "cyclical") {
    driver = {
      title: "景氣循環與營運轉折",
      copy: `收入年增 ${number(metrics.revenue_yoy_pct)}、月增 ${number(metrics.revenue_mom_pct)}；需確認需求、報價或運價是否共同改善。`,
    };
    risk = {
      title: proResearchText(risks[0], "循環反轉與籌碼壓力"),
      copy: proResearchText(risks[1], `近 20 日報酬 ${number(metrics.return_20d_pct)}；價格領先營運時，需防範循環尚未落地。`),
    };
  } else if (
    profileId === "high_volatility" ||
    profileId === "event_driven" ||
    profileId === "high_volatility_event"
  ) {
    driver = {
      title: "事件進度與營運落地",
      copy: `目前已確認公司事件 ${Number(metrics.confirmed_company_event_count || 0)} 項；事件必須由後續收入、獲利或風險變化驗證。`,
    };
    risk = {
      title: proResearchText(risks[0], "高波動與事件落空風險"),
      copy: proResearchText(risks[1], `近 20 日波動 ${number(metrics.volatility_20d_pct)}；單日價格反應不能替代正式證據。`),
    };
  }

  return [
    {key: "01", label: "PRIMARY DRIVER", ...driver, tone: "positive"},
    {key: "02", label: "CORE RISK", ...risk, tone: "caution"},
    {key: "03", label: "NEXT VALIDATION", ...validation, tone: "neutral"},
  ];
}

function renderProExecutiveOverview(report) {
  if (!$("proExecutiveOverview")) return;

  const thesis = proResearchProfileThesis(report);
  const profileLabel = report?.stock_profile?.label_zh || "綜合研究型";
  const profileGroup = report?.stock_profile?.comparison_group_zh || "多因子比較框架";
  const overall = report?.score_delta?.overall || {};
  const change = Number(overall.change);
  const changeAvailable = overall.available && Number.isFinite(change);
  const risk = Number(report.risk);
  const confidence = Number(report.confidence);
  const valuation = report?.investment_research?.valuation || {};

  $("proProfileLabel").textContent = thesis.label;
  $("proProfileGroup").textContent = `${profileLabel} · ${profileGroup}`;
  $("proThesisTitle").textContent = thesis.question;
  $("proThesisSummary").textContent = thesis.rationale;

  $("proThesisState").innerHTML = `
    <span>CURRENT STANCE</span>
    <b>${escapeHtml(thesis.stance)}</b>
    <small>${changeAvailable
      ? `較前期 ${change > 0 ? "+" : ""}${change.toFixed(1)} 分`
      : "等待可比較的前期資料"}</small>
  `;

  $("proMonitoringGrid").innerHTML = proResearchMonitoring(report)
    .map((item) => `
      <article class="pro-monitor-item ${item.tone}">
        <div><span>${item.key}</span><small>${escapeHtml(item.label)}</small></div>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.copy)}</p>
      </article>
    `).join("");

  $("proExecutiveOverview").dataset.riskState = Number.isFinite(risk)
    ? (risk >= 65 ? "high" : risk >= 40 ? "medium" : "controlled")
    : "unknown";
  $("proExecutiveOverview").dataset.confidenceState = Number.isFinite(confidence)
    ? (confidence >= 75 ? "supported" : confidence >= 50 ? "developing" : "limited")
    : "unknown";
  $("proExecutiveOverview").dataset.valuationState = valuation.status || "unavailable";
}


function positionProResearchWorkspace() {
  const workspace = $("proResearchWorkspace");
  const guidedAnalysis = $("integratedDecision");
  if (!workspace || !guidedAnalysis || !guidedAnalysis.parentNode) return;
  if (workspace.nextElementSibling === guidedAnalysis) return;
  guidedAnalysis.parentNode.insertBefore(workspace, guidedAnalysis);
}

function renderProResearch(report) {
  if (!$("proResearchWorkspace")) return;

  positionProResearchWorkspace();

  const score = Number(report.score);
  const risk = Number(report.risk);
  const confidence = Number(report.confidence);
  const investment = report.investment_research || {};
  const valuation = investment.valuation || {};
  const valuationMetrics = Array.isArray(valuation.metrics)
    ? valuation.metrics
    : [];

  renderProExecutiveOverview(report);

  const history = (Array.isArray(report.score_history) ? report.score_history : [])
    .map((item) => Number(item.score))
    .filter(Number.isFinite);

  const scoreChange = history.length > 1
    ? history[history.length - 1] - history[0]
    : null;

  const coreItems = [
    {
      key: "Health",
      label: "健康狀態",
      value: Number.isFinite(score) ? score.toFixed(1) : "—",
      meta: report.assessment || "健康狀態尚未分類",
      tone: score >= 75 ? "positive" : score >= 55 ? "neutral" : "caution",
    },
    {
      key: "Risk",
      label: "風險壓力",
      value: Number.isFinite(risk) ? `${Math.round(risk)} / 100` : "—",
      meta: report.risk_level || "風險程度尚未分類",
      tone: risk >= 65 ? "caution" : risk >= 40 ? "neutral" : "positive",
    },
    {
      key: "Valuation",
      label:
        valuation.comparison_scope === "current_peer_group"
          ? "同組估值比較"
          : valuation.comparison_scope === "official_metrics_only"
            ? "正式估值數字"
            : valuation.comparison_scope === "historical_price_position"
              ? "自身歷史價格位置"
              : "價格比較狀態",
      value:
        valuation.comparison_scope === "current_peer_group"
          ? "同組比較可用"
          : valuation.comparison_scope === "official_metrics_only"
            ? "正式數字可用"
            : valuation.comparison_scope === "historical_price_position"
              ? "歷史位置可用"
              : researchStatus(valuation.status),
      meta:
        valuation.headline_zh ||
        "價格比較範圍尚未分類",
      tone: "neutral",
    },
    {
      key: "Confidence",
      label: "判斷把握度",
      value: Number.isFinite(confidence) ? `${Math.round(confidence)} / 100` : "—",
      meta: report.confidence_level || "判斷把握度尚未分類",
      tone: confidence >= 75 ? "positive" : confidence >= 50 ? "neutral" : "caution",
    },
  ];

  $("proCoreGrid").innerHTML = coreItems.map((item) => `
    <article class="pro-core-item ${item.tone}">
      <span>${escapeHtml(item.key)}</span>
      <small>${escapeHtml(item.label)}</small>
      <strong>${escapeHtml(item.value)}</strong>
      <p>${escapeHtml(item.meta)}</p>
    </article>
  `).join("");

  const indicators = Array.isArray(report.indicators)
    ? report.indicators
    : [];

  $("proIndicatorList").innerHTML = indicators.length
    ? indicators.slice(0, 5).map((item) => {
        const value = Number(item.score);
        return `
          <article>
            <div>
              <b>${escapeHtml(item.label || "研究指標")}</b>
              <small>${escapeHtml(item.level || "指標狀態未分類")}</small>
            </div>
            <strong>${Number.isFinite(value) ? value.toFixed(1) : "—"}</strong>
            <span>${escapeHtml(item.description || "")}</span>
          </article>
        `;
      }).join("")
    : '<p class="pro-empty">本次報告未列出個別研究指標。</p>';

  $("proResearchDate").textContent =
    report.updated && report.updated !== "—"
      ? `資料日期 ${report.updated}`
      : "資料日期未提供";

  $("proValuationTitle").textContent =
    valuation.headline_zh || "估值比較狀態未提供";

  $("proValuationSummary").innerHTML = `
    <span class="pro-data-status">${escapeHtml(researchStatus(valuation.status))}</span>
    <div class="pro-valuation-metrics">
      ${
        valuationMetrics.length
          ? valuationMetrics.slice(0, 5).map((item) => `
              <div>
                <span>${escapeHtml(item.label_zh || "估值指標")}</span>
                <b>${
                  item.value == null
                    ? "—"
                    : `${Number(item.value).toLocaleString("zh-TW", {maximumFractionDigits: 2})}${escapeHtml(item.unit || "")}`
                }</b>
                <small>${escapeHtml(item.basis_zh || "")}</small>
              </div>
            `).join("")
          : '<p class="pro-empty">本次報告未提供可顯示的估值指標。</p>'
      }
    </div>
    ${
      valuation.interpretation_zh
        ? `<p class="pro-interpretation">${escapeHtml(valuation.interpretation_zh)}</p>`
        : ""
    }
    ${
      valuation.missing_items_zh?.length
        ? `<small class="pro-missing">未納入比較：${valuation.missing_items_zh.map(escapeHtml).join("、")}</small>`
        : ""
    }
  `;

  $("proComparisonSummary").innerHTML = cleanProHtml(
    $("comparisonResearch")?.innerHTML
  );

  const scoreBridge = cleanProHtml($("scoreBridge")?.innerHTML);
  const positive = cleanProHtml($("positiveFactors")?.innerHTML);
  const negative = cleanProHtml($("negativeFactors")?.innerHTML);
  const breakdown = cleanProHtml($("factorBreakdown")?.innerHTML);

  $("proEvidenceSummary").innerHTML = `
    <div class="pro-evidence-headline">
      <div>
        <span>目前研究區間</span>
        <b>${escapeHtml($("scoreInterval")?.textContent || "研究區間未提供")}</b>
      </div>
      <div>
        <span>區間變化</span>
        <b>${
          scoreChange == null
            ? "累積中"
            : `${scoreChange >= 0 ? "+" : ""}${scoreChange.toFixed(1)} 分`
        }</b>
      </div>
    </div>
    <div class="pro-score-bridge">${scoreBridge || '<p class="pro-empty">本次未產生分數變化說明。</p>'}</div>
  `;

  $("proEvidenceDetail").innerHTML = `
    <div class="pro-factor-columns">
      <article><h4>主要加分因素</h4>${positive || "<p>本次未列出加分因素</p>"}</article>
      <article><h4>主要扣分因素</h4>${negative || "<p>本次未列出扣分因素</p>"}</article>
    </div>
    <div class="pro-breakdown">
      <h4>五大面向完整拆解</h4>
      ${breakdown || "<p>本次未產生面向拆解</p>"}
    </div>
  `;

  $("proHistorySummary").innerHTML = cleanProHtml(
    $("historySummary")?.innerHTML
  );

  $("proHistoryChart").innerHTML = cleanProHtml(
    $("historyChart")?.innerHTML
  );

  $("proSourceDetail").innerHTML = cleanProHtml(
    $("sourceGrid")?.innerHTML
  );

  setProResearchTab("overview");
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
    summary.textContent = points.length ? `目前已累積 1 筆：${Number(points[0].score).toFixed(1)} 分。` : "目前有 0 筆可比較的研究分數紀錄。";
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
  $("sourceGrid").innerHTML = (sources || []).map((item) => `<article><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.source)}</span></article>`).join("") || "<p class=\"factor-empty\">本次報告未列出個別資料來源。</p>";
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


function savedComparisonSelection() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(COMPARE_STORAGE_KEY) || "[]"
    );
    return Array.isArray(saved)
      ? [...new Set(saved.map(String))].slice(0, 2)
      : [];
  } catch (_error) {
    return [];
  }
}

function comparisonReport(stockId) {
  return stockCatalog.find(
    (item) => String(item.id) === String(stockId)
  ) || null;
}

function saveComparisonSelection(items) {
  comparisonSelection = [...new Set(
    (Array.isArray(items) ? items : [])
      .map(String)
      .filter((id) => comparisonReport(id))
  )].slice(0, 2);

  localStorage.setItem(
    COMPARE_STORAGE_KEY,
    JSON.stringify(comparisonSelection)
  );

  renderComparisonSelectionBar();
}

function comparisonScore(report) {
  const value = Number(
    report?.score ??
    report?.overview?.health_score
  );
  return Number.isFinite(value) ? value : null;
}

function comparisonRiskScore(report) {
  const value = Number(
    report?.risk ??
    report?.risk_score ??
    report?.overview?.risk_score
  );
  return Number.isFinite(value) ? value : null;
}

function comparisonConfidenceScore(report) {
  const value = Number(
    report?.confidence ??
    report?.confidence_score ??
    report?.overview?.confidence_score
  );
  return Number.isFinite(value) ? value : null;
}

function comparisonProfileLabel(report) {
  return report?.stock_profile?.label_zh ||
    report?.profile_label ||
    "研究類型待確認";
}

function toggleComparisonStock(stockId) {
  const id = String(stockId);
  const current = [...comparisonSelection];
  const existingIndex = current.indexOf(id);

  if (existingIndex >= 0) {
    current.splice(existingIndex, 1);
    saveComparisonSelection(current);
    showToast(`${comparisonReport(id)?.name || id} 已移出比較`);
    renderStockCenter();
    return;
  }

  if (current.length >= 2) {
    const removed = comparisonReport(current[1]);
    current[1] = id;
    saveComparisonSelection(current);
    showToast(
      `已用 ${comparisonReport(id)?.name || id} ` +
      `替換 ${removed?.name || "第二檔股票"}`
    );
    renderStockCenter();
    return;
  }

  current.push(id);
  saveComparisonSelection(current);
  showToast(`${comparisonReport(id)?.name || id} 已加入比較`);
  renderStockCenter();
}

function renderComparisonSelectionBar() {
  const slots = $("compareSelectionSlots");
  const openButton = $("openComparisonButton");
  const clearButton = $("clearComparisonButton");

  if (!slots || !openButton || !clearButton) return;

  const selected = comparisonSelection
    .map(comparisonReport)
    .filter(Boolean);

  slots.innerHTML = [0, 1].map((index) => {
    const report = selected[index];

    if (!report) {
      return `
        <article class="compare-selection-slot empty">
          <span>${index + 1}</span>
          <div><b>選擇第 ${index + 1} 檔</b><small>從下方股票卡加入</small></div>
        </article>
      `;
    }

    return `
      <article class="compare-selection-slot">
        <span>${index + 1}</span>
        <div>
          <b>${escapeHtml(report.name)}</b>
          <small>${escapeHtml(report.id)} · ${escapeHtml(report.industry || report.sector || "產業待確認")}</small>
        </div>
        <button type="button" data-remove-comparison="${escapeHtml(report.id)}"
          aria-label="將 ${escapeHtml(report.name)} 移出比較">×</button>
      </article>
    `;
  }).join("");

  openButton.disabled = selected.length !== 2;
  openButton.textContent = selected.length === 2
    ? `比較 ${selected[0].name} 與 ${selected[1].name}`
    : `已選 ${selected.length}/2 檔`;
  clearButton.disabled = selected.length === 0;

  document.querySelectorAll("[data-remove-comparison]")
    .forEach((button) => button.addEventListener("click", () => {
      toggleComparisonStock(button.dataset.removeComparison);
    }));
}

function comparisonSummaryCard(report, index) {
  const score = comparisonScore(report);
  const risk = comparisonRiskScore(report);
  const confidence = comparisonConfidenceScore(report);
  const valuation = report?.investment_research?.valuation;
  const decision = stockDecisionProfile(report).decision;

  return `
    <article class="comparison-stock-summary">
      <div class="comparison-stock-number">0${index + 1}</div>
      <header>
        <div>
          <span>${escapeHtml(comparisonProfileLabel(report))}</span>
          <h2>${escapeHtml(report.name)}</h2>
          <p>${escapeHtml(report.id)} · ${escapeHtml(report.industry || report.sector || "產業待確認")}</p>
        </div>
        <strong class="${score == null ? "neutral" : levelTone(score)}">
          ${score == null ? "—" : score.toFixed(1)}
          <small>健康分數</small>
        </strong>
      </header>

      <div class="comparison-summary-metrics">
        <article><span>公司狀態</span><b>${escapeHtml(report.assessment || report.overview?.assessment || "尚未分類")}</b></article>
        <article><span>目前風險</span><b>${risk == null ? "—" : `${risk.toFixed(0)} / 100`}</b><small>${escapeHtml(report.risk_level || report.overview?.risk_level || "風險未分類")}</small></article>
        <article><span>價格位置</span><b>${escapeHtml(valuation?.headline_zh || "比較資料未提供")}</b></article>
        <article><span>判斷把握度</span><b>${confidence == null ? "—" : `${confidence.toFixed(0)} / 100`}</b><small>${escapeHtml(report.confidence_level || report.overview?.confidence_level || "把握度未分類")}</small></article>
      </div>

      <div class="comparison-summary-decision">
        <span>目前研究結論</span>
        <b>${escapeHtml(decision?.unheld || report.overview?.summary_zh || "等待更多證據")}</b>
        <p>${escapeHtml(decision?.reason_zh || "完整差異將在下一階段展開。")}</p>
      </div>

      <div class="comparison-summary-actions">
        <button type="button" data-comparison-remove="${escapeHtml(report.id)}">移出比較</button>
        <button type="button" data-comparison-open="${escapeHtml(report.id)}">查看完整報告</button>
      </div>
    </article>
  `;
}


function comparisonFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function comparisonSigned(value, digits = 1, unit = "%") {
  const number = comparisonFinite(value);
  if (number == null) return "—";
  return `${number > 0 ? "+" : ""}${number.toFixed(digits)}${unit}`;
}

function comparisonAvailableProfile(report) {
  return [
    report?.income_profile,
    report?.growth_profile,
    report?.cyclical_profile,
    report?.event_profile,
  ].find((profile) => profile?.status === "available") || null;
}

function comparisonProfileEvidence(report) {
  const profileId = report?.stock_profile?.profile_id;
  const profile = comparisonAvailableProfile(report);
  const metrics = profile?.metrics || {};

  if (profileId === "financial_income") {
    return {
      headline: metrics.dividend_yield_pct == null
        ? "收益資料仍需補充"
        : `殖利率 ${Number(metrics.dividend_yield_pct).toFixed(2)}%`,
      detail: metrics.peer_count
        ? `同組排名 ${metrics.dividend_yield_rank || "—"}/${metrics.peer_count}；股價淨值比 ${metrics.pb_ratio == null ? "—" : Number(metrics.pb_ratio).toFixed(2)} 倍。`
        : "重點是配息延續、獲利支撐與金融風險。",
    };
  }

  if (profileId === "growth_quality") {
    return {
      headline: metrics.revenue_yoy_pct == null
        ? "成長資料仍需補充"
        : `收入年增 ${comparisonSigned(metrics.revenue_yoy_pct)}`,
      detail: `EPS 年增 ${comparisonSigned(metrics.eps_growth_yoy_pct)}；同組動能 ${metrics.sector_rank || "—"}/${metrics.sector_peer_count || "—"}。`,
    };
  }

  if (profileId === "cyclical") {
    const revenue = metrics.revenue_yoy_pct ?? metrics.revenue_growth_yoy_pct;
    const income = metrics.income_change_pct ?? metrics.trailing_income_change_pct;
    return {
      headline: revenue == null
        ? "景氣循環位置仍需確認"
        : `收入年增 ${comparisonSigned(revenue)}`,
      detail: income == null
        ? "重點是收入、獲利、價格與資金是否同向。"
        : `近四季獲利變化 ${comparisonSigned(income)}；需分辨循環回升或短期反彈。`,
    };
  }

  if (profileId === "high_volatility" || profileId === "event_driven") {
    const events = report?.upcoming_events?.events?.length || 0;
    return {
      headline: events
        ? `${events} 項已確認日程`
        : "目前沒有新的已確認日程",
      detail: "重點是事件來源、營運落地與市場反應能否互相驗證。",
    };
  }

  return {
    headline: profile?.decision?.unheld || "使用一般研究框架",
    detail: profile?.decision?.reason_zh || "依公司狀態、風險、價格位置與證據完整度持續追蹤。",
  };
}

function comparisonValuation(report) {
  const valuation = report?.investment_research?.valuation || {};
  return {
    value: valuation.headline_zh || "價格比較資料未提供",
    note: valuation.interpretation_zh || "價格位置不是合理價，也不是買賣訊號。",
    status: valuation.status || "unavailable",
  };
}

function comparisonChange(report) {
  const overall = report?.score_delta?.overall || {};
  const change = comparisonFinite(overall.change);

  if (!overall.available || change == null) {
    return {
      value: "近期變化仍在累積",
      note: "需要更多可比較日期，才能判斷研究方向是否改變。",
    };
  }

  const direction = change > 0
    ? "上升"
    : change < 0
      ? "下降"
      : "持平";

  return {
    value: `較前期${direction} ${Math.abs(change).toFixed(1)} 分`,
    note: report?.score_delta?.summary_zh || "這是研究分數變化，不是價格預測。",
  };
}

function comparisonPurposeFor(report) {
  const profileId = report?.stock_profile?.profile_id;

  const purposes = {
    financial_income: {
      label: "收益與配息研究",
      question: "配息是否有獲利支撐，收益條件能否延續？",
      fit: "適合想比較股利、獲利穩定度與金融風險的人。",
      caution: "殖利率較高不等於總報酬較高，也不能忽略資本與市場風險。",
    },
    growth_quality: {
      label: "成長品質研究",
      question: "收入與獲利能否持續成長，並追上市場期待？",
      fit: "適合想追蹤營運成長、獲利品質與估值支撐的人。",
      caution: "成長較快不代表目前價格合理，也不代表成長一定延續。",
    },
    cyclical: {
      label: "景氣循環研究",
      question: "營運是否進入回升階段，價格與資金是否已先反映？",
      fit: "適合想分辨循環位置、營運轉折與市場領先反應的人。",
      caution: "單月改善可能只是波動，需要多期收入與獲利共同確認。",
    },
    high_volatility: {
      label: "高波動事件研究",
      question: "事件是否真實、影響是否落地，市場是否過度反應？",
      fit: "適合願意持續核對公告、營運結果與價格反應的人。",
      caution: "事件題材不等於基本面改善，單日漲跌也不能替代正式證據。",
    },
    event_driven: {
      label: "事件驗證研究",
      question: "重大事件是否開始改變公司的收入、獲利或風險？",
      fit: "適合關注正式事件與後續數字能否互相驗證的人。",
      caution: "消息受到關注不代表影響已發生，仍要等待營運證據。",
    },
  };

  return purposes[profileId] || {
    label: "綜合研究",
    question: "公司的營運、風險與市場方向是否一致？",
    fit: "適合先建立完整研究輪廓，再決定主要追蹤問題的人。",
    caution: "資料尚未形成專屬框架時，不應硬套單一類型結論。",
  };
}

function comparisonFollowUpItems(report) {
  const profileId = report?.stock_profile?.profile_id;
  const profile = comparisonAvailableProfile(report);
  const metrics = profile?.metrics || {};
  const valuation = comparisonValuation(report);

  const valueOrDash = (value, digits = 1, suffix = "%") => {
    const number = comparisonFinite(value);
    return number == null ? null : `${number.toFixed(digits)}${suffix}`;
  };

  if (profileId === "financial_income") {
    const yieldText = valueOrDash(metrics.dividend_yield_pct, 2);
    const pbText = valueOrDash(metrics.pb_ratio, 2, " 倍");
    const rank = metrics.dividend_yield_rank && metrics.peer_count
      ? `${metrics.dividend_yield_rank}/${metrics.peer_count}`
      : null;

    return [
      yieldText
        ? `確認下一次盈餘與股利政策，是否足以延續目前 ${yieldText} 的殖利率條件。`
        : "補齊最新盈餘、股利政策與殖利率資料，確認配息是否有獲利支撐。",
      "追蹤 ROE、資產品質與資本強度，避免只用單次股利判斷長期收益。",
      rank
        ? `觀察同組殖利率排名 ${rank}${pbText ? ` 與股價淨值比 ${pbText}` : ""} 是否出現明顯變化。`
        : `${valuation.value}；持續核對價格位置與同類金融公司的相對差異。`,
    ];
  }

  if (profileId === "growth_quality") {
    const revenue = comparisonFinite(metrics.revenue_yoy_pct);
    const eps = comparisonFinite(metrics.eps_growth_yoy_pct);
    const rank = metrics.sector_rank && metrics.sector_peer_count
      ? `${metrics.sector_rank}/${metrics.sector_peer_count}`
      : null;

    return [
      revenue == null
        ? "補齊最新收入年增資料，確認成長方向是否延續。"
        : revenue >= 0
          ? `確認收入年增 ${comparisonSigned(revenue)} 是否能連續維持，而非只由單月高基期造成。`
          : `追蹤收入年增 ${comparisonSigned(revenue)} 是否止穩，並確認轉弱原因。`,
      eps == null
        ? "補齊 EPS 與自由現金流資料，確認收入能否轉成實際獲利。"
        : eps >= 0
          ? `核對 EPS 年增 ${comparisonSigned(eps)} 與現金流是否同向，確認成長品質。`
          : `確認 EPS 年增 ${comparisonSigned(eps)} 的壓力是否持續，以及毛利率能否回穩。`,
      rank
        ? `觀察同組動能排名 ${rank} 與目前價格位置，避免把成長速度直接當成合理價。`
        : `比較同業動能與${valuation.value}，確認市場期待是否已先反映。`,
    ];
  }

  if (profileId === "cyclical") {
    const revenue = comparisonFinite(
      metrics.revenue_yoy_pct ?? metrics.revenue_growth_yoy_pct
    );
    const income = comparisonFinite(
      metrics.income_change_pct ?? metrics.trailing_income_change_pct
    );

    return [
      revenue == null
        ? "補齊收入、報價或運價資料，定位目前所處的景氣循環階段。"
        : `確認收入年增 ${comparisonSigned(revenue)} 是否由需求、報價或運價共同支撐。`,
      income == null
        ? "追蹤近四季獲利與自由現金流，分辨營運回升或短期波動。"
        : `核對近四季獲利變化 ${comparisonSigned(income)} 是否與收入方向一致。`,
      `觀察庫存、資金方向與${valuation.value}，確認市場是否已提前反映循環轉折。`,
    ];
  }

  if (profileId === "high_volatility" || profileId === "event_driven") {
    const events = Array.isArray(report?.upcoming_events?.events)
      ? report.upcoming_events.events.filter((event) =>
          ["scheduled", "updated"].includes(String(event?.status || "scheduled"))
        )
      : [];
    const nextEvent = events[0];

    return [
      nextEvent
        ? `核對 ${nextEvent.event_date || "近期"}「${nextEvent.title_zh || "正式事件"}」的官方內容與後續結果。`
        : "等待新的正式公告或已確認日程，不用市場傳聞代替事件證據。",
      "事件發生後，確認收入、獲利或風險是否真的改變，而不是只看單日價格反應。",
      `重新比較${valuation.value}與事件前後的營運證據，判斷市場是否過度反應。`,
    ];
  }

  const supplied = report?.investment_research
    ?.research_fit?.follow_up_items_zh;

  if (Array.isArray(supplied) && supplied.length) {
    return supplied.slice(0, 3);
  }

  return [
    "追蹤下一次收入或財報是否延續目前方向。",
    "確認價格變化是否得到營運證據支持。",
    "出現重大公告時重新整理研究判斷。",
  ];
}

function comparisonDimensionRows(left, right) {
  const leftScore = comparisonScore(left);
  const rightScore = comparisonScore(right);
  const leftRisk = comparisonRiskScore(left);
  const rightRisk = comparisonRiskScore(right);
  const leftConfidence = comparisonConfidenceScore(left);
  const rightConfidence = comparisonConfidenceScore(right);
  const leftValuation = comparisonValuation(left);
  const rightValuation = comparisonValuation(right);
  const leftProfile = comparisonProfileEvidence(left);
  const rightProfile = comparisonProfileEvidence(right);
  const leftChange = comparisonChange(left);
  const rightChange = comparisonChange(right);

  return [
    {
      key: "health",
      title: "公司目前狀態",
      explanation: "健康分數整理目前營運、市場與風險證據；適合比較研究狀態，不是預測報酬。",
      left: {
        value: leftScore == null ? "—" : `${leftScore.toFixed(1)} 分`,
        note: left.assessment || left.overview?.assessment || "健康狀態未分類",
      },
      right: {
        value: rightScore == null ? "—" : `${rightScore.toFixed(1)} 分`,
        note: right.assessment || right.overview?.assessment || "健康狀態未分類",
      },
    },
    {
      key: "risk",
      title: "目前風險壓力",
      explanation: "風險分數越高代表需要注意的壓力越多；低風險不代表未來不會下跌。",
      left: {
        value: leftRisk == null ? "—" : `${leftRisk.toFixed(0)} / 100`,
        note: left.risk_level || left.overview?.risk_level || "風險未分類",
      },
      right: {
        value: rightRisk == null ? "—" : `${rightRisk.toFixed(0)} / 100`,
        note: right.risk_level || right.overview?.risk_level || "風險未分類",
      },
    },
    {
      key: "valuation",
      title: "目前價格位置",
      explanation: "不同類型公司使用不同估值框架；價格位置不是合理價、目標價或買賣建議。",
      left: leftValuation,
      right: rightValuation,
    },
    {
      key: "confidence",
      title: "判斷把握度",
      explanation: "把握度反映資料是否足以支持目前判斷，不表示研究一定正確。",
      left: {
        value: leftConfidence == null ? "—" : `${leftConfidence.toFixed(0)} / 100`,
        note: left.confidence_level || left.overview?.confidence_level || "把握度未分類",
      },
      right: {
        value: rightConfidence == null ? "—" : `${rightConfidence.toFixed(0)} / 100`,
        note: right.confidence_level || right.overview?.confidence_level || "把握度未分類",
      },
    },
    {
      key: "profile",
      title: "各自最重要的營運證據",
      explanation: "跨類型比較不能強迫兩家公司使用相同指標，應先看各自的研究重點。",
      left: {
        value: leftProfile.headline,
        note: leftProfile.detail,
      },
      right: {
        value: rightProfile.headline,
        note: rightProfile.detail,
      },
    },
    {
      key: "change",
      title: "最近研究方向",
      explanation: "比較最近判斷是改善、轉弱或持平，避免只看某一天的分數高低。",
      left: leftChange,
      right: rightChange,
    },
  ];
}

function renderComparisonContext(left, right) {
  const container = $("comparisonContext");
  if (!container) return;

  const sameProfile = left?.stock_profile?.profile_id &&
    left.stock_profile.profile_id === right?.stock_profile?.profile_id;

  container.innerHTML = `
    <div>
      <span>${sameProfile ? "同類型比較" : "跨類型比較"}</span>
      <h2>${sameProfile
        ? "可以直接比較共同框架，但仍要保留公司差異"
        : "先理解研究目的，再看分數與指標差異"}</h2>
    </div>
    <p>${sameProfile
      ? `${escapeHtml(left.name)}與${escapeHtml(right.name)}都屬於${escapeHtml(comparisonProfileLabel(left))}；可比較相同指標，但不能只看單一排名。`
      : `${escapeHtml(left.name)}屬於${escapeHtml(comparisonProfileLabel(left))}，${escapeHtml(right.name)}屬於${escapeHtml(comparisonProfileLabel(right))}。兩者研究問題不同，不應用同一項數字直接判定高下。`}</p>
  `;
}

function renderComparisonDimensions(left, right) {
  const container = $("comparisonDimensions");
  if (!container) return;

  container.innerHTML = comparisonDimensionRows(left, right)
    .map((row, index) => `
      <article class="comparison-dimension-card" data-comparison-dimension="${escapeHtml(row.key)}">
        <header>
          <span>0${index + 1}</span>
          <div><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.explanation)}</p></div>
        </header>
        <div class="comparison-dimension-values">
          <section>
            <span>${escapeHtml(left.name)}</span>
            <b>${escapeHtml(row.left.value || "—")}</b>
            <p>${escapeHtml(row.left.note || "資料未提供")}</p>
          </section>
          <i>VS</i>
          <section>
            <span>${escapeHtml(right.name)}</span>
            <b>${escapeHtml(row.right.value || "—")}</b>
            <p>${escapeHtml(row.right.note || "資料未提供")}</p>
          </section>
        </div>
      </article>
    `).join("");
}

function renderComparisonPurpose(left, right) {
  const container = $("comparisonPurpose");
  if (!container) return;

  container.innerHTML = [left, right].map((report, index) => {
    const purpose = comparisonPurposeFor(report);
    return `
      <article class="comparison-purpose-card">
        <span>0${index + 1} · ${escapeHtml(report.name)}</span>
        <em>${escapeHtml(purpose.label)}</em>
        <h3>${escapeHtml(purpose.question)}</h3>
        <p>${escapeHtml(purpose.fit)}</p>
        <small>${escapeHtml(purpose.caution)}</small>
      </article>
    `;
  }).join("");
}

function renderComparisonFollowUp(left, right) {
  const container = $("comparisonFollowUp");
  if (!container) return;

  container.innerHTML = [left, right].map((report, index) => `
    <article class="comparison-follow-up-card">
      <span>0${index + 1}</span>
      <div>
        <h3>${escapeHtml(report.name)}接下來要確認什麼？</h3>
        <ul>${comparisonFollowUpItems(report)
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ul>
      </div>
    </article>
  `).join("");
}

function renderFullComparison(left, right) {
  renderComparisonContext(left, right);
  renderComparisonDimensions(left, right);
  renderComparisonPurpose(left, right);
  renderComparisonFollowUp(left, right);
}

function renderComparisonPage() {
  const workspace = $("comparisonWorkspace");
  const empty = $("comparisonEmpty");
  const cards = $("comparisonStockCards");

  if (!workspace || !empty || !cards) return;

  const selected = comparisonSelection
    .map(comparisonReport)
    .filter(Boolean);
  const ready = selected.length === 2;

  workspace.classList.toggle("hidden", !ready);
  empty.classList.toggle("hidden", ready);

  if (!ready) {
    cards.innerHTML = "";
    return;
  }

  cards.innerHTML = selected
    .map(comparisonSummaryCard)
    .join("");

  renderFullComparison(selected[0], selected[1]);

  document.querySelectorAll("[data-comparison-remove]")
    .forEach((button) => button.addEventListener("click", () => {
      toggleComparisonStock(button.dataset.comparisonRemove);
      renderComparisonPage();
    }));

  document.querySelectorAll("[data-comparison-open]")
    .forEach((button) => button.addEventListener("click", async () => {
      await loadStock(button.dataset.comparisonOpen);
    }));
}

function openComparisonPage() {
  renderComparisonPage();
  switchPage("compare");
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
    <div class="stock-card-actions"><span class="stock-card-assessment">${escapeHtml(item.assessment)}</span><button type="button" data-save-stock="${item.id}" aria-label="${saved.has(item.id) ? "移出" : "加入"}${escapeHtml(item.name)}自選">${saved.has(item.id) ? "★ 已自選" : "☆ 加入自選"}</button><button type="button" class="${comparisonSelection.includes(String(item.id)) ? "active" : ""}" data-compare-stock="${item.id}">${comparisonSelection.includes(String(item.id)) ? "✓ 已加入比較" : "＋ 加入比較"}</button><button type="button" data-open-stock="${item.id}">查看報告 →</button></div>
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
      if (event.target.closest("[data-save-stock], [data-compare-stock], [data-open-stock]")) return;
      openCard(card);
    });
    card.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !event.target.closest("[data-save-stock], [data-compare-stock], [data-open-stock]")) {
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

  document.querySelectorAll("[data-compare-stock]")
    .forEach((button) => button.addEventListener("click", () => {
      toggleComparisonStock(button.dataset.compareStock);
    }));

  document.querySelectorAll("[data-open-stock]")
    .forEach((button) => button.addEventListener("click", async () => {
      await loadStock(button.dataset.openStock);
    }));

  renderComparisonSelectionBar();
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

  const now = new Date();
  const todayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  stockCatalog.forEach((report) => {
    const block = report?.upcoming_events;
    if (!block || block.version !== "UpcomingEvents-v1.0") return;
    (Array.isArray(block.events) ? block.events : []).forEach((event) => {
      if (!event?.verified || event.affects_health_score !== false) return;

      const lifecycleStatus = String(event.status || "");
      const eventDate = String(event.event_date || "");

      if (!["scheduled", "updated"].includes(lifecycleStatus)) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return;
      if (eventDate < todayKey) return;

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
  renderProfilePersonality();
  applyResearchMode(preferredResearchMode());
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
    comparisonSelection = savedComparisonSelection()
      .filter((id) => comparisonReport(id));
    $("stockCenterLoading").classList.add("hidden");
    renderSectorFilters();
    renderStockCenter();
    renderHomeDashboard();
    renderWatchlistPage();
    renderEventsPage();
    renderProfilePage();
    renderNotificationCenter();

    if (!onboardingCompleted()) {
      window.setTimeout(() => {
        startOnboarding();
      }, 450);
    }
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
document
  .querySelectorAll("[data-research-mode-option]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      setResearchMode(button.dataset.researchModeOption);
    });
  });

$("researchModeShortcut").addEventListener("click", () => {
  showHomeView({restoreScroll: false});
  switchPage("about");
});

$("restartOnboarding").addEventListener("click", () => {
  startOnboarding({force: true});
});

$("onboardingPrevious").addEventListener("click", () => {
  showOnboardingStep(onboardingStepIndex - 1);
});

$("onboardingNext").addEventListener("click", () => {
  if (onboardingStepIndex >= onboardingSteps.length - 1) {
    finishOnboarding();
    return;
  }

  showOnboardingStep(onboardingStepIndex + 1);
});

$("onboardingSkip").addEventListener("click", () => {
  finishOnboarding({skipped: true});
});

$("onboardingBackdrop").addEventListener("click", () => {
  finishOnboarding({skipped: true});
});

window.addEventListener("resize", () => {
  positionOnboarding(onboardingTarget);
});

function preventOnboardingPointerScroll(event) {
  if (!onboardingActive) return;
  event.preventDefault();
}

window.addEventListener(
  "wheel",
  preventOnboardingPointerScroll,
  {passive: false}
);

window.addEventListener(
  "touchmove",
  preventOnboardingPointerScroll,
  {passive: false}
);

window.addEventListener("keydown", (event) => {
  if (!onboardingActive) return;

  const blockedScrollKeys = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "PageUp",
    "PageDown",
    "Home",
    "End",
    " ",
  ]);

  if (blockedScrollKeys.has(event.key)) {
    event.preventDefault();
  }

  if (event.key === "Escape") {
    finishOnboarding({skipped: true});
  }

  if (event.key === "ArrowLeft" && onboardingStepIndex > 0) {
    showOnboardingStep(onboardingStepIndex - 1);
  }

  if (event.key === "ArrowRight") {
    if (onboardingStepIndex >= onboardingSteps.length - 1) {
      finishOnboarding();
    } else {
      showOnboardingStep(onboardingStepIndex + 1);
    }
  }
});
$("proResearchTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-pro-tab]");
  if (button) {
    setProResearchTab(button.dataset.proTab);
  }
});
$("profilePersonality").addEventListener(
  "click",
  openPersonalityPage
);

$("personalityBack").addEventListener("click", () => {
  showHomeView({restoreScroll: false});
  switchPage("about");
});

$("openComparisonButton").addEventListener(
  "click",
  openComparisonPage
);

$("clearComparisonButton").addEventListener("click", () => {
  saveComparisonSelection([]);
  renderStockCenter();
});

$("comparisonBack").addEventListener("click", () => {
  switchPage("explore");
});

$("comparisonChooseStocks").addEventListener("click", () => {
  switchPage("explore");
});

$("personalityStart").addEventListener(
  "click",
  startPersonalityQuiz
);

$("personalityOptions").addEventListener(
  "click",
  (event) => {
    const option = event.target.closest(
      "[data-personality-option]"
    );

    if (option) {
      selectPersonalityOption(
        Number(option.dataset.personalityOption)
      );
    }
  }
);

$("personalityPrevious").addEventListener("click", () => {
  if (personalityQuestionIndex <= 0) return;
  personalityQuestionIndex -= 1;
  renderPersonalityQuestion();
});

$("personalityNext").addEventListener("click", () => {
  if (
    personalityAnswers[personalityQuestionIndex] === null
  ) {
    return;
  }

  if (
    personalityQuestionIndex >=
    researchPersonalityQuestions.length - 1
  ) {
    completePersonalityQuiz();
    return;
  }

  personalityQuestionIndex += 1;
  renderPersonalityQuestion();
});

$("personalityShare").addEventListener(
  "click",
  sharePersonalityResult
);

$("personalityCopy").addEventListener(
  "click",
  copyPersonalityResult
);

$("personalityDownload").addEventListener(
  "click",
  downloadPersonalityReport
);

$("personalityRetake").addEventListener(
  "click",
  startPersonalityQuiz
);

$("personalityFinish").addEventListener("click", () => {
  showHomeView({restoreScroll: false});
  switchPage("about");
  renderProfilePage();
  showToast("已套用你的個人化研究閱讀順序");
});

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
applyResearchMode(preferredResearchMode());

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
  if (!localStorage.getItem(THEME_STORAGE_KEY)) applyTheme(event.matches ? "dark" : "light");
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/assets/sw.js"));
initializeBetaAccess();
