# Training domain model

This document defines the shared language used by Marathoner's Plan, Track, and
Analyze features. The model contains product data only. React state, open panels,
selected weeks, form text, and loading indicators remain view state and do not
belong here.

## Entities and relationships

| Entity | Purpose | Relationships |
| --- | --- | --- |
| `UserProfile` | Stores application preferences and the approved, in-progress first-marathon intake inputs. | Its `id` is the authenticated owner ID used by all other entities. |
| `TrainingPlan` | Represents one first-marathon journey over a defined date range. | Belongs to one user and owns many planned workouts. |
| `PlannedWorkout` | Describes a rest, run, or walk-run assignment on a local calendar day. | Belongs to one user and one training plan. |
| `CompletedRun` | Records what the runner actually completed. | Belongs to one user and may reference one planned workout, its parent plan, and one shoe. |
| `Shoe` | Represents a pair of shoes that can accumulate run distance. | Belongs to one user and may be referenced by many completed runs. |
| `PlanGenerationInputV1` | Normalizes only the runner context needed by a versioned generator. | Derived from approved profile and safety inputs without UI or ownership state. |
| `GeneratedPlanV1` | Represents a proposed, explained phase/week/workout schedule before approval. | Becomes persisted plan data only through the future atomic approval command. |

A user may eventually have multiple plans, but only one should be active at a
time. A completed run does not need a planned workout because runners may record
an extra, imported, or otherwise unplanned run. A run also does not require a
shoe because some data sources may not provide one.

When a completed run references a planned workout, it retains both the plan ID
and workout ID. Workouts are stored beneath plans, so this pair identifies the
workout directly without searching every plan.

## Canonical representations

| Concept | Domain representation | Reason |
| --- | --- | --- |
| Identifier | Branded string | Prevents accidentally mixing user, plan, workout, run, and shoe IDs in TypeScript. |
| Distance | Non-negative whole meters | Avoids floating-point persistence drift and supports both miles and kilometers. |
| Duration | Non-negative whole seconds | Gives runs and calculations one unambiguous time representation. |
| Pace | Seconds per selected unit, calculated when needed | Prevents persisted pace from disagreeing with distance or duration. |
| Scheduled date | `YYYY-MM-DD` date-only string | Preserves the runner's intended calendar day without a time-zone conversion. |
| Event timestamp | UTC ISO 8601 string ending in `Z` | Gives completed runs and audit timestamps a universal point in time. |
| Time zone | IANA name such as `America/Los_Angeles` | Allows a UTC run timestamp to be presented on the correct local day. |

The interface may continue accepting and displaying miles. Conversion happens at
the domain boundary. For example, 3 miles becomes 4,828 meters before it is stored.

## Training plan and workout states

A training plan moves among `draft`, `active`, `completed`, and `archived`. A
user can preserve a finished journey without leaving it active.

A planned workout is `planned`, `completed`, or `skipped`. Its training phase is
one of the five product-vision phases: learn to run, base building, marathon
training, race preparation, or recovery.

Workouts are a discriminated union:

- A rest workout has no distance or duration target.
- A run workout has a purpose and at least one positive distance or duration target.
- A walk-run workout has at least one positive distance or duration target.

This keeps rest-day data from pretending to be a zero-mile run while supporting
both distance-based and time-based training.

## Domain invariants

The validation functions enforce rules that TypeScript cannot guarantee when
data arrives from a form, network request, or database:

1. A plan's target race date cannot precede its start date.
2. A workout must belong to the same user as its plan.
3. A workout's date must fall within its plan's inclusive date range.
4. A run or walk-run workout needs a positive distance or duration target.
5. A completed run needs positive distance and duration values.
6. An entity's update timestamp cannot precede its creation timestamp.
7. A retired shoe has a retirement date, while an active shoe does not.
8. Text fields that are present cannot contain only whitespace.
9. Profile race windows cannot end before they begin, running frequency is a
   whole number from zero through seven, recent-performance values are
   positive, and the preferred long-run day must be available.

Future persistence code must also ensure that every referenced entity belongs to
the authenticated user. Database security rules remain the final authority for
cross-user access.

Plan-generation input, output, provenance, results, and structural invariants
are defined separately in the
[plan-generation contract](plan-generation-contract.md). Contract validation
does not approve training methodology or activate a plan.

## Calculated data

Pace, total run distance, and shoe mileage are calculated from canonical source
records. A shoe stores only its starting distance, which supports shoes already
in use when they are added. Its current mileage is that starting distance plus
the distances of completed runs associated with it.

These totals should not be persisted as independently editable values. Doing so
would create two competing sources of truth.

## Example flow

1. Onboarding creates or updates the owned user profile through the shared
   repository boundary.
2. Approved plan generation creates planned workouts linked to that plan.
3. Finishing a workout creates a completed run that optionally links to the
   planned workout and selected shoe.
4. Plan and Track read the same records, while Analyze derives totals and pace
   from completed runs.
5. The persistence layer introduced after this issue converts these domain
   values to and from database records without exposing Firebase to components.
