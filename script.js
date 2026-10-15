// Core state, shared helpers, and Home/intro data loading.
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
let route = "intro";

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
const validRoutes = new Set(["intro", "home", "letter", "social", "profile", "ai"]);

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
const TEXT_SIZE_STORAGE_KEY = "agetogether:text-size";

// Message shown if local profile saving fails.
// 本地保存失败时显示的提示信息。
let profileSaveError = "";
let profileValidationErrors = {};

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

function readSavedTextSizeLevel() {
  try {
    const savedLevel = Number(localStorage.getItem(TEXT_SIZE_STORAGE_KEY));
    return savedLevel >= 1 && savedLevel <= 5 ? savedLevel : 3;
  } catch (error) {
    return 3;
  }
}

function saveTextSizeLevel() {
  try {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, String(textSizeLevel));
  } catch (error) {
    console.warn("[profile] couldn't save text size:", error?.message ?? error);
  }
}

// Apply any saved profile before the first render/data load.
// 首次渲染前先加载本地保存的个人资料。
loadSavedProfile();
textSizeLevel = readSavedTextSizeLevel();

// Static activities are kept as a fallback when the database API fails.
// 静态活动数据用于数据库接口失败时兜底。
const staticActivities = JSON.parse(JSON.stringify(state.activities || []));
// Restore selections before any page or background refresh reads activity data.
let activitySelections = {};
try { activitySelections = window.ActivityCheck.readSelections(localStorage); }
catch { /* Storage access itself can be denied; keep this session usable. */ }
state.activities = window.ActivityCheck.restoreSelections(state.activities, activitySelections);
// Restored after Social helpers load, before the first render.
let activityPreferences = { needs: [], maxDistance: 5, interests: [] };
let activityStorageMessage = "";
let paperAudioContext = null;
let letterSoundEnabled = true;
try { letterSoundEnabled = localStorage.getItem("agetogether.letter-sound") !== "off"; } catch { /* Optional storage. */ }

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

// How many days of news to show, counted back from the newest article. 0 = all.
// 新闻显示最近几天（以最新一篇为基准），0 表示全部。
let newsWindowDays = 3;

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
  document.body.classList.remove("text-size-1", "text-size-2", "text-size-3", "text-size-4", "text-size-5");
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
    state.activities = window.ActivityCheck.restoreSelections(places.map(mapDiscoveryPlace), activitySelections);
    activitiesSource = "database";
  } catch (error) {
    console.warn("[activities] using static fallback:", error?.message ?? error);
    state.activities = window.ActivityCheck.restoreSelections(staticActivities, activitySelections);
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
/* Intro                                                              */
/* ------------------------------------------------------------------ */

function renderIntro() {
  app.innerHTML = `
    <section class="intro-page">
      <section class="intro-hero">
        <div class="intro-copy">
          <div class="intro-eyebrow-row">
            <span>Healthy ageing prototype</span>
            <span>Melbourne community support</span>
          </div>
          <h1>AgeTogether Australia</h1>
          <p class="intro-lead">
            A calm digital companion for older Australians who want to stay connected, write meaningful letters, and explore local community opportunities without learning a complex new platform.
          </p>
          <div class="intro-story">
            <strong>Design background</strong>
            <p>
              The experience is built around low digital confidence, privacy concerns, and the need for readable, low-pressure interactions. Each section keeps decisions small, visible, and reversible.
            </p>
          </div>
          <div class="intro-badges" aria-label="Core design principles">
            <span>Readable</span>
            <span>Step-by-step</span>
            <span>Privacy aware</span>
            <span>Local discovery</span>
          </div>
        </div>

        <div class="intro-product-board" aria-label="Prototype preview">
          <div class="intro-large-image">
            <img src="https://images.unsplash.com/photo-1764173040319-4db683637611?auto=format&fit=crop&w=1200&q=80" alt="Two older adults smiling together in a park" />
            <div class="intro-floating-note">
              <strong>Designed for confidence</strong>
              <span>Large text, clear actions, and gentle guidance.</span>
            </div>
          </div>
          <div class="intro-device" aria-label="Letter preview mockup">
            <div class="intro-device-bar">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div class="intro-message-card">
              <small>Letter preview</small>
              <p>Dear Margaret,</p>
              <p>I wanted to send a warm note and let you know I am thinking of you today.</p>
              <p>From, AgeTogether</p>
            </div>
            <div class="intro-mini-row">
              <span>Paper</span>
              <span>Tone</span>
              <span>Email</span>
            </div>
          </div>
        </div>
      </section>

      <section class="intro-showcase" aria-label="Feature overview">
        <article class="intro-card intro-card-letter">
          <span class="intro-icon">&#x2709;</span>
          <h2>Letter</h2>
          <p>Write a message, preview it as a styled letter, adjust paper, colour, and font, then download or send it by email.</p>
          <ul>
            <li>Live letter preview</li>
            <li>Download with selected style</li>
            <li>Email delivery through the backend</li>
          </ul>
        </article>
        <article class="intro-card intro-card-social">
          <span class="intro-icon">&#x1F5FA;</span>
          <h2>Social</h2>
          <p>Find nearby community places and switch between list and map views with simple labels and visible source notes.</p>
          <ul>
            <li>Nearby places</li>
            <li>Map and list views</li>
            <li>Saved interests</li>
          </ul>
        </article>
        <article class="intro-card intro-card-ai">
          <span class="intro-icon">&#x1F43E;</span>
          <h2>AI Companion</h2>
          <p>Provide lightweight practical support, gentle reminders, and optional writing help while keeping the core app usable without AI.</p>
          <ul>
            <li>Daily suggestions</li>
            <li>Safety tips</li>
            <li>Writing support</li>
          </ul>
        </article>
      </section>

      <section class="intro-flow" aria-label="Design background">
        <div>
          <span class="intro-kicker">Design background</span>
          <h2>From a private thought to a finished action.</h2>
          <p>
            The prototype avoids forcing users through account setup first. Instead, it lets them understand the service, try a simple task, and only share information when a task needs it.
          </p>
        </div>
        <div class="intro-flow-steps">
          <span>Understand</span>
          <span>Choose</span>
          <span>Write</span>
          <span>Preview</span>
          <span>Send</span>
        </div>
      </section>

      <button class="intro-start" data-route="home" type="button">
        <span>Start</span>
        <span class="intro-start-arrow" aria-hidden="true">&#8594;</span>
      </button>
    </section>
  `;
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
