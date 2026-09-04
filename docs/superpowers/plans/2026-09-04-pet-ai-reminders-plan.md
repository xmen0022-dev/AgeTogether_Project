# Pet AI Replies and Gentle Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add concise multilingual Pet speech, ten-click wellbeing tips, and local daily reminders without changing the existing server or database contract.

**Architecture:** Keep state and scheduling in `pet.js`, keep AI-page controls and the existing `/api/ask` flow in `script.js`, and keep all presentation in `styles.css`. Expose only a small `window.AgeTogetherPet` bridge so the AI page does not depend on Pet internals. Pure helper seams are exported for Node tests.

**Tech Stack:** Existing browser JavaScript, localStorage, DOM events, CSS animations, Node built-in `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-04-pet-ai-reminders-design.md`

## Global Constraints

- Keep the feature client-side; do not add database tables, accounts, or provider calls for tips/reminders.
- Use `en-AU`, `zh-CN`, and `zh-TW`; invalid values fall back to `en-AU`.
- Pet speech is at most ten whitespace-separated words and is inserted as text.
- Medication copy must not change a user's prescribed dose or treatment plan.
- Reminders operate in browser local time and only while the page is open.

### Task 1: Add pure Pet feature helpers and regression tests

**Files:**
- Create: `tests/pet-features.test.js`
- Modify: `pet.js` exports at the end of the file

**Interfaces:**
- Produces `limitPetWords(text, maxWords)`, `nextHealthTip(clickCount, tipIndex, language)`, `isReminderDue(reminder, now, deliveredDate)`, and `normalizeReminderSettings(value)`.

- [ ] **Step 1: Write the failing tests**

```js
test("limits Pet speech to the requested word count", () => {
  assert.equal(limitPetWords("Please drink some water and rest today", 5), "Please drink some water and rest");
});

test("returns a localised tip only on every tenth click", () => {
  assert.equal(nextHealthTip(9, 0, "en-AU"), null);
  const tip = nextHealthTip(10, 0, "zh-CN");
  assert.equal(tip.category, "mental");
  assert.match(tip.text, /休息|心情|朋友/);
});

test("does not repeat the same health category forever", () => {
  assert.equal(nextHealthTip(20, 1, "en-AU").category, "physical");
});

test("detects an enabled reminder at its local time", () => {
  const now = new Date(2026, 8, 4, 10, 0);
  assert.equal(isReminderDue({ enabled: true, time: "10:00" }, now, null), true);
  assert.equal(isReminderDue({ enabled: true, time: "10:00" }, now, "2026-09-04"), false);
});

test("normalizes malformed reminder settings to safe defaults", () => {
  const settings = normalizeReminderSettings({ water: { enabled: true, time: "bad" } });
  assert.equal(settings.water.time, "10:00");
  assert.equal(settings.water.enabled, true);
  assert.equal(settings.medication.time, "12:00");
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --test tests/pet-features.test.js`

Expected: FAIL because the helper exports and implementations do not exist yet.

- [ ] **Step 3: Implement the smallest pure helpers**

Add localised tip data, reminder defaults, validation, and the four functions
near the existing Pet state helpers. Guard the browser-only boot code so the
helpers can be imported by Node tests without a DOM.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test tests/pet-features.test.js`

Expected: PASS with all focused tests passing.

- [ ] **Step 5: Commit the vertical slice**

```powershell
git add tests/pet-features.test.js pet.js
git commit -m "feat: add pet reminder helper seams"
```

### Task 2: Add the Pet speech bubble and ten-click tips

**Files:**
- Modify: `pet.js` click lifecycle and public bridge
- Modify: `styles.css` Pet speech styles

**Interfaces:**
- Consumes the pure helpers from Task 1.
- Produces `window.AgeTogetherPet.speak(message, options)` and a persistent `#pet-speech` status element.

- [ ] **Step 1: Add a failing DOM-independent bridge contract test**

Extend `tests/pet-features.test.js` with the public-state expectations for
the click threshold and the `options.kind` values (`ai`, `tip`, `reminder`).

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/pet-features.test.js`

Expected: FAIL for the missing Pet bridge contract.

- [ ] **Step 3: Implement the Pet bubble and click counter**

Create the bubble as a sibling of `#pet`, update it with `textContent`, persist
click/tip state in the existing Pet record, and call the bridge on each tenth
click. Use the current language preference when selecting built-in tip copy.

- [ ] **Step 4: Add responsive and accessible styling**

Style the bubble above the fixed Pet, add distinct tip/reminder/AI classes,
allow long text to wrap, and keep it usable on narrow screens.

- [ ] **Step 5: Run focused tests and syntax checks**

