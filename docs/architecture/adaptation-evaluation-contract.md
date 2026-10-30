# Adaptation evaluation contract

## Purpose

Marathoner's founding-beta adaptation logic must be deterministic, bounded,
explainable, and fail closed. The shared contract in
[`adaptationEvaluation.ts`](../../src/domain/training/adaptationEvaluation.ts)
separates normalized evidence, injected methodology rules, and one evaluation
result without depending on Firebase, UI state, persistence, or a signed-in
runner.

This is an internal implementation boundary. It does not authorize any rules
for participant use.

## Normalized input

`AdaptationEvaluationInputV1` contains only the evidence needed by the frozen
decision table:

- requested base-plan and adaptation artifact versions;
- active and evaluated plan revisions;
- upstream safety and evidence-completeness states;
- the completed-or-skipped trigger;
- current and next week kinds and progression state;
- days until the race and since the last completed planned run;
- completed, skipped, pending, and planned counts for the evaluated week;
- up to four already-normalized perceived-effort values; and
- one prevalidated reschedule-candidate description.

The evaluator does not query history, infer workout ownership or association,
select the four-run evidence window, or calculate candidate dates. A trusted
future caller must normalize and verify those facts before invoking it.

Malformed shapes return `invalid_input`. Complete but unsupported, stale,
unsafe, ambiguous, or insufficient evidence follows the injected fail-closed
decision table and returns its exact refused or no-change outcome.

## Injected rules

`AdaptationEvaluationRulesV1` supplies all methodology choices:

- exact artifact versions and supported plan scope;
- hard-effort values and evidence counts;
- missed-run, disruption, race-proximity, and reschedule thresholds;
- eligible and protected week kinds;
- allowed reschedule purposes; and
- the reason code, explanation key, action, and approval requirement for every
  decision.

The evaluator contains the decision structure and precedence but no pinned
artifact name, path, or draft version. An eventual trusted loader owns artifact
schema validation and approval status before any participant-facing call.

## Result and provenance

Every structurally valid evaluation returns exactly one `refused`,
`recommendation`, or `no_change` result. It includes:

- one stable action or `null`;
- one reason code and explanation key supplied by the rules;
- whether explicit runner approval is required; and
- the input schema, evaluator, base-plan, and adaptation artifact versions.

Only material recommendations require approval. The evaluator proposes no
mutation, performs no write, and cannot change a plan autonomously.

## Internal draft evidence

Tests and the owner-only `internal-plan-rehearsal` mode load the exact pinned
`beta-adaptation@0.2.0-draft` packet, adapt its values into the injected rule
contract, and run frozen fixtures through the production evaluator. Tests prove
every fixture plus deterministic output, one-hard-effort protection, exact and
just-outside boundaries, malformed input rejection, provenance, and approval
semantics. The local UI makes those synthetic results inspectable without
normalizing live training history or offering a plan-change action.

The draft remains unapproved and runtime-ineligible. A Vite virtual module
injects it only into the explicitly selected local owner mode. Ordinary web,
iOS, and Functions builds exclude it and scan for leakage. It remains
disconnected from live runs, recommendations, persistence, guidance, and plan
mutation.

## Saved-history normalization

The signed-in synchronization snapshot now reads the server-owned active-plan
state, including its authoritative plan ID and positive revision. That closes
the revision-read prerequisite without adding a client-writable revision to a
plan or treating plan status alone as authority.

[`adaptationHistoryNormalization.ts`](../../src/domain/training/adaptationHistoryNormalization.ts)
is the pure boundary between that saved snapshot and a future evaluation
caller. Given an explicit owner, active state, plans, workouts, runs,
seven-calendar-day week, evaluation date, trigger workout, and recent-run
window size, it verifies:

- owner, active-plan, revision, status, and plan-date agreement;
- complete plan-and-workout associations for relevant completed runs;
- unique workouts and at most one completion for each planned workout;
- agreement between workout status and completed-run presence;
- a completed or skipped non-rest trigger inside the evaluated week; and
- that completed evidence is not from the future.

Only then does it derive objective week counts, the trigger kind, days until
the race, days since the most recent completed planned run, bounded perceived
efforts, and conservative safety completeness. Recent completions are ordered
by actual run start time, while the last-completion calendar distance uses each
run's recorded IANA time zone. Unplanned runs and runs tied coherently to an
older plan do not contaminate active-plan evidence. Partial, cross-plan,
cross-owner, duplicate, missing, and contradictory records return stable typed
issues instead of guessed evidence.

