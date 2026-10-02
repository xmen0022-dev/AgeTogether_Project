const app = document.querySelector("#app");
const pet = document.querySelector("#pet");
const nav = [...document.querySelectorAll(".top-nav button")];

let route = "home";
let socialTab = "activities";
let activityView = "list";
let activityMap = null;
let aiPreferences = { language: "en-AU", style: "simple" };
let aiRequestNumber = 0;
let textSizeLevel = 3;
const validRoutes = new Set(["home", "letter", "social", "profile", "ai"]);
const pagesWithPet = new Set(["letter", "social", "profile", "ai"]);
window.aiPreferences = aiPreferences;

const appData = window.appData || {};
let idSeed = appData.nextIdStart || 2000;
const nextId = () => idSeed++;
const state = JSON.parse(JSON.stringify(appData.state || {}));
const staticActivities = JSON.parse(JSON.stringify(state.activities || []));
let activitySelections = window.ActivityCheck.readSelections(localStorage);
state.activities = window.ActivityCheck.restoreSelections(state.activities, activitySelections);
let activityPreferences = loadActivityPreferences();
let activityStorageMessage = '';
let letterRewrite = { body: '', original: '', status: '', request: 0 };
let paperAudioContext = null;
let letterSoundEnabled = true;
try { letterSoundEnabled = localStorage.getItem('agetogether.letter-sound') !== 'off'; } catch { /* Default to a quiet sound. */ }
let activitiesSource = "static";
let activitiesLoading = false;
let activitiesError = "";

const staticNewsItems = JSON.parse(JSON.stringify(state.newsItems || []));
let newsSource = "static";
let newsLoading = false;
let newsError = "";

// Defaults to Melbourne CBD until the user opts in to sharing their real
// location. Nothing is requested automatically - see the "Use my location"
// button in the Social location card.
let userLocation = { lat: -37.8136, lng: 144.9631, label: "Melbourne CBD, VIC" };
let locationStatus = "default"; // "default" | "locating" | "granted" | "denied" | "error"
let locationMessage = "";
const letterDraft = {
  recipientName: "",
  recipientEmail: "",
  subject: "A note from AgeTogether",
  body: "",
  paper: "cream",
  textColor: "ink",
  font: "serif",
};
const notificationSeen = {
  social: 0,
};
applyTextSize();
/* ------------------------------------------------------------------ */

function setRoute(nextRoute) {
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
  return routeName;
}

function activeRoute() {
  return parentRoute(route);
}

function pageHead(title, subtitle) {
  return `
    <section class="page-head">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </section>
  `;
}

function applyTextSize() {
  // My feature / 鎴戠殑鍔熻兘锛歛pply one of five global text-size classes.
  // The actual font sizes are defined in styles.css on body.text-size-1
  // through body.text-size-5. Replacing the class keeps the change simple and global.
  document.body.classList.add(`text-size-${textSizeLevel}`);
}

function activityIcon(category, title = "") {
  // Use numeric HTML entities for controlled activity icons.
  // This avoids broken emoji encoding in the Social cards.
  const value = `${category || ""} ${title || ""}`.toLowerCase();
  if (value.includes("library")) return "&#x1F4DA;";
  if (value.includes("theatre") || value.includes("theater") || value.includes("athenaeum")) return "&#x1F3AD;";
  if (value.includes("museum") || value.includes("gallery") || value.includes("history")) return "&#x1F3DB;";
  if (value.includes("visitor") || value.includes("information") || value.includes("booth")) return "&#x2139;";
  if (value.includes("community") || value.includes("assembly") || value.includes("centre") || value.includes("center")) return "&#x1F91D;";
  if (value.includes("garden") || value.includes("park")) return "&#x1F331;";
  if (value.includes("health") || value.includes("medical")) return "&#x267F;";
  if (value.includes("sport") || value.includes("recreation")) return "&#x1F6B6;";
  return "&#x1F4CD;";
}

function notificationCounts() {
  // This prototype does not have real-time users yet, so Home shows a small
  // Social update when activities are available.
  return {
    social: Math.min(2, state.activities.length),
  };
}

function markNotificationsSeen(routeName) {
  // My feature / 鎴戠殑鍔熻兘锛歶pdate the read baseline for the section the user opened.
  // This makes notification chips disappear after they are clicked or
  // after the user manually visits the related page.
  // 鐢ㄦ埛鐐瑰嚮閫氱煡鎴栦富鍔ㄨ繘鍏ュ搴旈〉闈㈠悗锛岃繖閲屼細鎶婂綋鍓嶆暟閲忚涓哄凡璇诲熀鍑嗭紝
  const counts = notificationCounts();
  if (routeName === "social") notificationSeen.social = counts.social;
}

