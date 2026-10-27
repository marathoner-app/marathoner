# Firestore rules acceptance record

- **Status:** Evidence assembled; final issue #470 pull-request checks must pass
- **Last audited:** October 26, 2026
- **Security gate:** [#121](https://github.com/marathoner-app/marathoner/issues/121)
- **Final evidence issue:** [#470](https://github.com/marathoner-app/marathoner/issues/470)
- **Invitation decision:** [#129](https://github.com/marathoner-app/marathoner/issues/129)

## Accepted claim

The tracked development and beta Firestore rules deny access by default and
permit only the exact current document lifecycles recorded below. The beta
candidate adds verified email and an exact approved membership record to every
participant-data request. Both rulesets reject unknown fields, unsupported
schema versions, cross-owner access, invalid types and values, incoherent or
stale timestamps, and direct participant access to server-owned records.

This is not a claim that every material write already uses the server command
boundary. Plan and workout persistence remains transitional until issue #72
closes. Completed-run creation, editing, deletion, and their linked workout
status changes remain transitional until issue #115 closes. Security Rules
constrain those direct writes now; the owning migration issue must remove each
client permission after its command path is active.

## Positive scenarios

| Scenario | Development rules | Beta rules | Retained evidence |
| --- | --- | --- | --- |
| Owner reads profile, plans, workouts, runs, and shoes | Authenticated owner passes | Verified owner with an exact approved membership passes | `firestoreRules.integration.ts` owner and repository round-trip cases; `firestoreBetaAccess.integration.ts` approved-owner cases |
| Profile create/update | Exact version 1 profile lifecycle passes | Same lifecycle plus beta access gate passes | `allows a runner to create, read, and update only their own profile`; `enforces exact profile lifecycle and scheduling relationships` |
| Current plan/workout repository lifecycle | Exact plan and workout shapes pass | Same shapes plus beta access gate pass | `allows a runner to create, update, read, and delete a valid plan`; accepted rest, run, and walk-run workout fixtures; beta exact lifecycle cases |
| Run create/update/delete | Exact completed-run lifecycle passes | Same lifecycle plus beta access gate passes | `accepts the exact completed-run lifecycle for its owner`; beta exact completed-run lifecycle |
| Shoe create/update/retire | Exact one-way lifecycle passes; delete fails | Same lifecycle plus beta access gate passes | `accepts exact shoe creation and makes retirement terminal`; beta exact one-way shoe lifecycle |
| Membership self-read | Not used by development rules | Verified owner may get only its own record | `allows a verified account to read only its own membership status` |

## Named negative scenarios

| Required scenario | How it fails | Retained evidence |
| --- | --- | --- |
| Cross-owner | Path ownership and stored `userId` must match the authenticated UID; beta also checks membership | Development anonymous/cross-user, plan owner-field, workout owner, run owner, and shoe owner cases; beta anonymous/cross-owner case |
| Duplicate | Duplicate profile training days fail; repeated command IDs replay one receipt; two completions for one workout cannot both commit | Profile duplicate-day rule fixture; `commits one effect and returns the original receipt for a duplicate ID`; `allows only one of two authenticated clients to complete a planned workout` |
| Rest day | A rest workout cannot contain run targets or purpose, and completed-run projection rejects a rest-workout association | Workout `run-only fields on a rest workout` rule fixture; `completedRunCommandProjection.test.ts` rest-workout case |
| Stale revision | Direct document updates require a monotonic `updatedAt`; material commands require the expected aggregate revision | Profile, plan, workout, run, and shoe stale-update rule fixtures; material-command stale plan, completion, and deletion cases |
| Oversized | Profile text, plan names, workout notes, run notes, shoe names, membership approver IDs, and stored identifiers are bounded | Development rule parameter cases, matching beta lifecycle cases, and domain validation tests |
| Extra field | Every writable document uses `keys().hasOnly(...)` | Profile, plan, workout, run, and shoe unknown-field fixtures |
| Unsupported version | Writable documents require schema version 1; beta membership is version 1; command and artifact versions are validated | Schema-version update fixtures for every training document; malformed beta membership fixtures; unsupported app/command version material-command case |
| Direct material or control-plane write | Participant clients cannot mutate active-plan state, generation metadata, recommendation evidence, receipts, deletion requests, membership, recommendation activation, feature controls, or minimum-client-version records | Development and beta server-owned record cases, including the three `operatorControls` paths |

Coaching thresholds and scheduling methodology are deliberately not duplicated
in Firestore rules. Versioned application contracts validate them before a
command or repository write reaches Firestore.

## Version compatibility fixtures

- `canonicalFixtures.test.ts` proves one versioned, unique, complete fixture
  envelope against the web domain.
- `documentTrainingRepositories.test.ts` rejects stored plan data with an
  unsupported schema version; converters perform the same check for every
  hydrated training document.
- `firestoreRules.integration.ts` rejects schema-version changes for profile,
  plan, workout, run, and shoe records.
- `firestoreBetaAccess.integration.ts` rejects unsupported and malformed
  membership records before any participant-data access.
- `planGeneration.test.ts` checks explicit generator, ruleset, input, result,
  and provenance versions.
- `materialCommand.integration.ts` rejects unsupported app and command-schema
  versions and preserves versioned plan-approval provenance.

Additive schema work must add a new converter and current/previous fixture. It
must not relax the existing version check or silently reinterpret version 1.

## Remaining client-write inventory

| Rules path | Current caller or capability | Product reason while allowed | Removal or retention decision |
| --- | --- | --- | --- |
| `users/{userId}` | Runner setup and profile editing call `profile.save` | Save the runner's owned intake and preferences before plan review | Retain as the explicitly allowed non-material profile path; plan approval separately validates its exact versioned input |
| `users/{userId}/plans/{planId}` | Repository supports create, update/archive, and guarded delete; no current UI component calls these methods directly | Preserve the current plan persistence contract until approved-plan activation is fully available | #72 must remove direct client plan mutation permission when its command migration closes |
| `users/{userId}/plans/{planId}/workouts/{workoutId}` | Repository supports create/update/guarded delete; the live app updates status when a run is logged or deleted | Build the current plan record and keep a linked workout's completion state aligned with its run | #72 owns plan/workout creation and deletion migration; #115 owns run-linked workout status migration |
| `users/{userId}/runs/{runId}` | Track creates, edits, and deletes runs | Let a runner record and correct owned training history | #115 owns atomic completion/deletion and must also account for run editing before direct run writes are denied |
| `users/{userId}/shoes/{shoeId}` | Track creates, updates, and retires shoes | Maintain optional owned gear metadata and derived mileage; deletion is already denied | Retain the exact one-way lifecycle unless a later issue demonstrates a server-command requirement |

Repository capability is not proof of a live UI caller. The plan and workout
rows intentionally call out permissions that remain broader than current UI
use so they cannot be mistaken for a permanent least-privilege decision.

## Server-owned paths

Participant clients have no read or write access to account-deletion requests,
material-command receipts, or operator controls. They may read only their own
active-plan state, plan-generation metadata, and recommendation evidence; all
mutations remain server-only. Membership clients may get only their own record
after email verification and may never list or mutate membership.

The `operatorControls/{controlId}` wildcard is the protected home for current
recommendation activation and any later feature-control or minimum-client-
version record. The tests name all three categories explicitly; this does not
claim that a generalized remote-configuration product has been implemented.

## Pull-request CI and invitation evidence

Every pull request to `main` runs the
[`Pull request checks`](../../.github/workflows/pull-request-ci.yml) workflow.
Its `Firestore emulator tests` job installs Java 21 and runs
`npm run test:firestore`, which exercises both rulesets and the document
repository round trip. The separate `Material command emulators` job retains
the duplicate, stale-revision, cross-owner, partial-failure, and two-client
transaction evidence.

The pre-final baseline is the passing
[#469 workflow run](https://github.com/marathoner-app/marathoner/actions/runs/40426793265).
Issue #129 must link the final #470 pull-request workflow after all required
checks pass. Until that link is present, this record is evidence assembled, not
an invitation-gate pass.

Neither workflow deploys Firebase rules or authorizes beta invitations. Live
deployment remains an explicit reviewed operation with project-alias guards.
