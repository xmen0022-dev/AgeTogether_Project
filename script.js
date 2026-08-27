const app = document.querySelector("#app");
const pet = document.querySelector("#pet");
const nav = [...document.querySelectorAll(".bottom-nav button")];

let route = "home";
let socialTab = "activities";

const pagesWithPet = new Set(["family", "friends", "manage-family", "manage-friends", "social", "profile", "ai"]);

function setRoute(nextRoute) {
  route = nextRoute;
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function activeRoute() {
  if (route === "manage-family") return "family";
  if (route === "manage-friends") return "friends";
  return route;
}

function pageHead(title, subtitle) {
  return `
    <section class="page-head">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </section>
  `;
}

function renderHome() {
  app.innerHTML = `
    <section class="home-wrap">
      <div class="check-mark">&#x2713;</div>
      <h1>AgeTogether Australia</h1>
      <p>A simple way to stay connected with friends and family.</p>
      <section class="menu-list">
        ${homeCard("family", "family-card", "&#x1F3E0;", "Family", "A private board for trusted care notes, reminders, and messages from your family.")}
        ${homeCard("friends", "friends-card", "&#x1F4CC;", "Friends", "A shared noticeboard with friends you already know - calm, low-pressure connection.")}
        ${homeCard("social", "social-card", "&#x1F5FA;", "Social", "Find nearby community activities and helpful local news for healthy ageing.")}
        ${homeCard("profile", "profile-card", "&#x1F464;", "Profile", "Manage your personal information and privacy settings.")}
        ${homeCard("ai", "ai-card", "&#x1F43E;", "AI Companion", "A friendly helper for simple questions, daily suggestions, and safety tips.")}
      </section>
      <button class="get-started" data-route="family">Get Started</button>
    </section>
  `;
}

function homeCard(routeName, className, icon, title, copy) {
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

function renderFamily() {
  app.innerHTML = `
    ${pageHead("Family Board", "Private messages and care reminders from your family")}
    <section class="container">
      <div class="toolbar family-toolbar">
        <div class="chips">
          <strong class="muted">Showing notes from:</strong>
          ${chip("D", "Daniel", "Son", "peach", true)}
          ${chip("S", "Sophie", "Granddaughter", "purple")}
          ${chip("L", "Linda", "Daughter", "blue")}
          ${chip("J", "James", "Carer", "green")}
        </div>
        <button class="outline-btn" data-route="manage-family">&#x1F465; Manage Family</button>
      </div>
      <section class="board family-board">
        <div class="note-area family-note-area">
          ${note("peach", "D", "Daniel", "Son", "Doctor appointment on Friday at 2 pm &#x1FA7A;", "18 Aug", "Tap to mark done")}
          ${note("purple", "S", "Sophie", "Granddaughter", "Remember to drink water today &#x1F4A7;", "18 Aug", "Tap to mark done")}
          ${note("green", "L", "Linda", "Daughter", "I will call tonight after dinner &#x1F4DE;", "18 Aug", "Done", true)}
          ${note("green", "J", "James", "Carer", "Medication checked &#x2713;", "18 Aug", "Done", true)}
          ${note("purple", "S", "Sophie", "Granddaughter", "Let's have lunch this weekend! &#x1F37D;", "17 Aug", "Tap to mark done")}
          ${note("peach", "D", "Daniel", "Son", "Your favourite show is on at 7 pm tonight &#x1F4FA;", "17 Aug", "Tap to mark done")}
        </div>
      </section>
      <section class="two-col">
        <div class="panel">
          <h2>Add a family note</h2>
          <div class="chips note-picker">
            <button class="pill active">Daniel</button>
            <button class="pill">Sophie</button>
            <button class="pill">Linda</button>
            <button class="pill">James</button>
          </div>
          <textarea placeholder="Write a reminder or note for the family board..."></textarea>
          <p class="align-right"><button class="blue-btn">+ Add Family Note</button></p>
        </div>
        <div class="panel">
          <h2>Quick actions</h2>
          <div class="actions">
            <button class="message-action">&#x25A1; Send Message</button>
            <button class="done-action">&#x2611; Mark All Done</button>
          </div>
          <p class="notice compact">&#x1F512; Only your trusted family members can see this board. It is private and safe.</p>
        </div>
      </section>
    </section>
    <div class="help-bubble">Need help? Tap me to<br />chat &#x1F338;</div>
  `;
}

function chip(initial, name, rel, color, active = false) {
  return `<button class="pill ${active ? "active" : ""} ${color}-pill"><span class="mini-avatar ${color}">${initial}</span>${name}<span class="dot">&middot;</span><span class="muted">${rel}</span></button>`;
}

function note(color, initial, name, rel, text, date, action, done = false) {
  const relation = rel ? `<span class="muted"> &middot; ${rel}</span>` : "";
  return `
    <article class="note ${color} ${done ? "done" : ""}">
      <div class="note-head">
        <strong><span class="mini-avatar ${color}">${initial}</span>${name}${relation}</strong>
        <span>${date}</span>
      </div>
      <p>${text}</p>
      <span class="note-action">${done ? "&#x2713;" : "&#x25EF;"} ${action}</span>
    </article>
  `;
}

function renderManageFamily() {
  app.innerHTML = `
    ${pageHead("Manage Family Members", "Control who can post on your family board")}
    <section class="container narrow">
      <button class="outline-btn back-btn" data-route="family">&larr; Back to Family Board</button>
      <p class="notice">&#x1F512; You control who can post on your family board. Only the people listed here can leave notes.</p>
      <section class="panel form-card">
        <h2>Add a family member</h2>
        <p class="muted">Enter their details and we will send them a private family invite.</p>
        <div class="form-grid">
          <div class="field"><label>Name</label><input placeholder="e.g. Sarah" /></div>
          <div class="field"><label>Relationship</label><input placeholder="e.g. Daughter, Nephew, Carer" /></div>
          <div class="field full"><label>Email or phone number</label><input placeholder="example@email.com or 04xx xxx xxx" /></div>
        </div>
        <p><button class="primary wide">Send Family Invite</button></p>
      </section>
      <section class="member-list">
        <h2>Your family members</h2>
        <p class="muted">4 trusted people connected to your family board.</p>
        ${member("D", "Daniel", "Son", "daniel@email.com", "peach")}
        ${member("S", "Sophie", "Granddaughter", "0412 345 678", "purple")}
        ${member("L", "Linda", "Daughter", "linda@email.com", "blue")}
        ${member("J", "James", "Carer", "0498 765 432", "green")}
      </section>
    </section>
  `;
}

function member(initial, name, rel, contact, color, friend = false) {
  return `
    <article class="member">
      <span class="avatar ${color}">${initial}</span>
      <span><h3>${name} <span class="muted">&middot; ${rel}</span> <span class="small-badge">&#x2713; Active</span></h3><p class="muted">${contact}</p></span>
      ${friend ? `<button class="ghost" data-route="friends">View Board</button>` : ""}
      <button class="ghost">&#x1F507; ${friend ? "Mute" : "Mute messages"}</button>
      <button class="danger">Remove</button>
    </article>
  `;
}

function renderFriends() {
  app.innerHTML = `
    <section class="container">
      <div class="toolbar friends-toolbar">
        <div>
          <p class="muted"><strong>Choose a friend to open their shared board:</strong></p>
          <div class="chips">
            ${friendPick("M", "Margaret", "5 notes on board", "peach", true)}
            ${friendPick("D", "David", "4 notes on board", "blue")}
            ${friendPick("H", "Helen", "4 notes on board", "purple")}
          </div>
        </div>
        <button class="outline-btn" data-route="manage-friends">&#x1F465; Manage Friends</button>
      </div>
      <section class="board">
        <div class="board-title">
          <div class="title-row">
            <span class="avatar peach">M</span>
            <span><h2>Shared board with Margaret</h2><p class="muted">A quiet place to leave notes for each other - read them whenever you like.</p></span>
          </div>
          <p class="muted privacy-copy">&#x1F512; Private board<br />Only you and Margaret can see this</p>
        </div>
        <div class="note-area friend-note-area">
          ${note("peach", "M", "Margaret", "", "Good morning! I hope you are having a lovely peaceful day &#x2600;", "18 Aug", "Like")}
          ${note("green", "Y", "You", "", "Good morning Margaret! The garden is looking beautiful today.", "18 Aug", "Like")}
          ${note("yellow", "M", "Margaret", "", "Would you like to walk together this weekend? I know a lovely path by the lake.", "17 Aug", "Like")}
          ${note("blue", "Y", "You", "", "Yes, that sounds lovely. Saturday morning would be perfect!", "17 Aug", "Like")}
          ${note("peach", "M", "Margaret", "", "Wonderful! I will bring some homemade biscuits to share &#x1F36A;", "17 Aug", "Like")}
        </div>
        <div class="message-panel">
          <h2>Leave a message on the board...</h2>
          <div class="message-form">
            <textarea placeholder="Write something for Margaret to read when they visit..."></textarea>
            <button class="primary">Post Message</button>
          </div>
          <p class="muted small">Your message will appear on the shared board. Margaret will see it the next time they visit.</p>
        </div>
      </section>
    </section>
  `;
}

function friendPick(initial, name, copy, color, active = false) {
  return `<button class="friend-pick ${active ? "active" : ""}"><span class="avatar ${color}">${initial}</span><span><h3>${name}</h3><p class="muted">${copy}</p></span><span class="status-dot"></span></button>`;
}

function renderManageFriends() {
  app.innerHTML = `
    ${pageHead("Manage Friends", "Control your trusted friend connections")}
    <section class="container narrow">
      <button class="outline-btn back-btn" data-route="friends">&larr; Back to Friends Board</button>
      <p class="notice blue-notice">&#x1F6E1; <strong>For your safety,</strong> AgeTogether does not recommend strangers. You can only add people you already know using their email, phone number, or an invitation code they have shared with you.</p>
      <section class="panel form-card">
        <h2>Add someone you already know</h2>
        <p class="muted">Enter one of the following to send them a private invitation.</p>
        <div class="form-grid single">
          <div class="field"><label>Email address</label><input placeholder="example@email.com" /></div>
          <div class="field"><label>Phone number</label><input placeholder="04xx xxx xxx" /></div>
          <div class="field"><label>Invitation code</label><input placeholder="e.g. FRIEND-1234" /></div>
        </div>
        <p><button class="primary wide">Send Friend Invite</button></p>
      </section>
      <section class="member-list">
        <h2>Your friends</h2>
        <p class="muted">3 trusted friends connected to your boards.</p>
        ${member("M", "Margaret", "Friend", "Connected via Email invite", "peach", true)}
        ${member("D", "David", "Friend", "Connected via Phone invite", "blue", true)}
        ${member("H", "Helen", "Friend", "Connected via Invitation code", "purple", true)}
      </section>
    </section>
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

function renderActivities() {
  return `
    <h2>Find nearby community activities</h2>
    <p class="muted section-copy">Safe, welcoming local events designed for older adults.</p>
    <div class="chips filter-row">
      <button class="pill active">All</button>
      <button class="pill">Walking</button>
      <button class="pill">Gardening</button>
      <button class="pill">Coffee group</button>
      <button class="pill">Library event</button>
      <button class="pill">Health workshop</button>
      <button class="pill">Senior community</button>
    </div>
    <section class="social-grid">
      ${activity("&#x1F6B6;", "Morning Walk at Carlton Gardens", "Carlton Gardens, Melbourne &middot; 1.2 km away", "Wednesday, 20 Aug &middot; 8:00 am", "Free", "A friendly guided morning walk through the gardens. All fitness levels welcome. Walking poles provided.", "Flat paths, wheelchair accessible", "Melbourne City Council")}
      ${activity("&#x1F331;", "Community Gardening Group", "Fitzroy Community Garden &middot; 2.4 km away", "Saturday, 23 Aug &middot; 10:00 am", "Free", "Grow vegetables and flowers with friendly neighbours. No experience needed - tools and gloves provided.", "Ground level, seated options available", "Fitzroy Community Hub")}
      ${activity("&#x1F4BB;", "Library Digital Skills Workshop", "Melbourne City Library &middot; 0.9 km away", "Thursday, 21 Aug &middot; 2:00 pm", "Free", "Learn how to use your phone and tablet safely. Friendly staff help at your own pace. Bring your device.", "Fully accessible, lift available", "State Library Victoria")}
      ${activity("&#x2615;", "Seniors Coffee Morning", "Brunswick Community Centre &middot; 3.1 km away", "Friday, 22 Aug &middot; 10:30 am", "Low cost - $3 donation", "A warm and welcoming morning tea with other seniors. Chat, play cards, or simply enjoy the company.", "Accessible entrance, seating provided", "Brunswick Seniors Network")}
      ${activity("&#x1F938;", "Gentle Exercise Class", "Northcote Leisure Centre &middot; 4.0 km away", "Tuesday & Friday &middot; 9:30 am", "Low cost - $5 per session", "Low-impact stretching and gentle movement for older adults. Instructor led, suitable for all abilities.", "Accessible venue, chairs available", "Northcote Leisure Centre")}
    </section>
  `;
}

function activity(icon, title, location, date, price, copy, access, organiser) {
  return `
    <article class="activity-card">
      <div class="card-top">
        <span class="activity-icon">${icon}</span>
        <h3>${title}</h3>
        <button class="save-btn">&#x1F516; Save</button>
      </div>
      <p class="muted">&#x1F4CD; ${location}</p>
      <p><span class="small-badge blue-badge">&#x1F5D3; ${date}</span> <span class="small-badge">${price}</span></p>
      <p>${copy}</p>
      <p class="muted small">&#x267F; ${access}<br />&#x1F3E2; ${organiser}</p>
      <button class="primary wide">Join Activity</button>
    </article>
  `;
}

function renderNews() {
  return `
    <h2>Useful news & information</h2>
    <p class="muted section-copy">Simple, helpful news for healthy and connected living.</p>
    <section class="social-grid">
      ${news("&#x1F9E0;", "Healthy Ageing", "Staying socially connected helps protect brain health", "New research shows that regular contact with friends and family can significantly reduce the risk of cognitive decline in older adults.", "Australian Institute of Health and Welfare")}
      ${news("&#x1F6E1;", "Scam Safety", "New phone scam targeting older Australians - what to know", "Scammers are pretending to be from Medicare. They will never call you asking for personal details. Hang up and call the official number.", "Scamwatch Australia")}
      ${news("&#x1F91D;", "Local Community", "Free community programs available across Victoria this August", "Local councils are offering free social events, exercise classes, and digital skills workshops for seniors throughout August and September.", "Victorian Seniors Festival")}
    </section>
  `;
}

function news(icon, tag, title, copy, source) {
  return `
    <article class="news-card">
      <div class="card-top">
        <span class="activity-icon">${icon}</span>
        <span class="small-badge blue-badge">${tag}</span>
        <button class="save-btn">&#x1F516; Save</button>
      </div>
      <h3>${title}</h3>
      <p>${copy}</p>
      <p class="muted small">Source: ${source}</p>
      <button class="outline-btn wide">Read More</button>
    </article>
  `;
}

function renderSaved() {
  return `
    <h2>Your Saved Items</h2>
    <p class="muted section-copy">Activities and news you have saved to read or revisit later.</p>
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

function renderProfile() {
  app.innerHTML = `
    ${pageHead("My Profile", "Manage your personal information and privacy settings")}
    <section class="container narrow">
      <section class="panel profile-panel">
        <div class="title-row">
          <span class="avatar peach">M</span>
          <span><h2>Personal Information</h2><p class="muted">Only you can see this unless you choose to share it.</p></span>
        </div>
        <div class="form-grid profile-grid">
          ${profileField("Full name", "Margaret Lee")}
          ${profileField("Preferred name", "Margaret")}
          ${profileField("Age", "71")}
          ${profileField("Phone number", "0412 345 678")}
          ${profileField("Email address", "margaret.lee@email.com")}
          ${profileField("Suburb", "Carlton, VIC")}
          ${profileField("Emergency contact", "Daniel Lee - 0423 456 789")}
          <div class="field"><label>Accessibility needs</label><small>Optional. Helps activity organisers support you.</small><textarea>Prefer seating. Hearing aid user.</textarea></div>
        </div>
        <p><button class="primary">Save Changes</button></p>
      </section>
      <section class="panel profile-panel">
        <h2>What information can be shared?</h2>
        <p class="muted">You choose what information is shared when you join an activity.</p>
        <p class="notice blue-notice">&#x1F4A1; Turning something <strong>On</strong> means it may be shared with activity organisers when you join. Everything is <strong>Off</strong> by default.</p>
        <div class="toggle-list">
          ${toggle("Show my name", "Your preferred name will be shown.", true)}
          ${toggle("Show my phone number", "Your phone number may be given to the organiser.", false)}
          ${toggle("Show my email address", "Your email may be given to the organiser.", true)}
          ${toggle("Show my suburb", "Helps organisers suggest nearby activities.", true)}
          ${toggle("Share accessibility needs with activity organisers", "Helps organisers prepare appropriate support.", true)}
          ${toggle("Share emergency contact only when needed", "Only shared in an emergency situation.", false)}
        </div>
      </section>
    </section>
  `;
}

function profileField(label, value) {
  return `<div class="field"><label>${label}</label><input value="${value}" /></div>`;
}

function toggle(title, copy, on) {
  return `<article class="toggle-row ${on ? "on" : ""}"><span class="switch"></span><span><strong>${title}</strong><br /><span class="muted">${copy}</span></span><strong>${on ? "On" : "Off"}</strong></article>`;
}

function renderAI() {
  app.innerHTML = `
    ${pageHead("AI Companion", "Your friendly helper for questions, daily ideas, and safety tips")}
    <section class="container narrow">
      <section class="ai-panel">
        <div class="ai-intro">
          <span class="simple-pet"><span class="simple-face"></span></span>
          <span><h2>Your AI Companion</h2><p>Hello! I am here to help with questions, daily ideas, and safety tips. &#x1F338;</p></span>
        </div>
        <p class="muted quick-label"><strong>Quick questions - tap one to ask:</strong></p>
        <div class="quick-questions">
          <button class="question">"How do I avoid scam messages?"</button>
          <button class="question">"Remind me to call my family"</button>
          <button class="question">"What can I do today?"</button>
        </div>
        <section class="panel">
          <h2>Ask your companion</h2>
          <div class="ask-box"><input placeholder="Type your question here..." /><button class="primary">Ask AI</button></div>
        </section>
        <div class="wide-actions">
          <button class="primary">&#x1F33F; Daily Suggestion</button>
          <button class="blue-btn">&#x1F6E1; Safety Tip</button>
        </div>
        <p class="muted secure-copy">&#x1F512; Your conversations are private and secure.</p>
      </section>
    </section>
  `;
}

function render() {
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

document.addEventListener("click", (event) => {
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) setRoute(routeTarget.dataset.route);

  const tabTarget = event.target.closest("[data-social-tab]");
  if (tabTarget) {
    socialTab = tabTarget.dataset.socialTab;
    route = "social";
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderSocial();
  }
});

pet.addEventListener("click", () => setRoute("ai"));
render();
