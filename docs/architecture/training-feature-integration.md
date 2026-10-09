# Training feature integration

## Purpose

Plan, Track, and Analyze use one authenticated training-data state. The state is
loaded through the typed repositories introduced by issue #12 and remains above
the individual feature panels, so closing one panel does not discard data.

`TrainingDataProvider` owns repository access and cross-feature mutations.
Calendar, ShoeTracker, and Analyze receive domain records and callbacks as
props. This keeps the views testable without Firebase and prevents components
from constructing database paths.

## Loading and ownership

The provider is created only for a signed-in Firebase user. It converts the
Firebase UID to the shared `UserId`, dynamically loads the Firestore repository,
then loads plans, workouts, completed runs, and shoes for that owner.

Dynamic loading keeps the Firestore persistence chunk out of the initial
signed-out application bundle. A failed load produces a recoverable error with
a retry action. Signing out unmounts the provider and clears the in-memory
training snapshot.

## Plan behavior

The Plan panel chooses the active plan first, then a draft plan, then the first
non-archived plan. It renders persisted workouts in calendar weeks beginning on
the plan start date.

An account without a plan receives an explicit empty state. Marathoner does not
silently recreate the old repeated sample schedule. Personalized plan creation
remains tracked by issue #29.

## Completion rules

- An unplanned run has no workout association. It still contributes to all run,
  pace, mileage, and shoe calculations.
- A run can be associated only with a run or walk/run workout that is still
  planned. Rest days cannot receive run completion records.
- Creating an associated run changes the planned workout status to `completed`.
  The completed run is the explicit record of what actually happened.
- A run shorter or longer than its target still completes the workout. Actual
  distance and duration remain visible in the run record instead of rewriting
  the original target.
- The current interaction allows one completion record per planned workout.
- If completion-status persistence fails after creating a run, the provider
  deletes that run so the two records do not visibly disagree.

## Edit and deletion rules

Editing a run's local completion date, distance, duration, or shoe association
updates the completed run. A date correction keeps any planned-workout
association intact and weekly analytics are derived again from the corrected
local date. Every other dependent value is also derived from the updated run
collection; there is no separately incremented analytics or shoe-mileage total
to drift. Completed-run dates must be real calendar dates and cannot be in the
future in the run's stored time zone.

Deleting an unplanned run removes it from every calculation. Deleting the only
completion record associated with a workout changes that workout back to
`planned`. If deletion fails after reopening the workout, the provider restores
the completed status as a compensating operation.

## Analytics definitions

| Value | Definition |
| --- | --- |
| Total mileage | Sum of every completed-run distance. |
| Weekly mileage | Sum of completed runs whose local run date falls in the current Monday-through-Sunday week. |
| Average pace | Total duration divided by total distance across all completed runs. |
| Total runs | Number of completed-run records. |
| Runs this week | Number of completed runs in the current Monday-through-Sunday week. |
| Shoe mileage | Shoe starting distance plus distances from completed runs associated with that shoe. |

The run's stored IANA time zone determines its local calendar date. Empty data
shows zero totals and an explicit not-enough-data pace rather than demonstration
values.

## Current boundary

The provider loads a snapshot when the authenticated experience starts and when
the user chooses retry. Mutations update both Firestore and that shared snapshot.
It does not yet provide real-time listeners, freshness states, atomic material
commands, or cross-device live refresh; a new session or page refresh reloads
the persisted records. The accepted target behavior and ordered migration are
documented in
[`training-data-synchronization.md`](training-data-synchronization.md).
