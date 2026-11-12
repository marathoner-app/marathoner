# Signed-in visual system

This is the implementation reference for Marathoner's signed-in experience.
It is intentionally small: the goal is to make each new surface feel like the
same product without freezing the design before daily beta use exposes what
needs to change.

## Direction

- Use a soft neutral canvas with white content surfaces and a slightly blue-gray
  application banner.
- Use near-black for hierarchy and primary actions. Reserve Marathoner blue for
  selection, links, focus, and small points of emphasis.
- Prefer thin neutral borders, restrained corner radii, subtle depth, and
  generous spacing over heavy outlines or decorative shadows.
- Use the system font stack so the web and iOS wrapper feel native and crisp.
- Preserve semantic colors for errors, warnings, success, workout types, and
  workout completion. The visual system must not turn meaning into decoration.

## Shared tokens

The semantic tokens live in `src/styles/global.css`. Feature styles should use
the `--app-*` tokens instead of introducing a new near-duplicate color, radius,
shadow, or transition value.

The first implementation layer is `src/styles/signed-in-theme.css`. It loads
after feature CSS and unifies recurring signed-in surfaces while existing
feature layouts remain independent. Later slices should move stable decisions
into their owning component styles rather than growing an unlimited override
file.

Runner setup, account and data-import settings, guidance, and recommendation
surfaces now own their stable visual-system rules. Use the shared accent,
warning, success, and danger surface tokens so these states stay recognizable
without relying on text alone.

Plan creation and activation use the same language: selected dates use the
accent surface, provisional and uncertain results use warning surfaces,
invalid inputs use danger surfaces, and confirmed activation uses success.
Long proposals keep the schedule in ordinary document flow with compact,
repeatable week cards rather than a separate visual system.

Analyze uses the neutral card hierarchy for recorded facts and reserves blue
for chart series, disclosure controls, and focus. Perceived-effort history uses
the shared success, accent, warning, and neutral surfaces so meaning remains
visible without turning every analytics heading into an accent.

Track keeps run entry and shoe management on equal neutral surfaces, while
saved runs and shoes use quieter inset cards. Uncertain saves use warning,
confirmed saves and active-shoe badges use success, and read-only imported run
facts use the accent surface. Editing remains neutral; retirement is cautionary
and permanent run deletion is the only destructive action.

## Interaction rules

- Primary actions are near-black; active navigation, focus, and links are blue.
- Secondary actions are white with a neutral border.
- Keyboard focus uses both a solid outline and a soft outer ring.
- Mobile navigation remains fixed, thumb-friendly, and safe-area aware.
- Long setup flows keep their completion actions anchored within the form while
  preserving normal document space and safe-area padding.
- Routine account controls use neutral surfaces. Diagnostics remain secondary,
  and irreversible account deletion has a distinct danger surface.
- Safety guidance keeps danger emphasis; ordinary guidance and recommended
  choices use the blue accent surface; provisional content uses the warning
  surface; confirmed outcomes use the success surface.
- Motion is brief and functional, and collapses under `prefers-reduced-motion`.

## Responsive checks

Every visual-system slice should exercise the signed-in home and representative
Plan, Track, and Analyze states at phone and desktop widths. Check safe areas,
large text, keyboard focus, scrolling, and reduced-motion behavior before the
slice is considered complete.
