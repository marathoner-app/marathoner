# Training data persistence

## Decision

Marathoner uses Cloud Firestore for authenticated training data. Firebase
Authentication already supplies the user identifier, the web application already
depends on the Firebase SDK, and Firestore provides the document ownership and
typed document model this stage of the product needs.

Firestore may retain a last-known in-memory view, but offline material writes are
not part of the founding-beta promise. The current web repository sends writes
directly through the Firebase client and has not yet implemented the explicit
network gate, revision precondition, or cross-record transaction required by the
ratified contract. The accepted target and its migration gates are documented in
[`training-data-synchronization.md`](training-data-synchronization.md); issues
#72, #115, and #159 own the remaining workflow slices. Issue #158 established
the local authenticated command foundation without migrating these direct
writes or deploying a live endpoint. Until that work closes, this document
describes the current storage implementation rather than claiming the beta
integrity boundary is complete. The boundary is documented in
[`material-command-boundary.md`](material-command-boundary.md).

Components do not import Firestore. They consume typed repository interfaces
from `src/persistence/trainingRepositories.ts`. A Firestore document-store adapter
owns SDK calls, and converters translate between database documents and the
shared training domain.

The Firestore instance is created when the persistence entry point is imported,
not when Authentication starts. This keeps the Firestore SDK out of the current
application bundle until a feature actually requests training repositories.

## Ownership hierarchy

Every document is stored below the authenticated user's path:

```text
users/{userId}
  planState/active
  (runner profile fields)
  plans/{planId}
    workouts/{workoutId}
    metadata/generation
  runs/{runId}
  shoes/{shoeId}
```

Issue #241 commits the active-state and generation-metadata records with the
plan, complete workout set, prior-plan retirement, and idempotency receipt in
one Admin SDK transaction. The production artifact registry remains empty, so
this implemented path is not reachable in a live environment.

Issue #87 temporarily added one non-production proof path below the same owner:

```text
users/{userId}/mobileSpikeProofs/issue-87-shared-record
```

The proof completed and the document was deleted. Issue #178 then removed its
contract and explicit development rule; current rules deny this retired path by
default. It was never part of the production training hierarchy, and beta was
not changed. The immutable result remains in the
[mobile evidence](../../spikes/mobile/shared-record-evidence.md).

The path is the primary ownership boundary. Each training document also stores
its `userId`, allowing converters to reject a document whose data disagrees with
its path. Workouts similarly store `planId` and are rejected when it disagrees
with the parent plan path.

The complete participant-linked path inventory and trusted deletion order are
maintained in
[`account-deletion.md`](account-deletion.md). Adding a new owned store requires
updating that inventory and the deletion runner in the same change; placing a
document outside `users/{userId}` does not make it exempt from deletion.

Repositories are created for one `UserId`. Callers do not supply another user ID
to individual operations, which reduces the chance of constructing a cross-user
request.

The user document itself is the versioned runner profile. Its exact input,
conversion, application, and security contract is documented in
[`runner-profile-persistence.md`](runner-profile-persistence.md).

## Common storage rules

All documents use these conventions:

| Field or concept | Representation |
| --- | --- |
| Schema version | `schemaVersion: 1` |
| IDs | Firestore document IDs, converted to branded domain IDs |
| Ownership | User path plus a matching `userId` field |
| Creation time | Native Firestore `Timestamp` in `createdAt` |
| Update time | Native Firestore `Timestamp` in `updatedAt` |
| Scheduled dates | `YYYY-MM-DD` strings |
| Distances | Whole meters |
| Durations | Whole seconds |
| Optional fields | Omitted rather than stored as `undefined` |

The repository supplies IDs, ownership, and timestamps. Components provide only
the editable product fields.

Converters reject unknown schema versions. A future schema change must add an
explicit converter or migration rather than silently guessing how older data
should be interpreted.

## Runner profile document

Path: `users/{userId}`

The profile stores distance and time-zone preferences plus optional,
in-progress onboarding inputs. The repository derives ownership, preserves the
creation timestamp on update, and returns `null` before a runner creates a
profile. See the
[runner profile persistence contract](runner-profile-persistence.md) for the
complete version 1 field table and compatibility rules.

## Plan documents

Path: `users/{userId}/plans/{planId}`

