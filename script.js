const app = document.querySelector("#app");
// The app constant above points to the main page container.
// 上面的 app 常量指向主页面容器。
// Floating pet button shown on selected pages.
// 右下角桌宠按钮，只在指定页面显示。
const pet = document.querySelector("#pet");

// Top navigation buttons used to switch between pages.
// 顶部导航按钮，用于切换不同页面。
const nav = [...document.querySelectorAll(".top-nav button")];

// Current page route.
// 当前所在页面。
let route = "home";

// Current Social tab.
// Social 页面当前选中的标签页。
let socialTab = "activities";

// Activities can be shown as cards or on a map.
// 活动可以用列表或地图两种方式展示。
let activityView = "list";

// Leaflet map instance; null means no map is mounted.
// Leaflet 地图对象，为 null 表示当前没有地图。
let activityMap = null;

// User-selected AI response preferences.
// 用户选择的 AI 回复语言和语气偏好。
let aiPreferences = { language: "en-AU", style: "simple" };

// Request counter prevents older AI replies from overwriting newer ones.
// 请求编号用于避免旧的 AI 回复覆盖新的回复。
let aiRequestNumber = 0;

// Accessibility text-size level, from 1 to 5.
// 无障碍字号档位，范围是 1 到 5。
let textSizeLevel = 3;

// Allowed route names.
// 允许访问的页面名称。
const validRoutes = new Set(["home", "letter", "social", "profile", "ai"]);

// Pages where the floating pet should be visible.
// 需要显示桌宠入口的页面。
const pagesWithPet = new Set(["letter", "social", "profile", "ai"]);

// Expose preferences so other modules can read them if needed.
// 暴露 AI 偏好，方便其他模块读取。
window.aiPreferences = aiPreferences;

// Static data loaded from data.js.
// 从 data.js 读取的初始数据。
const appData = window.appData || {};

// Local ID generator for prototype-only records.
// 本地 ID 生成器，用于原型中的临时数据。
let idSeed = appData.nextIdStart || 2000;
const nextId = () => idSeed++;

// Deep-copy the app state so UI edits do not mutate the original data object.
// 深拷贝应用状态，避免直接修改原始数据对象。
const state = JSON.parse(JSON.stringify(appData.state || {}));

// Profile is saved to this device's localStorage (not a server account), so
// it survives a refresh but stays private to this browser.
// 个人资料保存到本机浏览器，不依赖账号或服务器。
const PROFILE_STORAGE_KEY = "agetogether:profile";

// Message shown if local profile saving fails.
// 本地保存失败时显示的提示信息。
let profileSaveError = "";

function loadSavedProfile() {
  // Load saved profile data from this browser.
  // 从当前浏览器读取已保存的个人资料。
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === "object") {
      state.profile = { ...state.profile, ...parsed };
    }
  } catch (error) {
    console.warn("[profile] couldn't read saved profile from localStorage:", error?.message ?? error);
  }
}

function saveProfileLocally() {
  // Save profile data to this browser only.
  // 只把个人资料保存到当前浏览器。
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state.profile));
    profileSaveError = "";
    return true;
  } catch (error) {
    console.warn("[profile] couldn't save profile to localStorage:", error?.message ?? error);
    profileSaveError = "Couldn't save to this device (storage may be full or disabled). Your changes are kept for this session only.";
    return false;
  }
}

// Apply any saved profile before the first render/data load.
// 首次渲染前先加载本地保存的个人资料。
loadSavedProfile();

// Static activities are kept as a fallback when the database API fails.
// 静态活动数据用于数据库接口失败时兜底。
const staticActivities = JSON.parse(JSON.stringify(state.activities || []));

// Activity data source and loading state.
// 活动数据来源和加载状态。
let activitiesSource = "static";
let activitiesLoading = false;
let activitiesError = "";

// Static news items are kept as a fallback when the news API fails.
// 静态新闻数据用于新闻接口失败时兜底。
const staticNewsItems = JSON.parse(JSON.stringify(state.newsItems || []));

// News data source and loading state.
// 新闻数据来源和加载状态。
let newsSource = "static";
let newsLoading = false;
let newsError = "";

// Defaults to Melbourne CBD until the user opts in to sharing their real
// location. Nothing is requested automatically - see the "Use my location"
// button in the Social location card.
// 默认使用墨尔本 CBD；只有用户点击按钮后才请求真实定位。
let userLocation = { lat: -37.8136, lng: 144.9631, label: "Melbourne CBD, VIC" };

// Location permission/status value used by the location card.
// 定位状态，用于控制定位卡片的显示。
let locationStatus = "default"; // "default" | "locating" | "granted" | "denied" | "error"

// Human-readable location message shown under the card.
// 定位提示信息，显示在定位卡片下方。
let locationMessage = "";

// Letter form state. The preview, download, and email all read from this object.
// 写信表单状态，预览、下载和邮件发送都从这里读取。
const letterDraft = {
  recipientName: "",
  recipientEmail: "",
  subject: "A note from AgeTogether",
  body: "",
  paper: "cream",
  textColor: "ink",
  font: "serif",
};

// AI rewrite state for the Letter helper.
// Letter 辅助写作的 AI 改写状态。
let letterRewrite = { body: "", original: "", status: "", request: 0 };

// Tracks notification counts the user has already seen.
// 记录用户已经看过的通知数量。
const notificationSeen = {
  social: 0,
};

// Set the initial text-size class.
// 设置初始字号样式。
applyTextSize();
/* ------------------------------------------------------------------ */

