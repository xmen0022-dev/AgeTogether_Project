import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../pet.js", import.meta.url), "utf8");
const sandbox = { console, setTimeout: () => 0, clearTimeout: () => {} };
vm.runInNewContext(
  `${source}\nglobalThis.testExports = { mountSetup, createLatestTaskGuard, createPetTimerManager, isReminderDue, limitPetWords, nextHealthTip, normalizeReminderSettings };`,
  sandbox,
);
const { createLatestTaskGuard, createPetTimerManager, isReminderDue, limitPetWords, nextHealthTip, normalizeReminderSettings } = sandbox.testExports;

test('photo setup renders an image picker and binds the cutout upload handler', () => {
  const events = [];
  const host = {
    innerHTML: '',
    querySelector: (selector) => ({ addEventListener: (name, callback) => events.push({ selector, name, callback }) }),
  };
  sandbox.document = { querySelector: () => host };
  try {
    sandbox.testExports.mountSetup();
    assert.match(host.innerHTML, /Choose a photo/);
    assert.match(host.innerHTML, /type="file" id="pet-file" accept="image\/\*"/);
    assert.ok(events.some((entry) => entry.selector === '#pet-file' && entry.name === 'change' && typeof entry.callback === 'function'));
  } finally { delete sandbox.document; }
});

test("limits Pet speech to the requested word count", () => {
  assert.equal(limitPetWords("Please drink some water and rest today", 5), "Please drink some water and");
});

test('open chat receives reminders instead of a second overlapping speech bubble', () => {
  const notices = [];
  sandbox.window = { PetChat: { isOpen: () => true, notice: (...args) => notices.push(args) } };
  try {
    vm.runInNewContext("speak('Time for water', { kind: 'reminder' })", sandbox);
    assert.deepEqual(notices, [['Time for water', 'reminder']]);
  } finally { delete sandbox.window; }
});

test("returns a localised tip only on every tenth click", () => {
  assert.equal(nextHealthTip(9, 0, "en-AU"), null);
  const tip = nextHealthTip(10, 0, "SC");
  assert.equal(tip.category, "mental");
  assert.match(tip.text, /休息|心情|朋友/);
});

test("alternates mental and physical health tips", () => {
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

test("normalizes short speech edge cases", () => {
  assert.equal(limitPetWords("", 10), "");
  assert.equal(limitPetWords("Hello, friend!", 10), "Hello, friend!");
});

test("only lets the newest photo task update the companion", () => {
  const photoTasks = createLatestTaskGuard();
  const firstPhoto = photoTasks.begin();
  const secondPhoto = photoTasks.begin();

  assert.equal(firstPhoto.isCurrent(), false);
  assert.equal(secondPhoto.isCurrent(), true);
});

test("stops outstanding Pet timers when its lifecycle ends", () => {
  let nextId = 1;
  const timeouts = new Set();
  const intervals = new Set();
  const timers = createPetTimerManager({
    setTimeout: () => {
      const id = nextId++;
      timeouts.add(id);
      return id;
    },
    clearTimeout: (id) => timeouts.delete(id),
    setInterval: () => {
      const id = nextId++;
      intervals.add(id);
      return id;
    },
    clearInterval: (id) => intervals.delete(id),
  });

  timers.after(() => {}, 1000);
  timers.every(() => {}, 60000);
  timers.stop();

  assert.equal(timeouts.size, 0);
  assert.equal(intervals.size, 0);
});