| Field | Type |
| --- | --- |
| `schemaVersion` | `1` |
| `userId` | string |
| `name` | string |
| `startDate` | date-only string |
| `targetRaceDate` | date-only string |
| `endDate` | optional date-only string; required for generated plans and may extend through recovery |
| `completionGoal` | optional `complete_first_marathon`; required for generated plans |
| `status` | `draft`, `active`, `completed`, or `archived` |
| `createdAt` | Firestore `Timestamp` |
| `updatedAt` | Firestore `Timestamp` |

Archiving is the normal removal behavior because it preserves the runner's
history. Permanent deletion is an explicitly named repository operation. It
deletes the plan and all child workouts in the same Firestore batch so it cannot
leave orphaned workout documents. The first version limits this operation to 499
workouts because a Firestore batch supports at most 500 writes including the plan.
A plan or workout referenced by a completed run cannot be permanently deleted.

## Workout documents

Path: `users/{userId}/plans/{planId}/workouts/{workoutId}`

| Field | Type |
| --- | --- |
| `schemaVersion` | `1` |
| `userId` | string |
| `planId` | string |
| `scheduledDate` | date-only string |
| `phase` | shared `TrainingPhase` value |
| `status` | `planned`, `completed`, or `skipped` |
| `kind` | `rest`, `run`, or `walk_run` |
| `purpose` | shared `RunPurpose`, present for run workouts |
| `targetDistanceMeters` | optional whole number |
| `targetDurationSeconds` | optional whole number |
| `notes` | optional string |
| `createdAt` | Firestore `Timestamp` |
| `updatedAt` | Firestore `Timestamp` |

The repository verifies that the plan exists and validates every workout against
the plan's owner and inclusive date range before writing it. Generated plans use
`endDate` as the inclusive boundary so recovery workouts after race day remain
valid; legacy plans without it continue to use `targetRaceDate`.

## Atomic plan activation

The projection defined by issue #240 supplies two server-owned records below
the authenticated owner:

```text
users/{userId}/planState/active
users/{userId}/plans/{planId}/metadata/generation
```

The active-state record contains schema version `1`, training schema version
`1`, matching `userId`, the active plan ID, a positive active-plan revision,
and server approval/update timestamps. The provenance record contains:

- its own and the training persistence schema versions;
- matching owner and plan IDs plus the material command ID;
- envelope, app-protocol, and plan-approval command schema versions;
- input, generator, ruleset, generated-plan, and result versions;
- the exact approved supported-scope identifier and `approved` review state;
- the expected prior active-plan revision;
- plan, phase, week, and workout reason-code mappings; and
- the server approval timestamp.

`projectApprovedPlan` accepts ownership separately from the payload, validates
the envelope again, requires one exact approved policy tuple, validates the
server plan ID, positive revision, and UTC timestamp, and returns one active
plan plus only planned workouts. It preserves rest, run, walk/run, distance,
duration, phase, date-only, recovery-end, and audit values without importing a
Firebase SDK or accepting a data-store dependency. Invalid or incomplete input
therefore fails before any Firestore operation can exist. Unit tests inject
synthetic artifacts only; the production artifact registry remains empty.

`FirestorePlanApprovalStore` converts projected timestamps with the Admin SDK
and commits the plan, every workout, active state, provenance, and owner-scoped
material-command receipt in one transaction. On replacement it also verifies
and archives the previous active plan in that transaction. The submitted
expected revision must equal the stored active revision (`null` for no active
plan); otherwise the store returns a typed stale result without writing. First
activation records revision `1`, and a valid replacement increments once.

The receipt stores the canonical command signature and exact approval result.
A retry with the same command ID and signature returns that result before the
current revision is inspected. Different content under the same ID conflicts.
Resolution through the authenticated material-command endpoint returns the
same receipt. Client rules permit the owner to read active state and provenance
but deny every client mutation; material-command receipts remain unreadable and
unwritable from clients. The emulator alone enables one synthetic fixture tuple
to prove this behavior. Production continues to reject every plan proposal
before the transaction because its artifact registry is empty.

## Completed-run documents

Path: `users/{userId}/runs/{runId}`

| Field | Type |
| --- | --- |
| `schemaVersion` | `1` |
| `userId` | string |
| `plannedWorkoutPlanId` | optional string |
| `plannedWorkoutId` | optional string |
| `shoeId` | optional string |
| `startedAt` | Firestore `Timestamp` |
| `timeZone` | IANA time-zone string |
| `distanceMeters` | whole number |
| `durationSeconds` | whole number |
| `perceivedEffort` | optional shared `PerceivedEffort` value |
| `unusualPain` | optional boolean |
| `notes` | optional string |
| `createdAt` | Firestore `Timestamp` |
| `updatedAt` | Firestore `Timestamp` |

