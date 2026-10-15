// Application router, delegated event handling, and startup.
/* ------------------------------------------------------------------ */
/* Router and render                                                   */
/* ------------------------------------------------------------------ */

function render() {
  // Rebuild the visible UI from the current route and state.
  // 根据当前路由和状态重建可见界面。
  if (!validRoutes.has(route)) route = "intro";
  nav.forEach((button) => {
    // Highlight the active navigation button.
    // 高亮当前页面对应的导航按钮。
    const buttonRoute = button.dataset.route;
    button.classList.toggle("active", buttonRoute === activeRoute());
  });
  pet.classList.toggle("hidden", !pagesWithPet.has(route));
  if (!pagesWithPet.has(route)) window.PetChat?.close();
  document.body.classList.toggle("intro-active", route === "intro");

  if (route === "intro") renderIntro();
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
  const activityFollowup = event.target.closest("[data-activity-followup]");
  if (activityFollowup) { askAboutActivity(activityFollowup); return; }
  const rewriteButton = event.target.closest("[data-rewrite-tone]");
  if (rewriteButton) {
    // Ask AI to rewrite the current letter body with the selected tone.
    // 按所选语气让 AI 改写当前信件正文。
    rewriteLetter(rewriteButton.dataset.rewriteTone);
    return;
  }

  if (event.target.closest("[data-use-rewrite]")) {
    // Apply only a suggestion made for the still-current draft. This prevents
    // a stale preview from replacing edits made after the AI request began.
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
    // Discard the preview and invalidate pending responses without changing text.
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

  // Change how many recent days of news are shown (3, 7, or 0 for all).
  // 切换新闻显示的时间范围（3 天、7 天或全部）。
  const newsWindowTarget = event.target.closest("[data-news-window]");
  if (newsWindowTarget) {
    newsWindowDays = Number(newsWindowTarget.dataset.newsWindow);
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
    if (activityItem) { activityItem.saved = !activityItem.saved; rememberActivity(activityItem); }
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
  // News ids are strings (news-<article url>), so compare as strings.
  // 新闻 id 是字符串（news-文章链接），所以按字符串比较。
  const saveNews = event.target.closest("[data-save-news]");
  if (saveNews) {
    const id = saveNews.dataset.saveNews;
    const newsItem = state.newsItems.find((n) => String(n.id) === id);
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
    if (activityItem) { activityItem.joined = !activityItem.joined; rememberActivity(activityItem); }
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
    textSizeLevel = Number(textSizeTarget.dataset.textSize);
    saveTextSizeLevel();
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
  if (!letterField) {
    const profileInput = event.target.closest("#profile-full-name, #profile-preferred-name, #profile-age, #profile-phone, #profile-email, #profile-suburb, #profile-emergency, #profile-accessibility");
    if (profileInput) {
      const fieldKey = profileInput.id.replace("profile-", "");
      if (profileValidationErrors[fieldKey]) {
        delete profileValidationErrors[fieldKey];
        profileInput.closest(".field")?.classList.remove("invalid");
        profileInput.setAttribute("aria-invalid", "false");
        profileInput.closest(".field")?.querySelector(".field-error")?.remove();
      }
    }
    return;
  }
  letterDraft[letterField.dataset.letterField] = letterField.value;
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

  // Change events are used for select boxes, checkboxes, and time inputs.
  // change 事件用于下拉框、复选框和时间输入。
  const preference = event.target.closest("[data-ai-preference]");
  if (preference) {
    // Store AI preference changes locally.
    // 本地保存 AI 偏好变化。
    aiPreferences[preference.dataset.aiPreference] = preference.value;
    window.PetChat?.refreshLanguage();
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
    const nextProfile = {
      fullName: cleanProfileValue("#profile-full-name", state.profile.fullName),
      preferredName: cleanProfileValue("#profile-preferred-name", state.profile.preferredName),
      age: cleanProfileValue("#profile-age", state.profile.age),
      phone: cleanProfileValue("#profile-phone", state.profile.phone),
      email: cleanProfileValue("#profile-email", state.profile.email),
      suburb: cleanProfileValue("#profile-suburb", state.profile.suburb),
      emergencyContact: cleanProfileValue("#profile-emergency", state.profile.emergencyContact),
      accessibility: cleanProfileValue("#profile-accessibility", state.profile.accessibility),
    };
    profileValidationErrors = validateProfileValues(nextProfile);
    if (Object.keys(profileValidationErrors).length) {
      state.profile = { ...state.profile, ...nextProfile };
      state.profileJustSaved = false;
      renderProfile();
      return;
    }
    state.profile.fullName = nextProfile.fullName;
    state.profile.preferredName = nextProfile.preferredName;
    state.profile.age = nextProfile.age;
    state.profile.phone = nextProfile.phone;
    state.profile.email = nextProfile.email;
    state.profile.suburb = nextProfile.suburb;
    state.profile.emergencyContact = nextProfile.emergencyContact;
    state.profile.accessibility = nextProfile.accessibility;
    saveProfileLocally();
    // Stored activity overrides remain authoritative; otherwise use the new profile.
    activityPreferences = loadActivityPreferences();
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
// Restore Social preferences only after its helper has loaded.
activityPreferences = loadActivityPreferences();

// Initial render after data.js has populated window.appData.
// data.js 准备好 window.appData 后进行初始数据加载。
// Render the first visible page before background data refreshes finish.
// 后台数据刷新完成前，先渲染首屏页面，避免打开时空白。
render();
loadDatabaseActivities();
loadNewsFeed();
