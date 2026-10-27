# Internal plan and adaptation rehearsal

This local-only mode lets the Marathoner owner run a saved runner profile
through the deterministic initial-plan generator before the draft methodology
has received independent review. It exists to make the product internally
testable, not to move the external-participant release gate.

Start the mode with:

```sh
npm run dev:plan-rehearsal
```

After signing into the development environment, finish and save the runner
profile. The signed-in home then shows **Internal draft plan rehearsal**. For an
exact race date that falls on the saved preferred long-run day, the tool offers
one explicit start-date choice for every whole-week horizon allowed by the
pinned draft. It never selects a date automatically, and the date field remains
editable so invalid and unsupported boundaries can still be rehearsed. Choose a
date and truthfully answer the two rehearsal-only confirmations. The selection,
confirmations, and generated proposal stay in memory; they are not written to
Firebase.

The surface can:

- map the current saved profile into the plan-generation input contract;
- run the exact hash-pinned draft packet through the deterministic generator;
- show incomplete, invalid, unsupported, or generated results; and
- render a generated proposal as read-only and inactive.

The same mode also shows **Internal draft adaptation rehearsal**. This second
tool requires the owner to choose one frozen scenario from the pinned adaptation
fixture packet. It runs the normalized synthetic evidence through the production
evaluator, displays the exact decision, action, reason, explanation key,
approval requirement, and provenance, and confirms whether the result matches
the fixture's expected outcome. The evidence is inspectable but remains
in-memory and read-only.

The adaptation lab deliberately does not derive evidence from saved runs. The
signed-in client does not yet have a trusted active-plan revision and
association-normalization seam, so presenting live-run results now would require
inventing facts. The frozen lab makes the implemented decision table testable
without hiding that missing integration boundary.

Neither tool can approve, activate, or persist a plan or recommendation.
Ordinary development, production web, iOS development, and iOS beta builds do
not include these surfaces or either draft packet. The distributable build
commands scan their output and fail if any appears.

Independent methodology review remains required before the rules or generated
plans can be used by real-world participants. Reviewer changes can be applied
to the pinned packet and exercised through this same rehearsal flow before any
participant-facing activation is authorized.
