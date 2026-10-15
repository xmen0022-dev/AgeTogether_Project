// Letter editor, preview, download, email, and rewrite helpers.
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
          <label class="letter-sound-toggle"><input type="checkbox" data-letter-sound ${letterSoundEnabled ? "checked" : ""} /> Play a paper sound when sent</label>
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

function preparePaperSound() {
  // Unlock optional audio during the user's click, before the email request.
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
  preparePaperSound();
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

    playPaperSound();
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
  // Allow only supported task suffixes and snapshot the draft before the request.
  // Recipient fields are excluded, but private details typed into the body itself
  // would still be sent, which is why the confirmation asks users to omit them.
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
  // The sequence number invalidates older responses when another rewrite starts,
  // the draft changes, or the user discards/accepts a previous suggestion.
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
    // Keep the original untouched on provider errors, refusals or missing output.
    // A valid response becomes a preview, not an automatic replacement.
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