function setRoute(nextRoute) {
  // Validate the requested route and remove the map when leaving Social.
  // 校验目标页面；离开 Social 时清理地图对象。
  const targetRoute = validRoutes.has(nextRoute) ? nextRoute : "letter";
  if (targetRoute !== "social" && activityMap) {
    activityMap.remove();
    activityMap = null;
  }
  route = targetRoute;
  // Opening a section marks its Home notification as read.
  markNotificationsSeen(targetRoute);
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function parentRoute(routeName) {
  // Kept as a helper in case nested routes are added later.
  // 预留函数，之后如果增加子页面可以在这里统一处理。
  return routeName;
}

function activeRoute() {
  // Returns the nav route that should be highlighted.
  // 返回当前应该高亮的导航页面。
  return parentRoute(route);
}

function pageHead(title, subtitle) {
  // Shared page heading template.
  // 通用页面标题模板。
  return `
    <section class="page-head">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </section>
  `;
}

function applyTextSize() {
  // Apply one of five global text-size classes.
  // 应用五档全局字号中的一档。
  // Font-size classes are defined in styles.css from body.text-size-1 to text-size-5.
  // 具体字号在 styles.css 中定义。
  // This keeps most page text in sync with the selected accessibility size.
  // 这样页面大部分文字会跟随无障碍字号变化。
  document.body.classList.add(`text-size-${textSizeLevel}`);
}

function activityIcon(category) {
  // Use numeric HTML entities for controlled activity icons.
  // 使用 HTML 实体控制活动图标。
  // This avoids broken emoji encoding in the Social cards.
  // 这样可以减少 Social 卡片里的表情编码问题。
  const value = `${category || ""}`.toLowerCase();
  if (value.includes("library")) return "&#x1F4DA;";
  if (value.includes("garden") || value.includes("park")) return "&#x1F331;";
  if (value.includes("health") || value.includes("medical")) return "&#x267F;";
  if (value.includes("sport") || value.includes("recreation")) return "&#x1F6B6;";
  return "&#x1F4CD;";
}

function notificationCounts() {
  // This prototype does not have real-time users yet, so Home shows a small
  // Social update when activities are available.
  // 当前原型没有实时用户系统，所以首页只显示 Social 的简单更新提示。
  return {
    social: Math.min(2, state.activities.length),
  };
}

function markNotificationsSeen(routeName) {
  // Update the read baseline for the section the user opened.
  // 用户打开某个页面后，更新该页面的已读基准。
  // This makes notification chips disappear after they are clicked or manually visited.
  // 这样通知按钮在用户访问后会消失。
  const counts = notificationCounts();
  if (routeName === "social") notificationSeen.social = counts.social;
}

function homeNotifications() {
  // Render only unread Home notification buttons.
  // 只渲染首页中还未读的通知按钮。
  const counts = notificationCounts();
  return [
    { key: "social", label: "Social", route: "social" },
  ]
    .filter((item) => counts[item.key] > notificationSeen[item.key])
    .map((item) => {
      return `
        <button class="home-notification has-update" data-route="${item.route}" aria-label="${item.label} has new updates">
          <span>${item.label}</span>
        </button>
      `;
    })
    .join("");
}

function mapDiscoveryPlace(place) {
  // Convert a database place record into the activity card format.
  // 把数据库地点记录转换成活动卡片需要的格式。
  const category = place.sub_theme || place.theme || "Community place";
  // Use an ASCII separator so place distances render consistently.
  // 使用普通横线，避免距离文字出现编码或显示问题。
  const distance = place.distance_km ? ` - ${place.distance_km} km away` : "";
  return {
    id: `place-${place.place_id}`,
    category,
    icon: activityIcon(category),
    title: place.feature_name,
    location: `${place.theme}${distance}`,
    date: "Community place",
    price: "Details not confirmed",
    copy: place.relevance_reason || "A nearby place from the City of Melbourne discovery dataset.",
    access: "Check directly with the venue before visiting",
    organiser: `${place.provider} dataset`,
    saved: false,
    joined: false,
    source: "database",
    licence: place.licence,
    officialUrl: place.official_url,
    lat: Number(place.latitude),
    lng: Number(place.longitude),
  };
}

async function loadDatabaseActivities(lat = userLocation.lat, lng = userLocation.lng) {
  // Load nearby community places from the backend API.
  // 从后端接口读取附近社区地点。
  activitiesLoading = true;
  activitiesError = "";
  if (route === "social") renderSocial();

  try {
    // limit=200 comfortably covers all Tier 1 discovery places currently in
    // the database (115) so the Activities map shows everything, not just
    // the closest handful. The server still enforces its own hard cap.
    // limit=200 可以覆盖当前数据库里的主要地点，地图不会只显示少量最近地点。
    const response = await fetch(`/api/nearby-places?lat=${lat}&lng=${lng}&limit=200`);
    if (!response.ok) throw new Error(`Database API returned ${response.status}`);
    const payload = await response.json();
    const places = Array.isArray(payload.places) ? payload.places : [];
    if (!places.length) throw new Error("Database API returned no places");
    state.activities = places.map(mapDiscoveryPlace);
    activitiesSource = "database";
  } catch (error) {
    console.warn("[activities] using static fallback:", error?.message ?? error);
    state.activities = staticActivities;
    activitiesSource = "static";
    activitiesError = "Database places are unavailable, so static sample activities are shown.";
  } finally {
    activitiesLoading = false;
    if (route === "social") renderSocial();
  }
}

function newsIcon(category) {
  // Map an SBS RSS category to a controlled icon. Same approach as
  // activityIcon() - numeric HTML entities, so encoding stays predictable.
  // 把 SBS 新闻分类映射成固定图标，避免表情编码不稳定。
  const value = `${category || ""}`.toLowerCase();
  if (value.includes("health") || value.includes("covid")) return "&#x1FA7A;";
  if (value.includes("politic")) return "&#x1F3DB;";
  if (value.includes("finance")) return "&#x1F4B0;";
  if (value.includes("life")) return "&#x1F91D;";
  return "&#x1F4F0;";
}

function mapNewsArticle(article) {
  // The CSV's first listed category becomes the badge tag; categories are
  // semicolon-separated (e.g. "Australia; Health; Life").
  // CSV 里第一个分类会作为新闻标签显示。
  const primaryCategory = (article.category || "").split(";")[0].trim() || "News";
  return {
    id: `news-${article.article_url || article.title}`,
    icon: newsIcon(article.category),
    tag: primaryCategory,
    title: article.title,
    copy: article.summary || "",
    source: article.source || "SBS News",
    publishedDate: article.published_date || "",
    articleUrl: article.article_url || "",
    saved: false,
  };
}

async function loadNewsFeed() {
  // Load news from the backend; fall back to static data if it fails.
  // 从后端读取新闻；失败时使用静态新闻兜底。
  newsLoading = true;
  newsError = "";
  if (route === "social") renderSocial();

  try {
    const response = await fetch("/api/news");
    if (!response.ok) throw new Error(`News API returned ${response.status}`);
    const payload = await response.json();
    const articles = Array.isArray(payload.articles) ? payload.articles : [];
    if (!articles.length) throw new Error("News API returned no articles");
    state.newsItems = articles.map(mapNewsArticle);
    newsSource = "feed";
  } catch (error) {
    console.warn("[news] using static fallback:", error?.message ?? error);
    state.newsItems = staticNewsItems;
    newsSource = "static";
    newsError = "The live news snapshot is unavailable, so sample headlines are shown.";
  } finally {
    newsLoading = false;
    if (route === "social") renderSocial();
  }
}

function formatNewsDate(isoDate) {
  // Format ISO dates into a short Australian date label.
  // 把 ISO 日期转换成澳洲常用的简短日期格式。
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const AU_STATE_ABBREVIATIONS = {
  // State names returned by geocoding are shortened for compact display.
  // 地理编码返回的州名会缩写，方便在界面中显示。
  Victoria: "VIC",
  "New South Wales": "NSW",
  Queensland: "QLD",
  "South Australia": "SA",
  "Western Australia": "WA",
  Tasmania: "TAS",
  "Northern Territory": "NT",
  "Australian Capital Territory": "ACT",
};

async function useMyLocation() {
  // Ask the browser for location only after the user clicks the button.
  // 只有用户点击按钮后才请求浏览器定位权限。
  if (!navigator.geolocation) {
    locationStatus = "error";
    locationMessage = "This browser doesn't support location access.";
    if (route === "social") renderSocial();
    return;
  }

  locationStatus = "locating";
  locationMessage = "";
  if (route === "social") renderSocial();

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      userLocation = { lat, lng, label: "Locating your suburb..." };
      locationStatus = "granted";
      if (route === "social") renderSocial();

      // Reverse-geocode with Nominatim (OpenStreetMap) - same data source as
      // the map tiles, so no separate API key is needed. If this fails we
      // still keep the real coordinates and just show them directly.
      // 使用 Nominatim 反查 suburb；失败时仍然保留坐标。
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
          { headers: { Accept: "application/json" } },
        );
        if (!response.ok) throw new Error(`Reverse geocode returned ${response.status}`);
        const place = await response.json();
        const address = place.address || {};
        const suburb = address.suburb || address.city_district || address.town || address.village || address.city;
        const stateName = address.state ? AU_STATE_ABBREVIATIONS[address.state] || address.state : "";
        userLocation.label = [suburb, stateName].filter(Boolean).join(", ") || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
      } catch (error) {
        console.warn("[location] reverse geocode failed:", error?.message ?? error);
        userLocation.label = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
      }

      await loadDatabaseActivities(lat, lng);
    },
    (error) => {
      locationStatus = "denied";
      locationMessage =
        error.code === error.PERMISSION_DENIED
          ? "Location access was declined, so Melbourne CBD is shown instead."
          : "Couldn't get your location right now, so Melbourne CBD is shown instead.";
      if (route === "social") renderSocial();
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}

/* ------------------------------------------------------------------ */
/* Home                                                               */
/* ------------------------------------------------------------------ */

function renderHome() {
  // Landing page: explains the purpose of the service and gives simple entry
  // points into the main tools.
  // 首页用于介绍应用，并提供进入主要功能的入口。
  const notifications = homeNotifications();
  const cards = [
    homeCard("letter", "letter-card", "&#x2709;", "Letter", "Write a personal letter with your choice of paper, colour, and font."),
    homeCard("social", "social-card", "&#x1F5FA;", "Social", "Nearby activities and useful local information."),
  ];
  app.innerHTML = `
    <section class="home-wrap">
      ${notifications ? `<section class="home-notifications" aria-label="Notifications">${notifications}</section>` : ""}
      <section class="home-hero">
        <div class="hero-copy">
          <span class="home-kicker">Support for healthy ageing</span>
          <h1>AgeTogether Australia</h1>
          <p class="hero-lead">A simple digital space that helps older Australians write personal letters, stay connected, and discover nearby community activities.</p>
          <div class="hero-actions">
            <button class="get-started" data-route="letter">Get Started</button>
            <button class="outline-btn" data-route="social">Explore Activities</button>
          </div>
        </div>
        <div class="hero-image" role="img" aria-label="Two older adults smiling together in a park">
          <img src="https://images.unsplash.com/photo-1764173040319-4db683637611?auto=format&fit=crop&w=1200&q=80" alt="Two older adults smiling together in a park" />
        </div>
      </section>

      <section class="home-section">
        <div class="section-heading">
          <span class="home-kicker">Main areas</span>
          <h2>Choose where to go</h2>
        </div>
        <section class="menu-list">
          ${cards.map((card) => card.html).join("")}
        </section>
      </section>
    </section>
  `;
}

