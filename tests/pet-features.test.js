import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../pet.js", import.meta.url), "utf8");
const sandbox = { console, setTimeout: () => 0, clearTimeout: () => {} };
vm.runInNewContext(
  `${source}\nglobalThis.testExports = { isReminderDue, limitPetWords, nextHealthTip, normalizeReminderSettings };`,
  sandbox,
);
const { isReminderDue, limitPetWords, nextHealthTip, normalizeReminderSettings } = sandbox.testExports;

test("limits Pet speech to the requested word count", () => {
  assert.equal(limitPetWords("Please drink some water and rest today", 5), "Please drink some water and");
});

test("returns a localised tip only on every tenth click", () => {
  assert.equal(nextHealthTip(9, 0, "en-AU"), null);
  const tip = nextHealthTip(10, 0, "zh-CN");
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