function homeNotifications() {
  // Render only unread Home notification buttons.
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
  const category = place.sub_theme || place.theme || "Community place";
  // Use an ASCII separator so place distances render consistently.
  const distance = place.distance_km != null ? ` - ${place.distance_km} km away` : "";
  return {
    id: `place-${place.place_id}`,
    category,
    icon: activityIcon(category, place.feature_name),
    title: place.feature_name,
    location: `${place.theme}${distance}`,
    distanceKm: place.distance_km,
    distanceOrigin: locationStatus === "granted" ? "your selected location" : "Melbourne CBD demonstration location",
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
  activitiesLoading = true;
  activitiesError = "";
  if (route === "social") renderSocial();

  try {
    // limit=200 comfortably covers all Tier 1 discovery places currently in
    // the database (115) so the Activities map shows everything, not just
    // the closest handful. The server still enforces its own hard cap.
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
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const AU_STATE_ABBREVIATIONS = {
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
/* Home / 棣栭〉                                                          */
/* ------------------------------------------------------------------ */

function renderHome() {
  // Landing page: explains the purpose of the service and gives simple entry
  // points into the main tools.
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
  { key: "cream", label: "Cream" },
  { key: "rose", label: "Rose" },
  { key: "sky", label: "Sky" },
  { key: "mint", label: "Mint" },
  { key: "lavender", label: "Lavender" },
  { key: "white", label: "White" },
];

const letterTextOptions = [
  { key: "ink", label: "Ink" },
  { key: "navy", label: "Navy" },
  { key: "forest", label: "Forest" },
  { key: "plum", label: "Plum" },
  { key: "brown", label: "Brown" },
];

const letterFontOptions = [
  { key: "serif", label: "Serif" },
  { key: "sans", label: "Clear sans" },
  { key: "hand", label: "Handwritten" },
];

function renderLetter() {
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
          <label class="letter-sound-toggle"><input type="checkbox" data-letter-sound ${letterSoundEnabled ? 'checked' : ''} /> Play a gentle paper sound when sent</label>
          <p id="letter-send-status" role="status" aria-live="polite"></p>
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
  const active =
    (type === "paper" && letterDraft.paper === item.key) ||
    (type === "color" && letterDraft.textColor === item.key) ||
    (type === "font" && letterDraft.font === item.key);
  const dataName = type === "color" ? "letter-color" : `letter-${type}`;
  const styleClass = type === "paper" ? `letter-swatch paper-${item.key}` : type === "color" ? `letter-swatch ink-${item.key}` : "letter-font-button";
  return `<button class="${styleClass} ${active ? "active" : ""}" data-${dataName}="${item.key}" type="button">${escapeHtml(item.label)}</button>`;
}

function letterPreviewMarkup() {
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
  const preview = document.querySelector("#letter-preview");
  if (preview) preview.innerHTML = letterPreviewMarkup();
}

function letterPlainText() {
  return letterDraft.body.trim() || "";
}

const letterDownloadStyles = {
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
  return letterDownloadStyles[group][key] || letterDownloadStyles[group][fallback];
}

function downloadableLetterMarkup() {
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

function preparePaperSound() {
  if (!letterSoundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    paperAudioContext ||= new AudioContext();
    if (paperAudioContext.state === 'suspended') paperAudioContext.resume().catch(() => {});
  } catch { /* Sound is optional. */ }
}

// Filtered noise with a brief swishing envelope mimics turning a paper page.
// 使用滤波噪声和短促起伏模拟翻纸，无需下载音频文件。
function playPaperSound() {
  if (!letterSoundEnabled || !paperAudioContext || paperAudioContext.state !== 'running') return;
  try {
    const context = paperAudioContext;
    const duration = 0.65;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(650, context.currentTime + duration);
    filter.Q.value = 0.55;
    const gain = context.createGain();
    const start = context.currentTime;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.08);
    gain.gain.linearRampToValueAtTime(0.035, start + 0.24);
    gain.gain.linearRampToValueAtTime(0.09, start + 0.36);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(start);
    source.stop(start + duration);
  } catch { /* Never turn a successful send into an error because of audio. */ }
}

async function sendLetter() {
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
  preparePaperSound();
  const sendStatus = document.querySelector('#letter-send-status');
  if (sendStatus) sendStatus.textContent = 'Sending your letter...';

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

    playPaperSound();
    if (sendStatus?.isConnected) sendStatus.textContent = 'Letter sent.';
  } catch (error) {
    if (sendStatus?.isConnected) sendStatus.textContent = 'Your letter could not be sent.';
    alert(error?.message || "Email could not be sent.");
  }
}

/* Social / 绀句氦涓庣ぞ鍖烘椿鍔?                                             */
/* ------------------------------------------------------------------ */

// 仅在本机记录活动；刷新或数据库重载后按稳定 ID 恢复。
function rememberActivity(activity) {
  activitySelections = window.ActivityCheck.recordSelection(activitySelections, activity);
  try {
    localStorage.setItem(window.ActivityCheck.SELECTION_KEY, JSON.stringify(activitySelections));
    activityStorageMessage = '';
  } catch { activityStorageMessage = 'Your selection works now, but this device could not save it for next time.'; }
}

function loadActivityPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem('agetogether.activity-preferences.v1') || 'null');
    if (stored && Array.isArray(stored.needs) && Array.isArray(stored.interests)) return {
      needs: stored.needs.filter((need) => Object.hasOwn(window.ActivityCheck.needLabels, need)),
      interests: stored.interests.filter((interest) => typeof interest === 'string'),
      maxDistance: [2, 5, 10, 20].includes(stored.maxDistance) ? stored.maxDistance : 5,
    };
  } catch { /* Corrupt storage uses profile-derived defaults. */ }
  const profile = String(state.profile?.accessibility || '');
  const needs = [];
  if (/seat|chair/i.test(profile)) needs.push('seating');
  if (/wheelchair/i.test(profile)) needs.push('wheelchair');
  if (/step|stairs/i.test(profile)) needs.push('stepFree');
  if (/hearing/i.test(profile)) needs.push('hearing');
  if (profile.trim() && !needs.length) needs.push('other');
  return { needs, maxDistance: 5, interests: [] };
}

