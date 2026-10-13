import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function appFixture(records = new Map(), { storageDenied = false } = {}) {
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
      body: { classList: { add() {}, remove() {}, toggle() {} } },
      addEventListener: (name, callback) => { handlers[name] = callback; },
    },
    localStorage: { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) },
    fetch: async (url, options) => {
      if (url.includes('nearby-places') || url === '/api/news') throw new Error('Use sample data');
      calls.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ text: 'Could we please talk tomorrow?' }) };
    },
  };
  if (storageDenied) Object.defineProperty(context, 'localStorage', {
    get() { throw new Error('Storage denied'); },
  });
  vm.createContext(context);
  for (const file of ['data.js', 'activity-check.js', 'script.js']) vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  const run = (code) => vm.runInContext(code, context);
  const click = (selector, dataset = {}) => handlers.click({ target: { closest: (query) => query === selector ? { dataset } : null } });
  return { app, tools, run, click, context, calls, records, change: (event) => handlers.change(event) };
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

test('AI shortcuts use the shared Pet request and language changes refresh Pet controls', async () => {
  const fixture = appFixture();
  const questions = [];
  let refreshes = 0;
  fixture.context.window.PetChat = {
    mountHistory() {}, close() {},
    sendQuestion: async (input, task) => { questions.push({ input, task }); return true; },
    refreshLanguage: () => { refreshes += 1; },
  };
  fixture.run("setRoute('ai')");
  assert.match(fixture.app.innerHTML, /id="companion-history"/);
  await fixture.run("askCompanion('ask', 'Hello')");
  assert.deepEqual(questions, [{ input: 'Hello', task: 'ask' }]);
  fixture.run("aiPreferences.language = 'SC'");
  fixture.context.document.querySelector = () => null;
  // Exercise the actual delegated preference-change handler.
  fixture.context.preferenceEvent = { target: { closest: (selector) => selector === '[data-ai-preference]' ? { dataset: { aiPreference: 'language' }, value: 'SC' } : null } };
  fixture.change(fixture.context.preferenceEvent);
  assert.equal(refreshes, 1);
});

test('activity distance changes persist and recompute selected activity reasons', async () => {
  const fixture = appFixture();
  await new Promise(setImmediate);
  fixture.run("setRoute('social'); activityPreferences = { needs: [], maxDistance: 5, interests: [] }; state.activities[0].distanceKm = 4");
  fixture.click('[data-save-activity]', { saveActivity: fixture.run('String(state.activities[0].id)') });
  const setting = { dataset: { activitySetting: 'maxDistance' }, value: '2' };
  fixture.change({ target: { closest: (selector) => selector === '[data-activity-setting]' ? setting : null } });
  assert.match(fixture.app.innerHTML, /Your activity check: Worth checking/);
  const reload = appFixture(fixture.records);
  assert.equal(reload.run('activityPreferences.maxDistance'), 2);
});

test('restoration preserves the introduction, saved text size and recent-news controls', () => {
  const fixture = appFixture(new Map([['agetogether:text-size', '5']]));
  assert.match(fixture.app.innerHTML, /intro-start/);
  assert.equal(fixture.run('textSizeLevel'), 5);
  fixture.run("setRoute('social'); socialTab = 'news'; newsSource = 'feed'; renderSocial()");
  assert.match(fixture.app.innerHTML, /data-news-window="3"/);
  fixture.click('[data-news-window]', { newsWindow: '7' });
  assert.equal(fixture.run('newsWindowDays'), 7);
});

test('letter sound preference survives reload without sending a letter', () => {
  const fixture = appFixture();
  const setting = { checked: false };
  fixture.change({ target: { closest: (selector) => selector === '[data-letter-sound]' ? setting : null } });
  assert.equal(fixture.run('letterSoundEnabled'), false);
  const reload = appFixture(fixture.records);
  assert.equal(reload.run('letterSoundEnabled'), false);
  assert.equal(fixture.calls.length, 0);
});

test('storage access denial does not prevent the first page rendering', () => {
  const fixture = appFixture(new Map(), { storageDenied: true });
  assert.match(fixture.app.innerHTML, /AgeTogether/);
});

test('a wheelchair-only profile does not introduce a separate seating need', () => {
  const records = new Map([['agetogether:profile', JSON.stringify({ accessibility: 'Wheelchair access' })]]);
  const fixture = appFixture(records);
  assert.equal(fixture.run("activityPreferences.needs.includes('wheelchair')"), true);
  assert.equal(fixture.run("activityPreferences.needs.includes('seating')"), false);
});

test('saving changed Profile access needs updates derived activity preferences', () => {
  const fixture = appFixture();
  fixture.run("state.profile.accessibility = 'Wheelchair access'; handleAction('save-profile')");
  assert.equal(fixture.run("activityPreferences.needs.includes('wheelchair')"), true);
});

test('saving Profile preserves explicitly chosen activity access settings', () => {
  const records = new Map([['agetogether.activity-preferences.v1', JSON.stringify({ needs: ['hearing'], maxDistance: 10, interests: [] })]]);
  const fixture = appFixture(records);
  fixture.run("state.profile.accessibility = 'Wheelchair access'; handleAction('save-profile')");
  assert.equal(fixture.run("activityPreferences.needs.join(',')"), 'hearing');
  assert.equal(fixture.run('activityPreferences.maxDistance'), 10);
});
