// Social discovery, activity checks, map, news, and saved selections.
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

function rememberActivity(activity) {
  // Save both selected flags by stable ID; storage failure does not block the UI.
  activitySelections = window.ActivityCheck.recordSelection(activitySelections, activity);
  try {
    localStorage.setItem(window.ActivityCheck.SELECTION_KEY, JSON.stringify(activitySelections));
    activityStorageMessage = '';
  } catch { activityStorageMessage = 'Your selection works now, but this device could not save it for next time.'; }
}

function loadActivityPreferences() {
  // Keep personal access needs local and validate stored settings on reload.
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
  if (/\b(seating|seat|seats|chair|chairs)\b/i.test(profile)) needs.push('seating');
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
  // Explain the local rule result for each saved or interested activity.
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
  // Send venue data only, never the user's personal access preferences.
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
      ${socialTab !== "news" ? activityPreferenceMarkup() : ""}
      ${activityStorageMessage ? `<p role="status">${escapeHtml(activityStorageMessage)}</p>` : ""}
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
    <article class="activity-card" data-activity-card="${escapeHtml(a.id)}">
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
      ${a.saved || a.joined ? activityCheckMarkup(a) : ""}
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

function recentNewsItems() {
  // Newest first. The window is measured from the newest article, not from today,
  // because the news data is a snapshot. Items without a date are never hidden.
  // 按时间倒序；窗口以最新文章为基准，因为新闻是快照。没有日期的条目不会被隐藏。
  const dated = state.newsItems.map((n) => ({ n, t: Date.parse(n.publishedDate) }));
  const valid = dated.filter((x) => Number.isFinite(x.t)).sort((a, b) => b.t - a.t);
  const undated = dated.filter((x) => !Number.isFinite(x.t)).map((x) => x.n);
  if (!newsWindowDays || !valid.length) return [...valid.map((x) => x.n), ...undated];
  const cutoff = valid[0].t - newsWindowDays * 24 * 60 * 60 * 1000;
  return valid.filter((x) => x.t >= cutoff).map((x) => x.n);
}

function renderNews() {
  // News cards are generated from `state.newsItems`, limited to the chosen window.
  // 新闻卡片来自 state.newsItems，并按所选时间范围筛选。
  const items = recentNewsItems();
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
    ${
      newsSource === "feed"
        ? `<div class="chips filter-row">
            ${[[3, "Last 3 days"], [7, "Last 7 days"], [0, "All"]]
              .map(([days, label]) => `<button class="pill ${newsWindowDays === days ? "active" : ""}" data-news-window="${days}">${label}</button>`)
              .join("")}
          </div>
          <p class="muted small">Showing ${items.length} of ${state.newsItems.length} articles, newest first.</p>`
        : ""
    }
    <section class="social-grid">
      ${items.map((n) => news(n)).join("")}
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
        <button class="save-btn ${n.saved ? "saved" : ""}" data-save-news="${escapeHtml(n.id)}">&#x1F516; ${n.saved ? "Saved" : "Save"}</button>
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
  // Include interested activities too, so every selection remains reviewable.
  // 它会收集 saved 为 true 的活动和新闻。
  const savedActivities = state.activities.filter((a) => a.saved || a.joined);
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