function activityPreferenceMarkup() {
  const categories = activityFilters().filter((category) => category !== 'All');
  return `<details class="panel activity-preferences">
    <summary>Personalise your activity checks</summary>
    <p class="muted small">Access needs come first, then distance, then interests. Choose what matters to you.</p>
    <fieldset><legend>Access needs</legend><div class="check-options">
      ${Object.entries(window.ActivityCheck.needLabels).map(([key, label]) => `<label><input type="checkbox" data-activity-setting="needs" value="${key}" ${activityPreferences.needs.includes(key) ? 'checked' : ''} /> ${label}</label>`).join('')}
    </div></fieldset>
    <label>Preferred distance <select data-activity-setting="maxDistance">${[2, 5, 10, 20].map((km) => `<option value="${km}" ${activityPreferences.maxDistance === km ? 'selected' : ''}>Up to ${km} km</option>`).join('')}</select></label>
    <fieldset><legend>Interests (optional)</legend><div class="check-options">
      ${categories.map((category) => `<label><input type="checkbox" data-activity-setting="interests" value="${escapeHtml(category)}" ${activityPreferences.interests.includes(category) ? 'checked' : ''} /> ${escapeHtml(category)}</label>`).join('')}
    </div></fieldset>
  </details>`;
}

function activityCheckMarkup(activity) {
  const check = window.ActivityCheck.analyse(activity, activityPreferences);
  return `<section class="activity-check check-${check.level}">
    <h4>Your activity check: ${escapeHtml(check.label)}</h4>
    <p class="muted small">${activity.saved ? 'Saved' : ''}${activity.saved && activity.joined ? ' · ' : ''}${activity.joined ? 'Interested / selected' : ''}${activity.fromHistory ? ' · From your earlier selections' : ''}</p>
    <ul>${check.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
    <p>${escapeHtml(check.next)}</p>
    <button class="outline-btn" data-activity-followup="${escapeHtml(activity.id)}">Ask Companion about this activity</button>
    <p class="muted small">This sends the activity description, not your personal access needs, to our AI provider.</p>
    <p class="activity-answer" role="status" aria-live="polite"></p>
  </section>`;
}

// 在活动卡片内显示问答；页面重建后忽略旧请求。
async function askAboutActivity(button) {
  const activity = state.activities.find((item) => String(item.id) === button.dataset.activityFollowup);
  const answer = button.closest('[data-activity-card]')?.querySelector('.activity-answer');
  if (!activity || !answer || button.disabled) return;
  button.disabled = true;
  answer.textContent = 'Your companion is thinking...';
  try {
    const response = await fetch('/api/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'activity-explain', ...aiPreferences, input: JSON.stringify({ title: activity.title, category: activity.category, description: activity.copy, access: activity.access, distanceKm: window.ActivityCheck.distanceOf(activity), source: activity.source || 'sample', question: 'Explain what I could do here and what to ask the venue before visiting.' }) }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Your companion could not answer right now.');
    if (!answer.isConnected) return;
    answer.textContent = payload.text || 'There is no answer available right now.';
    window.AgePet?.speak(payload.text, { kind: 'ai' });
  } catch (error) { if (answer.isConnected) answer.textContent = error.message || 'Please try again later.'; }
  finally { if (button.isConnected) button.disabled = false; }
}

