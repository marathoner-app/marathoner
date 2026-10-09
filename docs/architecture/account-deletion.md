# Account and training-data deletion

- **Status:** Local request/account-lock, deletion runner, and shared client experience complete; private-store activation, live deployment, and rehearsal remain open
- **Decision date:** 2026-10-05
- **Decision owner:** Marathoner maintainer
- **Tracking issue:** [#79](https://github.com/marathoner-app/marathoner/issues/79)
- **Request implementation:** [#195](https://github.com/marathoner-app/marathoner/issues/195)
- **Deletion runner:** [#197](https://github.com/marathoner-app/marathoner/issues/197)
- **Client experience:** [#196](https://github.com/marathoner-app/marathoner/issues/196)
- **Readiness rehearsal:** [#124](https://github.com/marathoner-app/marathoner/issues/124)

## Decision

Marathoner will use a recently authenticated, server-confirmed deletion request
followed by a fixed, idempotent operator deletion runner. The request locks the
account immediately. The operator must complete and verify deletion within seven
calendar days.

This is deliberately not a client-side recursive delete and not a generalized,
fully automatic deletion service. The founding cohort is small enough for a
rehearsed operator procedure, but the security-sensitive request, access lock,
and deletion authority still require trusted server code.

Issue #195 implements the request contract, protected request and receipt,
immediate membership lock, and Authentication disable/revocation locally.
Issue #197 implements the fixed deletion runner, manifest verification,
failure recovery, anonymized receipt, and exact-ID expiry cleanup against the
emulators. Issue #196 implements the shared responsive account-settings flow,
recent password authentication, original-command resolution, pending receipt,
and immediate client-state clearing for web and the Capacitor bundle. These
changes do not deploy a Firebase Function, change billing, or authorize
deletion against a live project. Private-store activation, live activation
gates, and issue #124 rehearsal must all pass before Marathoner can claim
complete in-product account deletion.

## Why a backend is required

The Firebase web client cannot safely complete this workflow:

- deleting a Firestore document does not delete its subcollections;
- collection deletion is not atomic and can stop after partial progress;
- the client is intentionally forbidden from deleting its profile or beta
  membership;
- Firebase Authentication and Firestore deletion must be ordered and verified;
- current and future server-only command records are invisible to clients; and
- accepting a user ID or Firestore path from the caller would create a
  cross-account deletion risk.

Firebase recommends deleting collections from a trusted server environment and
documents that recursive deletion is non-atomic. Firebase also requires the
Blaze plan to deploy Cloud Functions. Therefore the beta project must have an
explicitly approved billing account, budget alerts, spend controls, deployment
boundary, and rollback owner before the request endpoint can go live. The
repository now has an exact-beta-project guard, but its operator-intent check
keeps deployment blocked until #143 and #204 are complete and #205 authorizes
the first live release.

## Data inventory

The deletion manifest is the canonical inventory of participant-linked data.
Every change that adds an owned or participant-linked store must update this
table and the deletion runner in the same pull request.

| System and path | Current content | Deletion action |
| --- | --- | --- |
| Firebase Authentication user keyed by `uid` | Email, provider metadata, verification state, and account status | Disable and revoke sessions when the request is accepted; delete only after every owned record is verified absent. |
| `users/{uid}` | Runner profile and onboarding context | Recursively delete the document and every descendant. |
| `users/{uid}/plans/{planId}` | Training plans | Covered by recursive deletion of `users/{uid}`. |
| `users/{uid}/plans/{planId}/workouts/{workoutId}` | Planned workouts | Covered by recursive deletion of `users/{uid}`. |
| `users/{uid}/plans/{planId}/metadata/generation` | Server-owned plan-generation versions, approved scope, command ID, and audit reason codes | Covered by recursive deletion of `users/{uid}`. |
| `users/{uid}/planState/active` | Server-owned current plan ID, revision, and approval timestamps | Covered by recursive deletion of `users/{uid}`. |
| `users/{uid}/runs/{runId}` | Completed runs and feedback | Covered by recursive deletion of `users/{uid}`. |
| `users/{uid}/shoes/{shoeId}` | Shoe records | Covered by recursive deletion of `users/{uid}`. |
| `betaMemberships/{uid}` | Allowlist status and approval metadata | Change to `deletion_pending` to lock access, then delete during completion. |
| `materialCommandReceipts/{uid}/commands/{commandId}` | Server idempotency receipts for proof, deletion-request, and plan-approval commands | Recursively delete the owner document path and descendants. This store is implemented and emulator-tested but not deployed. |
| `materialCommandProofs/{uid}` | Local server-boundary proof state | Delete. This store is currently local proof infrastructure, not deployed. |
| `accountDeletionRequests/{requestId}` | Server-only workflow state, including the UID only while work is pending; implemented locally and not deployed | Remove all identity fields after completion, retain the anonymous completion receipt for 30 days, then delete it. |
| Current client memory | Current-session authentication and training state | Clear immediately when the request is accepted; persistent participant-data caching remains prohibited. |

The retired `users/{uid}/mobileSpikeProofs/issue-87-shared-record` path is not a
current data store. The proof document was deleted and its explicit rule was
removed. Recursive deletion of the user tree would nevertheless remove any
unexpected descendant left below that owner.

Manifest version `1` remains valid for plan activation because no deletion root
changed: active state and generation provenance are descendants of the already
recursive `users/{uid}` root, and plan-approval receipts are descendants of the
already recursive `materialCommandReceipts/{uid}` root. Emulator fixtures seed
all three exact paths and verify owner deletion and cross-owner preservation.

Marathoner currently has no Cloud Storage participant objects, analytics event
store, app-managed export, or app-managed backup. Issue #124 may add a
proportionate backup and restore procedure; it must update this inventory and
define how deletion reaches backups before invitations open.

The commercial-research boundary selects a restricted, organization-controlled
Google Workspace account in the
[research operations runbook](../operations/commercial-research-operations.md).
The organization now has an owner-only research root and active Drive storage;
its October 6 synthetic withdrawal rehearsal passed and is recorded in the
[research evidence](../operations/evidence/2026-10-06-commercial-research-withdrawal-rehearsal.md).
That operational boundary does not silently activate the live-product adapter:
issue #124 must incorporate every applicable Workspace record, its owner,
retention period, and verified deletion step into the complete participant
manifest. Complete product deletion cannot be rehearsed or promised while that
adapter and its live-system rehearsal remain absent.

## Request contract

Deletion initiation is a material, online-only command available from the
supported web and Capacitor iOS surfaces.

1. The signed-in runner opens account settings and reviews the deletion scope.
2. Because email/password is the only enabled sign-in provider, the runner
   re-enters their password with Firebase `reauthenticateWithCredential`.
3. The client force-refreshes the ID token and submits a client-generated
   command ID. It sends no UID, email address, document path, or project ID.
4. The callable endpoint verifies Authentication, verified email, approved beta
   membership, App Check, supported contract versions, and an `auth_time` no
   more than five minutes old. The endpoint derives the owner only from the
   verified token.
5. In one Firestore transaction, the endpoint creates or resolves the deletion
   request and changes the membership from `approved` to `deletion_pending`.
   Retrying the same command ID returns the same request ID.
6. The endpoint disables the Authentication user and revokes refresh tokens.
   If either action fails, the locked request remains observable and retryable;
   the membership lock already denies beta training-data access.
7. The response gives the runner a non-identifying request ID, the seven-day
   completion commitment, and the private support path. The client clears all
   participant state and signs out.

The five-minute server check is mandatory even though the client reauthenticates.
Firebase ID tokens include the trusted `auth_time` claim, and Firebase uses a
five-minute check as its documented example for a recent sign-in boundary. A
freshly issued token without a recent `auth_time` does not pass.

The deletion endpoint is the one exception that may resolve an already-created
request after the membership becomes `deletion_pending`. It may only return the
request created for the authenticated token owner; it cannot create a new target
or unlock access.

## Confirmation experience

The confirmation must be explicit without using alarming or manipulative copy.
The final screen states:

- the account, profile, plans, workouts, runs, shoes, and beta access will be
  permanently deleted;
- access stops as soon as the request is accepted;
- completion may take up to seven calendar days;
- the action cannot be undone; and
- the runner may contact the private support address with the request ID.

The runner must re-enter their password and activate a final button labeled
**Permanently delete my Marathoner account**. A generic **Confirm** or
icon-only control is insufficient. The destructive button is visually distinct,
keyboard reachable, screen-reader named, and disabled while the request is in
flight. A lost or ambiguous response resolves the original command ID before a
second submission is offered.

After acceptance, the client shows a copyable request ID and completion date,
then signs out. The interface must not say that deletion is complete merely
because the request was accepted.

## Operator deletion runner

The runner is a repository-owned Admin SDK command, not a console checklist of
ad hoc clicks. It accepts an exact environment and deletion request ID; it never
accepts a UID, email address, arbitrary Firestore path, or wildcard. The beta
command requires an explicit typed confirmation containing the project ID and
request ID. Credentials come from the operator's short-lived Google identity;
no service-account key is committed or copied into the repository.

The fixed stages are:

| Stage | Required operation and evidence |
| --- | --- |
| 1. Validate | Load the protected request by random request ID, confirm its project and supported manifest version, and prove its membership is no longer `approved`. |
| 2. Lock | Re-disable the Authentication user and revoke refresh tokens. This is idempotent and closes a partial failure from request acceptance. |
| 3. Delete user tree | Recursively delete the exact `users/{uid}` document so known and unexpected descendant subcollections are removed. |
| 4. Delete server records | Recursively delete `materialCommandReceipts/{uid}` and delete `materialCommandProofs/{uid}`. |
| 5. Delete declared private records | Complete every participant-linked external-system step registered by issue #124 and record only pass/fail against the request ID. |
| 6. Remove membership | Delete `betaMemberships/{uid}`. Missing membership is success on a retry. |
| 7. Verify | Query every manifest path and require zero owned records. Verify the user tree has no descendant collections. Stop before Authentication deletion on any non-zero result. |
| 8. Delete Authentication | Delete the Firebase Authentication user. `user-not-found` is success on a retry after all data checks pass. |
| 9. Anonymize receipt | Replace the pending request with an anonymous receipt containing only schema version, random request ID, status, requested/completed times, manifest version, and expiry. Remove UID, email, command ID, errors, and counts. |

The anonymous receipt expires after 30 days. It exists only to answer a
completion dispute using the request ID the runner received. It is not joined
to an account, cohort roster, or participant metrics. Its cleanup must be
automated or included in a dated operator check and tested before beta.

The implementation and exact command boundary are documented in the
[account-deletion operator runbook](../operations/account-deletion-runbook.md).
Its live-project allowlist remains empty until #124 supplies the private-record
adapter and the complete development and beta rehearsals pass.

## Failure recovery and observability

Deletion is irreversible and non-atomic. Recovery means safely completing the
same request, not restoring already deleted records.

| Failure | Required behavior |
| --- | --- |
| Before the lock transaction commits | Return a typed failure; no request is acknowledged and no records are deleted. |
| After access is locked but before deletion completes | Keep the account disabled and membership non-approved. Record the safe stage and retryable error code in the protected request. |
| During recursive Firestore deletion | Leave the request pending or failed. Rerunning the same request treats missing documents as success and continues. |
| Authentication deletion fails | Keep the data-absence evidence and retry Authentication deletion. Never recreate participant data. |
| Authentication is deleted before receipt anonymization | A retry treats `user-not-found` as success and removes identity fields from the request. |
| Client loses the acceptance response | Resolve the original command ID. Never create a second request merely because the response was ambiguous. |
| Seven-day service level is at risk | Escalate through the incident procedure and pause new invitations until the queue is healthy. |

The protected request records `status`, `stage`, `attemptCount`, timestamps,
manifest version, and an allowlisted error code. Application logs contain the
random request ID, stage, status, duration, and error category only. They never
contain UID, email, request payload, participant data, raw exceptions, or
document contents. The operator view must show every request that is not
anonymized as completed.

## Deleted and retained information

Completion means all active app-controlled records in the manifest and the
Firebase Authentication user are gone. Marathoner retains only the anonymous
30-day completion receipt described above and aggregate product measures that
cannot reasonably identify a participant. The deletion workflow does not turn
individual records into analytics or research data before deleting them.

Cloud-provider security logs, abuse controls, and provider-managed recovery
copies are not represented as instantly physically erased. Before invitations,
the participant notice must link the applicable Firebase/Google retention terms
and state any app-managed backup expiry chosen by issue #124. Marathoner must not
promise a shorter physical-erasure period than its providers and backup design
can support.

Support correspondence, consent evidence, and research notes are neither
silently retained nor silently covered by this app-data procedure. Their future
private system must state its own required retention and deletion outcome in
the manifest and participant notice.

## Required tests and rehearsal

The implementation is not complete until automated emulator or integration
tests prove:

1. anonymous, stale-authentication, unverified-email, unapproved-membership,
   missing-App-Check, and unsupported-version requests are rejected;
2. request fields such as `userId`, `email`, `path`, or `projectId` are rejected;
3. ownership always comes from the authenticated token and a malicious request
   cannot change or delete a second user's records;
4. one command ID produces one request and an ambiguous response resolves to
   that request;
5. accepting a request changes membership access to denied before any delete;
6. the runner removes the profile, plans, nested workouts, runs, shoes, command
   records, membership, Authentication user, and an unexpected descendant
   canary below `users/{uid}`;
7. injected failure after each stage leaves an observable request and a rerun
   reaches the same completed state;
8. Authentication is never deleted before the manifest verifies empty;
9. the completion receipt contains no UID, email, command ID, record counts, or
   participant content; and
10. logs and test artifacts contain no participant identifiers or data.

Issue #124 then runs a dated development rehearsal using fictional records,
followed by a beta release-candidate rehearsal. Evidence records the request ID,
manifest version, start and completion times, stage results, service-level
result, and corrective issues without publishing the test account's identity or
data.

## Dependencies and implementation split

The accepted design is split into focused child issues in this order:

1. **#195 — implement the deletion-request contract and account lock.** The
   shared payload-free command, callable handler, five-minute authentication
   check, protected request schema, atomic membership transition, App Check
   gate, Auth disable/revocation, and local tests are complete. Live deployment
   remains blocked by #161, #121 coordination, unresolved #143 and #204 gates,
   and #205 authorization. The beta-only Blaze and budget boundary is verified
   in #201 but does not itself authorize deployment.
2. **#197 — implement the idempotent deletion runner and manifest tests.** The
   fixed-path Admin command, stage checkpoints, failure injection, recursive
   verification, anonymized receipt, exact-ID cleanup, and operator runbook are
   complete against fictional emulator records. Live projects remain blocked
   until #124 supplies the declared private-record adapter and rehearsal.
3. **#196 — add the calm account-deletion experience.** The shared responsive UI,
   password reauthentication and token refresh, typed outcomes,
   original-command resolution, immediate state clearing, accessibility
   coverage, and accurate participant copy are implemented. The Capacitor
   shell builds and synchronizes the same root interface; live acceptance
   remains gated by #161 and the deployment controls above.
4. **Rehearse the complete procedure in #124.** Name the private participant
   system, include its records in the manifest, run the development and beta
   rehearsals, and record the invitation-gate result.

Issues #121 and #159 remain relevant: command endpoints must honor the deletion
lock, and every client must clear memory and detach listeners on sign-out or
account change. External invitations remain blocked until every child and #124
are complete.

## Platform references

- [Firebase: manage users and recent reauthentication](https://firebase.google.com/docs/auth/web/manage-users)
- [Firebase: verify ID tokens and the `auth_time` claim](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase: five-minute recent-sign-in example](https://firebase.google.com/docs/auth/admin/manage-cookies)
- [Firebase: delete Firestore data and subcollections](https://firebase.google.com/docs/firestore/manage-data/delete-data)
- [Firebase: recursive deletion is trusted-server and non-atomic work](https://firebase.google.com/docs/firestore/solutions/delete-collections)
- [Firebase: Functions deployment requires the Blaze plan](https://firebase.google.com/docs/functions/get-started)
