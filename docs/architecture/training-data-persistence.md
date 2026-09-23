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
ratified contract. Issues #80 and #115 own that work. Until they close, this
document describes the current storage implementation rather than claiming the
beta integrity boundary is complete.

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
  plans/{planId}
    workouts/{workoutId}
  runs/{runId}
  shoes/{shoeId}
```

The path is the primary ownership boundary. Each training document also stores
its `userId`, allowing converters to reject a document whose data disagrees with
its path. Workouts similarly store `planId` and are rejected when it disagrees
with the parent plan path.

Repositories are created for one `UserId`. Callers do not supply another user ID
to individual operations, which reduces the chance of constructing a cross-user
request.

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

## Plan documents

Path: `users/{userId}/plans/{planId}`

| Field | Type |
| --- | --- |
| `schemaVersion` | `1` |
| `userId` | string |
| `name` | string |
| `startDate` | date-only string |
| `targetRaceDate` | date-only string |
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
the plan's owner and inclusive date range before writing it.

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

The plan, workout, run, and shoe repositories provide focused create, read,
list, update, archive, retire, and delete operations using shared domain types.
They return `null` for a missing read and throw a typed `PersistenceError` for
invalid data, conflicts, unavailable storage, denied access, limits, and
unexpected failures.

Raw Firebase error messages do not cross the persistence boundary. This gives
the future UI stable error categories it can turn into calm, recoverable states.

## Security and integration

`firestore.rules` denies access by default. Training-document access requires
an authenticated user whose ID matches the `userId` segment in the document
path. Creates and updates also require schema version 1 and a matching stored
`userId`; workout writes require a `planId` matching their parent plan path.

Run the ownership and repository integration suite against the local Firestore
emulator with:

```bash
npm run test:firestore
```

The suite proves same-user access, anonymous and cross-user denial, owner and
plan-field validation, and an end-to-end repository round trip for a related
plan, workout, shoe, and run. The Firebase emulator requires a local Java
runtime.

The tested rules and index configuration were deployed to the Marathoner Firebase
project during the Foundation closeout. Repeat this explicit production operation
whenever either file changes:

```bash
npx firebase deploy --project marathoner-d9bf9 --only firestore
```

This is an explicit production operation, not part of the local test command.

Plan, Track, and Analyze integration is documented in
[`training-feature-integration.md`](training-feature-integration.md).
