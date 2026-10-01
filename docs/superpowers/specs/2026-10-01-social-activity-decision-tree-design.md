# Social Activity Decision Tree Design

## Purpose

Make the Social & Community activities flow demonstrably connected to the
AgeTogether support features. When an older user saves or joins an activity,
the app should give a short, explainable suitability check rather than a
black-box recommendation.

## Scope

This change covers the existing Social activities view only. It does not add
accounts, database writes, live bookings, medical advice, or a machine-learning
model. The later Letter writing-style feature is deliberately out of scope.

## Inputs

- The selected activity's known distance, category, and accessibility text.
- The user's existing free-text accessibility preference.
- A small in-browser list of preferred activity categories.

The analysis only uses information already available in the prototype. Unknown
accessibility information is treated as unknown, never as a positive match.

## Decision Tree

1. **Accessibility first.** If the activity accessibility information is
   missing or does not appear to address the user's stated needs, return
   **Needs confirmation** and ask the user to contact the venue.
2. **Distance second.** For an accessibility-compatible activity, use a
   configurable local threshold of 5 km. A farther activity returns
   **Worth checking** and suggests planning transport or asking a trusted
   person to come along.
3. **Interest third.** A nearby, accessibility-compatible activity in a
   preferred category returns **Good match**. A different category stays
   **Worth checking**, not rejected, because the user may still enjoy trying
   something new.

The card shows the exact reasons used by the tree and a cautious next step. It
does not say an activity is medically safe, and it never presents venue details
as confirmed.

## User Flow

1. The user saves or joins an existing activity in Social & Community.
2. The app retains that selection using the activity's existing `saved` or
   `joined` field.
3. A "Your activity check" card appears for the most recently selected
   activity, showing its result, reasons, and next step.
4. Selecting another activity refreshes the card. Unselecting the active
   activity removes the card.

## Implementation Boundaries

- Keep state in the current client-side `state` object; no new endpoint.
- Put decision-tree logic in small pure functions so it can be unit tested.
- Extend Social rendering and click handlers only; no changes to the AI or Pet
  features.
- Use clear, senior-friendly wording and existing UI styling patterns.

## Error Handling and Verification

- Missing distance or accessibility data must yield a cautious result rather
  than throw or claim a match.
- Existing Save and Join controls must keep their current toggle behaviour.
- Unit tests cover accessibility priority, distance priority, category as a
  lower-priority input, and missing data.
