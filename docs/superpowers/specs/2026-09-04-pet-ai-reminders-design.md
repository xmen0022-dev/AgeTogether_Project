# Pet AI Replies and Gentle Reminders Design

## Goal

Make the on-screen companion a lightweight, multilingual prompt surface: it
can repeat a short AI reply above its head, show a health tip after every ten
Pet clicks, and surface three user-configurable daily reminders.

## Scope and constraints

- Keep the feature client-side. Do not add database tables, accounts, or a new
  provider call for health tips or reminders.
- Use the existing AI language preference (`en-AU`, `zh-CN`, `zh-TW`).
- Pet speech is deliberately concise: at most ten whitespace-separated words
  for model replies, with safe client-side truncation as a final guard.
- Health tips are general wellbeing prompts, not diagnosis or treatment.
- Medication reminders tell the user to follow their existing care plan; they
  never recommend changing a medicine or dose.
- Reminders run while the page is open, in the browser's local time zone.

## User experience

### Pet speech bubble

The persistent `#pet` button gets a sibling speech bubble positioned above the
companion. `pet.js` owns the visual surface and exposes a small public bridge:
`window.AgeTogetherPet.speak(message, options)`. The bridge updates text with
`textContent`, adds a type class, and hides the bubble after a short timeout
unless a reminder or tip is currently being displayed.

`script.js` calls the bridge after a successful `/api/ask` response. The full
answer remains in `#ai-answer` for accessibility and reading comfort, while
the bubble receives the concise version only.

### Ten-click health tips

Each Pet activation increments a click counter stored with the existing Pet
state. On counts divisible by ten, the client selects the next tip, alternating
between mental and physical wellbeing, localised to the selected language. It
shows the tip in the speech bubble and records the tip event so a re-render
does not duplicate it.

### Daily reminders

The companion owns three default reminders:

| Reminder | Default | Safety copy |
| --- | --- | --- |
| Water | 10:00 | Invite the user to have a drink of water. |
| Medication | 12:00 | Remind the user to follow their prescribed plan. |
| Movement | 16:00 | Invite gentle movement if it feels safe. |

The AI page includes three time inputs and an enable checkbox for each
reminder. Settings are stored in `localStorage`. A minute-level scheduler
checks enabled reminders and shows each one at most once per local calendar
day. The scheduler starts once and is cleared/restarted safely if the page
shell is re-rendered.

### Language

The selected AI language controls model prompt language and the built-in Pet
copy. If the preference is absent or invalid, Australian English is used.

## Components and boundaries

- `pet.js`: persistent Pet bubble, click counting, localised tip selection,
  reminder state and scheduler, plus the public `speak` bridge.
- `script.js`: AI page controls, reminder settings markup, preference-aware
  call to the Pet bridge, and handling of short model speech.
- `styles.css`: bubble positioning, reminder/tip visual states, and responsive
  layout near the fixed Pet.
- `tests/pet-features.test.js`: pure exported helper seams for click thresholds,
  reminder due checks, word limiting, and language fallback.

## Data flow

1. User clicks `#pet`.
2. `pet.js` updates Pet state and, every tenth click, publishes a localised
   wellbeing tip through the bubble.
3. The minute scheduler reads reminder settings and today's delivery markers.
4. When a reminder is due, it publishes a localised reminder and marks it as
   delivered for today.
5. When the user asks AI, `script.js` receives the existing full response,
   derives a bounded speech string, and publishes it through the Pet bridge.

## Error handling and accessibility

- Invalid or unavailable local storage falls back to in-memory defaults; the
  existing AI answer flow must continue working.
- Empty model output does not replace an existing bubble.
- Bubble content is inserted as text, never HTML.
- The bubble uses `role="status"` and `aria-live="polite"`; settings use
  explicit labels and native time inputs.
- The page remains usable if `pet.js` is unavailable: AI still renders its
  normal answer panel.

## Test seams

- `limitPetWords(text, maxWords)` returns no more than the requested number of
  words without HTML interpretation.
- `nextHealthTip(clickCount, tipIndex, language)` returns a tip only at the
  tenth-click boundary and advances mental/physical category selection.
- `isReminderDue(reminder, now, deliveredDate)` returns true only for an
  enabled reminder matching the local hour/minute and not already delivered.
- `normalizeReminderSettings(value)` preserves valid settings and restores
  safe defaults for malformed data.

## Out of scope

System notifications, alarms while the browser is closed, medical records,
personal medication schedules, server-side reminder persistence, and AI-
generated medical advice are intentionally deferred.