function homeCard(routeName, className, icon, title, copy) {
  // Build one large button card for the Home page.
  // 生成首页里的一个功能入口卡片。
  return {
    routeName,
    html: `
    <button class="menu-card ${className}" data-route="${routeName}">
      <span class="menu-icon">${icon}</span>
      <span>
        <h2>${title}</h2>
        <p>${copy}</p>
      </span>
      <span class="chevron">&rsaquo;</span>
    </button>
  `,
  };
}

/* ------------------------------------------------------------------ */
/* Letter / personal letter writer                                     */
/* ------------------------------------------------------------------ */

const letterPaperOptions = [
  // Paper colour options for Letter.
  // Letter 信纸颜色选项。
  { key: "cream", label: "Cream" },
  { key: "rose", label: "Rose" },
  { key: "sky", label: "Sky" },
  { key: "mint", label: "Mint" },
  { key: "lavender", label: "Lavender" },
  { key: "white", label: "White" },
];

const letterTextOptions = [
  // Text colour options for Letter.
  // Letter 文字颜色选项。
  { key: "ink", label: "Ink" },
  { key: "navy", label: "Navy" },
  { key: "forest", label: "Forest" },
  { key: "plum", label: "Plum" },
  { key: "brown", label: "Brown" },
];

const letterFontOptions = [
  // Font style options for Letter.
  // Letter 字体样式选项。
  { key: "serif", label: "Serif" },
  { key: "sans", label: "Clear sans" },
  { key: "hand", label: "Handwritten" },
];

function renderLetter() {
  // Render the letter editor, style toolbar, and live preview.
  // 渲染写信表单、样式菜单和实时预览。
  app.innerHTML = `
    ${pageHead("Letter", "Write a personal message without creating an account")}
    <section class="container letter-shell">
      <details class="letter-format-menu" open>
        <summary>
          <span class="format-menu-title">Letter style</span>
          <span class="format-menu-current">Choose paper, text colour, and font</span>
        </summary>
        <div class="letter-options">
          <div>
            <h3>Paper</h3>
            <div class="letter-choice-row">
              ${letterPaperOptions.map((item) => letterChoice("paper", item)).join("")}
            </div>
          </div>
          <div>
            <h3>Text colour</h3>
            <div class="letter-choice-row">
              ${letterTextOptions.map((item) => letterChoice("color", item)).join("")}
            </div>
          </div>
          <div>
            <h3>Font</h3>
            <div class="letter-choice-row">
              ${letterFontOptions.map((item) => letterChoice("font", item)).join("")}
            </div>
          </div>
        </div>
      </details>

      <div class="letter-layout">
        <section class="panel letter-editor">
          <div class="letter-editor-head">
            <span class="letter-icon">&#x2709;</span>
            <div>
              <h2>Write your letter</h2>
              <p class="muted">Write the message, then download it or prepare an email.</p>
            </div>
          </div>

          <div class="two-col compact-fields">
            <div class="field">
              <label for="letter-recipient-name">Recipient name</label>
              <input id="letter-recipient-name" data-letter-field="recipientName" value="${escapeHtml(letterDraft.recipientName)}" placeholder="e.g. Sophie" />
            </div>
            <div class="field">
              <label for="letter-recipient-email">Recipient email</label>
              <input id="letter-recipient-email" data-letter-field="recipientEmail" value="${escapeHtml(letterDraft.recipientEmail)}" placeholder="name@example.com" />
            </div>
          </div>

          <div class="field">
            <label for="letter-subject">Subject</label>
            <input id="letter-subject" data-letter-field="subject" value="${escapeHtml(letterDraft.subject)}" />
          </div>

          <div class="field">
            <label for="letter-body">Message</label>
            <textarea id="letter-body" class="letter-body-input" data-letter-field="body" placeholder="Write your letter here...">${escapeHtml(letterDraft.body)}</textarea>
          </div>

          ${letterWritingTools()}
          <div class="wide-actions letter-actions">
            <button class="primary" data-action="download-letter">Download letter</button>
            <button class="blue-btn" data-action="send-letter">Send by email</button>
          </div>
        </section>

        <section class="panel letter-preview-panel">
          <h2>Preview</h2>
          <div id="letter-preview">
            ${letterPreviewMarkup()}
          </div>
        </section>
      </div>
    </section>
  `;
}

function letterChoice(type, item) {
  // Build one style choice button and mark it active when selected.
  // 生成一个样式按钮，并根据当前选择显示选中状态。
  const active =
    (type === "paper" && letterDraft.paper === item.key) ||
    (type === "color" && letterDraft.textColor === item.key) ||
    (type === "font" && letterDraft.font === item.key);
  const dataName = type === "color" ? "letter-color" : `letter-${type}`;
  const styleClass = type === "paper" ? `letter-swatch paper-${item.key}` : type === "color" ? `letter-swatch ink-${item.key}` : "letter-font-button";
  return `<button class="${styleClass} ${active ? "active" : ""}" data-${dataName}="${item.key}" type="button">${escapeHtml(item.label)}</button>`;
}

function letterPreviewMarkup() {
  // Build the preview letter using the current draft and selected style.
  // 根据当前草稿和样式生成右侧预览信件。
  const body = letterDraft.body.trim() || "Write your message on the left. Your letter preview will appear here.";
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  return `
    <article class="letter-paper letter-paper-${letterDraft.paper} letter-ink-${letterDraft.textColor} letter-font-${letterDraft.font}">
      <p class="letter-date">${escapeHtml(today)}</p>
      <p class="letter-body-preview">${escapeHtml(body).replace(/\n/g, "<br />")}</p>
    </article>
  `;
}

function updateLetterPreview() {
  // Refresh only the preview area while the user types.
  // 用户输入时只刷新预览区域，不重建整个页面。
  const preview = document.querySelector("#letter-preview");
  if (preview) preview.innerHTML = letterPreviewMarkup();
}

function letterPlainText() {
  // Plain text version used as email fallback text.
  // 邮件备用纯文本内容。
  return letterDraft.body.trim() || "";
}

const letterDownloadStyles = {
  // Inline CSS values used by downloaded HTML and styled email.
  // 下载 HTML 和邮件模板使用的内联样式值。
  paper: {
    cream: "#fff5dc",
    rose: "#ffe7e0",
    sky: "#e4f3ff",
    mint: "#e8f7ed",
    lavender: "#f0e9ff",
    white: "#fffdf7",
  },
  text: {
    ink: "#142331",
    navy: "#163f73",
    forest: "#27623d",
    plum: "#65305f",
    brown: "#69462b",
  },
  font: {
    serif: `Georgia, "Times New Roman", serif`,
    sans: `Aptos, "Segoe UI", Arial, sans-serif`,
    hand: `"Comic Sans MS", "Segoe Print", cursive`,
  },
};

function selectedLetterStyle(group, key, fallback) {
  // Safely read a style value, falling back if the key is unknown.
  // 安全读取样式值，如果 key 不存在就使用默认值。
  return letterDownloadStyles[group][key] || letterDownloadStyles[group][fallback];
}

function downloadableLetterMarkup() {
  // Build a self-contained letter body for downloads.
  // 生成下载文件中使用的完整信件内容。
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const body = letterDraft.body.trim() || "Write your message before downloading.";
  const paper = selectedLetterStyle("paper", letterDraft.paper, "cream");
  const text = selectedLetterStyle("text", letterDraft.textColor, "ink");
  const font = selectedLetterStyle("font", letterDraft.font, "serif");

  return `
    <article style="max-width:760px; min-height:520px; margin:0 auto; border:2px solid rgba(95,74,48,0.2); border-radius:18px; padding:42px; background:${paper}; color:${text}; font-family:${font}; font-size:20px; line-height:1.7; box-shadow:0 24px 42px rgba(70,55,36,0.16);">
      <p style="margin:0 0 24px; text-align:right; opacity:0.76;">${escapeHtml(today)}</p>
      <p style="margin:0 0 24px;">${escapeHtml(body).replace(/\n/g, "<br />")}</p>
    </article>
  `;
}

