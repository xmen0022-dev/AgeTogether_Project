# Social Activity Check Implementation Plan

**Goal:** Record selected Social activities and show an explainable check beside each selection.

**Architecture:** A browser helper contains pure accessibility/distance/interest rules and selection storage helpers. Social owns the UI and uses the existing Companion API for optional follow-up questions. Local storage retains selections on this device; activity checks are recomputed from preferences.

**Tech Stack:** Plain JavaScript, existing CSS, Node test runner.

**Spec:** ../specs/2026-10-01-social-activity-decision-tree-design.md

## Task 1: Decision rules and selected activity records

- [ ] Add `tests/activity-check.test.js`, covering missing venue data, unmet access needs, distance boundaries, lower-priority interests, zero distance, and selection restoration after the data source changes.
- [ ] Run `node --test tests/activity-check.test.js` and confirm it fails before implementation.
- [ ] Create `activity-check.js` with `analyse(activity, preferences)`, `readSelections(storage)`, `recordSelection(records, activity)`, and `restoreSelections(activities, records)`.
- [ ] Run the focused tests.

## Task 2: Social integration

- [ ] Load the helper before `script.js` in `index.html`.
- [ ] Add accessibility, maximum-distance and optional-interest controls. Unrecognised profile accessibility needs require confirmation.
- [ ] Keep selected activity snapshots in local storage and restore them after asynchronous database loading. Keep records from other data sources visible in Saved.
- [ ] Show a check in every selected activity card. Include selected/interested activities in Saved.
- [ ] Offer an inline Companion follow-up with activity context; keep responses in that card and protect against stale requests after rerendering.
- [ ] Add responsive CSS and a README explaining that this is a hand-authored decision tree, not a trained model; database place distances use the Melbourne CBD demonstration origin.
- [ ] Run syntax checks, decision tests, the existing test suite and a DOM integration smoke test of Save, reload, preference updates, and Join/Interested toggles.

## Scope adjustments authorised in conversation

Keep checks beside every selection rather than only the latest selection. Retain records across refreshes on this device. Pulling origin/main revealed the existing Letter page in c7bf5b2. Integrate gentler, simpler and formal rewrite tasks into its editor with explicit confirmation before sending the message body to DeepSeek. Preserve original text until accepted and ignore obsolete replies after edits. No deployment is included.

## Verification results

The focused decision-tree tests failed with ENOENT before implementation.
The full Node test suite passed with 32 tests after integration, including
selection reload, request consent, recipient exclusion and obsolete replies.
Browser access to the deployed origin was blocked by browser policy; no live
email or real AI request was sent during verification.
