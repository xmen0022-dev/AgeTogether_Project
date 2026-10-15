// Profile rendering, validation, and privacy controls.
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
          <div class="field ${profileValidationErrors.accessibility ? "invalid" : ""}"><label>Accessibility needs</label><small>Optional. Helps activity organisers support you.</small><textarea id="profile-accessibility" aria-invalid="${profileValidationErrors.accessibility ? "true" : "false"}">${escapeHtml(p.accessibility)}</textarea>${profileError("accessibility")}</div>
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
  const error = profileValidationErrors[id];
  return `<div class="field ${error ? "invalid" : ""}"><label>${escapeHtml(label)}</label><input id="profile-${id}" value="${escapeHtml(value)}" aria-invalid="${error ? "true" : "false"}" />${profileError(id)}</div>`;
}

function profileError(id) {
  const message = profileValidationErrors[id];
  return message ? `<p class="field-error">${escapeHtml(message)}</p>` : "";
}

function cleanProfileValue(selector, fallback = "") {
  return (document.querySelector(selector)?.value ?? fallback).trim();
}

function isValidName(value) {
  return /^[A-Za-z][A-Za-z\s'-]{1,59}$/.test(value);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function normalisedPhoneDigits(value) {
  return value.replace(/[^\d]/g, "");
}

function isValidAustralianPhone(value) {
  const digits = normalisedPhoneDigits(value);
  return (digits.startsWith("04") && digits.length === 10) || (digits.startsWith("614") && digits.length === 11);
}

function validateProfileValues(values) {
  const errors = {};
  if (values.fullName && !isValidName(values.fullName)) {
    errors["full-name"] = "Use 2-60 letters. Spaces, hyphens, and apostrophes are allowed.";
  }
  if (values.preferredName && !isValidName(values.preferredName)) {
    errors["preferred-name"] = "Use 2-60 letters. Spaces, hyphens, and apostrophes are allowed.";
  }
  if (values.age && (!/^\d{1,3}$/.test(values.age) || Number(values.age) < 1 || Number(values.age) > 120)) {
    errors.age = "Age must be a whole number between 1 and 120.";
  }
  if (values.phone && !isValidAustralianPhone(values.phone)) {
    errors.phone = "Use an Australian mobile number, for example 0412 345 678 or +61 412 345 678.";
  }
  if (values.email && !isValidEmail(values.email)) {
    errors.email = "Use a valid email address, for example name@example.com.";
  }
  if (values.suburb && !/^[A-Za-z][A-Za-z\s,'-]{1,79}$/.test(values.suburb)) {
    errors.suburb = "Use a suburb or area name with letters. Commas and hyphens are allowed.";
  }
  if (values.emergencyContact) {
    const hasName = /[A-Za-z]{2,}/.test(values.emergencyContact);
    const hasPhone = isValidAustralianPhone(values.emergencyContact);
    if (!hasName || !hasPhone) {
      errors.emergency = "Include a contact name and an Australian mobile number.";
    }
  }
  if (values.accessibility.length > 240) {
    errors.accessibility = "Keep this note under 240 characters.";
  }
  return errors;
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

