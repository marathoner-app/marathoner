# Signed-in visual system

This is the implementation reference for Marathoner's signed-in experience.
It is intentionally small: the goal is to make each new surface feel like the
same product without freezing the design before daily beta use exposes what
needs to change.

## Direction

- Use a cool neutral canvas with flat white content surfaces and a white
  application banner. Page headings are left aligned and share one scale.
- Use near-black for hierarchy and primary actions. Reserve Marathoner blue for
  the next-workout surface, selection, links, focus, and chart series.
- Prefer thin neutral dividers, 8–12px corner radii, strong numeric hierarchy,
  and generous spacing. Routine surfaces do not cast decorative shadows.
- Use the system font stack so the web and iOS wrapper feel native and crisp.
- Preserve semantic colors for errors, warnings, success, workout types, and
  workout completion. The visual system must not turn meaning into decoration.

## Shared tokens

The semantic tokens live in `src/styles/global.css`. Feature styles should use
the `--app-*` tokens instead of introducing a new near-duplicate color, radius,
shadow, or transition value.

`src/styles/signed-in-theme.css` owns the compact account header, home profile
entry, and shared status/focus treatment. Feature layouts and form styling live
in their owning component styles rather than a growing global override file.
The main canvas is `#f4f5f6`, ink is `#16191f`, and the accent is `#2155d8`.

Runner setup, account and data-import settings, guidance, and recommendation
surfaces now own their stable visual-system rules. Use the shared accent,
warning, success, and danger surface tokens so these states stay recognizable
without relying on text alone.

Plan creation and activation use the same language: selected dates use the
accent surface, provisional and uncertain results use warning surfaces,
invalid inputs use danger surfaces, and confirmed activation uses success.
Long proposals keep the schedule in ordinary document flow with compact,
repeatable week cards rather than a separate visual system.

Home leads with the next scheduled workout and its existing distance/duration
values. Runner profile actions sit beside it on desktop and follow it on phones.
An empty workout state remains neutral.

Plan browsing uses a flat week sheet, a divided summary strip, and workout rows,
with blue reserved for ordinary scheduled status, selection, and focus.
Completed workouts use success, skipped workouts recede, and restrained
workout-type rails preserve the distinction between easy, quality, long or race,
and rest days. Workout details use the shared dialog surface.

Analyze uses the neutral card hierarchy for recorded facts and reserves blue
for chart series, disclosure controls, and focus. Perceived-effort history uses
dated rows and plain-language responses, with consistent neutral dividers.
Existing saved widget coordinates, editing controls, and the phone carousel are
preserved;
visual changes must not reset or reinterpret a runner's dashboard layout.
At enlarged desktop text sizes, dashboard overflow remains scrollable so the
minimum widget rows and their content stay reachable.

Track gives run entry the wider desktop column and shoe mileage a quieter
sidebar. Saved runs and shoes use divided rows. Uncertain saves use warning,
confirmed saves and active-shoe badges use success, and read-only imported run
facts use the accent surface. Editing remains neutral; retirement is cautionary
and permanent run deletion is the only destructive action.

## Interaction rules

- Primary actions are near-black; active navigation, focus, and links are blue.
- Secondary actions are white with a neutral border.
- Keyboard focus uses both a solid outline and a soft outer ring.
- Desktop section navigation sits in the top banner, with an underline for the
  active section. When the available width relative to text size is too small,
  navigation moves to the bottom and dashboard editing gets its own header row.
  Its existing buttons, state, and focus behavior are unchanged.
- Mobile navigation remains fixed, thumb-friendly, and safe-area aware.
- Long setup flows keep their completion actions anchored within the form while
  preserving normal document space and safe-area padding.
- Routine account controls use neutral surfaces. Diagnostics remain secondary,
  and irreversible account deletion has a distinct danger surface.
- Runner setup and account settings use divided form sections, with the same
  input labels, validation, completion controls, and saving behavior.
- Safety guidance keeps danger emphasis; ordinary guidance and recommended
  choices use the blue accent surface; provisional content uses the warning
  surface; confirmed outcomes use the success surface.
- Motion is brief and functional, and collapses under `prefers-reduced-motion`.

## Responsive checks

Every visual-system slice should exercise the signed-in home and representative
Plan, Track, and Analyze states at phone and desktop widths. Check safe areas,
large text, keyboard focus, scrolling, and reduced-motion behavior before the
slice is considered complete.

The issue #886 implementation changes presentation only: Firebase configuration,
services, domain calculations, plan generation, imports, persistence, and data
contracts remain unchanged. Browser fixtures verify layouts and interactions;
physical iOS and VoiceOver checks remain separate device evidence under #699.

Representative browser-fixture captures from this implementation (sample data):

- [Analyze at 1280 × 720](running-journal-ui/analyze-desktop.png)
- [Plan at 390px wide](running-journal-ui/plan-phone.png)
