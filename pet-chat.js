// Pet is the same companion everywhere: opening chat never changes the page.
// Pet 是同一个伙伴：打开聊天不会跳转，也不会自动请求 AI。
(() => {
  const pet = document.querySelector('#pet');
  if (!pet) return;
  // yuyan wenan：英文、简体、繁体的界面文字。
  const copy = {
    'en-AU': { title: 'Your companion', hello: "I'm here. What would you like to talk about?", input: 'Talk with your companion', send: 'Send', close: 'Close chat', thinking: 'Thinking…', error: 'I could not connect just now. Please try again.', privacy: 'Your message is sent to AI. Please leave out private details.', empty: 'I did not get an answer. Please try again.' },
    SC: { title: '你的伙伴', hello: '我在这里。你想聊些什么？', input: '和伙伴聊聊', send: '发送', close: '关闭聊天', thinking: '正在想一想…', error: '暂时无法连接，请重试。', privacy: '消息会发送给 AI，请不要填写私人信息。', empty: '暂时没有收到回答，请重试。' },
    TC: { title: '你的夥伴', hello: '我在這裡。你想聊些什麼？', input: '和夥伴聊聊', send: '傳送', close: '關閉聊天', thinking: '正在想一想…', error: '暫時無法連線，請重試。', privacy: '訊息會傳送給 AI，請不要填寫私人資訊。', empty: '暫時沒有收到回答，請重試。' },
  };
  let panel, title, closeButton, messages, status, form, input, send, privacy;
  // `opened` controls visibility; `compact` hides the composer but keeps the reply.
  // `pending` is shared by both composers so only one AI request runs at a time.
  let opened = false;
  let pending = false;
  let compact = false;
  let peek;
  let replyText;
  // One session transcript for both surfaces; no persistent storage.
  // 两个入口共享本次对话，刷新后清空，不写入本地存储。
  // linshi duihua jilu：只存内存，刷新清空，不是数据库保存。
  const transcript = [];
  // This array is a display history only. It is neither persisted nor included
  // in the API payload as model context, so refresh clears the conversation.
  let historyMessages, historyStatus, historySend, historyTitle, historyInput, historyPrivacy;
  let feedback = '';
  const languageCopy = () => copy[window.aiPreferences?.language] || copy['en-AU'];

  // tiaozheng qipao weizhi：根据 Pet 图片大小，把气泡放到图片上方。
  function positionAbovePet() {
    if (!panel || !opened) return;
    // Measure the actual image, not an assumed fixed avatar height.
    // 根据实际图片边界定位，给气泡尾巴和 Pet 的轻微动作留出空间。
    const buttonRect = pet.getBoundingClientRect();
    const photoRect = pet.querySelector('.pet-photo')?.getBoundingClientRect();
    const top = Math.min(buttonRect.top, photoRect?.top ?? buttonRect.top);
    const right = Math.max(buttonRect.right, photoRect?.right ?? buttonRect.right);
    // Viewport coordinates become fixed-position offsets. Reserve 36 pixels
    // above the image for the balloon tail and the Pet's small movements.
    panel.style.bottom = `${Math.max(12, window.innerHeight - top + 36)}px`;
    panel.style.right = `${Math.max(12, window.innerWidth - right)}px`;
    panel.style.left = 'auto';
    panel.style.maxHeight = `${Math.max(60, top - 48)}px`;
    // Bound the readable reply area to 320 pixels and available space above
    // the Pet; an expanded composer reserves an additional 90 pixels.
    replyText.style.maxHeight = `${Math.max(44, Math.min(320, top - 80 - (compact ? 0 : 90)))}px`;
  }

  // chuangjian yemian yuansu：创建元素并设置 ID 和样式类。
  function element(tag, id, className = '') {
    const node = document.createElement(tag);
    node.id = id;
    node.className = className;
    return node;
  }

  // Share the conversation between both views. / liang ge jiemian gongxiang duihua
  // jilu bing tongbu xiaoxi：加入临时记录，同步到 Pet 和 AI 页面。
  function appendMessage(text, kind) {
    // Store once, then update any mounted views. An absent AI-page history
    // will receive these messages later when mountHistory() replays the array.
    transcript.push({ text, kind });
    renderMessage(messages, text, kind);
    if (historyMessages) renderMessage(historyMessages, text, kind);
  }

  // xianshi
  function renderMessage(host, text, kind) {
    // `kind` chooses the visual style (user, companion, reminder or tip).
    // This function creates DOM only; it does not write to storage.
    const row = element('p', '', `pet-chat-message is-${kind}`);
    // Model output is always plain text, never HTML. / AI 输出仅作为文本展示。
    row.textContent = text;
    host.append(row);
    host.scrollTop = host.scrollHeight;
  }

  // chuangjian liaotian kuang
  function ensurePanel() {
    // Build and bind the floating panel once, rather than attaching duplicate
    // handlers every time the user opens it. Leave it hidden until open().
    if (panel) return;
    panel = element('section', 'pet-chat', 'pet-chat');
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'pet-chat-title');
    const header = element('header', 'pet-chat-header', 'pet-chat-header');
    title = element('h2', 'pet-chat-title');
    closeButton = element('button', 'pet-chat-close', 'outline-btn');
    closeButton.type = 'button';
    closeButton.addEventListener('click', close);
    header.append(title);
    messages = element('div', 'pet-chat-messages', 'pet-chat-messages');
    messages.setAttribute('role', 'log');
    messages.setAttribute('aria-live', 'polite');
    messages.setAttribute('aria-relevant', 'additions');
    status = element('p', 'pet-chat-status', 'pet-chat-status');
    status.setAttribute('role', 'status');
    form = element('form', 'pet-chat-form', 'pet-chat-form');
    input = element('textarea', 'pet-chat-input');
    input.rows = 1;
    input.maxLength = 2000;
    send = element('button', 'pet-chat-send', 'solid-btn');
    send.type = 'submit';
    form.append(input, send, closeButton);
    form.addEventListener('submit', submit);
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    privacy = element('p', 'pet-chat-privacy', 'pet-chat-privacy');
    peek = element('button', 'pet-chat-peek', 'pet-chat-peek');
    peek.type = 'button';
    // The outer button owns the comic outline and clickable reopening action.
    // The inner span scrolls long replies without clipping the balloon tail.
    replyText = element('span', 'pet-chat-reply', 'pet-chat-reply');
    peek.append(replyText);
    peek.setAttribute('aria-live', 'polite');
    peek.addEventListener('click', open);
    panel.append(header, messages, status, peek, form, privacy);
    document.body.append(panel);
    appendMessage(languageCopy().hello, 'companion');
  }

  // gengxin yuyan：让两个聊天入口的界面文字跟随语言设置。
  function refreshLanguage() {
    // Translate controls without replacing the composers or clearing drafts.
    // Existing messages keep the language in which they were originally sent.
    if (!panel) return;
    const words = languageCopy();
    title.textContent = words.title;
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', words.close);
    input.placeholder = words.input;
    input.setAttribute('aria-label', words.input);
    input.setAttribute('aria-description', words.privacy);
    send.textContent = words.send;
    privacy.textContent = words.privacy;
    pet.setAttribute('aria-label', words.input);
    if (historyTitle) {
      historyTitle.textContent = ({ SC: '我们的对话', TC: '我們的對話' })[window.aiPreferences?.language] || 'Our conversation';
      historyInput.placeholder = words.input;
      historyInput.setAttribute('aria-label', words.input);
      historySend.textContent = words.send;
      historyPrivacy.textContent = words.privacy;
    }
    if (pending) status.textContent = words.thinking;
    syncStatus();
  }

  // gengxin zhuangtai he huifu：显示等待、错误或完整回复。
  function syncStatus() {
    // A pending/error status temporarily takes precedence over the latest
    // non-user message. Both views share the same disabled-send state.
    const text = pending ? languageCopy().thinking : feedback ? languageCopy().error : '';
    status.textContent = text;
    send.disabled = pending;
    if (historyStatus) historyStatus.textContent = text;
    if (historySend) historySend.disabled = pending;
    const latest = transcript.findLast(entry => entry.kind !== 'user');
    const fullText = text || latest?.text || languageCopy().hello;
    // Keep the full reply; only its visible height is limited, with scrolling.
    // 保留完整回复；只限制显示高度，长内容可在气泡内滚动。
    replyText.textContent = fullText;
    replyText.scrollTop = 0;
    peek.setAttribute('aria-label', `${languageCopy().input}: ${fullText}`);
    positionAbovePet();
  }

  // Display the shared conversation history. / xianshi gongxiang de duihua jilu
  // gongxiang duihua jilu：在 AI Companion 页面显示同一份临时记录。
  function mountHistory(host) {
    // The router supplies a fresh container after rendering the AI page.
    // Rebuild that view from the shared transcript, not from the Pet's HTML.
    if (!host) return;
    ensurePanel();
    const words = languageCopy();
    historyTitle = element('h2', 'companion-history-title');
    historyMessages = element('div', 'companion-history-messages', 'companion-history-messages');
    historyMessages.setAttribute('role', 'log');
    historyMessages.setAttribute('aria-live', 'polite');
    historyMessages.setAttribute('aria-relevant', 'additions');
    transcript.forEach(entry => renderMessage(historyMessages, entry.text, entry.kind));
    historyStatus = element('p', 'companion-history-status', 'pet-chat-status');
    historyStatus.setAttribute('role', 'status');
    const historyForm = element('form', 'companion-history-form', 'pet-chat-form');
    historyInput = element('textarea', 'companion-history-input');
    const composer = historyInput;
    // Capture this particular textarea so an old asynchronous submit handler
    // cannot accidentally restore a question into a newly mounted composer.
    historyInput.rows = 2;
    historyInput.maxLength = 2000;
    historyInput.placeholder = words.input;
    historyInput.setAttribute('aria-label', words.input);
    historySend = element('button', 'companion-history-send');
    historySend.type = 'submit';
    historySend.textContent = words.send;
    historyForm.append(historyInput, historySend);
    historyForm.addEventListener('submit', async event => {
      event.preventDefault();
      const question = composer.value.trim();
      if (pending || !question) return;
      composer.value = '';
      const answered = await sendQuestion(question);
      // Restore a failed question only if the user has not typed a new draft.
      if (!answered && !composer.value) composer.value = question;
    });
    historyPrivacy = element('p', 'companion-history-privacy', 'pet-chat-privacy');
    host.append(historyTitle, historyMessages, historyStatus, historyForm, historyPrivacy);
    refreshLanguage();
  }

  // dakai shuru kuang：展开输入区并让光标进入输入框，不自动请求 AI。
  function open() {
    // Opening is a local UI action only: it never sends text to the AI provider.
    ensurePanel();
    refreshLanguage();
    opened = true;
    compact = false;
    panel.className = 'pet-chat';
    panel.hidden = false;
    document.body.classList.add('pet-chat-open');
    pet.setAttribute('aria-expanded', 'true');
    positionAbovePet();
    input.focus();
  }

  // guanbi liaotian kuang：隐藏气泡和输入区，保留本次临时记录。
  function close() {
    // Hide the UI without cancelling a pending request or clearing its record.
    // Returning focus to Pet keeps keyboard navigation predictable.
    if (!panel) return;
    opened = false;
    panel.hidden = true;
    document.body.classList.remove('pet-chat-open');
    pet.setAttribute('aria-expanded', 'false');
    pet.focus();
  }

  // fasong bing shouqi shuru：提交问题后收起输入区，只留回复气泡。
  async function submit(event) {
    // Reject duplicate, blank and oversized questions before changing the UI.
    // The compact class hides the form through CSS while the answer is awaited.
    event.preventDefault();
    const question = input.value.trim();
    if (pending || !question || question.length > 2000) return;
    input.value = '';
    compact = true;
    panel.className = 'pet-chat is-compact';
    positionAbovePet();
    pet.setAttribute('aria-expanded', 'false');
    pet.focus();
    const answered = await sendQuestion(question);
    if (!answered) {
      if (!input.value) input.value = question;
      // Do not reopen a bubble the user explicitly closed while waiting.
      if (opened) open();
    }
  }

  async function sendQuestion(value, task = 'ask') {
    // Common request path for the Pet composer and AI-page shortcuts/history.
    // Return a boolean so callers can restore their own draft on failure.
    const question = String(value || '').trim();
    if (pending || !question || question.length > 2000) return false;
    ensurePanel();
    pending = true;
    feedback = '';
    syncStatus();
    appendMessage(question, 'user');
    const controller = new AbortController();
    // chaoshi quxiao
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      // Reuse server safety rules and the selected output language/style.
      // 复用服务端安全规则，以及用户选定的语言和表达风格。
      // qingqiu ziji de fuwuqi：前端请求本站接口，后端再调用 DeepSeek。
      const response = await fetch('/api/ask', {
        // This calls our backend, not DeepSeek directly. The API key stays on
        // the server; only the current question, task and preferences are sent.
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ task, input: question, ...window.aiPreferences }),
      });
      const payload = await response.json();
      // Treat failed HTTP responses and missing/blank text as retryable errors.
      // Never add malformed responses to the shared conversation transcript.
      if (!response.ok || typeof payload.text !== 'string' || !payload.text.trim()) throw new Error('No answer');
      appendMessage(payload.text.trim(), 'companion');
      return true;
    } catch {
      feedback = 'error';
      return false;
    } finally {
      // Release the timeout and pending lock on success, error or cancellation.
      clearTimeout(timeout);
      pending = false;
      syncStatus();
    }
  }

  // jiaru tixing：聊天打开时，把提醒或小贴士加入同一份记录。
  function notice(message, kind = 'companion') {
    // pet.js routes notices here only while chat is visible. Keeping them in
    // the same transcript avoids a second overlapping notification balloon.
    if (!opened || !message) return;
    appendMessage(message, kind);
    syncStatus();
  }

  pet.setAttribute('aria-controls', 'pet-chat');
  pet.setAttribute('aria-expanded', 'false');
  // dianji Pet：切换输入区；只有回复气泡时，点击可以重新输入。
  pet.addEventListener('click', () => opened && !compact ? close() : open());
  window.addEventListener('resize', positionAbovePet);
  pet.addEventListener('load', positionAbovePet, true);
  // Photo changes resize the avatar; remeasure without polling or extra timers.
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(positionAbovePet);
    observer.observe(pet);
  }
  // daochu gongneng：供 script.js 和 pet.js 调用同一个聊天模块。
  window.PetChat = { open, close, isOpen: () => opened, notice, refreshLanguage, mountHistory, sendQuestion };
})();
