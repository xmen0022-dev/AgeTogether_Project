# Adaptive AI Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing AI Companion UI to DeepSeek and produce safe, user-selected Australian English, Simplified Chinese, or Traditional Chinese answers with adjustable reading style.

**Architecture:** Preserve `/api/ask`, `TASKS`, and server-side prompts. Add provider configuration and preference prompt composition in `server.js`; add UI preference controls and fetch-based answer rendering in `script.js` without exposing API keys.

**Tech Stack:** Native Node.js HTTP server, native `fetch`, DeepSeek OpenAI-compatible Chat Completions API, browser JavaScript, HTML templates, CSS.

**Spec:** `docs/superpowers/specs/2026-09-04-adaptive-ai-companion-design.md`

## Global Constraints

- Use `deepseek-v4-flash` by default.
- Read the key from `DEEPSEEK_API_KEY`; never put it in browser code.
- Keep defaults `en-AU` and `simple`.
- Preserve medical, legal, financial, privacy, and scam safety rules.
- Keep the site runnable without an API key.
- Render provider output with `textContent`, never `innerHTML`.

### Task 1: Add testable server prompt and preference helpers

**Files:**
- Modify: `server.js`
- Test: `tests/server-helpers.test.js`

**Interfaces:**
- `normalizePreferences(language, style)` returns `{ language, style }` using the allowed values and defaults.
- `buildSystemPrompt(task, language, style)` returns the shared system prompt plus the task prompt and bounded output instructions.

- [ ] **Step 1: Write failing tests** for defaults, invalid-value fallback, language instructions, and simple versus expressive style instructions.
- [ ] **Step 2: Run `node --test tests/server-helpers.test.js` and confirm the helpers are not exported yet.**
- [ ] **Step 3: Implement the smallest pure helpers in `server.js` and export them only when the module is imported by tests.**
- [ ] **Step 4: Run the focused test and confirm it passes.**
- [ ] **Step 5: Commit the helper and test changes.**

### Task 2: Replace the provider call with DeepSeek

**Files:**
- Modify: `server.js`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- `runTask(taskName, input, preferences)` sends a chat-completions request to the configured DeepSeek endpoint and returns `{ refused, text, suggestions }`.

- [ ] **Step 1: Add failing request-shape tests for model, max tokens, system message, user message, and refusal-safe response parsing.**
- [ ] **Step 2: Run the focused tests and confirm the DeepSeek request behavior is absent.**
- [ ] **Step 3: Implement provider configuration using `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL`, defaulting to `https://api.deepseek.com` and `deepseek-v4-flash`.**
- [ ] **Step 4: Preserve task-specific max output limits and parse `choices[0].message.content`; keep `reply-suggestions` line parsing.**
- [ ] **Step 5: Run focused tests and syntax checks.**
- [ ] **Step 6: Update setup documentation and commit.**

### Task 3: Extend `/api/ask` validation and frontend interaction

**Files:**
- Modify: `server.js`
- Modify: `script.js`
- Modify: `styles.css`
- Test: `tests/api-ask.test.js`

**Interfaces:**
- Request body accepts optional `language` and `style` in addition to `task` and `input`.
- AI page controls use `data-quick-question`, `data-ai-action`, and a single answer region with `role="status"`.

- [ ] **Step 1: Add failing API validation tests for accepted preferences and rejected malformed requests.**
- [ ] **Step 2: Run the focused tests and confirm preference handling is absent.**
- [ ] **Step 3: Add preference controls and answer region to `renderAI()`.**
- [ ] **Step 4: Add one frontend request helper and event-delegated handlers for quick questions, Ask AI, Daily Suggestion, and Safety Tip.**
- [ ] **Step 5: Render answer and errors using `textContent`; add loading and readable answer styles.**
- [ ] **Step 6: Run all tests, syntax checks, and a local no-key smoke test.**
- [ ] **Step 7: Commit the completed integration.**
