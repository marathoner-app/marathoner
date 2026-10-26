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

Tests load the exact pinned `beta-adaptation@0.1.0-draft` packet outside runtime
source, adapt its values into the injected rule contract, and run every frozen
fixture through the production evaluator. They additionally prove deterministic
output, one-hard-effort protection, exact and just-outside boundaries, malformed
input rejection, provenance, and approval semantics.

The draft remains unapproved and runtime-ineligible. It is not imported by
browser or Functions source and is not connected to recommendations,
persistence, guidance, plan mutation, or any signed-in product path.

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
