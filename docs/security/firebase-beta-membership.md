# Founding-beta Firebase membership boundary

- **Status:** Deployed and verified with self-cleaning fictional live fixtures
- **Tracking issue:** [#166](https://github.com/marathoner-app/marathoner/issues/166)
- **Activation issue:** [#168](https://github.com/marathoner-app/marathoner/issues/168)
- **Parent:** [#125](https://github.com/marathoner-app/marathoner/issues/125)
- **Broader rules hardening:** [#121](https://github.com/marathoner-app/marathoner/issues/121)

## Decision

An authenticated Firebase account is not sufficient for founding-beta access.
Every participant-data read or currently allowed write must also satisfy all of
these conditions:

1. the account UID owns the `/users/{userId}` path;
2. the Firebase ID token reports a verified email; and
3. `/betaMemberships/{userId}` contains a valid, approved membership record.

This makes accidental account creation non-authoritative. An account without an
operator-created membership cannot access participant training data.

## Membership record

An approved membership has exactly these fields:

| Field | Required value |
| --- | --- |
| `schemaVersion` | `1` |
| `userId` | The document ID and authenticated participant UID |
| `status` | `approved` |
| `approvedAt` | Firestore `Timestamp` |
| `approvedBy` | A non-empty operator identifier of at most 128 characters |

The public repository contains only fictional fixture identities. Participant
UIDs, emails, invitations, and membership records belong in the approved beta
project and private operating records.

Clients may directly read only their own membership document after email
verification. All client create, update, list, and delete operations on the
membership collection are denied. A dedicated operator workflow must create
memberships with privileged server or console authority; participant clients
must never receive that authority.

The deletion-request boundary introduced by issue #195 is the only currently
implemented server transition from `approved` to `deletion_pending`. It derives
the membership document from the verified Authentication UID and changes only
the status field in the same transaction that creates the protected deletion
request and idempotency receipt. `deletion_pending` is deliberately not an
approved membership state: it blocks all subsequent participant-training-data
access while preserving the approval evidence needed by the operator runner.
Clients cannot create, select, or reverse that state.

## Revocation

Deleting the membership or changing its status from `approved` immediately
denies subsequent participant-data requests because the rules read membership
state for each protected request. An accepted deletion request atomically sets
`deletion_pending`, then the trusted handler disables the Authentication user
and revokes refresh tokens. The local boundary does not delete participant
records or the Authentication user; the fixed runner, audit, communication,
and rehearsal remain owned by #197 and #124.

## Operator approval and revocation procedure

Until a reviewed server-side membership command replaces it, only the dedicated
beta administrator may change membership through privileged console or operator
authority. A participant client must never receive that authority.

For approval, the operator must:

1. confirm the invitation and verified-email state against the private cohort
   record;
2. create `/betaMemberships/{uid}` with exactly the five fields documented
   above;
3. record the approver and approval time in the private operating log; and
4. confirm that the participant can read its own membership without exposing
   another user's path.

For revocation, the operator deletes the membership or changes its status away
from `approved`, records the reason privately, and verifies that a subsequent
training-data request is denied. Account disabling, participant-data retention
or deletion, and participant communication follow #124 and #121; membership
revocation alone does not perform those actions.

## Rules and test isolation

- `firestore.rules` remains the deployed development/prototype ruleset.
- `firestore.beta.rules` is the pre-deployment beta candidate.
- `firebase.json` points to development rules, while `firebase.beta.json`
  points to beta rules.
- Each configuration runs a predeploy guard against the exact project alias in
  `.firebaserc`. Development maps only to `marathoner-d9bf9`, while beta maps
  only to `marathonerapp-beta`; either ruleset is blocked from every other
  project.
- The emulator permits multiple logical project IDs so the development and
  beta suites run together without sharing data or rules.

The beta suite covers approved verified access plus anonymous, unverified,
absent, pending, deletion-pending, malformed, cross-owner, and client
membership-mutation denial. It also proves that protected deletion requests
cannot be read or written through a participant client. It deliberately
preserves the current training-write schema checks. Broader field bounds,
immutable metadata, revision checks, and server-only material writes remain in
#121 after their command migrations.

## Live verification evidence

The reviewed alias and public configuration merged before the rules were
deployed to `marathonerapp-beta` on October 1, 2026. The guarded live verifier
then proved:

1. approved verified owner's membership and training reads and training writes
   succeed;
2. anonymous, unverified, unapproved, cross-owner, and client membership
   mutation requests fail;
3. deleting membership denies the next training read without waiting for an ID
   token refresh; and
4. all fictional Auth accounts and Firestore records are removed afterward.

The exact command, HTTP outcomes, cleanup guarantee, project controls, and
quota procedure are recorded in
[the founding-beta project record](firebase-beta-project.md). App Check,
support, incident response, deletion completion, command deployment, and
workflow migration remain owned by #161, #124, #197, #121, #72, and #115. The
local #158 and #195 boundaries do not bypass those invitation gates.
