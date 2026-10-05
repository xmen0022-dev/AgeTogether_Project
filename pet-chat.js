// Pet is the same companion everywhere: opening chat never changes the page.
// Pet 是同一个伙伴：打开聊天不会跳转，也不会自动请求 AI。
(() => {
  const pet = document.querySelector('#pet');
  if (!pet) return;
  const copy = {
    'en-AU': { title: 'Your companion', hello: "I'm here. What would you like to talk about?", input: 'Talk with your companion', send: 'Send', close: 'Close chat', thinking: 'Thinking…', error: 'I could not connect just now. Please try again.', privacy: 'Your message is sent to AI. Please leave out private details.', empty: 'I did not get an answer. Please try again.' },
    SC: { title: '你的伙伴', hello: '我在这里。你想聊些什么？', input: '和伙伴聊聊', send: '发送', close: '关闭聊天', thinking: '正在想一想…', error: '暂时无法连接，请重试。', privacy: '消息会发送给 AI，请不要填写私人信息。', empty: '暂时没有收到回答，请重试。' },
    TC: { title: '你的夥伴', hello: '我在這裡。你想聊些什麼？', input: '和夥伴聊聊', send: '傳送', close: '關閉聊天', thinking: '正在想一想…', error: '暫時無法連線，請重試。', privacy: '訊息會傳送給 AI，請不要填寫私人資訊。', empty: '暫時沒有收到回答，請重試。' },
  };
  let panel, title, closeButton, messages, status, form, input, send, privacy;
  let opened = false;
  let pending = false;
  let compact = false;
  let peek;
  // One session transcript for both surfaces; no persistent storage.
  // 两个入口共享本次对话，刷新后清空，不写入本地存储。
  const transcript = [];
  let historyMessages, historyStatus, historySend, historyTitle, historyInput, historyPrivacy;
  let feedback = '';
  const languageCopy = () => copy[window.aiPreferences?.language] || copy['en-AU'];

  function positionAbovePet() {
    if (!panel || !opened) return;
    // Measure the actual image, not an assumed fixed avatar height.
    // 根据实际图片边界定位，给气泡尾巴和 Pet 的轻微动作留出空间。
    const buttonRect = pet.getBoundingClientRect();
    const photoRect = pet.querySelector('.pet-photo')?.getBoundingClientRect();
    const top = Math.min(buttonRect.top, photoRect?.top ?? buttonRect.top);
    const right = Math.max(buttonRect.right, photoRect?.right ?? buttonRect.right);
    panel.style.bottom = `${Math.max(12, window.innerHeight - top + 36)}px`;
    panel.style.right = `${Math.max(12, window.innerWidth - right)}px`;
    panel.style.left = 'auto';
    panel.style.maxHeight = `${Math.max(60, top - 48)}px`;
  }

  function element(tag, id, className = '') {
    const node = document.createElement(tag);
    node.id = id;
    node.className = className;
    return node;
  }

  function appendMessage(text, kind) {
    transcript.push({ text, kind });
    renderMessage(messages, text, kind);
    if (historyMessages) renderMessage(historyMessages, text, kind);
  }

  function renderMessage(host, text, kind) {
    const row = element('p', '', `pet-chat-message is-${kind}`);
    // Model output is always plain text, never HTML. / AI 输出仅作为文本展示。
    row.textContent = text;
    host.append(row);
    host.scrollTop = host.scrollHeight;
  }

  function ensurePanel() {
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
    peek.setAttribute('aria-live', 'polite');
    peek.addEventListener('click', open);
    panel.append(header, messages, status, peek, form, privacy);
    document.body.append(panel);
    appendMessage(languageCopy().hello, 'companion');
  }

  function refreshLanguage() {
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

  function syncStatus() {
    const text = pending ? languageCopy().thinking : feedback ? languageCopy().error : '';
    status.textContent = text;
    send.disabled = pending;
    if (historyStatus) historyStatus.textContent = text;
    if (historySend) historySend.disabled = pending;
    const latest = transcript.findLast(entry => entry.kind !== 'user');
    const fullText = text || latest?.text || languageCopy().hello;
    // Compact bubble is a preview, not a replacement for the full record.
    // 小气泡只是预览，完整回复保留在对话记录里。
    const words = fullText.split(/\s+/);
    const shortText = words.length > 12 ? `${words.slice(0, 12).join(' ')}…` : fullText;
    peek.textContent = shortText.length > 80 ? `${shortText.slice(0, 80)}…` : shortText;
    peek.setAttribute('aria-label', `${languageCopy().input}: ${peek.textContent}`);
    positionAbovePet();
  }

  function mountHistory(host) {
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
      if (!answered && !composer.value) composer.value = question;
    });
    historyPrivacy = element('p', 'companion-history-privacy', 'pet-chat-privacy');
    host.append(historyTitle, historyMessages, historyStatus, historyForm, historyPrivacy);
    refreshLanguage();
  }

  function open() {
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

  function close() {
    if (!panel) return;
    opened = false;
    panel.hidden = true;
    document.body.classList.remove('pet-chat-open');
    pet.setAttribute('aria-expanded', 'false');
    pet.focus();
  }

  async function submit(event) {
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
    const question = String(value || '').trim();
    if (pending || !question || question.length > 2000) return false;
    ensurePanel();
    pending = true;
    feedback = '';
    syncStatus();
    appendMessage(question, 'user');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      // Reuse server safety rules and the selected output language/style.
      // 复用服务端安全规则，以及用户选定的语言和表达风格。
      const response = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ task, input: question, ...window.aiPreferences }),
      });
      const payload = await response.json();
      if (!response.ok || typeof payload.text !== 'string' || !payload.text.trim()) throw new Error('No answer');
      appendMessage(payload.text.trim(), 'companion');
      return true;
    } catch {
      feedback = 'error';
      return false;
    } finally {
      clearTimeout(timeout);
      pending = false;
      syncStatus();
    }
  }

  function notice(message, kind = 'companion') {
    if (!opened || !message) return;
    appendMessage(message, kind);
    syncStatus();
  }

  pet.setAttribute('aria-controls', 'pet-chat');
  pet.setAttribute('aria-expanded', 'false');
  pet.addEventListener('click', () => opened && !compact ? close() : open());
  window.addEventListener('resize', positionAbovePet);
  pet.addEventListener('load', positionAbovePet, true);
  // Photo changes resize the avatar; remeasure without polling or extra timers.
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(positionAbovePet);
    observer.observe(pet);
  }
  window.PetChat = { open, close, isOpen: () => opened, notice, refreshLanguage, mountHistory, sendQuestion };
})();
