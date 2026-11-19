# Firestore rules acceptance record

- **Status:** Final direct-material-write denial candidate; deployment remains a separate reviewed operation
- **Last audited:** November 14, 2026
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

Plan records, workout definitions and status transitions, completed-run
creation/editing/deletion, and provider imports now use trusted server command
boundaries. Participant clients may read their owned plan, workout, and run
records but cannot write them directly. Profile and one-way shoe lifecycle
writes remain the two explicit non-material participant write paths.

## Positive scenarios

| Scenario | Development rules | Beta rules | Retained evidence |
| --- | --- | --- | --- |
| Owner reads profile, plans, workouts, runs, and shoes | Authenticated owner passes | Verified owner with an exact approved membership passes | `firestoreRules.integration.ts` owner and repository round-trip cases; `firestoreBetaAccess.integration.ts` approved-owner cases |
| Profile create/update | Exact version 1 profile lifecycle passes, including an optional owned active default shoe | Same lifecycle plus beta access gate passes | `allows a runner to create, read, and update only their own profile`; owned/active default-shoe and atomic lifecycle cases; `enforces exact profile lifecycle and scheduling relationships` |
| Committed plan/workout reads | Authenticated owner reads server-seeded records | Verified owner with an exact approved membership reads server-seeded records | `keeps server-committed plans readable by their owner and immutable to clients`; matching development and beta workout cases |
| Committed workout and run reads | Authenticated owner reads server-seeded records; every direct mutation fails | Verified approved owner reads server-seeded records; every direct mutation fails | `denies every direct workout update after command migration`; `keeps server-committed runs readable but denies every direct write`; matching beta cases |
| Shoe create/update/retire | Exact one-way lifecycle passes; first-default creation and default retirement are atomic; delete fails | Same lifecycle plus beta access gate passes | `accepts exact shoe creation and makes retirement terminal`; default-shoe batch cases; beta exact one-way shoe lifecycle |
| Membership self-read | Not used by development rules | Verified owner may get only its own record | `allows a verified account to read only its own membership status` |

## Named negative scenarios

| Required scenario | How it fails | Retained evidence |
| --- | --- | --- |
| Cross-owner | Path ownership and stored `userId` must match the authenticated UID; beta also checks membership | Development anonymous/cross-user, plan owner-field, workout owner, run owner, and shoe owner cases; beta anonymous/cross-owner case |
| Duplicate | Duplicate profile training days fail; repeated command IDs replay one receipt; two completions for one workout cannot both commit | Profile duplicate-day rule fixture; `commits one effect and returns the original receipt for a duplicate ID`; `allows only one of two authenticated clients to complete a planned workout` |
| Rest day | A rest workout cannot contain run targets or purpose, and completed-run projection rejects a rest-workout association | Workout `run-only fields on a rest workout` rule fixture; `completedRunCommandProjection.test.ts` rest-workout case |
| Stale revision | Remaining direct profile/shoe updates require a newer `updatedAt`; material commands require the expected aggregate revision | Profile and shoe stale-update rule fixtures; material-command stale plan, completion, update, and deletion cases |
| Oversized | Writable profile, shoe, membership, and stored identifier values are bounded; material documents are rejected at the client boundary and validated by command/domain contracts | Development rule parameter cases, matching beta lifecycle cases, domain validation tests, and material-command fixtures |
| Extra field | Every remaining writable document uses `keys().hasOnly(...)`; all material client writes fail regardless of shape | Profile and shoe unknown-field fixtures; direct plan/workout/run denial fixtures |
| Unsupported version | Remaining writable documents require schema version 1; beta membership is version 1; material client writes are denied; command and artifact versions are validated | Schema-version profile/shoe fixtures; malformed beta membership fixtures; unsupported app/command version material-command case |
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
- `firestoreRules.integration.ts` rejects schema-version changes for remaining
  participant-writable records and denies every client plan/workout/run
  mutation regardless of version.
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
| `users/{userId}/plans/{planId}` | No participant write permission | Plan activation and replacement are committed atomically by the authenticated server command | Retain read-only participant access |
| `users/{userId}/plans/{planId}/workouts/{workoutId}` | No participant write permission | Completed-run commands own linked status transitions | Retain read-only participant access |
| `users/{userId}/runs/{runId}` | No participant write permission | Track and provider imports use trusted material commands | Retain read-only participant access |
| `users/{userId}/shoes/{shoeId}` | Track creates, updates, and retires shoes | Maintain optional owned gear metadata and derived mileage; deletion is already denied | Retain the exact one-way lifecycle unless a later issue demonstrates a server-command requirement |

Repository capability is not client authority. The repository implementations
remain available to trusted code and tests, while Security Rules deny every
participant material write.

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

The current development deployment candidate is retained by the passing
[#598 workflow run](https://github.com/marathoner-app/marathoner/actions/runs/40766903512),
including its
[`Firestore emulator tests` job](https://github.com/marathoner-app/marathoner/actions/runs/40766903512/job/123093360618).
This final candidate must replace that link with its passing pull-request
workflow before deployment or closure of #121.

Neither workflow deploys Firebase rules or authorizes beta invitations. Live
deployment remains an explicit reviewed operation with project-alias guards.

## Historical live development deployment evidence

Issue [#597](https://github.com/marathoner-app/marathoner/issues/597) records
the October 28, 2026 deployment of the prior rules to development only. Before
deployment, `cloud.firestore` pointed to ruleset
`65d26383-3b4d-4edf-bd5a-656af4f45013`, whose source hash
`8cfac2d94aa6e1cd931d71e85c2c601371e1286370ed0caa772073c7691bd64f`
matched repository commit `c659435258ffe7cfa28f3559445d5fe6cc6dd3ff`. That
ruleset remains the exact rollback target.

The November 14 direct-write denial candidate is not deployed by its pull
request. Development and beta deployment each require a separate exact-project
approval, source-hash check, and post-deploy read/command smoke before #121 can
close.

The reviewed candidate source hash was
`0668ba5bd897631b2ceeb1c15dc752518ee3baa445e9eb234b0b4b912374095c`.
The exact candidate passed the linked Firestore emulator job before the
project-guarded command deployed it to `marathoner-d9bf9`. The resulting live
ruleset is `c62cace2-c495-4876-8ee9-6ddf72eedff4`, and its retrieved source
hash matches the reviewed candidate exactly. The separate
`marathonerapp-beta` project was not changed.

The post-deployment owner smoke proved Email/Password authentication, the
owner-scoped profile and training-data reads, the legacy profile update that
adds `consistentRunningWeeks`, and a full reload. Reopening runner setup after
reload hydrated the saved value and preserved every prior answer. A local
emulator rerun was unavailable because this development machine has no Java
runtime; the exact candidate's required CI emulator job is the retained test
evidence rather than an unverified local substitute.
