import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function appFixture(records = new Map()) {
  const app = { innerHTML: '' };
  const tools = { innerHTML: '' };
  const handlers = {};
  const calls = [];
  const context = {
    console: { warn() {}, log() {} }, setTimeout, clearTimeout,
    window: { scrollTo() {}, confirm: () => true },
    document: {
      querySelector: (selector) => selector === '#app' ? app : selector === '#pet' ? { classList: { toggle() {} } } : selector === '#letter-writing-tools' ? tools : null,
      querySelectorAll: () => [],
      body: { classList: { add() {}, remove() {} } },
      addEventListener: (name, callback) => { handlers[name] = callback; },
    },
    localStorage: { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) },
    fetch: async (url, options) => {
      if (url.includes('nearby-places') || url === '/api/news') throw new Error('Use sample data');
      calls.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ text: 'Could we please talk tomorrow?' }) };
    },
  };
  vm.createContext(context);
  for (const file of ['data.js', 'activity-check.js', 'script.js']) vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  const run = (code) => vm.runInContext(code, context);
  const click = (selector, dataset = {}) => handlers.click({ target: { closest: (query) => query === selector ? { dataset } : null } });
  return { app, tools, run, click, context, calls, records };
}

test('initial page renders and Social save persists across reload with analysis on every selection', async () => {
  const fixture = appFixture();
  assert.match(fixture.app.innerHTML, /AgeTogether/);
  await new Promise(setImmediate);
  fixture.run("setRoute('social')");
  const id = fixture.run('String(state.activities[0].id)');
  fixture.click('[data-save-activity]', { saveActivity: id });
  assert.match(fixture.app.innerHTML, /Your activity check:/);
  const reload = appFixture(fixture.records);
  await new Promise(setImmediate);
  reload.run("setRoute('social'); socialTab = 'saved'; renderSocial()");
  assert.match(reload.app.innerHTML, /Your activity check:/);
  assert.equal(reload.run('state.activities[0].saved'), true);
  reload.click('[data-join-activity]', { joinActivity: id });
  reload.click('[data-save-activity]', { saveActivity: id });
  assert.match(reload.app.innerHTML, /Your activity check:/);
  reload.click('[data-join-activity]', { joinActivity: id });
  assert.doesNotMatch(reload.app.innerHTML, /Your activity check:/);
});

test('rewriting requires consent, excludes email, and preserves original until accepted', async () => {
  const fixture = appFixture();
  fixture.run("setRoute('letter'); letterDraft.body = 'Can we talk tomorrow?'; letterDraft.recipientEmail = 'recipient@example.test'");
  fixture.context.window.confirm = () => false;
  await fixture.run("rewriteLetter('gentle')");
  assert.equal(fixture.calls.length, 0);
  fixture.context.window.confirm = () => true;
  await fixture.run("rewriteLetter('gentle')");
  assert.equal(fixture.calls[0].input, 'Can we talk tomorrow?');
  assert.doesNotMatch(JSON.stringify(fixture.calls[0]), /recipient@example/);
  assert.equal(fixture.run('letterDraft.body'), 'Can we talk tomorrow?');
  fixture.click('[data-use-rewrite]');
  assert.equal(fixture.run('letterDraft.body'), 'Could we please talk tomorrow?');
});

test('a slow rewrite cannot overwrite a draft edited while waiting', async () => {
  const fixture = appFixture();
  fixture.run("setRoute('letter'); letterDraft.body = 'Original'");
  let finish;
  fixture.context.fetch = () => new Promise((resolve) => { finish = resolve; });
  const pending = fixture.run("rewriteLetter('simple')");
  fixture.run("letterDraft.body = 'New draft'");
  finish({ ok: true, json: async () => ({ text: 'Old rewrite' }) });
  await pending;
  fixture.click('[data-use-rewrite]');
  assert.equal(fixture.run('letterDraft.body'), 'New draft');
});

test('changing distance preferences recomputes the selected activity check', async () => {
  const fixture = appFixture();
  await new Promise(setImmediate);
  fixture.run("setRoute('social'); activityPreferences = { needs: [], maxDistance: 5, interests: [] }; state.activities[0].distanceKm = 4");
  const id = fixture.run('String(state.activities[0].id)');
  fixture.click('[data-save-activity]', { saveActivity: id });
  assert.match(fixture.app.innerHTML, /Your activity check: Good match/);
  fixture.run("activityPreferences.maxDistance = 2; renderSocial()");
  assert.match(fixture.app.innerHTML, /Your activity check: Worth checking/);
});

test('AI failures keep the original letter available', async () => {
  const fixture = appFixture();
  fixture.run("setRoute('letter'); letterDraft.body = 'Original message'");
  fixture.context.fetch = async () => ({ ok: false, json: async () => ({ error: 'Companion unavailable' }) });
  await fixture.run("rewriteLetter('formal')");
  assert.equal(fixture.run('letterDraft.body'), 'Original message');
  assert.equal(fixture.run('letterRewrite.body'), '');
  assert.match(fixture.tools.innerHTML, /Companion unavailable/);
});

test('opening AI Companion mounts the photo picker after creating its setup container', () => {
  const fixture = appFixture();
  let mounted = 0;
  fixture.context.window.AgePet = {
    mountSetup() {
      assert.match(fixture.app.innerHTML, /id="pet-setup"/);
      mounted += 1;
    },
  };
  fixture.run("setRoute('ai')");
  assert.equal(mounted, 1, 'Photo setup must be mounted when the AI page opens');
  assert.match(fixture.app.innerHTML, /value="SC"[^>]*>简体中文<\/option>/);
  assert.match(fixture.app.innerHTML, /value="TC"[^>]*>繁體中文<\/option>/);
});

test('restored Letter tools coexist with current location and news entry points', () => {
  const fixture = appFixture();
  fixture.run("setRoute('letter')");
  assert.match(fixture.app.innerHTML, /data-rewrite-tone="gentle"/);
  assert.match(fixture.app.innerHTML, /data-letter-sound/);
  fixture.run("setRoute('social')");
  assert.match(fixture.app.innerHTML, /Use my location/);
  fixture.run("socialTab = 'news'; renderSocial()");
  assert.match(fixture.app.innerHTML, /news/);
});
