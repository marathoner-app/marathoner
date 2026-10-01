# Founding-beta Firebase membership boundary

- **Status:** Live beta project provisioned; reviewed rules deployment pending
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

## Revocation

Deleting the membership or changing its status from `approved` immediately
denies subsequent participant-data requests because the rules read membership
state for each protected request. Revoking membership does not delete an Auth
account or participant records; the complete suspension, deletion, audit, and
communication procedures remain owned by #124 and #121.

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
absent, pending, malformed, cross-owner, and client membership-mutation denial.
It deliberately preserves the current training-write schema checks. Broader
field bounds, immutable metadata, revision checks, and server-only material
writes remain in #121 after their command migrations.

## Live activation gate

Do not deploy this ruleset until the reviewed project alias and public client
configuration merge. Activation also requires:

1. a dedicated operator procedure for approving and revoking membership;
2. live approved and unapproved account checks against non-participant fixture
   data; and
3. the remaining App Check, support, incident, deletion, and command-boundary
   gates owned by #161, #124, #121, and #158.