function letterWritingToolsContent() {
  return `<h3>Let Companion help with your words</h3>
    <p class="muted small">Keep your meaning and change the tone. You review the result before using it.</p>
    <label>Writing language <select data-ai-preference="language">
      <option value="en-AU" ${aiPreferences.language === 'en-AU' ? 'selected' : ''}>Australian English</option>
      <option value="SC" ${aiPreferences.language === 'SC' ? 'selected' : ''}>简体中文</option>
      <option value="TC" ${aiPreferences.language === 'TC' ? 'selected' : ''}>繁體中文</option>
    </select></label>
    <div class="check-options">${[['gentle', 'Softer & warmer'], ['simple', 'Simpler'], ['formal', 'More formal']].map(([tone, label]) => `<button class="outline-btn" data-rewrite-tone="${tone}">${label}</button>`).join('')}</div>
    <p class="muted small">Only your message text is sent to DeepSeek for rewriting. Please leave out private details.</p>
    <p role="status" aria-live="polite">${escapeHtml(letterRewrite.status)}</p>
    ${letterRewrite.body ? `<div class="rewrite-preview"><h4>Suggested wording</h4><p class="rewritten-body">${escapeHtml(letterRewrite.body)}</p><button class="primary" data-use-rewrite>Use this wording</button> <button class="outline-btn" data-dismiss-rewrite>Keep original</button></div>` : ''}`;
}

function letterWritingTools() {
  return `<section id="letter-writing-tools" class="writing-tools">${letterWritingToolsContent()}</section>`;
}

// User approves sharing the message before each rewrite. Original stays intact until accepted.
// 每次改写前确认发送正文；用户采纳前保留原文，防止旧请求覆盖新编辑。
async function rewriteLetter(tone) {
  if (!['gentle', 'simple', 'formal'].includes(tone)) return;
  const original = letterDraft.body;
  const target = document.querySelector('#letter-writing-tools');
  if (!target) return;
  if (original.trim() && !window.confirm('Send this letter message to DeepSeek to change its wording? Recipient name and email will not be sent. Avoid including private details in the message.')) return;
  const request = letterRewrite.request + 1;
  letterRewrite = { body: '', original, request, status: original.trim() ? 'Preparing suggested wording...' : 'Write your message first.' };
  target.innerHTML = letterWritingToolsContent();
  if (!original.trim()) return;
  try {
    const response = await fetch('/api/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: `rewrite-${tone}`, input: original, language: aiPreferences.language, style: 'standard' }),
    });
    const payload = await response.json();
    if (request !== letterRewrite.request || original !== letterDraft.body) return;
    if (!response.ok || payload.refused || !payload.text) throw new Error(payload.error || 'Companion could not rewrite this message. Your original is unchanged.');
    letterRewrite.body = payload.text;
    letterRewrite.status = 'Read the suggestion and choose whether to use it.';
  } catch (error) {
    if (request !== letterRewrite.request) return;
    letterRewrite.status = error.message || 'Please try again later.';
  }
  const current = document.querySelector('#letter-writing-tools');
  if (current) current.innerHTML = letterWritingToolsContent();
}