function downloadLetter() {
  // Create and download an HTML file that keeps the selected letter styling.
  // 创建并下载 HTML 文件，保留选择的信纸、颜色和字体。
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(letterDraft.subject || "AgeTogether letter")}</title>
  <style>
    body { margin: 0; padding: 42px; background: #f7f3ec; color: #172b3a; }
    @media print { body { background: white; } }
  </style>
</head>
<body>
  ${downloadableLetterMarkup()}
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "AgeTogether-letter.html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function sendLetter() {
  // Send the current letter through the backend email endpoint.
  // 通过后端邮件接口发送当前信件。
  const email = letterDraft.recipientEmail.trim();
  if (!email) {
    alert("Please enter a recipient email first.");
    return;
  }

  if (!letterDraft.body.trim()) {
    alert("Please write a message before sending.");
    return;
  }

  const subject = letterDraft.subject.trim() || "A note from AgeTogether";
  const sender = state.profile?.preferredName || state.profile?.fullName || "Me";
  const date = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  try {
    const response = await fetch("/api/send-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject,
        text: letterPlainText(),
        letter: {
          recipient: letterDraft.recipientName.trim() || "Someone special",
          body: letterDraft.body.trim(),
          sender,
          date,
          paper: letterDraft.paper,
          textColor: letterDraft.textColor,
          font: letterDraft.font,
        },
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || "Email could not be sent.");

    alert("Letter sent.");
  } catch (error) {
    alert(error?.message || "Email could not be sent.");
  }
}

function letterWritingToolsContent() {
  // Render AI writing helper controls for the Letter page.
  // 渲染 Letter 页面里的 AI 辅助写作控件。
  return `
    <h3>Let Companion help with your words</h3>
    <p class="muted small">Keep your meaning and change the tone. You review the result before using it.</p>
    <label>
      Writing language
      <select data-ai-preference="language">
        <option value="en-AU" ${aiPreferences.language === "en-AU" ? "selected" : ""}>Australian English</option>
        <option value="SC" ${aiPreferences.language === "SC" ? "selected" : ""}>Simplified Chinese</option>
        <option value="TC" ${aiPreferences.language === "TC" ? "selected" : ""}>Traditional Chinese</option>
      </select>
    </label>
    <div class="check-options">
      ${[
        ["gentle", "Softer & warmer"],
        ["simple", "Simpler"],
        ["formal", "More formal"],
      ]
        .map(([tone, label]) => `<button class="outline-btn" data-rewrite-tone="${tone}">${label}</button>`)
        .join("")}
    </div>
    <p class="muted small">Only your message text is sent to DeepSeek for rewriting. Please leave out private details.</p>
    <p role="status" aria-live="polite">${escapeHtml(letterRewrite.status)}</p>
    ${
      letterRewrite.body
        ? `<div class="rewrite-preview"><h4>Suggested wording</h4><p class="rewritten-body">${escapeHtml(letterRewrite.body)}</p><button class="primary" data-use-rewrite>Use this wording</button> <button class="outline-btn" data-dismiss-rewrite>Keep original</button></div>`
        : ""
    }
  `;
}

function letterWritingTools() {
  // Keep the helper as a small replaceable panel.
  // 把辅助写作做成可单独刷新的小面板。
  return `<section id="letter-writing-tools" class="writing-tools">${letterWritingToolsContent()}</section>`;
}

async function rewriteLetter(tone) {
  // Rewrite only the letter body; recipient name and email are not sent.
  // 只改写正文，不发送收件人姓名和邮箱。
  if (!["gentle", "simple", "formal"].includes(tone)) return;

  const original = letterDraft.body;
  const target = document.querySelector("#letter-writing-tools");
  if (!target) return;

  if (
    original.trim() &&
    !window.confirm(
      "Send this letter message to DeepSeek to change its wording? Recipient name and email will not be sent. Avoid including private details in the message.",
    )
  ) {
    return;
  }

  const request = letterRewrite.request + 1;
  letterRewrite = {
    body: "",
    original,
    request,
    status: original.trim() ? "Preparing suggested wording..." : "Write your message first.",
  };
  target.innerHTML = letterWritingToolsContent();
  if (!original.trim()) return;

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: `rewrite-${tone}`,
        input: original,
        language: aiPreferences.language,
        style: "standard",
      }),
    });
    const payload = await response.json();
    if (request !== letterRewrite.request || original !== letterDraft.body) return;
    if (!response.ok || payload.refused || !payload.text) {
      throw new Error(payload.error || "Companion could not rewrite this message. Your original is unchanged.");
    }
    letterRewrite.body = payload.text;
    letterRewrite.status = "Read the suggestion and choose whether to use it.";
  } catch (error) {
    if (request !== letterRewrite.request) return;
    letterRewrite.status = error.message || "Please try again later.";
  }

  const current = document.querySelector("#letter-writing-tools");
  if (current) current.innerHTML = letterWritingToolsContent();
}

/* Social and community activities                                    */
/* ------------------------------------------------------------------ */

function locationCard() {
  // Render the user's current location state and the location permission button.
  // 渲染当前定位状态和“使用我的位置”按钮。
  const isDefault = locationStatus === "default" || locationStatus === "denied" || locationStatus === "error";
  const buttonLabel = locationStatus === "locating" ? "Locating..." : "&#x1F4CD; Use my location";
  return `
    <div class="location-card">
      <span class="location-card-info">
        &#x1F4CD;
        <span>
          <span class="muted">${isDefault ? "Showing activities near" : "Using your current location"}</span>
          <br /><strong>${escapeHtml(userLocation.label)}</strong>
        </span>
      </span>
      <button class="outline-btn" data-action="use-my-location" ${locationStatus === "locating" ? "disabled" : ""}>${buttonLabel}</button>
    </div>
    ${locationMessage ? `<p class="muted small location-message">${escapeHtml(locationMessage)}</p>` : ""}
  `;
}

function renderSocial() {
  // Render the Social page and choose the current tab content.
  // 渲染 Social 页面，并根据当前标签页选择内容。
  const content = {
    activities: renderActivities(),
    news: renderNews(),
    saved: renderSaved(),
  }[socialTab];

  app.innerHTML = `
    ${pageHead("Social & Community", "Find nearby activities, helpful news, and save items for later")}
    <section class="container">
      ${locationCard()}
      <div class="tabs">
        <button class="tab ${socialTab === "activities" ? "active" : ""}" data-social-tab="activities">&#x1F5FA; Nearby Activities</button>
        <button class="tab ${socialTab === "news" ? "active" : ""}" data-social-tab="news">&#x1F4F0; Current News</button>
        <button class="tab ${socialTab === "saved" ? "active" : ""}" data-social-tab="saved">&#x1F516; Saved</button>
      </div>
      ${content}
    </section>
  `;

  if (socialTab === "activities" && activityView === "map") {
    const filtered = state.activities.filter((a) => state.activityFilter === "All" || a.category === state.activityFilter);
    initActivityMap(filtered);
  } else if (activityMap) {
    activityMap.remove();
    activityMap = null;
  }
}

function activityFilters() {
  // Build filter chips from the categories currently available in activity data.
  // 根据当前活动数据生成分类筛选按钮。
  return ["All", ...new Set(state.activities.map((a) => a.category).filter(Boolean))];
}

