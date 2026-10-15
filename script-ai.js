// AI Companion rendering and request helpers.
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
          <div id="companion-history"></div>
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
  // optional chaining 可以保证 Companion 模块不可用时页面仍能打开。
  // Mount the pet setup panel after the AI page HTML exists.
  // AI 页面 HTML 创建后再挂载桌宠设置面板。
  window.AgePet?.mountSetup();
  // Replay the same session transcript shown in the floating Pet composer.
  window.PetChat?.mountHistory(document.querySelector("#companion-history"));
}

// Send one named task to the server and render the response as plain text.
// 把指定任务发送到服务器，并以纯文本方式显示回复。
// The response is written as textContent so returned text is not treated as HTML.
// 回复使用 textContent 写入，避免把返回内容当成 HTML 执行。
async function askCompanion(task, input) {
  if (window.PetChat?.sendQuestion) return window.PetChat.sendQuestion(input, task);
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
