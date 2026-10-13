import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, getDeepSeekApiKey, normalizePreferences, runTask } from "../server.js";

test("normalizes missing preferences to Australian English and simple style", () => {
  assert.deepEqual(normalizePreferences(), { language: "en-AU", style: "simple" });
});

test("falls back when language or style is unsupported", () => {
  assert.deepEqual(normalizePreferences("fr-FR", "academic"), { language: "en-AU", style: "simple" });
});

test("builds a prompt with language and simple-reading instructions", () => {
  const prompt = buildSystemPrompt("ask", "SC", "simple");
  assert.match(prompt, /简体中文/);
  assert.match(prompt, /short sentences|短句/i);
  assert.match(prompt, /Answer the user's question|回答用户的问题/);
});

test("builds expressive Traditional Chinese instructions without removing safety rules", () => {
  const prompt = buildSystemPrompt("scam-check", "TC", "expressive");
  assert.match(prompt, /繁體中文/);
  assert.match(prompt, /gentle imagery|溫和的比喻/i);
  assert.match(prompt, /Never give medical|不得提供醫療/i);
});

test("sends a DeepSeek chat-completions request and parses the answer", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ choices: [{ message: { content: "A short answer." } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await runTask("ask", "What can I do today?", { language: "en-AU", style: "simple" });
    const body = JSON.parse(request.options.body);
    assert.equal(request.url, "https://api.deepseek.com/chat/completions");
    assert.equal(body.model, "deepseek-v4-flash");
    assert.equal(body.max_tokens, 800);
    assert.equal(body.thinking.type, "disabled");
    assert.equal(body.messages[1].content, "What can I do today?");
    assert.equal(result.text, "A short answer.");
    assert.equal(result.refused, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("accepts the Render environment variable name used by the deployed service", () => {
  assert.equal(getDeepSeekApiKey({ deepseekAgeV1: "render-key" }), "render-key");
  assert.equal(getDeepSeekApiKey({ DEEPSEEK_API_KEY: "standard-key", deepseekAgeV1: "render-key" }), "standard-key");
});

test('letter rewrite tasks preserve facts and boundaries while giving distinct tone instructions', () => {
  for (const tone of ['gentle', 'simple', 'formal']) {
    const prompt = buildSystemPrompt(`rewrite-${tone}`, 'SC', 'standard');
    assert.match(prompt, /Preserve its meaning, facts/);
    assert.match(prompt, /Never add promises/);
    assert.match(prompt, /简体中文/);
  }
  assert.match(buildSystemPrompt('rewrite-gentle'), /without weakening/);
  assert.match(buildSystemPrompt('rewrite-simple'), /plain everyday words/);
  assert.match(buildSystemPrompt('rewrite-formal'), /natural formal language/);
});

test('activity follow-up distinguishes discovery places from confirmed events', () => {
  const prompt = buildSystemPrompt('activity-explain');
  assert.match(prompt, /rather than a confirmed event/);
  assert.match(prompt, /demonstration origin/);
  assert.match(prompt, /Never invent/);
});

test('a token-truncated rewrite is not presented as a complete letter', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Partial rewrite' }, finish_reason: 'length' }] }), { status: 200 });
  try {
    assert.equal((await runTask('rewrite-gentle', 'Original letter')).refused, true);
  } finally { globalThis.fetch = originalFetch; }
});

test('unsupported voice requests return localised text without contacting the AI provider', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Yes, send your recording.' } }] }));
  };
  try {
    const samples = [
      ['我可以用语音发送给你吗', 'SC', /不能.*语音/, /键盘/],
      ['可以發語音給你嗎？', 'TC', /不能.*語音/, /鍵盤/],
      ['Can I send you a voice message?', 'en-AU', /cannot.*voice/i, /keyboard/i],
      ['Can you transcribe my recording?', 'en-AU', /cannot.*recordings/i, /keyboard/i],
      ['你支持语音吗？', 'SC', /不能.*语音/, /键盘/],
      ['能不能发语音？', 'SC', /不能.*语音/, /键盘/],
    ];
    for (const [question, language, limitation, alternative] of samples) {
      const result = await runTask('ask', question, { language });
      assert.match(result.text, limitation);
      assert.match(result.text, alternative);
      assert.equal(result.refused, false);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = previous; }
});

test('chat cannot claim to inspect uploaded images or make a voice call', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('Unexpected provider request'); };
  try {
    assert.match((await runTask('ask', 'Can you read a screenshot I send here?')).text, /cannot.*(image|screenshot)/i);
    assert.match((await runTask('ask', 'Can you call my daughter for me?')).text, /cannot.*call/i);
    assert.match((await runTask('ask', 'Can you send this email for me?')).text, /Letter.*Send by email/);
    assert.match((await runTask('ask', 'Can you book this activity for me?')).text, /cannot.*book/i);
  } finally { globalThis.fetch = previous; }
  assert.equal(calls, 0);
});

test('closed-page reminder questions state the actual browser-only limitation', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Unexpected provider request'); };
  try {
    const result = await runTask('ask', 'Will you remind me after I close the app?', { language: 'SC' });
    assert.match(result.text, /网页.*打开/);
    assert.match(result.text, /闹钟/);
  } finally { globalThis.fetch = previous; }
});

test('ordinary phone help and letter content mentioning voice are not blocked', async () => {
  const previous = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Normal task result.' } }] }));
  };
  try {
    for (const question of ['How do I use voice typing on my phone?', 'Can you explain how to send a voice message to my family?', 'Can I upload a photo for my pet?', 'Can you help me write an email?', 'Can you recommend a book?', 'Can you help me use my phone?']) {
      assert.equal((await runTask('ask', question)).text, 'Normal task result.');
    }
    assert.equal((await runTask('rewrite-gentle', 'Can I send you a voice message?')).text, 'Normal task result.');
    assert.equal(requests.length, 7);
    // Check the actual outbound system instructions, not just a helper constant.
    for (const body of requests) {
      const system = body.messages[0].content;
      assert.match(system, /text-only/i);
      assert.match(system, /page is open/i);
      assert.match(system, /Never claim.*completed/i);
    }
  } finally { globalThis.fetch = previous; }
});