function renderActivities() {
  // Activity cards are generated from `state.activities`.
  // 活动卡片来自 state.activities。
  // The filter is a simple category match, which demonstrates a transparent
  // data-driven discovery baseline suitable for Iteration 1.
  // 当前筛选是简单分类匹配，便于演示数据驱动的发现流程。
  const filtered = state.activities.filter((a) => state.activityFilter === "All" || a.category === state.activityFilter);
  return `
    <h2>Find nearby community activities</h2>
    <p class="muted section-copy">
      ${
        activitiesSource === "database"
          ? "Showing nearby discovery places from the PostgreSQL/PostGIS database. Times and bookings should be checked with the venue."
          : "Safe, welcoming sample events designed for older adults."
      }
    </p>
    ${activitiesLoading ? `<p class="info-note">Loading places from the database...</p>` : ""}
    ${activitiesError ? `<p class="info-note warning-note">${activitiesError}</p>` : ""}
    <div class="chips filter-row">
      ${activityFilters().map((f) => `<button class="pill ${state.activityFilter === f ? "active" : ""}" data-activity-filter="${f}">${f}</button>`).join("")}
    </div>
    <div class="view-toggle">
      <button class="tab ${activityView === "list" ? "active" : ""}" data-activity-view="list">&#x1F4CB; List view</button>
      <button class="tab ${activityView === "map" ? "active" : ""}" data-activity-view="map">&#x1F5FA; Map view</button>
    </div>
    ${
      activityView === "map"
        ? `
      <section class="map-panel">
        <div id="activity-map" class="activity-map"></div>
        <p class="muted small map-caption">
          ${filtered.filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng)).length} of ${filtered.length} activities shown on the map &middot; tap a pin for details
        </p>
      </section>
    `
        : ""
    }
    <section class="social-grid">
      ${
        filtered.length
          ? filtered.map((a) => activity(a)).join("")
          : `<p class="muted">No activities in this category right now - try a different filter.</p>`
      }
    </section>
  `;
}

function activity(a) {
  // Reusable card for one activity/place suggestion.
  // 单个活动或地点建议的通用卡片。
  // The same component is used in both the Activities tab and Saved tab.
  // Activities 和 Saved 两个标签页都会复用这个组件。
  return `
    <article class="activity-card">
      <div class="card-top">
        <span class="activity-icon">${a.icon}</span>
        <h3>${escapeHtml(a.title)}</h3>
        <button class="save-btn ${a.saved ? "saved" : ""}" data-save-activity="${a.id}">&#x1F516; ${a.saved ? "Saved" : "Save"}</button>
      </div>
      <p class="muted">&#x1F4CD; ${escapeHtml(a.location)}</p>
      <p><span class="small-badge blue-badge">&#x1F5D3; ${escapeHtml(a.date)}</span> <span class="small-badge">${escapeHtml(a.price)}</span></p>
      <p>${escapeHtml(a.copy)}</p>
      <p class="muted small">&#x267F; ${escapeHtml(a.access)}<br />&#x1F3E2; ${escapeHtml(a.organiser)}</p>
      <button class="${a.joined ? "outline-btn" : "primary"} wide" data-join-activity="${a.id}">${
        a.source === "database"
          ? a.joined
            ? "&#x2713; Interested - tap to remove"
            : "Mark as Interested"
          : a.joined
            ? "&#x2713; Joined - tap to leave"
            : "Join Activity"
      }</button>
    </article>
  `;
}

