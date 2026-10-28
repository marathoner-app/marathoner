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
- review a generated proposal and explicitly activate it only inside the
  current rehearsal session.

Session activation is an interface rehearsal, not a plan approval. It shows the
draft plan dates and first scheduled training workout, then projects the same
session draft into the signed-in home next-workout card and the normal Plan
calendar. Both surfaces label the plan as an owner-only, unsaved rehearsal. The
projection disappears when the proposal inputs change, activation is cleared,
or the page reloads. It does not call the plan-approval command, write a plan or
workouts, replace synchronized plan data, or change Track's available workout
associations.

The home summary also compares the draft schedule for the owner's current local
date with synchronized completed runs logged on that date. This is a visual,
same-date comparison only. It does not infer or save a planned-workout
association, classify completion, change a run, or turn the session projection
into authoritative adaptation evidence. The owner-only journey keeps the draft
projection and synchronized data lanes visibly separate.

The separate **Session-draft feedback rehearsal** lets the owner explicitly
confirm a transient history instead of inferring one from that home comparison.
The owner can add multiple same-date draft workout and synchronized-run pairs,
mark draft workouts as skipped, remove either kind of confirmation, and rerun
the production evaluator. A workout cannot be both completed and skipped, and
one synchronized run cannot support more than one completed workout. The latest
dated confirmed workout becomes the deterministic trigger; all confirmed
completed runs form the bounded recent-run window.

A skipped workout contributes no invented run. Skip-only history therefore
remains not ready until the production normalizer also has sufficient completed
run evidence. Every pairing, skip, and evaluator result stays in memory. This
feedback rehearsal does not associate or change a synchronized run, save a
workout status, write Firestore, or approve the draft methodology.

When that transient history is coherent, the rehearsal derives and locks the
current core week, current and next week kinds, and next-week progression state
from the activated draft and pinned base-plan packet. It refuses lead-in, race,
recovery, or otherwise unsupported trigger weeks instead of asking the owner to
guess. For an explicitly confirmed skipped workout, it also derives any
structurally valid reschedule dates from the activated draft and pinned
adaptation limits. Purpose, delay, plan-week boundaries, target-date occupancy,
and consecutive run spacing are locked schedule facts. Runner availability
remains an explicit owner confirmation, and the owner can still choose that no
candidate is available.

Accepting a ready material change replaces the unsaved session projection shown
by the signed-in Home summary, normal Plan calendar, and internal session
schedule. The evaluator continues to use the original activated draft as its
evidence source, so the displayed adjustment cannot recursively rewrite the
facts that produced it. Keeping the current plan, reviewing the choice again,
changing the evaluation evidence or supplied facts, replacing or clearing the
activated draft, or reloading restores the base session projection. This
cross-surface preview remains in memory and sends no command.

The same mode also shows **Internal draft adaptation rehearsal**. This second
tool requires the owner to choose one frozen scenario from the pinned adaptation
fixture packet. It runs the normalized synthetic evidence through the production
evaluator, displays the exact decision, action, reason, explanation key,
approval requirement, and provenance, and confirms whether the result matches
the fixture's expected outcome. The evidence is inspectable but remains
in-memory and read-only.

When a matching frozen result is a recommendation that requires runner
approval, the lab also presents the exact draft condition and plan-mutation
description through the isolated recommendation-review interface. **Keep in
rehearsal** and **Apply in rehearsal** record only an in-memory interface choice.
Refused, no-change, invalid, mismatched, and non-approval outcomes expose no
choice. Rerunning or changing the scenario clears the choice, and neither action
submits a command, persists a decision, projects a plan, or changes live data.

The same mode also includes a separate live-history path for synchronized owner
data. Its inspector receives the authenticated owner's active-plan state,
plans, workouts, and completed runs; the owner then chooses the evaluation date,
completed-or-skipped trigger, and recent-run bound. The production normalizer
either shows complete objective evidence or refuses the snapshot with every
stable issue, including incomplete or cross-plan associations. A ready history
result means only that those saved facts are coherent. It does not approve a
rule or recommendation.

After a ready result, the owner may deliberately supply the remaining facts
that saved history cannot determine, affirm their completeness, and invoke the
production evaluator with the pinned draft artifact. A material result can use
the existing in-memory keep-or-apply rehearsal and preview a bounded adjustment
through the normal Plan calendar. Any changed history or supplied fact clears
that result. No recommendation, decision, plan revision, or calendar change is
saved, and the synchronized plan remains authoritative. This live path uses
only the synchronized active plan; it does not treat the session-only initial
plan projection, the home same-date comparison, or owner-confirmed session-draft
feedback as persisted evidence.

None of these surfaces can approve or persist a plan or recommendation, and
rehearsal activation cannot escape the current page session. Ordinary
development, production web, iOS development, iOS beta, and Functions builds do
not include these surfaces or either draft packet. The distributable build
commands scan their output and fail if any appears.

Independent methodology review remains required before the rules or generated
plans can be used by real-world participants. Reviewer changes can be applied
to the pinned packet and exercised through this same rehearsal flow before any
participant-facing activation is authorized.
