import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL('../activity-check.js', import.meta.url), 'utf8'), context);
const { analyse, recordSelection, restoreSelections, readSelections } = context.window.ActivityCheck;
const place = { id: 'a', title: 'Walk', category: 'Walking', access: 'Wheelchair accessible, seating provided, step-free paths', distanceKm: 2 };

test('unknown venue access cannot become a good match through nearby distance or interests', () => {
  assert.equal(analyse({ ...place, access: 'Check directly with venue' }, { needs: ['seating'], interests: ['Walking'] }).level, 'confirmation');
});
test('all access needs must be addressed before distance and interests', () => {
  assert.equal(analyse(place, { needs: ['seating', 'hearing'], interests: ['Walking'] }).level, 'confirmation');
  assert.equal(analyse({ ...place, access: 'Not wheelchair accessible; seating provided' }, { needs: ['wheelchair'] }).level, 'confirmation');
  assert.equal(analyse({ ...place, access: 'Wheelchair accessible, no seating' }, { needs: ['seating'] }).level, 'confirmation');
});
test('distance takes priority over matching interests, including configurable boundaries', () => {
  assert.equal(analyse({ ...place, distanceKm: 6 }, { needs: ['seating'], maxDistance: 5, interests: ['Walking'] }).level, 'checking');
  assert.equal(analyse({ ...place, distanceKm: 5 }, { needs: ['seating'], maxDistance: 5, interests: ['Walking'] }).level, 'match');
});
test('zero distance is known; missing distance and unknown access needs require confirmation', () => {
  assert.equal(analyse({ ...place, distanceKm: 0 }, { needs: [] }).level, 'match');
  assert.equal(analyse({ ...place, distanceKm: undefined }, { needs: [] }).level, 'confirmation');
  assert.equal(analyse(place, { needs: ['other'] }).level, 'confirmation');
});
test('interests are optional and never override access or distance', () => {
  assert.equal(analyse(place, { needs: ['seating'], interests: [] }).level, 'match');
  assert.equal(analyse(place, { needs: ['seating'], interests: ['Gardening'] }).level, 'checking');
});
test('selection records survive data refresh and unselect only when both toggles are off', () => {
  const records = recordSelection({}, { ...place, saved: true, joined: true });
  const restored = restoreSelections([{ ...place, saved: false, joined: false, title: 'Updated walk' }], records);
  assert.equal(restored[0].saved, true);
  assert.equal(restored[0].title, 'Updated walk');
  assert.equal(restoreSelections([], records)[0].joined, true);
  assert.equal(Object.keys(recordSelection(records, { ...place, saved: false, joined: true })).length, 1);
  assert.equal(Object.keys(recordSelection(records, { ...place, saved: false, joined: false })).length, 0);
});
test('corrupt local storage safely yields empty selection records', () => {
  assert.equal(Object.keys(readSelections({ getItem: () => '{broken' })).length, 0);
  assert.equal(Object.keys(readSelections({ getItem: () => 'null' })).length, 0);
});