function escapeHtml(value) {
  // Escape user/data text before putting it into HTML strings.
  // 把用户或数据文本放入 HTML 前先进行转义，避免 HTML 注入。
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function initActivityMap(activities) {
  // Builds (or rebuilds) the Leaflet map for the Activities > Map view.
  // 为 Activities 的地图视图创建或重建 Leaflet 地图。
  // Called after app.innerHTML has been set, so #activity-map exists in the DOM.
  // 这个函数在页面 HTML 渲染后调用，所以 #activity-map 已经存在。
  const container = document.querySelector("#activity-map");
  if (!container || typeof L === "undefined") return;

  if (activityMap) {
    activityMap.remove();
    activityMap = null;
  }

  const withCoords = activities.filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng));

  activityMap = L.map(container, { scrollWheelZoom: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(activityMap);

  if (withCoords.length) {
    withCoords.forEach((a) => {
      const marker = L.marker([a.lat, a.lng]).addTo(activityMap);
      marker.bindPopup(`
        <div class="map-popup">
          <strong>${escapeHtml(a.title)}</strong>
          <p class="muted small">${escapeHtml(a.category || "")}</p>
          <p class="small">${escapeHtml(a.date)} &middot; ${escapeHtml(a.price)}</p>
          <button class="save-btn ${a.saved ? "saved" : ""}" data-save-activity="${a.id}">&#x1F516; ${a.saved ? "Saved" : "Save"}</button>
        </div>
      `);
    });
    const bounds = L.latLngBounds(withCoords.map((a) => [a.lat, a.lng]));
    activityMap.fitBounds(bounds.pad(0.25));
  } else {
    // No coordinates on any filtered activity - fall back to a Melbourne CBD view.
    // 如果筛选后的活动都没有坐标，则保留默认墨尔本 CBD 视图。
    // The old setView fallback is intentionally left inactive in this comment-only pass.
    // 旧的 setView 兜底逻辑当前保持不启用。
  }
}

function renderNews() {
  // News cards are generated from `state.newsItems`.
  // 新闻卡片来自 state.newsItems。
  return `
    <h2>Useful news & information</h2>
    <p class="muted section-copy">
      ${
        newsSource === "feed"
          ? "A snapshot of recent SBS News headlines. Tap through to read the full article on SBS News."
          : "Simple, helpful news for healthy and connected living."
      }
    </p>
    ${newsLoading ? `<p class="info-note">Loading the latest news snapshot...</p>` : ""}
    ${newsError ? `<p class="info-note warning-note">${newsError}</p>` : ""}
    <section class="social-grid">
      ${state.newsItems.map((n) => news(n)).join("")}
    </section>
  `;
}

function news(n) {
  // Reusable card for one news item. Saved state controls the button label.
  // 单条新闻的通用卡片，保存状态会影响按钮文字。
  // n.icon is a controlled HTML entity (not user input), so it is not escaped -
  // same treatment as a.icon in activity() below.
  // n.icon 是固定 HTML 实体，不是用户输入，所以这里不转义。
  const dateLabel = formatNewsDate(n.publishedDate);
  return `
    <article class="news-card">
      <div class="card-top">
        <span class="activity-icon">${n.icon}</span>
        <span class="small-badge blue-badge">${escapeHtml(n.tag)}</span>
        <button class="save-btn ${n.saved ? "saved" : ""}" data-save-news="${n.id}">&#x1F516; ${n.saved ? "Saved" : "Save"}</button>
      </div>
      <h3>${escapeHtml(n.title)}</h3>
      <p>${escapeHtml(n.copy)}</p>
      <p class="muted small">Source: ${escapeHtml(n.source)}${dateLabel ? ` &middot; ${dateLabel}` : ""}</p>
      ${
        n.articleUrl
          ? `<a class="outline-btn wide news-link" href="${escapeHtml(n.articleUrl)}" target="_blank" rel="noopener noreferrer">Read full article on SBS News &#x2197;</a>`
          : ""
      }
    </article>
  `;
}

function renderSaved() {
  // Saved view is derived from the data, not stored as a separate list.
  // Saved 页面由现有数据筛选生成，不单独保存列表。
  // It collects activities/news where `saved === true`.
  // 它会收集 saved 为 true 的活动和新闻。
  const savedActivities = state.activities.filter((a) => a.saved);
  const savedNews = state.newsItems.filter((n) => n.saved);

  if (!savedActivities.length && !savedNews.length) {
    return `
      <section class="panel empty">
        <div>
          <div class="empty-icon">&#x1F516;</div>
          <h2>Nothing saved yet</h2>
          <p class="muted">Browse Nearby Activities or Current News and tap the Save button on any item to keep it here.</p>
          <button class="primary" data-social-tab="activities">Browse Activities</button>
          <button class="blue-btn" data-social-tab="news">Browse News</button>
        </div>
      </section>
    `;
  }

  return `
    <h2>Your Saved Items</h2>
    <p class="muted section-copy">Activities and news you have saved to read or revisit later.</p>
    <section class="social-grid">
      ${savedActivities.map((a) => activity(a)).join("")}
      ${savedNews.map((n) => news(n)).join("")}
    </section>
  `;
}

/* ------------------------------------------------------------------ */
/* Profile                                                            */
/* ------------------------------------------------------------------ */

function renderProfile() {
  // Profile page reads all fields from `state.profile`.
  // Profile 页面从 state.profile 读取所有字段。
  // Saving the form writes values back into state, then re-renders this page.
  // 保存表单时会把输入写回 state，然后重新渲染页面。
  const p = state.profile;
  app.innerHTML = `
    ${pageHead("My Profile", "Manage your personal information and privacy settings")}
    <section class="container narrow">
      <!--
        Five-level text-size control for accessibility.
        五档字号控制，用于提升可读性。
        These buttons only change the visual reading size of the prototype;
        这些按钮只改变原型的视觉字号。
        they do not change profile data or require any account/login information.
        它们不会修改个人资料，也不需要账号登录。
      -->
      <section class="panel profile-panel">
        <h2>Text size</h2>
        <div class="text-size-picker" aria-label="Text size">
          ${[1, 2, 3, 4, 5]
            .map((level) => `<button class="text-size-btn ${textSizeLevel === level ? "active" : ""}" data-text-size="${level}">A${level}</button>`)
            .join("")}
        </div>
      </section>
      <section class="panel profile-panel">
        <div class="title-row">
          <span class="avatar peach">${(p.preferredName || "?").charAt(0).toUpperCase()}</span>
          <span><h2>Personal Information</h2><p class="muted">Only you can see this unless you choose to share it.</p></span>
        </div>
        <div class="form-grid profile-grid">
          ${profileField("full-name", "Full name", p.fullName)}
          ${profileField("preferred-name", "Preferred name", p.preferredName)}
          ${profileField("age", "Age", p.age)}
          ${profileField("phone", "Phone number", p.phone)}
          ${profileField("email", "Email address", p.email)}
          ${profileField("suburb", "Suburb", p.suburb)}
          ${profileField("emergency", "Emergency contact", p.emergencyContact)}
          <div class="field"><label>Accessibility needs</label><small>Optional. Helps activity organisers support you.</small><textarea id="profile-accessibility">${p.accessibility}</textarea></div>
        </div>
        <p>
          <button class="primary" data-action="save-profile">Save Changes</button>
          ${state.profileJustSaved ? `<span class="small-badge" style="margin-left:12px;">&#x2713; Saved to this device</span>` : ""}
        </p>
        ${profileSaveError ? `<p class="info-note warning-note">${escapeHtml(profileSaveError)}</p>` : ""}
        <p class="muted small">Saved on this device only - not sent to a server or shared with anyone else.</p>
      </section>
      <section class="panel profile-panel">
        <h2>What information can be shared?</h2>
        <p class="muted">You choose what information is shared when you join an activity.</p>
        <p class="notice blue-notice">&#x1F4A1; Turning something <strong>On</strong> means it may be shared with activity organisers when you join. Everything is <strong>Off</strong> by default.</p>
        <div class="toggle-list">
          ${state.profileToggles.map((t) => toggle(t)).join("")}
        </div>
      </section>
    </section>
  `;
}

function profileField(id, label, value) {
  // Reusable input field. The id naming is used later when saving profile data.
  // 通用输入框，id 命名会在保存个人资料时再次使用。
  return `<div class="field"><label>${escapeHtml(label)}</label><input id="profile-${id}" value="${escapeHtml(value)}" /></div>`;
}

function toggle(t) {
  // Privacy toggle row. Clicking the row flips the `on` value in state.
  // 隐私开关行；点击后会切换 state 里的 on 状态。
  return `
    <article class="toggle-row ${t.on ? "on" : ""}" data-toggle-key="${t.key}">
      <span class="switch"></span>
      <span><strong>${escapeHtml(t.title)}</strong><br /><span class="muted">${escapeHtml(t.copy)}</span></span>
      <strong>${t.on ? "On" : "Off"}</strong>
    </article>
  `;
}

/* ------------------------------------------------------------------ */
/* AI page and Companion integration                                  */
/* ------------------------------------------------------------------ */

function renderAI() {
  // Rebuild the AI page whenever it is opened, then let pet.js mount the setup panel.
  // 每次打开 AI 页面都会重建页面，然后让 pet.js 挂载设置面板。
  // Reminder values come from the Pet module so the page reflects saved settings.
  // 提醒设置来自 Pet 模块，因此页面能显示已保存的提醒状态。
  const reminders = window.AgePet?.getReminderSettings?.() ?? {
    water: { enabled: true, time: "10:00" },
    medication: { enabled: true, time: "12:00" },
    movement: { enabled: true, time: "16:00" },
  };

  const reminderRow = (kind, label, copy) => `
    <!-- One reminder row with an enabled checkbox and a time input. -->
    <!-- 单条提醒设置，包含启用开关和时间输入。 -->
    <div class="reminder-row">
      <label class="reminder-toggle">
        <input type="checkbox" data-ai-reminder="${kind}" data-ai-reminder-field="enabled" ${reminders[kind].enabled ? "checked" : ""} />
        <span><strong>${label}</strong><small class="muted">${copy}</small></span>
      </label>
      <label class="reminder-time">
        <span class="sr-only">${label} time</span>
        <input type="time" value="${reminders[kind].time}" data-ai-reminder="${kind}" data-ai-reminder-field="time" />
      </label>
    </div>
  `;

  app.innerHTML = `
    ${pageHead("AI Companion", "Your friendly helper for questions, daily ideas, and safety tips")}
    <section class="container narrow">
      <section class="ai-panel">
        <div class="ai-intro">
          <span class="simple-pet"><span class="simple-face"></span></span>
          <span><h2>Your AI Companion</h2><p>Hello! I am here to help with questions, daily ideas, and safety tips. &#x1F338;</p></span>
        </div>
        <section class="panel">
          <h2>Ask your companion</h2>
          <div class="ask-box"><input id="ai-input" placeholder="Type your question here..." /><button class="primary" data-ai-action="ask-ai">Ask AI</button></div>
          <p id="ai-answer" class="ai-answer" role="status" aria-live="polite"></p>
          <p class="muted quick-label"><strong>Or tap a question to ask:</strong></p>
          <div class="quick-questions">
            <button class="question" data-ai-question="How do I avoid scam messages?">"How do I avoid scam messages?"</button>
            <button class="question" data-ai-question="How can I keep in touch with people I care about?">"Help me keep in touch"</button>
            <button class="question" data-ai-question="What gentle activities could I do today?">"What can I do today?"</button>
          </div>
        </section>
        <div class="wide-actions">
          <button class="primary" data-ai-action="daily-suggestion">&#x1F33F; Daily Suggestion</button>
          <button class="blue-btn" data-ai-action="safety-tip">&#x1F6E1; Safety Tip</button>
        </div>
        <!--
          Companion setup mount point.
          桌宠设置区域的挂载点。
          pet.js fills this empty container with the photo picker, status card,
          pet.js 会把照片选择器、状态卡片填入这里。
          and companion history after the AI page has been rendered.
          AI 页面渲染完成后会显示桌宠历史记录。
        -->
        <section class="panel" id="pet-setup"></section>
        <section class="ai-preferences panel">
          <h2>How would you like me to speak?</h2>
          <div class="form-grid">
            <div class="field">
              <label for="ai-language">Language</label>
              <select id="ai-language" data-ai-preference="language">
                <option value="en-AU" ${aiPreferences.language === "en-AU" ? "selected" : ""}>Australian English</option>
                <option value="SC" ${aiPreferences.language === "SC" ? "selected" : ""}>绠€浣撲腑鏂?/option>
                <option value="TC" ${aiPreferences.language === "TC" ? "selected" : ""}>绻侀珨涓枃</option>
              </select>
            </div>
            <div class="field">
              <label for="ai-style">Reading style</label>
              <select id="ai-style" data-ai-preference="style">
                <option value="simple" ${aiPreferences.style === "simple" ? "selected" : ""}>Simple and clear</option>
                <option value="standard" ${aiPreferences.style === "standard" ? "selected" : ""}>Friendly and standard</option>
                <option value="expressive" ${aiPreferences.style === "expressive" ? "selected" : ""}>Warm and expressive</option>
              </select>
            </div>
          </div>
        </section>
        <section class="ai-reminders panel">
          <h2>Gentle daily reminders</h2>
          <p class="muted small">These reminders run while this page is open. You can change the times anytime.</p>
          <div class="reminder-list">
            ${reminderRow("water", "Water", "Have a little drink.")}
            ${reminderRow("medication", "Medicine", "Follow your usual plan.")}
            ${reminderRow("movement", "Movement", "Try gentle movement if safe.")}
          </div>
        </section>
        <p class="muted secure-copy">&#x1F512; Your conversations are private and secure.</p>
      </section>
    </section>
  `;

  // Optional chaining keeps the AI page usable if the Companion module is unavailable.
  // optional chaining 可以保证 Companion 模块不可用时页面仍能打开。
  // Mount the pet setup panel after the AI page HTML exists.
  // AI 页面 HTML 创建后再挂载桌宠设置面板。
  window.AgePet?.mountSetup();
}

// Send one named task to the server and render the response as plain text.
// 把指定任务发送到服务器，并以纯文本方式显示回复。
// The response is written as textContent so returned text is not treated as HTML.
// 回复使用 textContent 写入，避免把返回内容当成 HTML 执行。
async function askCompanion(task, input) {
  // Locate the output panel and ignore empty questions.
  // 找到回复区域，并忽略空问题。
  const answer = document.querySelector("#ai-answer");
  if (!answer || !input.trim()) return;

  // Increment request id so only the newest answer can update the page.
  // 增加请求编号，确保只有最新回复可以更新页面。
  const requestNumber = ++aiRequestNumber;
  answer.className = "ai-answer loading";
  answer.textContent = "Your companion is thinking...";

  try {
    // Send task, input, and current AI preferences to the backend.
    // 把任务、输入内容和当前 AI 偏好发送到后端。
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, input: input.trim(), ...aiPreferences }),
    });
    const payload = await response.json();
    if (requestNumber !== aiRequestNumber) return;
    if (!response.ok) throw new Error(payload.error || "The companion could not answer that.");

    answer.className = "ai-answer";
    answer.textContent = payload.text || "Your companion did not have an answer for that one.";
    // Keep the full answer in the panel, but show a short, safe version above Pet.
    // 完整回复留在面板中，同时让桌宠显示一段简短回复。
    window.AgePet?.speak(payload.text, { kind: "ai" });
  } catch (error) {
    // Show a friendly error message if the backend or network fails.
    // 如果后端或网络失败，显示友好的错误提示。
    if (requestNumber !== aiRequestNumber) return;
    answer.className = "ai-answer error";
    answer.textContent = error.message || "The companion is unavailable right now.";
  }
}

/* ------------------------------------------------------------------ */
/* Router and render                                                   */
/* ------------------------------------------------------------------ */

function render() {
  // Rebuild the visible UI from the current route and state.
  // 根据当前路由和状态重建可见界面。
  if (!validRoutes.has(route)) route = "letter";
  nav.forEach((button) => {
    // Highlight the active navigation button.
    // 高亮当前页面对应的导航按钮。
    const buttonRoute = button.dataset.route;
    button.classList.toggle("active", buttonRoute === activeRoute());
  });
  pet.classList.toggle("hidden", !pagesWithPet.has(route));

  if (route === "home") renderHome();
  if (route === "letter") renderLetter();
  if (route === "social") renderSocial();
  if (route === "profile") renderProfile();
  if (route === "ai") renderAI();
}

/* ------------------------------------------------------------------ */
/* Event handling                                                       */
/* ------------------------------------------------------------------ */

document.addEventListener("click", (event) => {
  const rewriteButton = event.target.closest("[data-rewrite-tone]");
  if (rewriteButton) {
    // Ask AI to rewrite the current letter body with the selected tone.
    // 按所选语气让 AI 改写当前信件正文。
    rewriteLetter(rewriteButton.dataset.rewriteTone);
    return;
  }

  if (event.target.closest("[data-use-rewrite]")) {
    // Replace the draft only when the suggestion still matches the original text.
    // 只有当前正文仍是原文时，才用建议内容替换，避免覆盖用户新编辑。
    if (letterRewrite.body && letterDraft.body === letterRewrite.original) {
      letterDraft.body = letterRewrite.body;
      letterRewrite = { body: "", original: "", status: "", request: letterRewrite.request + 1 };
      renderLetter();
    }
    return;
  }

  if (event.target.closest("[data-dismiss-rewrite]")) {
    // Clear the suggested rewrite and keep the user's original message.
    // 清除 AI 建议，保留用户原文。
    letterRewrite = { body: "", original: "", status: "", request: letterRewrite.request + 1 };
    renderLetter();
    return;
  }

  // Event delegation keeps the interaction code in one place. Instead of
  // 事件委托把点击逻辑集中在一个地方。
  // attaching separate click listeners after every render, the document listens
  // 不需要每次渲染后重新给按钮绑定监听器。
  // once and checks which data-* attribute was clicked.
  // document 统一判断点击了哪个 data-* 元素。
  // Navigation: any element with data-route changes the active screen. The
  // 导航：带 data-route 的元素会切换页面。
  // render functions recreate the visible page from the current state object.
  // 页面会根据当前 state 重新渲染。
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) {
    setRoute(routeTarget.dataset.route);
    return;
  }

  // Social tab switching: this is local UI state only. In a real backend setup,
  // Social 标签切换只属于本地 UI 状态。
  // this would usually remain on the frontend because it does not need to be
  // 真实后端中这类状态通常也只留在前端。
  // saved to the database.
  // 它不需要保存到数据库。
  const tabTarget = event.target.closest("[data-social-tab]");
  if (tabTarget) {
    socialTab = tabTarget.dataset.socialTab;
    route = "social";
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderSocial();
    return;
  }

  /* ---------------- AI Companion ---------------- */

  // Quick questions use the same server task as free-form questions.
  // 快捷问题和手动输入使用同一个服务端 ask 任务。
  // They share the same ask task as manual input.
  // 这样可以减少重复逻辑。
  const aiQuestion = event.target.closest("[data-ai-question]");
  if (aiQuestion) {
    askCompanion("ask", aiQuestion.dataset.aiQuestion);
    return;
  }

  // Action buttons provide carefully worded prompts for common use cases.
  // AI 操作按钮使用预设提示词处理常见需求。
  // This reduces the effort needed to write a useful question.
  // 这样用户不需要自己组织复杂问题。
  const aiAction = event.target.closest("[data-ai-action]");
  if (aiAction) {
    const action = aiAction.dataset.aiAction;
    if (action === "ask-ai") {
      askCompanion("ask", document.querySelector("#ai-input")?.value || "");
    } else if (action === "daily-suggestion") {
      askCompanion("ask", "Suggest one gentle, low-cost activity I could consider today in Australia. Do not invent a specific event, time, price, or accessibility detail.");
    } else if (action === "safety-tip") {
      askCompanion("ask", "Give me one short general safety tip about suspicious messages and online scams. Do not tell me to click a link or call a number from a message.");
    }
    return;
  }

  const letterPaper = event.target.closest("[data-letter-paper]");
  if (letterPaper) {
    // Update paper colour and rebuild the Letter page.
    // 更新信纸颜色并重新渲染 Letter 页面。
    letterDraft.paper = letterPaper.dataset.letterPaper;
    renderLetter();
    return;
  }

  const letterColor = event.target.closest("[data-letter-color]");
  if (letterColor) {
    // Update text colour and rebuild the Letter page.
    // 更新文字颜色并重新渲染 Letter 页面。
    letterDraft.textColor = letterColor.dataset.letterColor;
    renderLetter();
    return;
  }

  const letterFont = event.target.closest("[data-letter-font]");
  if (letterFont) {
    // Update font style and rebuild the Letter page.
    // 更新字体样式并重新渲染 Letter 页面。
    letterDraft.font = letterFont.dataset.letterFont;
    renderLetter();
    return;
  }

  /* ---------------- Social ---------------- */

  // Activity category filter. This uses the activities loaded from data.js and
  // 活动分类筛选基于当前已加载的活动数据。
  // filters them in the browser. If the dataset becomes large, this should move
  // 目前直接在浏览器里筛选。
  // to an API query such as GET /activities?category=walking.
  // 如果数据变大，之后可以改成后端查询。
  const activityFilter = event.target.closest("[data-activity-filter]");
  if (activityFilter) {
    state.activityFilter = activityFilter.dataset.activityFilter;
    renderSocial();
    return;
  }

  // Switch the Activities tab between the card list and the Leaflet map.
  // 在活动卡片列表和 Leaflet 地图之间切换。
  const activityViewTarget = event.target.closest("[data-activity-view]");
  if (activityViewTarget) {
    activityView = activityViewTarget.dataset.activityView;
    renderSocial();
    return;
  }

  // Save/unsave a community activity. Backend mapping:
  // 保存或取消保存一个社区活动。
  // POST /saved-items with { type: "activity", id } or
  // 如果接后端，可对应 POST /saved-items。
  // DELETE /saved-items/activity/:id.
  // 取消保存可对应 DELETE /saved-items/activity/:id。
  // This prototype keeps the saved activity state locally in the browser.
  // 当前原型只在浏览器状态中保存。
  const saveActivity = event.target.closest("[data-save-activity]");
  if (saveActivity) {
    const id = saveActivity.dataset.saveActivity;
    const activityItem = state.activities.find((a) => String(a.id) === id);
    if (activityItem) activityItem.saved = !activityItem.saved;
    renderSocial();
    return;
  }

  // Save/unsave a news item. Backend mapping:
  // 保存或取消保存一条新闻。
  // POST /saved-items with { type: "news", id } or
  // 如果接后端，可对应 POST /saved-items。
  // DELETE /saved-items/news/:id.
  // 取消保存可对应 DELETE /saved-items/news/:id。
  // This prototype keeps the saved news state locally in the browser.
  // 当前原型只在浏览器状态中保存。
  const saveNews = event.target.closest("[data-save-news]");
  if (saveNews) {
    const id = Number(saveNews.dataset.saveNews);
    const newsItem = state.newsItems.find((n) => n.id === id);
    if (newsItem) newsItem.saved = !newsItem.saved;
    renderSocial();
    return;
  }

  // Join/unjoin an activity. Backend mapping:
  // 参加或取消参加一个活动。
  // POST /activity-registrations with { activityId } or
  // 如果接后端，可对应 POST /activity-registrations。
  // DELETE /activity-registrations/:activityId.
  // 取消参加可对应 DELETE /activity-registrations/:activityId。
  // This is one of the clearest "backend interaction" points because a real
  // 这是最明显的后端交互点之一。
  // site would need to save the registration, possibly send organiser details,
  // 真实网站需要保存报名、发送组织者信息。
  // and respect the profile sharing toggles.
  // 同时需要遵守用户的资料分享设置。
  // In this prototype the joined/interested state is local only.
  // 当前原型中 joined/interested 状态只保存在本地。
  const joinActivity = event.target.closest("[data-join-activity]");
  if (joinActivity) {
    const id = joinActivity.dataset.joinActivity;
    const activityItem = state.activities.find((a) => String(a.id) === id);
    if (activityItem) activityItem.joined = !activityItem.joined;
    renderSocial();
    return;
  }

  /* ---------------- Profile ---------------- */

  // Toggle profile privacy settings. Backend mapping:
  // 切换 Profile 隐私设置。
  // PATCH /profile/share-settings with { key, on }.
  // 如果接后端，可对应 PATCH /profile/share-settings。
  // These toggles decide what information may be shared when joining activities.
  // 这些开关决定参加活动时哪些信息可以被分享。
  // In this prototype these settings are local UI state.
  // 当前原型中这些设置只是本地 UI 状态。
  const toggleRow = event.target.closest("[data-toggle-key]");
  if (toggleRow) {
    const key = toggleRow.dataset.toggleKey;
    const toggleItem = state.profileToggles.find((t) => t.key === key);
    if (toggleItem) toggleItem.on = !toggleItem.on;
    renderProfile();
    return;
  }

  const textSizeTarget = event.target.closest("[data-text-size]");
  if (textSizeTarget) {
    // Update the global text-size class from Profile.
    // 从 Profile 页面更新全局字号样式。
    // After changing the level, renderProfile() refreshes only the Profile
    // 更改后重新渲染 Profile 控件。
    // controls so the active button reflects the current size.
    // 这样当前选中的字号按钮能显示正确状态。
    applyTextSize();
    renderProfile();
    return;
  }

  /* ---------------- Generic actions ---------------- */

  // Form-style actions are routed through handleAction because they often need
  // 表单类动作统一交给 handleAction 处理。
  // to read input values, validate them, create/update data objects, and then
  // 这些动作通常需要读取输入、校验并更新数据。
  // re-render the affected page.
  // 最后再重新渲染受影响的页面。
  const action = event.target.closest("[data-action]");
  if (action) {
    handleAction(action.dataset.action);
  }
});

// Preferences are local UI state and are sent with the next API request.
// 偏好设置属于本地 UI 状态。
// They are included in the next AI request.
// 下一次 AI 请求会带上这些偏好。
document.addEventListener("input", (event) => {
  // Letter fields update draft state immediately while typing.
  // Letter 输入框会在用户输入时立即更新草稿状态。
  const letterField = event.target.closest("[data-letter-field]");
  if (!letterField) return;
  letterDraft[letterField.dataset.letterField] = letterField.value;
  updateLetterPreview();
});

document.addEventListener("change", (event) => {
  // Change events are used for select boxes, checkboxes, and time inputs.
  // change 事件用于下拉框、复选框和时间输入。
  const preference = event.target.closest("[data-ai-preference]");
  if (preference) {
    // Store AI preference changes locally.
    // 本地保存 AI 偏好变化。
    aiPreferences[preference.dataset.aiPreference] = preference.value;
    return;
  }

  // Save one reminder field without rebuilding the page or losing focus.
  // 保存单个提醒字段，不重建页面。
  // This keeps the current input focused while reminder settings change.
  // 这样修改提醒设置时输入框不会丢失焦点。
  const reminderInput = event.target.closest("[data-ai-reminder]");
  if (!reminderInput) return;
  const settings = window.AgePet?.getReminderSettings?.();
  if (!settings) return;
  const kind = reminderInput.dataset.aiReminder;
  const field = reminderInput.dataset.aiReminderField;
  settings[kind][field] = field === "enabled" ? reminderInput.checked : reminderInput.value;
  window.AgePet?.setReminderSettings(settings);
});

function handleAction(action) {
  // Route command-style button clicks to the right feature.
  // 把按钮命令分发到对应功能。
  if (action === "use-my-location") {
    // Start browser geolocation flow.
    // 开始浏览器定位流程。
    useMyLocation();
    return;
  }

  if (action === "download-letter") {
    // Download the current letter as an HTML file.
    // 将当前信件下载为 HTML 文件。
    downloadLetter();
    return;
  }

  if (action === "send-letter") {
    // Send the current letter by email through the backend.
    // 通过后端把当前信件发送为邮件。
    sendLetter();
    return;
  }

  if (action === "save-profile") {
    // Copy form values back into state.profile.
    // 把表单里的值复制回 state.profile。
    state.profile.fullName = document.querySelector("#profile-full-name")?.value ?? state.profile.fullName;
    state.profile.preferredName = document.querySelector("#profile-preferred-name")?.value ?? state.profile.preferredName;
    state.profile.age = document.querySelector("#profile-age")?.value ?? state.profile.age;
    state.profile.phone = document.querySelector("#profile-phone")?.value ?? state.profile.phone;
    state.profile.email = document.querySelector("#profile-email")?.value ?? state.profile.email;
    state.profile.suburb = document.querySelector("#profile-suburb")?.value ?? state.profile.suburb;
    state.profile.emergencyContact = document.querySelector("#profile-emergency")?.value ?? state.profile.emergencyContact;
    state.profile.accessibility = document.querySelector("#profile-accessibility")?.value ?? state.profile.accessibility;
    saveProfileLocally();
    // Show a short saved confirmation.
    // 显示短暂的保存成功提示。
    state.profileJustSaved = true;
    renderProfile();
    setTimeout(() => {
      state.profileJustSaved = false;
      if (route === "profile") renderProfile();
    }, 2000);
  }
}
// Floating companion shortcut: opens the AI Companion page. This is navigation
// 右下角桌宠快捷入口会打开 AI Companion 页面。
// only; the current AI page is static and does not call an external AI/backend.
// 这里只做前端导航，不直接调用外部 AI 或后端。
// Initial render after data.js has populated window.appData.
// data.js 准备好 window.appData 后进行初始数据加载。
// Render the first visible page before background data refreshes finish.
// 后台数据刷新完成前，先渲染首屏页面，避免打开时空白。
render();
loadDatabaseActivities();
loadNewsFeed();