A `ready` result means only that saved history is coherent enough to trust
these objective facts. It is not permission to evaluate or recommend a plan
change. The caller must still supply and attest the exact base-plan and
adaptation artifact versions, current core week, current and next week kinds,
progression state, and a prevalidated reschedule candidate. Methodology
thresholds remain injected rules. The normalizer does not load a draft packet,
invoke the evaluator, persist anything, mutate a plan, or expose participant
guidance.

## Trusted live-evidence prerequisites

Participant live adaptation evaluation remains intentionally disconnected. A
future trusted caller must assemble the normalizer's objective evidence with
the explicit trusted facts above, confirm completeness, and load an approved
non-draft rule artifact before invoking the evaluator. Revision readability and
a history-ready result do not independently satisfy those gates.

The first product integration remains owner-only and read-only. The explicit
`internal-plan-rehearsal` mode now passes the authenticated owner's synchronized
active state, plans, workouts, and runs to a live-history inspector. The owner
chooses an evaluation date, completed-or-skipped trigger, and recent-run bound;
the inspector then displays either the normalizer's complete objective evidence
or all stable refusal issues. The recent-run bound is visibly an editable
inspection input, not an approved threshold.

The history inspection itself still imports no packet values and invokes no
evaluator. After a `ready` history result, a separate nested owner-only form can
deliberately continue into an internal draft evaluation. It pins the exact
injected draft artifact versions visibly, requires the owner to supply every
other trusted caller fact, and requires an explicit completeness affirmation
and evaluation action. The production evaluator then receives only the
normalized history and those explicit facts.

The live draft result is visibly unapproved. A material result can reach only
the existing in-memory keep-or-apply rehearsal; it cannot create a
recommendation record, call a material command, project or persist a plan, or
activate guidance. Changing history or any supplied fact clears the result and
session choice. Ordinary production, iOS, and Functions builds exclude the
inspector, live draft evaluation, and identifying text through the existing
internal-rehearsal build boundary. This permits owner testing before the
professional-review and external-use gates are funded without weakening them.

## Activation gates

Before participant use, issue #119 must record dated qualified approval for one
exact non-draft artifact. A later focused change must then:

1. reconcile the evaluator and fixtures to that exact approved artifact;
2. document every difference from the draft;
3. add a trusted loader that rejects draft, unknown, conditional, rejected,
   retired, or mismatched versions;
4. repeat the full automated and manual verification path; and
5. connect recommendations to reviewed explanations and explicit approval
   without allowing autonomous plan mutation.

Until those gates pass, this module is implementation evidence only.

## Isolated plan projection

[`adaptationPlanProjection.ts`](../../src/domain/training/adaptationPlanProjection.ts)
defines the next internal boundary after evaluation. It accepts a normalized
plan prescription, the active and evaluated revisions, and one server-owned
bounded adjustment. It can project only repeat, hold, or reschedule changes,
advances the revision exactly once, and records stable before-and-after workout
snapshots.

The projection is deliberately structural. It models scheduled dates, phases,
purposes, and distance-or-duration targets, but not workout completion status,
participant identity, persistence metadata, or Firestore paths. The draft
packet does not define the operational status transition for a rescheduled
skipped workout, so this implementation does not invent one. A later reviewed
atomic workflow must resolve that state transition explicitly.

The projector rejects stale revisions, incomplete positional weeks,
incompatible target kinds, target increases, duplicate workout identities or
dates, occupied reschedule dates, moves outside the supplied plan week, and
material recommendations that would make no change. Because it receives no
artifact path or version, it neither imports the pinned draft nor represents
methodology approval.

The owner-only live rehearsal can connect an explicitly accepted draft
recommendation to this projector. A fail-closed adapter derives the active-plan
calendar week and exact reschedule date from the synchronized snapshot, rejects
missing or ambiguous workout targets, and shows only a session-memory
before-and-after projection. Choosing to keep the current plan never calls the
projector. A successful rehearsal projection creates no recommendation record,
approval receipt, material command, persisted revision, or real plan mutation.

After that explicit session-only apply choice, a second fail-closed adapter can
reconcile the complete projection with the synchronized active-plan workout
snapshot and render the changed week through the ordinary Plan calendar. It
preserves workout identity, ownership, status, timestamps, unaffected rest
days, and the owner's preferred distance unit. Missing, duplicate, incomplete,
or incompatible mappings refuse the calendar preview rather than showing a
partial revision. The preview disappears when the owner keeps the current plan,
reopens the choice, or changes any evaluation input; it never replaces the
listener-confirmed plan state.

The projector remains disconnected from participant-facing acceptance,
material-command handling, plan persistence, and activation controls. Ordinary
production, iOS, beta iOS, and Functions artifacts exclude this owner-only
connection. After #119 approves an exact non-draft artifact, the projection and
its fixtures must be reconciled to that artifact before any participant-facing
acceptance transaction may use it.
