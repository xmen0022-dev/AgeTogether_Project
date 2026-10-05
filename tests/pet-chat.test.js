import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Real chat controller, with only browser elements and the external API replaced.
function fixture() {
  const nodes = new Map();
  const makeNode = () => ({
    children: [], hidden: true, value: '', textContent: '', disabled: false,
    style: {}, listeners: {}, attributes: {},
    append(...children) { this.children.push(...children); },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(key, handler) { this.listeners[key] = handler; },
    focus() { this.focused = true; },
  });
  const pet = makeNode();
  pet.getBoundingClientRect = () => ({ top: 700, right: 370, left: 300 });
  pet.querySelector = () => null;
  nodes.set('#pet', pet);
  const body = makeNode();
  body.classList = { add() {}, remove() {} };
  const context = {
    window: { innerWidth: 390, innerHeight: 844, listeners: {}, addEventListener(name, callback) { this.listeners[name] = callback; }, aiPreferences: { language: 'SC', style: 'simple' } },
    document: {
      body,
      createElement() { const node = makeNode(); Object.defineProperty(node, 'id', { set(id) { nodes.set(`#${id}`, node); } }); return node; },
      querySelector: (selector) => nodes.get(selector) || null,
    },
    fetch: async () => ({ ok: true, json: async () => ({ text: '<b>你好</b>' }) }),
    AbortController, setTimeout, clearTimeout,
  };
  vm.runInNewContext(readFileSync(new URL('../pet-chat.js', import.meta.url), 'utf8'), context);
  return { context, nodes, pet, makeNode, chat: context.window.PetChat };
}

test('clicking Pet opens localised chat without navigating or calling the API', () => {
  const f = fixture();
  let calls = 0;
  f.context.fetch = () => { calls++; };
  f.pet.listeners.click();
  assert.equal(f.chat.isOpen(), true);
  assert.equal(f.nodes.get('#pet-chat').hidden, false);
  assert.equal(f.nodes.get('#pet-chat-input').attributes['aria-label'], '和伙伴聊聊');
  assert.equal(calls, 0);
  f.nodes.get('#pet-chat-close').listeners.click();
  assert.equal(f.chat.isOpen(), false);
  assert.equal(f.pet.focused, true);
});

test('sending uses selected preferences and renders full output as text, not HTML', async () => {
  const f = fixture();
  const requests = [];
  f.context.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ text: '<b>你好</b>' }) };
  };
  f.chat.open();
  f.nodes.get('#pet-chat-input').value = '  你好  ';
  await f.nodes.get('#pet-chat-form').listeners.submit({ preventDefault() {} });
  assert.equal(requests[0].url, '/api/ask');
  assert.equal(requests[0].body.input, '你好');
  assert.equal(requests[0].body.language, 'SC');
  assert.equal(requests[0].body.style, 'simple');
  assert.equal(f.nodes.get('#pet-chat-messages').children.at(-1).textContent, '<b>你好</b>');
});

test('pending chat prevents duplicate requests and keeps its answer after closing and reopening', async () => {
  const f = fixture();
  let finish;
  let calls = 0;
  f.context.fetch = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  f.chat.open();
  const input = f.nodes.get('#pet-chat-input');
  input.value = 'Hello';
  const submit = () => f.nodes.get('#pet-chat-form').listeners.submit({ preventDefault() {} });
  const pending = submit();
  input.value = 'Next question';
  await submit();
  assert.equal(calls, 1);
  f.chat.close();
  finish({ ok: true, json: async () => ({ text: 'Hello, friend!' }) });
  await pending;
  f.chat.open();
  assert.equal(f.nodes.get('#pet-chat-messages').children.at(-1).textContent, 'Hello, friend!');
  assert.equal(input.value, 'Next question');
});

test('failed requests retain the question for retry and empty submissions do not send', async () => {
  const f = fixture();
  let calls = 0;
  f.context.fetch = async () => { calls++; throw new Error('Network down'); };
  f.chat.open();
  const input = f.nodes.get('#pet-chat-input');
  const submit = () => f.nodes.get('#pet-chat-form').listeners.submit({ preventDefault() {} });
  await submit();
  assert.equal(calls, 0);
  input.value = 'Hello';
  await submit();
  assert.equal(input.value, 'Hello');
  assert.equal(f.nodes.get('#pet-chat-send').disabled, false);
  assert.match(f.nodes.get('#pet-chat-status').textContent, /重试/);
});

test('a reminder appears within open chat without replacing the AI answer', () => {
  const f = fixture();
  f.chat.open();
  f.chat.notice('Time for water', 'reminder');
  assert.equal(f.nodes.get('#pet-chat-messages').children.at(-1).textContent, 'Time for water');
});

