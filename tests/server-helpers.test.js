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
  const prompt = buildSystemPrompt("ask", "zh-CN", "simple");
  assert.match(prompt, /简体中文/);
  assert.match(prompt, /short sentences|短句/i);
  assert.match(prompt, /Answer the user's question|回答用户的问题/);
});

test("builds expressive Traditional Chinese instructions without removing safety rules", () => {
  const prompt = buildSystemPrompt("scam-check", "zh-TW", "expressive");
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
