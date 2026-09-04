const app = document.querySelector("#app");
const pet = document.querySelector("#pet");
const nav = [...document.querySelectorAll(".top-nav button")];

// Current visible page. This simple router lets the prototype work like a
// multi-page app while still using one static HTML file.
let route = "home";
let socialTab = "activities";
let aiPreferences = { language: "en-AU", style: "simple" };
let aiRequestNumber = 0;

// The floating companion button is only useful after the landing page, so this
// list controls where it appears.
const pagesWithPet = new Set(["family", "friends", "manage-family", "manage-friends", "social", "profile", "ai"]);

/* ------------------------------------------------------------------ */
/* Runtime state loaded from data.js                                   */
/* ------------------------------------------------------------------ */

const appData = window.appData || {};
let idSeed = appData.nextIdStart || 2000;
const nextId = () => idSeed++;

const COLORS = appData.colors || ["peach", "purple", "blue", "green"];
// Make a runtime copy of the seed data from data.js.
// This is important for the prototype: user actions can mutate `state` without
// changing the original seed object. In a future backend version, this state
// would be populated by API responses instead of the static data.js file.
const state = JSON.parse(JSON.stringify(appData.state || {}));

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function setRoute(nextRoute) {
  // Change the active screen and re-render the app from the current state.
  // In a full app this would usually be handled by a router library.
  route = nextRoute;
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function activeRoute() {
  // Management pages still belong to their parent navigation items, so the
  // bottom navigation highlights Family/Friends instead of adding extra tabs.
  if (route === "manage-family") return "family";
  if (route === "manage-friends") return "friends";
  return route;
}

function pageHead(title, subtitle) {
  // Reusable header component for pages that use a top title area.
  return `
    <section class="page-head">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </section>
  `;
}

function getFamilyMember(id) {
  // Lookup helper used by notes and management actions.
  return state.familyMembers.find((m) => m.id === id);
}

function getFriend(id) {
  // Lookup helper used by the Friends board and friend management screen.
  return state.friends.find((f) => f.id === id);
}

function nextColor(existingCount) {
  // Gives newly added people a rotating colour so generated cards still match
  // the existing visual system.
  return COLORS[existingCount % COLORS.length];
}

/* ------------------------------------------------------------------ */
/* Home                                                                 */
/* ------------------------------------------------------------------ */

function renderHome() {
  // Landing page: explains the purpose of the service and gives simple entry
  // points into the main tools.
  app.innerHTML = `
    <section class="home-wrap">
      <section class="home-hero">
        <div class="hero-copy">
          <span class="home-kicker">Support for healthy ageing</span>
          <h1>AgeTogether Australia</h1>
          <p class="hero-lead">A simple digital space that helps older Australians stay connected with trusted people, family reminders, and nearby community activities.</p>
          <div class="hero-actions">
            <button class="get-started" data-route="family">Get Started</button>
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
          ${homeCard("family", "family-card", "&#x1F3E0;", "Family", "Private reminders and messages from trusted family members.")}
          ${homeCard("friends", "friends-card", "&#x1F4CC;", "Friends", "A calm shared board for people you already know.")}
          ${homeCard("social", "social-card", "&#x1F5FA;", "Social", "Nearby activities and useful local information.")}
        </section>
      </section>
    </section>
  `;
}

function homeCard(routeName, className, icon, title, copy) {
  // Small reusable card component for the Home menu.
  return `
    <button class="menu-card ${className}" data-route="${routeName}">
      <span class="menu-icon">${icon}</span>
      <span>
        <h2>${title}</h2>
        <p>${copy}</p>
      </span>
      <span class="chevron">&rsaquo;</span>
    </button>
  `;
}

/* ------------------------------------------------------------------ */
/* Family                                                               */
/* ------------------------------------------------------------------ */

function renderFamily() {
  // Family Board is data-driven:
  // 1. Filter notes based on `state.familyFilterId`.
  // 2. Convert every visible note object into a note card.
  // 3. Rebuild the page from the latest state.
  const visibleNotes = state.familyNotes.filter((n) => !state.familyFilterId || n.memberId === state.familyFilterId);

  app.innerHTML = `
    ${pageHead("Family Board", "Private messages and care reminders from your family")}
    <section class="container">
      <div class="toolbar family-toolbar">
        <div class="chips">
          <strong class="muted">Showing notes from:</strong>
          ${state.familyMembers.map((m) => familyFilterChip(m)).join("")}
        </div>
        <button class="outline-btn" data-route="manage-family">&#x1F465; Manage Family</button>
      </div>
      <section class="board family-board">
        <div class="note-area family-note-area">
          ${
            visibleNotes.length
              ? visibleNotes.map((n) => familyNoteCard(n)).join("")
              : `<p class="muted">No notes from this person yet.</p>`
          }
        </div>
      </section>
      <section class="two-col">
        <div class="panel">
          <h2>Add a family note</h2>
          <div class="chips note-picker">
            ${state.familyMembers.map((m) => `<button class="pill ${m.id === state.familyNotePickId ? "active" : ""}" data-pick-family-member="${m.id}">${m.name}</button>`).join("")}
          </div>
          <textarea id="family-note-input" placeholder="Write a reminder or note for the family board..."></textarea>
          <p class="align-right"><button class="blue-btn" data-action="add-family-note">+ Add Family Note</button></p>
        </div>
        <div class="panel">
          <h2>Quick actions</h2>
          <div class="actions">
            <button class="message-action" data-action="focus-family-note">&#x25A1; Send Message</button>
            <button class="done-action" data-action="mark-all-family-done">&#x2611; Mark All Done</button>
          </div>
          <p class="notice compact">&#x1F512; Only your trusted family members can see this board. It is private and safe.</p>
        </div>
      </section>
    </section>
    <div class="help-bubble">Need help? Tap me to<br />chat &#x1F338;</div>
  `;
}

function familyFilterChip(member) {
  // Member filter chips are generated from `state.familyMembers`.
  // The active chip is determined by the current filter state.
  const active = state.familyFilterId === member.id;
  return `
    <button class="pill ${active ? "active" : ""} ${member.color}-pill" data-family-filter="${member.id}">
      <span class="mini-avatar ${member.color}">${member.initial}</span>${member.name}<span class="dot">&middot;</span><span class="muted">${member.rel}</span>
    </button>
  `;
}

function familyNoteCard(n) {
  // A note only stores `memberId`; this function joins note data with member
  // data so the UI can show the member name, relationship, colour, and initial.
  const member = getFamilyMember(n.memberId);
  if (!member) return "";
  const relation = member.rel ? `<span class="muted"> &middot; ${member.rel}</span>` : "";
  return `
    <article class="note ${member.color} ${n.done ? "done" : ""}">
      <div class="note-head">
        <strong><span class="mini-avatar ${member.color}">${member.initial}</span>${member.name}${relation}</strong>
        <span>${n.date}</span>
      </div>
      <p>${n.text}</p>
      <button class="note-action" data-toggle-family-note="${n.id}">${n.done ? "&#x2713; Done" : "&#x25EF; Tap to mark done"}</button>
    </article>
  `;
}

function renderManageFamily() {
  // Management screen for trusted family members.
  // The member list is rendered from `state.familyMembers`, so adding/removing
  // members immediately changes the list after re-rendering.
  app.innerHTML = `
    ${pageHead("Manage Family Members", "Control who can post on your family board")}
    <section class="container narrow">
      <button class="outline-btn back-btn" data-route="family">&larr; Back to Family Board</button>
      <p class="notice">&#x1F512; You control who can post on your family board. Only the people listed here can leave notes.</p>
      <section class="panel form-card">
        <h2>Add a family member</h2>
        <p class="muted">Enter their details and we will send them a private family invite.</p>
        <div class="form-grid">
          <div class="field"><label>Name</label><input id="fam-add-name" placeholder="e.g. Sarah" /></div>
          <div class="field"><label>Relationship</label><input id="fam-add-rel" placeholder="e.g. Daughter, Nephew, Carer" /></div>
          <div class="field full"><label>Email or phone number</label><input id="fam-add-contact" placeholder="example@email.com or 04xx xxx xxx" /></div>
        </div>
        <p><button class="primary wide" data-action="add-family-member">Send Family Invite</button></p>
      </section>
      <section class="member-list">
        <h2>Your family members</h2>
        <p class="muted">${state.familyMembers.length} trusted people connected to your family board.</p>
        ${state.familyMembers.map((m) => familyMemberRow(m)).join("") || `<p class="muted">No family members yet.</p>`}
      </section>
    </section>
  `;
}

function familyMemberRow(m) {
  // One row in the family member management list.
  // `muted` only changes the local prototype state at the moment.
  return `
    <article class="member ${m.muted ? "muted" : ""}">
      <span class="avatar ${m.color}">${m.initial}</span>
      <span><h3>${m.name} <span class="muted">&middot; ${m.rel}</span> <span class="small-badge">&#x2713; Active</span></h3><p class="muted">${m.contact}</p></span>
      <button class="ghost" data-mute-family="${m.id}">&#x1F507; ${m.muted ? "Unmute" : "Mute messages"}</button>
      <button class="danger" data-remove-family="${m.id}">Remove</button>
    </article>
  `;
}

/* ------------------------------------------------------------------ */
/* Friends                                                              */
/* ------------------------------------------------------------------ */

function renderFriends() {
  // Friends Board is also data-driven:
  // - `state.selectedFriendId` decides which board is open.
  // - `state.friendNotes[friend.id]` provides that board's messages.
  // - Posting a new message updates the selected friend's note array.
  const friend = getFriend(state.selectedFriendId);
  const notes = friend ? state.friendNotes[friend.id] || [] : [];

  app.innerHTML = `
    <section class="container">
      <div class="toolbar friends-toolbar">
        <div>
          <p class="muted"><strong>Choose a friend to open their shared board:</strong></p>
          <div class="chips">
            ${state.friends.map((f) => friendPick(f)).join("") || `<p class="muted">No friends connected yet.</p>`}
          </div>
        </div>
        <button class="outline-btn" data-route="manage-friends">&#x1F465; Manage Friends</button>
      </div>
      ${
        friend
          ? `
      <section class="board">
        <div class="board-title">
          <div class="title-row">
            <span class="avatar ${friend.color}">${friend.initial}</span>
            <span><h2>Shared board with ${friend.name}</h2><p class="muted">A quiet place to leave notes for each other - read them whenever you like.</p></span>
          </div>
          <p class="muted privacy-copy">&#x1F512; Private board<br />Only you and ${friend.name} can see this</p>
        </div>
        <div class="note-area friend-note-area">
          ${
            notes.length
              ? notes.map((n) => friendNoteCard(n, friend)).join("")
              : `<p class="muted">No messages yet - be the first to say hello!</p>`
          }
        </div>
        <div class="message-panel">
          <h2>Leave a message on the board...</h2>
          <div class="message-form">
            <textarea id="friend-note-input" placeholder="Write something for ${friend.name} to read when they visit..."></textarea>
            <button class="primary" data-action="post-friend-note">Post Message</button>
          </div>
          <p class="muted small">Your message will appear on the shared board. ${friend.name} will see it the next time they visit.</p>
        </div>
      </section>
      `
          : `<p class="muted">Add a friend to start a shared board.</p>`
      }
    </section>
  `;
}

function friendPick(friend) {
  // Friend selector card. The note count is calculated from the current data,
  // so it updates after new messages are posted.
  const active = friend.id === state.selectedFriendId;
  const noteCount = (state.friendNotes[friend.id] || []).length;
  return `
    <button class="friend-pick ${active ? "active" : ""}" data-select-friend="${friend.id}">
      <span class="avatar ${friend.color}">${friend.initial}</span>
      <span><h3>${friend.name}</h3><p class="muted">${noteCount} note${noteCount === 1 ? "" : "s"} on board</p></span>
      <span class="status-dot"></span>
    </button>
  `;
}

function friendNoteCard(n, friend) {
  // Friend notes have two possible authors: "you" or "friend".
  // The displayed initial/name changes based on the author value.
  const isYou = n.author === "you";
  const initial = isYou ? "Y" : friend.initial;
  const name = isYou ? "You" : friend.name;
  return `
    <article class="note ${n.color} ${n.liked ? "done" : ""}">
      <div class="note-head">
        <strong><span class="mini-avatar ${n.color}">${initial}</span>${name}</strong>
        <span>${n.date}</span>
      </div>
      <p>${n.text}</p>
      <button class="note-action" data-toggle-friend-like="${n.id}">${n.liked ? "&#x2764;&#xFE0F; Liked" : "&#x1F90D; Like"}</button>
    </article>
  `;
}

function renderManageFriends() {
  // Management screen for trusted friends.
  // This supports the prototype flow for inviting known contacts only.
  app.innerHTML = `
    ${pageHead("Manage Friends", "Control your trusted friend connections")}
    <section class="container narrow">
      <button class="outline-btn back-btn" data-route="friends">&larr; Back to Friends Board</button>
      <p class="notice blue-notice">&#x1F6E1; <strong>For your safety,</strong> AgeTogether does not recommend strangers. You can only add people you already know using their email, phone number, or an invitation code they have shared with you.</p>
      <section class="panel form-card">
        <h2>Add someone you already know</h2>
        <p class="muted">Enter their name and one of the following to send them a private invitation.</p>
        <div class="form-grid single">
          <div class="field"><label>Name</label><input id="friend-add-name" placeholder="e.g. Robert" /></div>
          <div class="field"><label>Email address</label><input id="friend-add-email" placeholder="example@email.com" /></div>
          <div class="field"><label>Phone number</label><input id="friend-add-phone" placeholder="04xx xxx xxx" /></div>
          <div class="field"><label>Invitation code</label><input id="friend-add-code" placeholder="e.g. FRIEND-1234" /></div>
        </div>
        <p><button class="primary wide" data-action="add-friend">Send Friend Invite</button></p>
      </section>
      <section class="member-list">
        <h2>Your friends</h2>
        <p class="muted">${state.friends.length} trusted friends connected to your boards.</p>
        ${state.friends.map((f) => friendMemberRow(f)).join("") || `<p class="muted">No friends yet.</p>`}
      </section>
    </section>
  `;
}

function friendMemberRow(f) {
  // One row in the friend management list.
  // View, mute, and remove buttons are wired through data attributes.
  return `
    <article class="member ${f.muted ? "muted" : ""}">
      <span class="avatar ${f.color}">${f.initial}</span>
      <span><h3>${f.name} <span class="muted">&middot; Friend</span> <span class="small-badge">&#x2713; Active</span></h3><p class="muted">${f.contact}</p></span>
      <button class="ghost" data-route="friends">View Board</button>
      <button class="ghost" data-mute-friend="${f.id}">&#x1F507; ${f.muted ? "Unmute" : "Mute"}</button>
      <button class="danger" data-remove-friend="${f.id}">Remove</button>
    </article>
  `;
}

/* ------------------------------------------------------------------ */
/* Social                                                               */
/* ------------------------------------------------------------------ */

function renderSocial() {
  // Social page switches between three data views:
  // activities, news, and saved items. `socialTab` controls which renderer is
  // used without changing the overall page shell.
  const content = {
    activities: renderActivities(),
    news: renderNews(),
    saved: renderSaved(),
  }[socialTab];

  app.innerHTML = `
    ${pageHead("Social & Community", "Find nearby activities, helpful news, and save items for later")}
    <section class="container">
      <div class="location-card">&#x1F4CD; <span><span class="muted">Using your current location</span><br /><strong>Melbourne CBD, VIC</strong></span></div>
      <div class="tabs">
        <button class="tab ${socialTab === "activities" ? "active" : ""}" data-social-tab="activities">&#x1F5FA; Nearby Activities</button>
        <button class="tab ${socialTab === "news" ? "active" : ""}" data-social-tab="news">&#x1F4F0; Current News</button>
        <button class="tab ${socialTab === "saved" ? "active" : ""}" data-social-tab="saved">&#x1F516; Saved</button>
      </div>
      ${content}
    </section>
  `;
}

const ACTIVITY_FILTERS = ["All", "Walking", "Gardening", "Coffee group", "Library event", "Health workshop", "Senior community"];

function renderActivities() {
  // Activity cards are generated from `state.activities`.
  // The filter is a simple category match, which demonstrates a transparent
  // data-driven discovery baseline suitable for Iteration 1.
  const filtered = state.activities.filter((a) => state.activityFilter === "All" || a.category === state.activityFilter);
  return `
    <h2>Find nearby community activities</h2>
    <p class="muted section-copy">Safe, welcoming local events designed for older adults.</p>
    <div class="chips filter-row">
      ${ACTIVITY_FILTERS.map((f) => `<button class="pill ${state.activityFilter === f ? "active" : ""}" data-activity-filter="${f}">${f}</button>`).join("")}
    </div>
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
    <article class="activity-card">
      <div class="card-top">
        <span class="activity-icon">${a.icon}</span>
        <h3>${a.title}</h3>
        <button class="save-btn ${a.saved ? "saved" : ""}" data-save-activity="${a.id}">&#x1F516; ${a.saved ? "Saved" : "Save"}</button>
      </div>
      <p class="muted">&#x1F4CD; ${a.location}</p>
      <p><span class="small-badge blue-badge">&#x1F5D3; ${a.date}</span> <span class="small-badge">${a.price}</span></p>
      <p>${a.copy}</p>
      <p class="muted small">&#x267F; ${a.access}<br />&#x1F3E2; ${a.organiser}</p>
      <button class="${a.joined ? "outline-btn" : "primary"} wide" data-join-activity="${a.id}">${a.joined ? "&#x2713; Joined - tap to leave" : "Join Activity"}</button>
    </article>
  `;
}

function renderNews() {
  // News cards are generated from `state.newsItems`.
  return `
    <h2>Useful news & information</h2>
    <p class="muted section-copy">Simple, helpful news for healthy and connected living.</p>
    <section class="social-grid">
      ${state.newsItems.map((n) => news(n)).join("")}
    </section>
  `;
}

function news(n) {
  // Reusable card for one news item. Saved state controls the button label.
  return `
    <article class="news-card">
      <div class="card-top">
        <span class="activity-icon">${n.icon}</span>
        <span class="small-badge blue-badge">${n.tag}</span>
        <button class="save-btn ${n.saved ? "saved" : ""}" data-save-news="${n.id}">&#x1F516; ${n.saved ? "Saved" : "Save"}</button>
      </div>
      <h3>${n.title}</h3>
      <p>${n.copy}</p>
      <p class="muted small">Source: ${n.source}</p>
    </article>
  `;
}

function renderSaved() {
  // Saved view is derived from the data, not stored as a separate list.
  // It collects activities/news where `saved === true`.
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
/* Profile                                                              */
/* ------------------------------------------------------------------ */

function renderProfile() {
  // Profile page reads all fields from `state.profile`.
  // Saving the form writes values back into state, then re-renders this page.
  const p = state.profile;
  app.innerHTML = `
    ${pageHead("My Profile", "Manage your personal information and privacy settings")}
    <section class="container narrow">
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
  return `<div class="field"><label>${label}</label><input id="profile-${id}" value="${value}" /></div>`;
}

function toggle(t) {
  // Privacy toggle row. Clicking the row flips the `on` value in state.
  return `
    <article class="toggle-row ${t.on ? "on" : ""}" data-toggle-key="${t.key}">
      <span class="switch"></span>
      <span><strong>${t.title}</strong><br /><span class="muted">${t.copy}</span></span>
      <strong>${t.on ? "On" : "Off"}</strong>
    </article>
  `;
}

/* ------------------------------------------------------------------ */
/* AI page and Companion integration                                  */
/* ------------------------------------------------------------------ */

function renderAI() {
  // Rebuild the AI page whenever it is opened, then let pet.js mount the setup panel.
  // AI Companion is intentionally a visual prototype in this iteration.
  // The UI shows the planned flow, but there is no real AI API integration yet.
  app.innerHTML = `
    ${pageHead("AI Companion", "Your friendly helper for questions, daily ideas, and safety tips")}
    <section class="container narrow">
      <section class="ai-panel">
        <div class="ai-intro">
          <span class="simple-pet"><span class="simple-face"></span></span>
          <span><h2>Your AI Companion</h2><p>Hello! I am here to help with questions, daily ideas, and safety tips. &#x1F338;</p></span>
        </div>
        <section class="ai-preferences panel">
          <h2>How would you like me to speak?</h2>
          <div class="form-grid">
            <div class="field">
              <label for="ai-language">Language</label>
              <select id="ai-language" data-ai-preference="language">
                <option value="en-AU" ${aiPreferences.language === "en-AU" ? "selected" : ""}>Australian English</option>
                <option value="zh-CN" ${aiPreferences.language === "zh-CN" ? "selected" : ""}>简体中文</option>
                <option value="zh-TW" ${aiPreferences.language === "zh-TW" ? "selected" : ""}>繁體中文</option>
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
        <p class="muted quick-label"><strong>Quick questions - tap one to ask:</strong></p>
        <div class="quick-questions">
          <button class="question" data-ai-question="How do I avoid scam messages?">"How do I avoid scam messages?"</button>
          <button class="question" data-ai-question="How can I remember to call my family?">"Remind me to call my family"</button>
          <button class="question" data-ai-question="What gentle activities could I do today?">"What can I do today?"</button>
        </div>
        <section class="panel">
          <h2>Ask your companion</h2>
          <div class="ask-box"><input id="ai-input" placeholder="Type your question here..." /><button class="primary" data-ai-action="ask-ai">Ask AI</button></div>
          <p id="ai-answer" class="ai-answer" role="status" aria-live="polite"></p>
        </section>
        <div class="wide-actions">
          <button class="primary" data-ai-action="daily-suggestion">&#x1F33F; Daily Suggestion</button>
          <button class="blue-btn" data-ai-action="safety-tip">&#x1F6E1; Safety Tip</button>
        </div>
        <!--
          Companion setup mount point.
          pet.js fills this empty container with the photo picker, status card,
          and companion history after the AI page has been rendered.
        -->
        <section class="panel" id="pet-setup"></section>
        <p class="muted secure-copy">&#x1F512; Your conversations are private and secure.</p>
      </section>
    </section>
  `;

  // Optional chaining keeps the AI page usable if the Companion module is unavailable.
  window.AgePet?.mountSetup();
}

// Send one named task to the server and render the response as plain text.
// 将一个命名任务发送到服务端，并以纯文本安全显示返回结果。
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
  } catch (error) {
    if (requestNumber !== aiRequestNumber) return;
    answer.className = "ai-answer error";
    answer.textContent = error.message || "The companion is unavailable right now.";
  }
}

/* ------------------------------------------------------------------ */
/* Router / render                                                      */
/* ------------------------------------------------------------------ */

function render() {
  // Central render function. Every route rebuilds the visible UI from the
  // current data state. This is the main data-driven pattern in the prototype.
  nav.forEach((button) => button.classList.toggle("active", button.dataset.route === activeRoute()));
  pet.classList.toggle("hidden", !pagesWithPet.has(route));

  if (route === "home") renderHome();
  if (route === "family") renderFamily();
  if (route === "manage-family") renderManageFamily();
  if (route === "friends") renderFriends();
  if (route === "manage-friends") renderManageFriends();
  if (route === "social") renderSocial();
  if (route === "profile") renderProfile();
  if (route === "ai") renderAI();
}

/* ------------------------------------------------------------------ */
/* Event handling                                                       */
/* ------------------------------------------------------------------ */

document.addEventListener("click", (event) => {
  // Event delegation keeps the interaction code in one place. Instead of
  // attaching separate click listeners after every render, the document listens
  // once and checks which data-* attribute was clicked.

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

  /* ---------------- AI Companion --------------------------------- */

  // Quick questions use the same server task as free-form questions.
  // 快捷问题和自由输入共用同一个服务端 ask 任务。
  const aiQuestion = event.target.closest("[data-ai-question]");
  if (aiQuestion) {
    askCompanion("ask", aiQuestion.dataset.aiQuestion);
    return;
  }

  // Action buttons provide carefully worded prompts for common use cases.
  // 操作按钮使用预先写好的提示，降低用户组织问题的负担。
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

  /* ---------------- Family ---------------- */

  // Filter the family board by one family member. This changes only the current
  // view, so it is stored in frontend state instead of persistent data.
  const familyFilter = event.target.closest("[data-family-filter]");
  if (familyFilter) {
    const id = Number(familyFilter.dataset.familyFilter);
    state.familyFilterId = state.familyFilterId === id ? null : id;
    renderFamily();
    return;
  }

  // Choose who the next family reminder/note will be sent to. This selected id
  // is later used by handleAction("add-family-note").
  const pickFamilyMember = event.target.closest("[data-pick-family-member]");
  if (pickFamilyMember) {
    state.familyNotePickId = Number(pickFamilyMember.dataset.pickFamilyMember);
    renderFamily();
    return;
  }

  // Mark one family note as done or not done. Backend mapping:
  // PATCH /family-notes/:id with { done: true/false }.
  // In this prototype the note is found in state.familyNotes and updated in
  // memory, so the change resets when the page is refreshed.
  const toggleFamilyNote = event.target.closest("[data-toggle-family-note]");
  if (toggleFamilyNote) {
    const id = Number(toggleFamilyNote.dataset.toggleFamilyNote);
    const noteItem = state.familyNotes.find((n) => n.id === id);
    if (noteItem) noteItem.done = !noteItem.done;
    renderFamily();
    return;
  }

  // Mute/unmute one family member. Backend mapping:
  // PATCH /family-members/:id with { muted: true/false }.
  const muteFamily = event.target.closest("[data-mute-family]");
  if (muteFamily) {
    const id = Number(muteFamily.dataset.muteFamily);
    const memberItem = getFamilyMember(id);
    if (memberItem) memberItem.muted = !memberItem.muted;
    renderManageFamily();
    return;
  }

  // Remove a family member and also remove notes that belonged to them.
  // Backend mapping:
  // DELETE /family-members/:id, then either cascade-delete their notes in the
  // database or return updated family member/note lists from the API.
  const removeFamily = event.target.closest("[data-remove-family]");
  if (removeFamily) {
    const id = Number(removeFamily.dataset.removeFamily);
    state.familyMembers = state.familyMembers.filter((m) => m.id !== id);
    state.familyNotes = state.familyNotes.filter((n) => n.memberId !== id);
    if (state.familyFilterId === id) state.familyFilterId = null;
    if (state.familyNotePickId === id) {
      state.familyNotePickId = state.familyMembers[0] ? state.familyMembers[0].id : null;
    }
    renderManageFamily();
    return;
  }

  /* ---------------- Friends ---------------- */

  // Select which friend's shared board is open. This is view state, not
  // database state, because it only controls what the current user is looking at.
  const selectFriend = event.target.closest("[data-select-friend]");
  if (selectFriend) {
    state.selectedFriendId = Number(selectFriend.dataset.selectFriend);
    renderFriends();
    return;
  }

  // Like/unlike a friend's note. Backend mapping:
  // POST /friend-notes/:id/like or DELETE /friend-notes/:id/like.
  // A real backend would normally store who liked the note, not only a boolean.
  const toggleFriendLike = event.target.closest("[data-toggle-friend-like]");
  if (toggleFriendLike) {
    const id = Number(toggleFriendLike.dataset.toggleFriendLike);
    for (const list of Object.values(state.friendNotes)) {
      const noteItem = list.find((n) => n.id === id);
      if (noteItem) {
        noteItem.liked = !noteItem.liked;
        break;
      }
    }
    renderFriends();
    return;
  }

  // Mute/unmute friend messages. Backend mapping:
  // PATCH /friends/:id with { muted: true/false }.
  const muteFriend = event.target.closest("[data-mute-friend]");
  if (muteFriend) {
    const id = Number(muteFriend.dataset.muteFriend);
    const friendItem = getFriend(id);
    if (friendItem) friendItem.muted = !friendItem.muted;
    renderManageFriends();
    return;
  }

  // Remove a friend and their board data from the current account.
  // Backend mapping:
  // DELETE /friends/:id. The server would decide whether messages are deleted
  // globally or only hidden from this user.
  const removeFriend = event.target.closest("[data-remove-friend]");
  if (removeFriend) {
    const id = Number(removeFriend.dataset.removeFriend);
    state.friends = state.friends.filter((f) => f.id !== id);
    delete state.friendNotes[id];
    if (state.selectedFriendId === id) {
      state.selectedFriendId = state.friends[0] ? state.friends[0].id : null;
    }
    renderManageFriends();
    return;
  }

  /* ---------------- Social ---------------- */

  // Activity category filter. This uses the activities loaded from data.js and
  // filters them in the browser. If the dataset becomes large, this should move
  // to an API query such as GET /activities?category=walking.
  const activityFilter = event.target.closest("[data-activity-filter]");
  if (activityFilter) {
    state.activityFilter = activityFilter.dataset.activityFilter;
    renderSocial();
    return;
  }

  // Save/unsave a community activity. Backend mapping:
  // POST /saved-items with { type: "activity", id } or
  // DELETE /saved-items/activity/:id.
  const saveActivity = event.target.closest("[data-save-activity]");
  if (saveActivity) {
    const id = Number(saveActivity.dataset.saveActivity);
    const activityItem = state.activities.find((a) => a.id === id);
    if (activityItem) activityItem.saved = !activityItem.saved;
    renderSocial();
    return;
  }

  // Save/unsave a news item. Backend mapping:
  // POST /saved-items with { type: "news", id } or
  // DELETE /saved-items/news/:id.
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
  const joinActivity = event.target.closest("[data-join-activity]");
  if (joinActivity) {
    const id = Number(joinActivity.dataset.joinActivity);
    const activityItem = state.activities.find((a) => a.id === id);
    if (activityItem) activityItem.joined = !activityItem.joined;
    renderSocial();
    return;
  }

  /* ---------------- Profile ---------------- */

  // Toggle profile privacy settings. Backend mapping:
  // PATCH /profile/share-settings with { key, on }.
  // These toggles decide what information may be shared when joining activities.
  const toggleRow = event.target.closest("[data-toggle-key]");
  if (toggleRow) {
    const key = toggleRow.dataset.toggleKey;
    const toggleItem = state.profileToggles.find((t) => t.key === key);
    if (toggleItem) toggleItem.on = !toggleItem.on;
    renderProfile();
    return;
  }

  /* ---------------- Generic actions ---------------- */

  // Form-style actions are routed through handleAction because they often need
  // to read input values, validate them, create/update data objects, and then
  // re-render the affected page.
  const action = event.target.closest("[data-action]");
  if (action) {
    handleAction(action.dataset.action);
  }
});

// Preferences are local UI state and are sent with the next API request.
// 偏好属于当前页面状态，会随下一次 API 请求一起发送。
document.addEventListener("change", (event) => {
  const preference = event.target.closest("[data-ai-preference]");
  if (!preference) return;
  aiPreferences[preference.dataset.aiPreference] = preference.value;
});

// Handles actions that are closer to backend transactions: add a note, add a
// family member, add a friend, post a message, or save profile changes.
//
// Current implementation:
// - Reads values from form inputs in the DOM.
// - Validates required fields in the browser.
// - Updates the in-memory `state` object.
// - Calls a render function so the UI shows the latest data.
//
// Future backend implementation:
// - Replace each direct state mutation with fetch()/axios calls to the server.
// - Let the backend create ids, validate data, and store records in the database.
// - After the API responds, update `state` with the returned record/list and
//   re-render the page. Add loading and error states around each request.
function handleAction(action) {
  if (action === "add-family-note") {
    // Create a new family reminder/note for the selected family member.
    // Backend mapping:
    // POST /family-notes with { memberId, text }
    // Expected response: the created note with server id, date, and done status.
    const input = document.querySelector("#family-note-input");
    const text = input ? input.value.trim() : "";
    if (!text || !state.familyNotePickId) return;
    state.familyNotes.unshift({
      id: nextId(),
      memberId: state.familyNotePickId,
      text,
      date: "Today",
      done: false,
    });
    renderFamily();
    return;
  }

  if (action === "focus-family-note") {
    // Convenience action only: opens the family page and places the cursor in the
    // note input. No backend or database call is needed.
    renderFamily();
    document.querySelector("#family-note-input")?.focus();
    return;
  }

  if (action === "mark-all-family-done") {
    // Marks every visible family note as done. Backend mapping:
    // PATCH /family-notes/bulk with { done: true }.
    // A production app should send only the ids the user is allowed to update.
    state.familyNotes.forEach((n) => (n.done = true));
    renderFamily();
    return;
  }

  if (action === "add-family-member") {
    // Add a trusted family member. Backend mapping:
    // POST /family-members with { name, relationship, contact }.
    // The backend should validate the contact method and send the invite.
    // The frontend should then show the returned member status, for example
    // "pending" or "active".
    const name = document.querySelector("#fam-add-name")?.value.trim();
    const rel = document.querySelector("#fam-add-rel")?.value.trim();
    const contact = document.querySelector("#fam-add-contact")?.value.trim();
    if (!name || !contact) return;
    const newMember = {
      id: nextId(),
      initial: name.charAt(0).toUpperCase(),
      name,
      rel: rel || "Family",
      contact,
      color: nextColor(state.familyMembers.length),
      muted: false,
    };
    state.familyMembers.push(newMember);
    state.familyNotePickId = newMember.id;
    renderManageFamily();
    return;
  }

  if (action === "post-friend-note") {
    // Post a message to the selected friend's shared board.
    // Backend mapping:
    // POST /friends/:friendId/notes with { text }.
    // In a real app this should also include authentication so the server knows
    // the author is the current logged-in user.
    const input = document.querySelector("#friend-note-input");
    const text = input ? input.value.trim() : "";
    if (!text || !state.selectedFriendId) return;
    if (!state.friendNotes[state.selectedFriendId]) state.friendNotes[state.selectedFriendId] = [];
    state.friendNotes[state.selectedFriendId].push({
      id: nextId(),
      author: "you",
      color: "green",
      text,
      date: "Today",
    });
    renderFriends();
    return;
  }

  if (action === "add-friend") {
    // Add someone the user already knows through email, phone, or invite code.
    // Backend mapping:
    // POST /friends/invitations with { name, email, phone, code }.
    // The server should check that the invite is valid and prevent adding
    // strangers who are not connected through an allowed contact method.
    const name = document.querySelector("#friend-add-name")?.value.trim();
    const email = document.querySelector("#friend-add-email")?.value.trim();
    const phone = document.querySelector("#friend-add-phone")?.value.trim();
    const code = document.querySelector("#friend-add-code")?.value.trim();
    if (!name || (!email && !phone && !code)) return;
    let contact = "Connected via Invitation code";
    if (email) contact = "Connected via Email invite";
    else if (phone) contact = "Connected via Phone invite";
    const newFriend = {
      id: nextId(),
      initial: name.charAt(0).toUpperCase(),
      name,
      color: nextColor(state.friends.length),
      contact,
      muted: false,
    };
    state.friends.push(newFriend);
    state.friendNotes[newFriend.id] = [];
    state.selectedFriendId = newFriend.id;
    renderManageFriends();
    return;
  }

  if (action === "save-profile") {
    // Save personal information from the profile form.
    // Backend mapping:
    // PATCH /profile with the updated fields below.
    // A real backend should validate sensitive fields such as age, phone number,
    // email, emergency contact, and accessibility needs before saving.
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
    // Temporary success feedback for the prototype. With a backend this should
    // appear after the API request succeeds, and an error message should be shown
    // if the save request fails.
    setTimeout(() => {
      state.profileJustSaved = false;
      if (route === "profile") renderProfile();
    }, 2000);
  }
}

// Floating companion shortcut: opens the AI Companion page. This is navigation
// only; the current AI page is static and does not call an external AI/backend.

// Initial render after data.js has populated window.appData.
render();
