# Recommendation evidence and activation control

Issue #449 defines the portable contracts that later recommendation persistence,
approval commands, and remote safety controls must consume. The contracts do not
enable recommendations, create a live control record, or approve any methodology
artifact.

## Recommendation evidence

`RecommendationEvidenceV2` preserves one exact material recommendation as an
immutable record:

- a server-safe recommendation identifier and evaluated plan identifier;
- the exact adaptation input and recommendation result;
- the active and evaluated plan revisions;
- the stable action, reason code, explanation key, evaluator version, base-plan
  artifact version, and adaptation artifact version;
- the exact bounded, server-owned plan adjustment that produced the proposed
  repeat, hold, or reschedule projection;
- the recommendation and decision times;
- the runner decision; and
- the resulting plan revision only when the recommendation was accepted.

The validator rejects unknown fields, malformed nested input or result shapes,
stale-plan recommendations, mismatched provenance, unsupported or malformed
adjustments, adjustment actions that disagree with the recommendation, and
incoherent decision states. Paired-week adjustments must name consecutive
weeks. Reschedule adjustments must name one valid workout and a target date
inside an exact valid plan-week range. Pending records cannot claim a decision.
Declined records cannot claim a resulting plan revision. Accepted records must
identify a strictly newer plan revision.

The exact adjustment plus the authoritative plan snapshot at the recorded
evaluated revision is sufficient to reproduce the bounded projection. The
snapshot itself remains authoritative plan data rather than duplicated
recommendation evidence. Version 2 intentionally replaces the incomplete
version 1 shape before any participant-facing recommendation activation; the
persistence boundary does not silently reinterpret a version 1 record as
current evidence.

The contract can validate internal evidence from a draft evaluator. Validation is
not activation: a structurally correct draft record still cannot be presented to
a participant or applied to a plan.

## Operator activation control

`OperatorActivationControlV1` defines one revisioned operator-owned record with
independent controls for:

- initial-plan generation;
- authored guidance; and
- adaptation.

Each capability has an enable switch and an exact allowlist of approved stable
artifact versions. The record also carries minimum app and material-command
protocol versions. Allowlisted versions cannot contain prerelease or draft
suffixes.

`evaluateActivation` applies one deterministic precedence order:

1. reject an invalid control record;
2. reject an invalid request;
3. reject a disabled capability;
4. reject a stale app protocol;
5. reject a stale command protocol;
6. reject a draft artifact;
7. reject an artifact absent from the exact approved allowlist; or
8. allow the request.

This pure decision function is deliberately independent of React, Firebase,
Functions, and browser globals. Issue #451 adds the Firestore storage and
client-deny rules described below. Issue #453 adds the first runtime enforcement
point described below. Later #120 slices still own recommendation-decision
commands and the physical-device disable and recovery rehearsal.

## Firestore persistence boundary

Recommendation evidence is stored at
`users/{uid}/recommendationEvidence/{recommendationId}`. The Admin SDK store
accepts only a valid pending record at creation. It can then record one coherent
accepted or declined decision while preserving the exact evaluated input,
result, adjustment, provenance, recommendation timestamp, plan identifier, and
evidence identifier. Replaying the same record is idempotent; a conflicting
rewrite, including a changed plan adjustment, is rejected.

The global activation record is stored at
`operatorControls/recommendationActivation`. Its Admin SDK store accepts
revision 1 only when the record is absent. Every later replacement must name the
current revision, advance exactly one revision, and use a strictly newer update
time. Reads fail closed when either persisted record is missing or malformed.

Development and beta Security Rules let an eligible owner read only their own
recommendation evidence and deny every participant-client evidence mutation.
Operator activation controls deny all direct client reads and writes. A later
server boundary may expose only the minimum availability result needed by a
participant; it must not expose an operator mutation path through the ordinary
client.

## Server command enforcement

The callable material-command boundary reads the persisted activation record at
decision time before committing a reviewed generated plan. The server derives
the activation request rather than accepting activation authority from the
client:

- capability is `generation`;
- artifact version is the exact plan-generation ruleset version already matched
  by the server-owned artifact policy;
- app protocol version comes from the parsed command envelope; and
- command protocol version is the parsed material-command envelope version.

The gate collapses missing, malformed, or unreadable control state into one
fail-closed decision. Disabled generation, stale protocols, draft artifacts,
and artifacts absent from the exact allowlist also stop the command before the
plan transaction begins. The participant receives one calm unavailable result;
logs record only the command type and outcome category, not control contents,
versions, identifiers, or request payloads.

Firebase Admin SDK writes bypass Firestore Security Rules. Therefore Security
Rules remain the client-deny boundary, while this callable guard is the
authoritative dynamic-control boundary for server-owned plan writes. A future
recommendation approval command must use the same gate before evidence or plan
mutation; the current slice does not create that command.

## Prepared decision command boundary

`recommendation.decide` version 1 defines the only participant-supplied facts a
future decision transaction may accept: the recommendation identifier, an
accepted or declined decision, and the exact evaluated plan revision the runner
saw. Ownership comes from the authenticated session. Decision time, evaluation
evidence, resulting plan revision, and every plan mutation remain server-owned.

The corresponding receipt contract makes the atomicity requirement explicit.
A declined decision has no resulting revision. An accepted decision is valid
only when it identifies a plan revision strictly newer than the evaluated one.
This prevents an evidence record from claiming acceptance when no plan change
was committed.

The callable currently recognizes and validates this command but returns
`recommendation-decisions-not-enabled` before any read or write. It does not
store a receipt, modify a plan, or change recommendation evidence. A later
implementation must commit accepted evidence, the newer plan revision, and the
receipt in one transaction; it must commit declined evidence and its receipt
together. Until that transaction, activation policy, and participant-facing UI
are complete, the command remains fail-closed.

## Immutability and ownership

Recommendation evidence becomes server-owned once persisted. Clients may submit
an approval or decline command, but they must not rewrite recommendation inputs,
results, provenance, or prior decisions.

Activation control is operator-owned. Participant clients may read only the
minimum state needed to explain availability; they must never write the control
record or treat a locally supplied artifact version as approved.

## Current safety boundary

No production allowlist is created by #449, #451, or #453. The production
artifact policy remains empty, and a missing activation record fails closed.
The current draft base-plan and adaptation artifacts remain ineligible for
participant-facing use. Qualified approval through #119 and an explicit later
activation change remain required before a stable artifact version can enter
both the reviewed policy and the operator allowlist.