function locationCard() {
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
        <button class="tab ${socialTab === "saved" ? "active" : ""}" data-social-tab="saved">&#x1F516; Your selections</button>
      </div>
      ${socialTab !== 'news' ? activityPreferenceMarkup() : ''}
      ${activityStorageMessage ? `<p role="status">${escapeHtml(activityStorageMessage)}</p>` : ''}
      ${content}
    </section>
  `;

  if (socialTab === "activities" && activityView === "map") {
    const filtered = state.activities.filter((a) => !a.fromHistory && (state.activityFilter === "All" || a.category === state.activityFilter));
    initActivityMap(filtered);
  } else if (activityMap) {
    activityMap.remove();
    activityMap = null;
  }
}

function activityFilters() {
  return ["All", ...new Set(state.activities.map((a) => a.category).filter(Boolean))];
}

function renderActivities() {
  // Activity cards are generated from `state.activities`.
  // The filter is a simple category match, which demonstrates a transparent
  // data-driven discovery baseline suitable for Iteration 1.
  const filtered = state.activities.filter((a) => !a.fromHistory && (state.activityFilter === "All" || a.category === state.activityFilter));
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
  // The same component is used in both the Activities tab and Saved tab.
  return `
    <article class="activity-card" data-activity-card="${escapeHtml(a.id)}">
      <div class="card-top">
        <span class="activity-icon">${/^&#x[0-9a-f]+;$/i.test(a.icon || '') ? a.icon : escapeHtml(a.icon)}</span>
        <h3>${escapeHtml(a.title)}</h3>
        <button class="save-btn ${a.saved ? "saved" : ""}" data-save-activity="${escapeHtml(a.id)}">&#x1F516; ${a.saved ? "Saved" : "Save"}</button>
      </div>
      <p class="muted">&#x1F4CD; ${escapeHtml(a.location)}</p>
      <p><span class="small-badge blue-badge">&#x1F5D3; ${escapeHtml(a.date)}</span> <span class="small-badge">${escapeHtml(a.price)}</span></p>
      <p>${escapeHtml(a.copy)}</p>
      <p class="muted small">&#x267F; ${escapeHtml(a.access)}<br />&#x1F3E2; ${escapeHtml(a.organiser)}</p>
      <button class="${a.joined ? "outline-btn" : "primary"} wide" data-join-activity="${escapeHtml(a.id)}">${
        a.source === "database"
          ? a.joined
            ? "&#x2713; Interested - tap to remove"
            : "Mark as Interested"
          : a.joined
            ? "&#x2713; Joined - tap to leave"
            : "Join Activity"
      }</button>
      ${a.saved || a.joined ? activityCheckMarkup(a) : ''}
    </article>
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function initActivityMap(activities) {
  // Builds (or rebuilds) the Leaflet map for the Activities > Map view.
  // Called after app.innerHTML has been set, so #activity-map exists in the DOM.
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
    activityMap.setView([-37.8136, 144.9631], 12);
  }
}

function renderNews() {
  // News cards are generated from `state.newsItems`.
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
  // n.icon is a controlled HTML entity (not user input), so it is not escaped -
  // same treatment as a.icon in activity() below.
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
  // It collects activities/news where `saved === true`.
  const savedActivities = state.activities.filter((a) => a.saved || a.joined);
  const savedNews = state.newsItems.filter((n) => n.saved);

  if (!savedActivities.length && !savedNews.length) {
    return `
      <section class="panel empty">
        <div>
          <div class="empty-icon">&#x1F516;</div>
          <h2>No selections yet</h2>
          <p class="muted">Browse Nearby Activities or Current News and tap the Save button on any item to keep it here.</p>
          <button class="primary" data-social-tab="activities">Browse Activities</button>
          <button class="blue-btn" data-social-tab="news">Browse News</button>
        </div>
      </section>
    `;
  }

  return `
    <h2>Your selected activities and saved news</h2>
    <p class="muted section-copy">Saved and interested activities are kept on this device. Each activity has its own check.</p>
    <section class="social-grid">
      ${savedActivities.map((a) => activity(a)).join("")}
      ${savedNews.map((n) => news(n)).join("")}
    </section>
  `;
}

/* ------------------------------------------------------------------ */
/* Profile / 涓汉璧勬枡                                                   */
/* ------------------------------------------------------------------ */

function renderProfile() {
  // Profile page reads all fields from `state.profile`.
  // Saving the form writes values back into state, then re-renders this page.
  const p = state.profile;
  app.innerHTML = `
    ${pageHead("My Profile", "Manage your personal information and privacy settings")}
    <section class="container narrow">
      <!--
        My feature / 鎴戠殑鍔熻兘锛歠ive-level text-size control for accessibility.
        These buttons only change the visual reading size of the prototype;
        they do not change profile data or require any account/login information.
        杩欓噷鎻愪緵 1 鍒?5 妗ｉ槄璇诲瓧鍙疯皟鑺傦紝鍙奖鍝嶉〉闈㈡樉绀哄ぇ灏忥紝
        涓嶄慨鏀逛釜浜鸿祫鏂欙紝涔熶笉闇€瑕佺櫥褰曡处鍙枫€?      -->
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
          ${state.profileJustSaved ? `<span class="small-badge" style="margin-left:12px;">&#x2713; Saved</span>` : ""}
        </p>
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
  return `<div class="field"><label>${escapeHtml(label)}</label><input id="profile-${id}" value="${escapeHtml(value)}" /></div>`;
}

function toggle(t) {
  // Privacy toggle row. Clicking the row flips the `on` value in state.
  return `
    <article class="toggle-row ${t.on ? "on" : ""}" data-toggle-key="${t.key}">
      <span class="switch"></span>
      <span><strong>${escapeHtml(t.title)}</strong><br /><span class="muted">${escapeHtml(t.copy)}</span></span>
      <strong>${t.on ? "On" : "Off"}</strong>
    </article>
  `;
}

/* ------------------------------------------------------------------ */
/* AI page and Companion integration / AI 椤甸潰鍜屾瀹犻泦鎴?               */
/* ------------------------------------------------------------------ */

function renderAI() {
  // Rebuild the AI page whenever it is opened, then let pet.js mount the setup panel.
  // Reminder values come from the Pet module so the page reflects saved settings.
  const reminders = window.AgePet?.getReminderSettings?.() ?? {
    water: { enabled: true, time: "10:00" },
    medication: { enabled: true, time: "12:00" },
    movement: { enabled: true, time: "16:00" },
  };

  const reminderRow = (kind, label, copy) => `
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
          pet.js fills this empty container with the photo picker, status card,
          and companion history after the AI page has been rendered.
          Companion 璁剧疆鍖哄煙鐨勬寕杞界偣銆?          AI 椤甸潰娓叉煋瀹屾垚鍚庯紝pet.js 浼氭妸鐓х墖閫夋嫨鍣ㄣ€佺姸鎬佸崱鐗囧拰鍘嗗彶璁板綍濉埌杩欓噷銆?        -->
        <section class="panel" id="pet-setup"></section>
        <section class="ai-preferences panel">
          <h2>How would you like me to speak?</h2>
          <div class="form-grid">
            <div class="field">
              <label for="ai-language">Language</label>
              <select id="ai-language" data-ai-preference="language">
                <option value="en-AU" ${aiPreferences.language === "en-AU" ? "selected" : ""}>Australian English</option>
                <option value="SC" ${aiPreferences.language === "SC" ? "selected" : ""}>简体中文</option>
                <option value="TC" ${aiPreferences.language === "TC" ? "selected" : ""}>繁體中文</option>
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
  window.AgePet?.mountSetup();
}

// Send one named task to the server and render the response as plain text.
// 灏嗕竴涓懡鍚嶄换鍔″彂閫佸埌鏈嶅姟绔紝骞朵互绾枃鏈畨鍏ㄦ樉绀鸿繑鍥炵粨鏋溿€?
async function askCompanion(task, input) {
  const answer = document.querySelector("#ai-answer");
  if (!answer || !input.trim()) return;

  const requestNumber = ++aiRequestNumber;
  answer.className = "ai-answer loading";
  answer.textContent = "Your companion is thinking...";

  try {
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
    // 瀹屾暣绛旀鐣欏湪闈㈡澘涓紝鍚屾椂鎶婄畝鐭函鏂囨湰鍥炲鏄剧ず鍦?Pet 澶撮《銆?
    window.AgePet?.speak(payload.text, { kind: "ai" });
  } catch (error) {
    if (requestNumber !== aiRequestNumber) return;
    answer.className = "ai-answer error";
    answer.textContent = error.message || "The companion is unavailable right now.";
  }
}

/* ------------------------------------------------------------------ */
/* Router / render / 璺敱涓庢覆鏌?                                         */
/* ------------------------------------------------------------------ */

function render() {
  // Rebuild the visible UI from the current route and state.
  if (!validRoutes.has(route)) route = "letter";
  nav.forEach((button) => {
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
/* Event handling / 浜嬩欢澶勭悊                                             */
/* ------------------------------------------------------------------ */

document.addEventListener("click", (event) => {
  const rewriteButton = event.target.closest('[data-rewrite-tone]');
  if (rewriteButton) { rewriteLetter(rewriteButton.dataset.rewriteTone); return; }
  if (event.target.closest('[data-use-rewrite]')) {
    if (letterRewrite.body && letterDraft.body === letterRewrite.original) {
      letterDraft.body = letterRewrite.body;
      letterRewrite = { body: '', original: '', status: '', request: letterRewrite.request + 1 };
      renderLetter();
    }
    return;
  }
  if (event.target.closest('[data-dismiss-rewrite]')) {
    letterRewrite = { body: '', original: '', status: '', request: letterRewrite.request + 1 };
    renderLetter();
    return;
  }
  const followUp = event.target.closest('[data-activity-followup]');
  if (followUp) { askAboutActivity(followUp); return; }
  // Event delegation keeps the interaction code in one place. Instead of
  // attaching separate click listeners after every render, the document listens
  // once and checks which data-* attribute was clicked.
  // 浜嬩欢濮旀墭鎶婁氦浜掗€昏緫闆嗕腑鍦ㄤ竴涓湴鏂广€?  // 姣忔 render 鍚庝笉鐢ㄩ噸鏂扮粰鎸夐挳缁戝畾鐩戝惉鍣紝鍙渶瑕佺敱 document 缁熶竴鍒ゆ柇鐐瑰嚮浜嗗摢涓?data-* 鍏冪礌銆?
  // Navigation: any element with data-route changes the active screen. The
  // render functions recreate the visible page from the current state object.
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) {
    setRoute(routeTarget.dataset.route);
    return;
  }

  // Social tab switching: this is local UI state only. In a real backend setup,
  // this would usually remain on the frontend because it does not need to be
  // saved to the database.
  const tabTarget = event.target.closest("[data-social-tab]");
  if (tabTarget) {
    socialTab = tabTarget.dataset.socialTab;
    route = "social";
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderSocial();
    return;
  }

  /* ---------------- AI Companion / AI 鍔╂墜 ---------------- */

  // Quick questions use the same server task as free-form questions.
  // 蹇嵎闂鍜岃嚜鐢辫緭鍏ュ叡鐢ㄥ悓涓€涓湇鍔＄ ask 浠诲姟銆?
  const aiQuestion = event.target.closest("[data-ai-question]");
  if (aiQuestion) {
    askCompanion("ask", aiQuestion.dataset.aiQuestion);
    return;
  }

  // Action buttons provide carefully worded prompts for common use cases.
  // 鎿嶄綔鎸夐挳浣跨敤棰勫厛鍐欏ソ鐨勬彁绀猴紝闄嶄綆鐢ㄦ埛缁勭粐闂鐨勮礋鎷呫€?
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
    letterDraft.paper = letterPaper.dataset.letterPaper;
    renderLetter();
    return;
  }

  const letterColor = event.target.closest("[data-letter-color]");
  if (letterColor) {
    letterDraft.textColor = letterColor.dataset.letterColor;
    renderLetter();
    return;
  }

  const letterFont = event.target.closest("[data-letter-font]");
  if (letterFont) {
    letterDraft.font = letterFont.dataset.letterFont;
    renderLetter();
    return;
  }

  /* ---------------- Social / 绀句氦鍔熻兘 ---------------- */

  // Activity category filter. This uses the activities loaded from data.js and
  // filters them in the browser. If the dataset becomes large, this should move
  // to an API query such as GET /activities?category=walking.
  const activityFilter = event.target.closest("[data-activity-filter]");
  if (activityFilter) {
    state.activityFilter = activityFilter.dataset.activityFilter;
    renderSocial();
    return;
  }

  // Switch the Activities tab between the card list and the Leaflet map.
  const activityViewTarget = event.target.closest("[data-activity-view]");
  if (activityViewTarget) {
    activityView = activityViewTarget.dataset.activityView;
    renderSocial();
    return;
  }

  // Save/unsave a community activity. Backend mapping:
  // POST /saved-items with { type: "activity", id } or
  // DELETE /saved-items/activity/:id.
  // 淇濆瓨鎴栧彇娑堜繚瀛樹竴涓ぞ鍖烘椿鍔ㄣ€傚悗绔槧灏勶細
  const saveActivity = event.target.closest("[data-save-activity]");
  if (saveActivity) {
    const id = saveActivity.dataset.saveActivity;
    const activityItem = state.activities.find((a) => String(a.id) === id);
    if (activityItem) { activityItem.saved = !activityItem.saved; rememberActivity(activityItem); }
    renderSocial();
    return;
  }

  // Save/unsave a news item. Backend mapping:
  // POST /saved-items with { type: "news", id } or
  // DELETE /saved-items/news/:id.
  // 淇濆瓨鎴栧彇娑堜繚瀛樹竴鏉℃柊闂汇€傚悗绔槧灏勶細
  const saveNews = event.target.closest("[data-save-news]");
  if (saveNews) {
    const id = Number(saveNews.dataset.saveNews);
    const newsItem = state.newsItems.find((n) => n.id === id);
    if (newsItem) newsItem.saved = !newsItem.saved;
    renderSocial();
    return;
  }

  // Join/unjoin an activity. Backend mapping:
  // POST /activity-registrations with { activityId } or
  // DELETE /activity-registrations/:activityId.
  // This is one of the clearest "backend interaction" points because a real
  // site would need to save the registration, possibly send organiser details,
  // and respect the profile sharing toggles.
  // 鍙傚姞鎴栧彇娑堝弬鍔犱竴涓椿鍔ㄣ€傚悗绔槧灏勶細
  const joinActivity = event.target.closest("[data-join-activity]");
  if (joinActivity) {
    const id = joinActivity.dataset.joinActivity;
    const activityItem = state.activities.find((a) => String(a.id) === id);
    if (activityItem) { activityItem.joined = !activityItem.joined; rememberActivity(activityItem); }
    renderSocial();
    return;
  }

  /* ---------------- Profile / 涓汉璧勬枡鍔熻兘 ---------------- */

  // Toggle profile privacy settings. Backend mapping:
  // PATCH /profile/share-settings with { key, on }.
  // These toggles decide what information may be shared when joining activities.
  // 鍒囨崲 Profile 闅愮璁剧疆銆傚悗绔槧灏勶細
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
    // My feature / 鎴戠殑鍔熻兘锛歶pdate the global text-size class from Profile.
    // After changing the level, renderProfile() refreshes only the Profile
    // controls so the active button reflects the current size.
    textSizeLevel = Number(textSizeTarget.dataset.textSize);
    applyTextSize();
    renderProfile();
    return;
  }

  /* ---------------- Generic actions / 閫氱敤琛ㄥ崟鍔ㄤ綔 ---------------- */

  // Form-style actions are routed through handleAction because they often need
  // to read input values, validate them, create/update data objects, and then
  // re-render the affected page.
  const action = event.target.closest("[data-action]");
  if (action) {
    handleAction(action.dataset.action);
  }
});

// Preferences are local UI state and are sent with the next API request.
// 鍋忓ソ灞炰簬褰撳墠椤甸潰鐘舵€侊紝浼氶殢涓嬩竴娆?API 璇锋眰涓€璧峰彂閫併€?
document.addEventListener("input", (event) => {
  const letterField = event.target.closest("[data-letter-field]");
  if (!letterField) return;
  letterDraft[letterField.dataset.letterField] = letterField.value;
  if (letterField.dataset.letterField === 'body') {
    letterRewrite = { body: '', original: '', status: '', request: letterRewrite.request + 1 };
    const tools = document.querySelector('#letter-writing-tools');
    if (tools) tools.innerHTML = letterWritingToolsContent();
  }
  updateLetterPreview();
});

document.addEventListener("change", (event) => {
  const soundToggle = event.target.closest('[data-letter-sound]');
  if (soundToggle) {
    letterSoundEnabled = soundToggle.checked;
    try { localStorage.setItem('agetogether.letter-sound', letterSoundEnabled ? 'on' : 'off'); } catch { /* Applies for this session. */ }
    return;
  }
  const activitySetting = event.target.closest('[data-activity-setting]');
  if (activitySetting) {
    const field = activitySetting.dataset.activitySetting;
    if (field === 'maxDistance') activityPreferences.maxDistance = Number(activitySetting.value);
    else {
      const values = new Set(activityPreferences[field]);
      if (activitySetting.checked) values.add(activitySetting.value);
      else values.delete(activitySetting.value);
      activityPreferences[field] = [...values];
    }
    try { localStorage.setItem('agetogether.activity-preferences.v1', JSON.stringify(activityPreferences)); }
    catch { activityStorageMessage = 'Your preferences apply now, but could not be saved on this device.'; }
    renderSocial();
    return;
  }
  const preference = event.target.closest("[data-ai-preference]");
  if (preference) {
    aiPreferences[preference.dataset.aiPreference] = preference.value;
    return;
  }

  // Save one reminder field without rebuilding the page or losing focus.
  // 淇敼鎻愰啋鏃跺彧鏇存柊瀵瑰簲瀛楁锛屼笉閲嶅缓椤甸潰锛岄伩鍏嶈緭鍏ユ澶卞幓鐒︾偣銆?
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
  if (action === "use-my-location") {
    useMyLocation();
    return;
  }

  if (action === "download-letter") {
    downloadLetter();
    return;
  }

  if (action === "send-letter") {
    sendLetter();
    return;
  }

  if (action === "save-profile") {
    state.profile.fullName = document.querySelector("#profile-full-name")?.value ?? state.profile.fullName;
    state.profile.preferredName = document.querySelector("#profile-preferred-name")?.value ?? state.profile.preferredName;
    state.profile.age = document.querySelector("#profile-age")?.value ?? state.profile.age;
    state.profile.phone = document.querySelector("#profile-phone")?.value ?? state.profile.phone;
    state.profile.email = document.querySelector("#profile-email")?.value ?? state.profile.email;
    state.profile.suburb = document.querySelector("#profile-suburb")?.value ?? state.profile.suburb;
    state.profile.emergencyContact = document.querySelector("#profile-emergency")?.value ?? state.profile.emergencyContact;
    state.profile.accessibility = document.querySelector("#profile-accessibility")?.value ?? state.profile.accessibility;
    state.profileJustSaved = true;
    renderProfile();
    setTimeout(() => {
      state.profileJustSaved = false;
      if (route === "profile") renderProfile();
    }, 2000);
  }
}
// Floating companion shortcut: opens the AI Companion page. This is navigation
// only; the current AI page is static and does not call an external AI/backend.
// 鍙充笅瑙掓瀹犲揩鎹峰叆鍙ｏ細鐐瑰嚮鍚庢墦寮€ AI Companion 椤甸潰銆?// 杩欓噷鍙仛鍓嶇瀵艰埅锛涘綋鍓?AI 椤甸潰鏄潤鎬侀〉闈紝涓嶄細璋冪敤澶栭儴 AI 鎴栧悗绔€?
// Initial render after data.js has populated window.appData.
// data.js 鎶?window.appData 鍑嗗濂戒箣鍚庯紝鎵ц绗竴娆￠〉闈㈡覆鏌撱€?render();
render();
loadDatabaseActivities();
loadNewsFeed();
