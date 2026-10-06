# Plan-generation contract

## Decision

Marathoner defines plan generation as a versioned, deterministic domain
boundary before it implements any generator. Version 1 has three named
contracts:

| Contract | Version | Purpose |
| --- | --- | --- |
| `PlanGenerationInputV1` | `plan-generation-input@1` | Normalized runner context and the requested ruleset |
| `GeneratedPlanV1` | `generated-plan@1` | A proposed phase, week, and workout schedule with provenance |
| `PlanGenerationResultV1` | `plan-generation-result@1` | A generated plan, honest unsupported result, or explained invalid input |

The implementation is in
[`src/domain/training/planGeneration.ts`](../../src/domain/training/planGeneration.ts).
It imports no React, Firebase, browser, or persistence code. The responsive web
client and selected Capacitor iOS client compile the same module, so they do not
need separate plan shapes.

The portable `@marathoner/training-contract` package remains deliberately
small. The mobile architecture says to expand that package only when another
runtime consumes the contract. The server generator in issue #70 is the point
to make that move or add an equivalent shared-package consumer; this issue does
not create a second implementation in advance.

## Input boundary

The input contains only facts with a defined generation purpose:

- the input schema and requested ruleset versions;
- the desired plan start date;
- recent-running consistency, whole-meter weekly volume, frequency, and
  longest recent run;
- an exact race date or target window;
- an optional representative effort in canonical date, meter, and second
  units;
- available training days and preferred long-run day;
- optional schedule constraints;
- the completion-focused first-marathon goal; and
- whether pain or unusual symptoms were reported, not reported, or left
  unanswered.

`none_reported` is a factual response state, not medical clearance. The safety
signal does not diagnose, grade, or interpret symptoms. Issue #134 owns the
reviewed safety questions, escalation rules, wording, and access consequences.

The input intentionally excludes display name, email, authenticated user ID,
distance-display preference, time zone, form text, current step, loading state,
and other UI or ownership data. Dates are already local date-only values and
distances and durations are canonical meters and seconds. The eventual
material command derives ownership from its authenticated context rather than
accepting a user ID in the generation contract.

## Generated-plan boundary

A generated plan is a proposal, not an active persisted `TrainingPlan`. It
contains:

- one output schema version and a nonblank plan name;
- start, target-race, and end dates;
- the completion goal;
- generator, ruleset, and source-input schema provenance;
- plan-level explainable reason codes;
- consecutive phase segments over numbered weeks;
- consecutive one-to-seven-day weeks; and
- generated rest, run, or walk-run workouts with branded workout identifiers,
  a date, reason codes, and exactly one positive distance or duration target
  for non-rest work.

The contract supports an end date after race day so an approved methodology
can represent the product vision's recovery phase. The current persisted plan
schema ends at `targetRaceDate`. Issue #72 must either preserve `endDate` in an
additive schema change or explicitly prove that the approved founding-beta
output ends on race day; it must not silently discard generated recovery days.

Generated workout identifiers follow the existing `PlannedWorkoutId`
convention. A proposed plan has no persisted plan ID, owner ID, timestamps, or
active status. Those values belong to the authenticated, atomic approval
command in issue #72.

## Result boundary

`PlanGenerationResultV1` has three outcomes:

- `generated` contains a structurally valid proposed plan;
- `unsupported` contains generator and ruleset provenance plus one or more
  reason codes, but no improvised plan; and
- `invalid_input` contains one or more field-addressed, coded, actionable
  validation issues.

Reason codes are stable identifiers, not user-visible prose. Issue #70 may emit
only codes from the exact approved ruleset; issue #135 owns reviewed runner
explanations. The contract validators accept a correctly formatted draft
artifact version because they validate structure, not approval status. A
participant-facing generator must separately reject draft, unknown, retired,
conditional, or rejected artifacts as required by the methodology protocol.

## Structural validation

The validators check:

1. exact schema versions and named semantic artifact versions;
2. real calendar dates and ordered date or window boundaries;
3. canonical whole-meter and whole-second values;
4. bounded frequency, unique weekdays, and a preferred day that is available;
5. complete optional-performance triples and bounded optional constraints;
6. nonempty, unique, formatted reason codes;
7. ordered, gap-free weeks and phase coverage;
8. valid workout identity, placement, kind, purpose, and positive target;
9. unique workout identifiers within a proposal; and
10. input/result agreement for ruleset, start date, completion goal, and target
    race date or window.

These are representation and consistency rules only. They do not decide
eligibility, minimum mileage, race-horizon feasibility, phase duration,
progression, cutbacks, taper, intensity, or safety disposition. Those decisions
remain blocked on qualified review through issues #119, #70, and #134.

## Fixtures

[`planGenerationFixtures.ts`](../../src/domain/training/planGenerationFixtures.ts)
checks in three version 1 contract pairs:

1. exact-date input with a distance-target proposal;
2. target-window input with a multi-phase duration-target proposal; and
3. complete input with an honest unsupported result.

Every fixture uses `fixture-rules@1.0.0`, `fixture-generator@1.0.0`, synthetic
future dates, and `FIXTURE-*` reason codes. Their mileage, workout, phase, and
date combinations demonstrate the schema only. They are not approved training
methodology, eligibility examples, or participant recommendations.

Tests also cover invalid schema versions, reversed dates, duplicate and
conflicting availability, invalid workout identifiers, zero targets, schedule
gaps, phase disagreement, duplicate workouts, missing explanations, and
provenance mismatch.

## Downstream gates

- **#70:** implement deterministic behavior only from approved rules and make
  every produced result pass these validators.
- **#71:** render a proposal and map reason codes to approved explanations
  without treating it as active.
- **#72:** atomically persist an approved proposal with command, generator,
  ruleset, and schema versions intact.
- **#119/#120:** approve and activate exact non-draft methodology artifacts;
  structural conformance is not approval.

Run:

```bash
npm test
npm run lint
npm run build
```