Run: `node --test tests/pet-features.test.js; node --check pet.js`

Expected: PASS and exit code 0.

- [ ] **Step 6: Commit the vertical slice**

```powershell
git add pet.js styles.css tests/pet-features.test.js
git commit -m "feat: show pet speech and health tips"
```

### Task 3: Add configurable daily reminder settings and scheduler

**Files:**
- Modify: `pet.js` reminder storage and scheduler
- Modify: `script.js` AI page settings markup and render lifecycle
- Modify: `styles.css` reminder settings layout

**Interfaces:**
- Consumes `normalizeReminderSettings` and `isReminderDue` from Task 1.
- Produces `window.AgeTogetherPet.setReminderSettings(value)` and a minute-level scheduler.

- [ ] **Step 1: Add failing tests for reminder normalization and delivery markers**

Cover disabled reminders, invalid time values, and a reminder already shown
on the current local date. Keep assertions at helper seams rather than timer
internals.

- [ ] **Step 2: Run tests to verify the new cases fail**

Run: `node --test tests/pet-features.test.js`

Expected: FAIL for the newly specified behavior.

- [ ] **Step 3: Implement settings persistence and due checking**

Store one settings object and one delivery-date map in localStorage. Check
once immediately and then once per minute. Clear the interval before starting
a new one so route re-renders cannot create duplicate reminders.

- [ ] **Step 4: Render labelled time controls in the AI page**

Add enable checkboxes and native `input type="time"` controls for water,
medication, and movement. On change, normalize and persist settings, then
restart the scheduler. Keep the existing language/style controls unchanged.

- [ ] **Step 5: Run focused tests and syntax checks**

Run: `node --test tests/pet-features.test.js; node --check pet.js; node --check script.js`

Expected: PASS and exit code 0.

- [ ] **Step 6: Commit the vertical slice**

```powershell
git add pet.js script.js styles.css tests/pet-features.test.js
git commit -m "feat: add configurable pet reminders"
```

### Task 4: Connect concise AI replies to the Pet

**Files:**
- Modify: `script.js` `askCompanion` and preference handling
- Modify: `server.js` task prompt configuration only if the existing task seam needs a dedicated Pet mode
- Modify: `tests/server-helpers.test.js` only if a server prompt regression is required

**Interfaces:**
- Consumes the existing `/api/ask` response and `window.AgeTogetherPet.speak`.
- Produces a short, language-matched Pet bubble while retaining the full `#ai-answer` response.

- [ ] **Step 1: Add a failing client helper test for whitespace word limiting**

If the browser file remains non-module, keep this behavior covered through the
exported `limitPetWords` seam from Task 1 and add cases for empty output and
punctuation.

- [ ] **Step 2: Run the focused test to verify the boundary**

Run: `node --test tests/pet-features.test.js`

Expected: FAIL until the edge-case behavior is implemented.

- [ ] **Step 3: Connect the existing successful response to Pet speech**

Keep `#ai-answer` as the full accessible response. Pass only
`limitPetWords(answer, 10)` to `window.AgeTogetherPet.speak(answer, { kind: "ai" })`.
If the bridge is absent, do nothing and preserve the existing AI flow.

- [ ] **Step 4: Preserve language and safety rules**

Ensure the selected language is included in the existing request and that the
Pet bubble never displays an error, empty result, or raw HTML.

- [ ] **Step 5: Run the complete verification suite**

Run: `node --test; node --check server.js; node --check script.js; node --check pet.js; git diff --check`

Expected: all tests pass, syntax checks exit 0, and no whitespace errors are
introduced by these files.

- [ ] **Step 6: Review the complete diff and commit**

```powershell
git diff --stat HEAD~3..HEAD
git diff -- pet.js script.js styles.css tests/pet-features.test.js
git add pet.js script.js styles.css tests/pet-features.test.js server.js tests/server-helpers.test.js
git commit -m "feat: connect AI replies to pet companion"
```

### Task 5: Final verification and handoff

**Files:**
- No new files; inspect the working tree and relevant commits.

- [ ] **Step 1: Run the complete test and syntax suite again**

Run: `node --test; node --check server.js; node --check script.js; node --check pet.js; git status --short`

Expected: all tests pass, all syntax checks exit 0, and only intentional
feature changes are present.

- [ ] **Step 2: Inspect the final diff for scope and safety**

Confirm no API key, `.env` file, or unrelated database/data changes are in the
feature diff. Confirm medication wording remains reminder-only.

- [ ] **Step 3: Report the exact verification evidence**

Summarize changed files, the default reminder times, language behavior, and
the observed test count. Do not claim deployment unless a fresh remote check
has also been performed.