A run can be logged without a planned workout. When it does reference a
workout, both the workout ID and its parent plan ID are required because workout
documents are nested below plans. The repository verifies referenced workouts
and shoes before saving the run.

### Completed-run command projection

The server-owned projection for completed-run commands is pure: it receives a
validated command plus records loaded by trusted server code and returns the
exact run, workout, uniqueness-guard, and receipt effects for the owning
transaction. It does not perform I/O. Authentication supplies the
owner, the server supplies the run ID and audit timestamp, and client-observed
`updatedAt` values are used only as stale-write preconditions.

An associated completion reserves this deterministic document:

```text
users/{userId}/plans/{planId}/workouts/{workoutId}/completionState/current
```

The guard stores schema versions, owner, plan, workout, completed-run and
command IDs, and the server creation time. Because every command for the same
workout addresses the same document, a later transaction can reject a second
completion without a collection query. Deleting an associated run may reopen a
workout only when the loaded run, workout, and guard all identify one another;
the projected deletion removes that exact guard. Unplanned runs create no guard
and never invent a plan or workout association.

The projection rejects missing, rest-day, already-completed, stale,
cross-owner, mismatched, and retired-shoe inputs with stable material-command
results. The Functions emulator now loads those records and commits a valid
run, optional workout update, guard, and replay receipt atomically through the
Admin SDK. A forced create collision proves that no partial state survives.
The handler does not install that store in a deployed environment, and no
browser or iOS client has migrated to this command yet. Completed-run deletion
still has projection coverage only and remains owned by its next implementation
slice.

## Shoe documents

Path: `users/{userId}/shoes/{shoeId}`

| Field | Type |
| --- | --- |
| `schemaVersion` | `1` |
| `userId` | string |
| `name` | string |
| `startingDistanceMeters` | whole number |
| `status` | `active` or `retired` |
| `retiredOn` | optional date-only string |
| `createdAt` | Firestore `Timestamp` |
| `updatedAt` | Firestore `Timestamp` |

Current shoe mileage will remain derived from starting distance plus associated
run documents. No independently editable mileage total will be stored.
Shoes referenced by completed runs must be retired instead of permanently
deleted so historical runs do not lose their equipment association.

## Repository behavior

The profile, plan, workout, run, and shoe repositories provide focused load,
save, create, read, list, update, archive, retire, and delete operations using shared domain types.
They return `null` for a missing read and throw a typed `PersistenceError` for
invalid data, conflicts, unavailable storage, denied access, limits, and
unexpected failures.

Raw Firebase error messages do not cross the persistence boundary. This gives
the future UI stable error categories it can turn into calm, recoverable states.

## Security and integration

`firestore.rules` denies access by default. Profile and training-document access requires
an authenticated user whose ID matches the `userId` segment in the document
path. Creates and updates also require schema version 1 and a matching stored
`userId`; profile updates preserve the creation timestamp, and workout writes
require a `planId` matching their parent plan path.

Run the ownership and repository integration suite against the local Firestore
emulator with:

```bash
npm run test:firestore
```

The suite proves profile create/read/update ownership, anonymous and cross-user
denial, immutable profile creation timestamps, malformed-profile rejection,
owner and plan-field validation, and an end-to-end repository round trip for a
related plan, workout, shoe, and run. The Firebase emulator requires a local
Java runtime.

The separate, not-yet-deployed `firestore.beta.rules` candidate additionally
requires verified email and an administrator-created approved membership for
participant-data access. Its negative fixtures run in the same emulator check
under a distinct logical project ID. The decision and activation gate are
documented in
[`../security/firebase-beta-membership.md`](../security/firebase-beta-membership.md).

The tested rules and index configuration were deployed to the Marathoner
development Firebase project during the Foundation closeout and again for the
exact issue #87 proof path on October 2, 2026. Repeat this explicit production
operation whenever either file changes:

```bash
npx firebase deploy --project marathoner-d9bf9 --only firestore
```

This is an explicit production operation, not part of the local test command.
The predeploy guard requires the command's project ID to match the
`development` alias in `.firebaserc`. The separate beta configuration remains
undeployable until a reviewed `beta` alias exists.

Plan, Track, and Analyze integration is documented in
[`training-feature-integration.md`](training-feature-integration.md).
The target real-time, offline, conflict, and cache behavior is documented in
[`training-data-synchronization.md`](training-data-synchronization.md).