test('AI page history shares Pet messages and survives remounting without duplicates', async () => {
  const f = fixture();
  f.chat.open();
  f.nodes.get('#pet-chat-input').value = 'Hello from Pet';
  await f.nodes.get('#pet-chat-form').listeners.submit({ preventDefault() {} });
  const firstHost = f.makeNode();
  f.chat.mountHistory(firstHost);
  assert.equal(f.nodes.get('#companion-history-messages').children.at(-2).textContent, 'Hello from Pet');
  await f.chat.sendQuestion('Hello from the AI page');
  assert.equal(f.nodes.get('#pet-chat-messages').children.at(-2).textContent, 'Hello from the AI page');
  f.chat.mountHistory(f.makeNode());
  assert.equal(f.nodes.get('#companion-history-messages').children.length, 5);
});

test('both entry points share the pending request lock', async () => {
  const f = fixture();
  f.chat.mountHistory(f.makeNode());
  let finish;
  let calls = 0;
  f.context.fetch = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const request = f.chat.sendQuestion('First');
  await f.chat.sendQuestion('Second');
  assert.equal(calls, 1);
  assert.equal(f.nodes.get('#companion-history-send').disabled, true);
  finish({ ok: true, json: async () => ({ text: 'Answer' }) });
  await request;
  assert.equal(f.nodes.get('#companion-history-send').disabled, false);
});

test('changing language updates both composers without discarding the draft', () => {
  const f = fixture();
  f.chat.mountHistory(f.makeNode());
  const input = f.nodes.get('#companion-history-input');
  input.value = 'My unfinished question';
  f.context.window.aiPreferences.language = 'TC';
  f.chat.refreshLanguage();
  assert.equal(f.nodes.get('#companion-history-title').textContent, '我們的對話');
  assert.equal(input.attributes['aria-label'], '和夥伴聊聊');
  assert.equal(input.value, 'My unfinished question');
});

test('sending folds Pet into a small bubble and clicking it reopens the composer', async () => {
  const f = fixture();
  f.chat.open();
  let finish;
  f.context.fetch = () => new Promise(resolve => { finish = resolve; });
  f.nodes.get('#pet-chat-input').value = 'Hello';
  const pending = f.nodes.get('#pet-chat-form').listeners.submit({ preventDefault() {} });
  assert.match(f.nodes.get('#pet-chat').className, /is-compact/);
  assert.match(f.nodes.get('#pet-chat-peek').textContent, /想/);
  finish({ ok: true, json: async () => ({ text: 'A very long answer '.repeat(30) }) });
  await pending;
  assert.ok(f.nodes.get('#pet-chat-peek').textContent.length < 180);
  assert.equal(f.nodes.get('#pet-chat-messages').children.at(-1).textContent, 'A very long answer '.repeat(30).trim());
  f.nodes.get('#pet-chat-peek').listeners.click();
  assert.doesNotMatch(f.nodes.get('#pet-chat').className, /is-compact/);
  assert.equal(f.nodes.get('#pet-chat-input').focused, true);
});

test('failed sending restores the expanded composer with the original question', async () => {
  const f = fixture();
  f.chat.open();
  f.context.fetch = async () => { throw new Error('offline'); };
  f.nodes.get('#pet-chat-input').value = 'My question';
  await f.nodes.get('#pet-chat-form').listeners.submit({ preventDefault() {} });
  assert.doesNotMatch(f.nodes.get('#pet-chat').className, /is-compact/);
  assert.equal(f.nodes.get('#pet-chat-input').value, 'My question');
});

test('Pet composer uses one input row and an accessible icon-only close control', () => {
  const f = fixture();
  f.chat.open();
  assert.equal(f.nodes.get('#pet-chat-input').rows, 1);
  assert.equal(f.nodes.get('#pet-chat-close').textContent, '×');
  assert.equal(f.nodes.get('#pet-chat-close').attributes['aria-label'], '关闭聊天');
});

test('bubble sits above the visible photo and follows viewport resizing', () => {
  const f = fixture();
  let photoTop = 620;
  f.pet.querySelector = () => ({ getBoundingClientRect: () => ({ top: photoTop, right: 370, left: 240 }) });
  f.chat.open();
  const panel = f.nodes.get('#pet-chat');
  assert.ok(parseFloat(panel.style.bottom) >= 844 - 620 + 26);
  photoTop = 560;
  f.context.window.listeners.resize();
  assert.ok(parseFloat(panel.style.bottom) >= 844 - 560 + 26);
});
