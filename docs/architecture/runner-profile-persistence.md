# Runner profile persistence

## Decision

The current runner profile is one versioned document at
`users/{authenticatedUserId}`. It is the shared web and mobile source for the
runner's preferences and the approved inputs collected by first-marathon
onboarding. Child training records remain beneath the same user path.

The repository is created for one authenticated `UserId`; profile operations do
not accept a user ID. The document repeats that owner as `userId` so rules and
converters can reject path/data disagreement.

## Version 1 contract

Required fields:

| Field | Representation |
| --- | --- |
| `schemaVersion` | `1` |
| `userId` | Firebase Auth user ID matching the path |
| `preferredDistanceUnit` | `mile` or `kilometer` |
| `timeZone` | IANA time-zone name |
| `createdAt` | Firestore `Timestamp`, immutable after creation |
| `updatedAt` | Firestore `Timestamp` |

Optional onboarding fields:

| Field | Representation |
| --- | --- |
| `displayName` | nonblank string, at most 120 characters |
| `experienceLevel` | `not_running`, `inconsistent`, `returning`, or `consistent` |
| `targetRace` | `{ kind: "date", date }` or `{ kind: "window", startDate, endDate }` |
| `currentWeeklyDistanceMeters` | non-negative whole meters |
| `currentRunningFrequencyDaysPerWeek` | whole number from 0 through 7 |
| `longestRecentRunDistanceMeters` | non-negative whole meters |
| `recentPerformance` | date, positive whole-meter distance, and positive whole-second duration |
| `availableTrainingDays` | unique weekday values |
| `preferredLongRunDay` | weekday included in available days when both are present |
| `scheduleConstraints` | nonblank string, at most 500 characters |
| `completionGoal` | `complete_first_marathon` |

`experienceLevel` describes recent running consistency; it is not an
unreviewed beginner/intermediate/advanced score and cannot select training
rules by itself. Numeric eligibility and progression thresholds remain owned by
#70 and the qualified review in #119.

## Repository and application boundary

`UserProfileRepository` exposes only:

- `load()`, which returns the owned profile or `null`; and
- `save(input)`, which creates or replaces the editable snapshot while deriving
  the owner and preserving the original creation timestamp.

`TrainingDataProvider` loads the profile with the other authenticated data and
exposes `profile` plus `saveProfile`. React components therefore do not import
Firestore or construct user paths. Issue #67 will consume this boundary for the
onboarding experience; it does not need a second profile model.

Malformed fields, unsupported enum values, an unknown schema version, invalid
dates, or ownership disagreement become a typed `PersistenceError` with code
`invalid_data`. Missing profiles are normal and return `null`.

## Security boundary

Development rules allow only the authenticated owner to get, create, or update
the document. Beta rules additionally require verified email and an approved
beta membership. Both rule sets:

- require schema version 1 and a `userId` matching the path;
- bound the accepted field set and basic types;
- preserve `createdAt` across updates;
- deny collection listing and client deletion; and
- deny anonymous and cross-owner access.

Account deletion remains a later privileged workflow; denying ordinary client
deletion prevents a partially deleted account from losing only its profile.

## Compatibility

Version 1 readers reject unknown schema versions rather than guessing. New
optional fields may be added only with updated domain types, converters, rules,
tests, and this table. A breaking representation requires an explicit new
version and migration plan. The broader current/previous-version fixture policy
is owned by #69 and #80.

## Verification

Unit tests cover complete round trips, updates, invalid inputs, owner mismatch,
unknown schema versions, invalid enums, and invalid dates. Firestore emulator
tests cover owner create/read/update, anonymous and cross-owner denial,
immutable creation timestamps, malformed documents, undeclared fields, and
client-deletion denial in both development and beta rule sets.

Run:

```bash
npm test
npm run test:firestore
npm run lint
npm run build
```
