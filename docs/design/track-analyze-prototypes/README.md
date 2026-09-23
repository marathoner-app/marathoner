# Track and Analyze prototype direction

**Status:** Historical design reference; current runtime behavior lives on `main`

**Captured:** July 30, 2026

**Product owner:** Kevin Tulloch

**Tracking issue:** [#43](https://github.com/marathoner-app/marathoner/issues/43)

**Prototype branch:** `codex/issue-43-track-analyze-prototypes`

**Historical prototype PR:** [#44](https://github.com/marathoner-app/marathoner/pull/44), closed as superseded and not intended to merge

## Purpose

This directory preserves a July 2026 visual exploration for Marathoner's Track
and Analyze panels. The screenshots and code on the prototype branch are
historical references, not descriptions of current runtime behavior or
production-ready feature implementations.

The shared training domain, Firestore repositories, and connected Plan, Track,
and Analyze state are now implemented. These prototypes remain visual
references only. Any future visual refresh should be rebuilt through small,
issue-linked pull requests that preserve the connected behavior and remain
understandable and reviewable on their own.

## Shared visual direction

Both panels intentionally use:

- Marathoner's existing typeface and black, white, and blue palette;
- direct, calm language that helps a first-time marathoner feel informed and in control;
- generous spacing, restrained borders, and focused cards;
- a clear summary before detailed information;
- responsive layouts that remain useful on mobile web; and
- one prominent next action instead of a dense dashboard of choices.

The current application shell change is also intentional. Only the selected panel is rendered while it is open, which avoids nested interactive controls and gives each feature enough room to become a real application surface.

## Track panel

The Track panel is intended to make routine logging feel immediate and understandable.

### Intentional elements

- The headline, **Every mile, accounted for.**
- A total-distance signal at the top of the page
- A compact summary of recorded runs, active shoes, and consistency
- A simple run form focused on distance, elapsed time, and shoes
- A shoe-rotation area built around a visible 400-mile target
- Recent activity with a useful empty state

### Historical prototype-only elements

- The prototype's summary cards, consistency label, 400-mile target, and recent
  activity layout were presentation concepts rather than approved product
  rules.
- The current Track implementation reads persisted runs, shoes, and planned
  workouts through `TrainingDataProvider`; it does not use the prototype's
  local demonstration state.
- Current shoe mileage is derived from persisted starting distance and linked
  completed runs. A configurable retirement recommendation is not implemented.

## Analyze panel

The Analyze panel is intended to answer a focused question: what does the runner need to understand about their training right now?

### Intentional elements

- The headline, **See the work taking shape.**
- A calm current signal that leads with interpretation
- A small set of high-value weekly summary metrics
- Weekly mileage, easy-run pace, and training-balance views
- A single **What matters next** recommendation
- Positive language that remains direct when training needs to change

### Historical prototype-only elements

- The prototype's 42-mile week, 7:30 pace, five-run count, charts, comparison
  text, **On track** signal, and **Protect the recovery** recommendation are
  illustrative and are not approved coaching or safety logic.
- The current Analyze implementation calculates total mileage, current-week
  mileage, average pace, and run counts from persisted completed runs.
- Pace trends, training balance, and recommendation cards are not implemented
  in the current application.

## Implementation boundary

Do not merge the historical prototype PR into `main` as the production
implementation. The branch preserves the July layout and styling experiment;
the current typed and persisted feature behavior on `main` is authoritative.

When Track and Analyze enter active development:

1. Create focused issues for the smallest useful data-backed behavior.
2. Build from the shared training model and service boundaries available at that time.
3. Preserve the visual hierarchy where it still supports real data and user needs.
4. Replace each placeholder with explicit rules, tests, and understandable empty states.
5. Validate desktop and mobile behavior before merging each slice.

## Reference files

- [`track-desktop.jpg`](./track-desktop.jpg) shows the Track panel at a desktop viewport.
- [`track-mobile.jpg`](./track-mobile.jpg) shows the top of the Track panel at a mobile viewport.
- [`analyze-desktop.jpg`](./analyze-desktop.jpg) shows the Analyze panel at a desktop viewport.
- [`analyze-mobile.jpg`](./analyze-mobile.jpg) shows the top of the Analyze panel at a mobile viewport.

### Track desktop

![Track panel prototype on desktop](./track-desktop.jpg)

### Track mobile

![Track panel prototype on mobile](./track-mobile.jpg)

### Analyze desktop

![Analyze panel prototype on desktop](./analyze-desktop.jpg)

### Analyze mobile

![Analyze panel prototype on mobile](./analyze-mobile.jpg)
