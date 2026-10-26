# Recommendation evidence and activation control

Issue #449 defines the portable contracts that later recommendation persistence,
approval commands, and remote safety controls must consume. The contracts do not
enable recommendations, create a live control record, or approve any methodology
artifact.

## Recommendation evidence

`RecommendationEvidenceV1` preserves one exact material recommendation as an
immutable record:

- a server-safe recommendation identifier and evaluated plan identifier;
- the exact adaptation input and recommendation result;
- the active and evaluated plan revisions;
- the stable action, reason code, explanation key, evaluator version, base-plan
  artifact version, and adaptation artifact version;
- the recommendation and decision times;
- the runner decision; and
- the resulting plan revision only when the recommendation was accepted.

The validator rejects unknown fields, malformed nested input or result shapes,
stale-plan recommendations, mismatched provenance, unsupported actions, and
incoherent decision states. Pending records cannot claim a decision. Declined
records cannot claim a resulting plan revision. Accepted records must identify a
strictly newer plan revision.

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
client-deny rules described below. Later #120 slices still own runtime command
enforcement and the physical-device disable and recovery rehearsal.

## Firestore persistence boundary

Recommendation evidence is stored at
`users/{uid}/recommendationEvidence/{recommendationId}`. The Admin SDK store
accepts only a valid pending record at creation. It can then record one coherent
accepted or declined decision while preserving the exact evaluated input,
result, provenance, recommendation timestamp, plan identifier, and evidence
identifier. Replaying the same record is idempotent; a conflicting rewrite is
rejected.

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

## Immutability and ownership

Recommendation evidence becomes server-owned once persisted. Clients may submit
an approval or decline command, but they must not rewrite recommendation inputs,
results, provenance, or prior decisions.

Activation control is operator-owned. Participant clients may read only the
minimum state needed to explain availability; they must never write the control
record or treat a locally supplied artifact version as approved.

## Current safety boundary

No production allowlist or runtime adapter is created by #449 or #451. The
current draft base-plan and adaptation artifacts remain ineligible for
participant-facing use. Qualified approval through #119 and an explicit later
activation change remain required before a stable artifact version can enter
the operator allowlist.
