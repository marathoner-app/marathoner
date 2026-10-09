# Material-command boundary

- **Status:** Local proof and deletion-request boundaries complete; plan approval, run completion, and completed-run deletion are atomically persisted in emulator proof; completed-run client adapter complete; production activation and deployment blocked
- **Decision date:** 2026-10-05
- **Owner:** Marathoner maintainer
- **Proof issue:** [#158](https://github.com/marathoner-app/marathoner/issues/158)
- **Deletion-request issue:** [#195](https://github.com/marathoner-app/marathoner/issues/195)
- **Plan-approval contract issue:** [#227](https://github.com/marathoner-app/marathoner/issues/227)
- **Plan-approval client issue:** [#230](https://github.com/marathoner-app/marathoner/issues/230)
- **Plan-approval artifact-policy issue:** [#239](https://github.com/marathoner-app/marathoner/issues/239)
- **Plan-approval persistence-projection issue:** [#240](https://github.com/marathoner-app/marathoner/issues/240)
- **Plan-approval transaction issue:** [#241](https://github.com/marathoner-app/marathoner/issues/241)
- **Completed-run contract issue:** [#257](https://github.com/marathoner-app/marathoner/issues/257)
- **Completed-run projection issue:** [#258](https://github.com/marathoner-app/marathoner/issues/258)
- **Run-completion transaction issue:** [#259](https://github.com/marathoner-app/marathoner/issues/259)
- **Run-deletion transaction issue:** [#260](https://github.com/marathoner-app/marathoner/issues/260)
- **Completed-run client issue:** [#261](https://github.com/marathoner-app/marathoner/issues/261)

## Purpose and scope

Marathoner has one shared authenticated, online-only contract for material
writes. Issue #158 proves the boundary with a harmless counter command. Issue
#195 adds the first security-sensitive workflow: requesting deletion and
locking account access. Adaptation, consent, the destructive deletion runner,
and the deletion UI remain in their owning issues.
Issue #227 defines the shared plan-approval envelope and outcomes. Issue #230
adds the transport-injected, online-only client adapter without claiming that
the server transaction or participant workflow exists yet. Issue #239 makes
the authenticated handler recognize the command while rejecting every
production proposal before persistence until an exact artifact tuple is
deliberately activated. Issue #240 defines the deterministic, owned projection.
Issue #241 commits that projection through one idempotent Admin SDK transaction
without activating a production methodology artifact. Issues #257 and #258
define and project completed-run creation and deletion commands. Issue #259
routes run completion through one emulator-only Admin SDK transaction; it does
not activate a deployed client write path. Issue #260 adds the symmetric
emulator-only deletion transaction and safely reopens only the workout whose
guard identifies the deleted run. Issue #261 adds the transport-injected,
online-only completion and deletion client without switching the production
provider or mounting a participant workflow.

The browser and server share the portable contract in
`src/domain/materialCommands/contract.ts`. It imports neither React nor
Firebase. Every supported envelope contains:

- envelope version `1`;
- app protocol version `1`;
- a client-generated command ID;
- a supported command type and schema version `1`.

`proof.material-command` includes one of two fixed, non-sensitive variants used
to exercise ID conflicts. `account.request-deletion` has no payload.
`plan.approve-generated` carries the normalized generation input, the
structurally valid generated proposal, and the expected active-plan revision;
`null` means the client observed no active plan. Its canonical signature changes
when the expected revision, input, or proposal changes while ignoring object-key
order. The shared parser rejects caller-supplied UID, owner, email, path, and
project fields anywhere in an envelope.

No user, owner, or UID field is accepted anywhere in the envelope. The callable
wrapper derives ownership only from the verified Firebase Authentication
session.

## Server behavior

`submitMaterialCommand` and `resolveMaterialCommand` run in the Node 22 Firebase
Functions runtime. The proof command writes two server-only records in one
Firestore transaction:

```text
materialCommandProofs/{authenticatedUserId}
materialCommandReceipts/{authenticatedUserId}/commands/{commandId}
```

The receipt stores the command signature and exact committed result. A retry
with the same ID and signature returns that result without a second effect. The
same ID with a different supported command signature returns a conflict. Client
security rules expose neither server-only collection.

The plan-approval parser preserves the proposal's end date, reason codes, and
input/generator/ruleset/schema provenance. It validates structural consistency
only. The material-command handler now applies the server-owned artifact policy
before a plan store can be called. Issue #240 validates and projects the active
plan, complete workout set, current-plan state, and audit provenance. Issue
#241 atomically commits those records, the prior-plan retirement, and the
replayable command receipt. The empty production policy still keeps live plan
approval unavailable.

The transaction reads the owner-scoped receipt and active state before any
write. A same-signature receipt returns its original result; a different
signature conflicts. A revision mismatch returns a typed stale result without
creating a receipt or plan. A valid first approval records revision `1`; each
valid replacement increments once and archives the prior active plan. Any
failed create rolls back the plan, every workout, provenance, active state,
prior-plan update, and receipt together. Resolution by command ID recognizes
the exact plan-approval receipt through the shared receipt store.

Run completion loads only the authenticated owner's referenced workout, shoe,
uniqueness guard, and command receipt before any write. A valid planned
completion creates the run, marks the workout completed, claims the
deterministic guard, and records the exact replay receipt in one transaction.
An unplanned completion creates only the run and receipt. The same command ID
and signature returns the original run ID; changed content conflicts, and a
second command cannot claim an existing workout guard. Missing, stale,
cross-owner, rest-day, completed-workout, and retired-shoe inputs create neither
a run nor a receipt. A failed create rolls back the run, workout, guard, and
receipt together.

The Functions entry point installs this store only when
`FUNCTIONS_EMULATOR=true`. Deployed environments return a typed authorization
failure before persistence. Production activation remains blocked by the
deployment, App Check, membership, and client-migration work described below.

Run deletion reads the owner-scoped run plus the command's optional workout and
guard before applying the deletion projection. A valid associated deletion
removes the run, reopens the completed workout, removes its guard, and records
one exact replay receipt. An unplanned run deletes without touching workout
state. Missing or stale runs and cross-owner, mismatched-association, or
mismatched-guard state produce typed failures and no receipt. Same-command
replay succeeds after the run is gone because the receipt is checked first;
changed content with the same command ID conflicts. A fault injected after all
writes are staged proves that the original run, completed workout, and guard
survive together when the transaction fails.

## Plan-approval artifact policy

The server policy in `functions/src/planApprovalArtifactPolicy.ts` compares one
plan-approval command with one complete policy record. A match pins all of the
following values together:

- the server-supplied supported-scope identifier;
- plan-generation input schema version;
- generator artifact version;
- ruleset artifact version, shared by the input and proposal provenance;
- generated-plan schema version; and
- plan-generation result schema version.

Only one unambiguous record with review state `approved` can pass. Missing,
draft, ready-for-review, conditional, rejected, retired, unknown, malformed,
mismatched, and duplicate records all produce the same typed
`plan-artifact-not-approved` authorization result before a plan store is
called. A `-draft` generator or ruleset remains blocked even if a malformed
record labels it approved. Application logs record only the fixed command type
and outcome status; they never record the scope, versions, command ID, input,
proposal, authenticated owner, or policy record.

`PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY` is intentionally an empty frozen
registry. Unit tests inject one synthetic, non-draft approved tuple and a fake
plan store to prove the positive wiring without approving any real methodology.
The Functions emulator enables only that exact synthetic fixture tuple so the
transaction can be exercised end to end; deployed environments always select
the empty production registry. The supported scope is injected from the server
boundary rather than accepted in the command payload. Ownership is always the
verified Authentication UID passed separately to the store.

Activating a real tuple requires a later reviewed issue and pull request that:

1. cites the attributable approval record and exact non-draft artifact hashes;
2. adds one exact `approved` registry record for the reviewed scope;
3. derives that scope from protected server-side membership evidence;
4. runs the approved interior, boundary, unsupported, and retirement tests;
5. confirms plan persistence, App Check, beta membership, and deployment gates;
   and
6. records the release and rollback owner.

Retirement is fail-safe: remove the record or change its review state to
`retired`, verify that the same proposal returns
`plan-artifact-not-approved` before storage, and deploy that safer change
without waiting for a replacement approval. Re-enabling requires a new active
approval record; a retired decision cannot be silently reused.

The deletion endpoint creates these protected records while atomically changing
the authenticated owner's approved membership to `deletion_pending`:

```text
accountDeletionRequests/{randomRequestId}
materialCommandReceipts/{authenticatedUserId}/commands/{commandId}
betaMemberships/{authenticatedUserId}
```

It requires a verified email, a trusted `auth_time` no more than five minutes
old, an approved membership, and a verified, unconsumed App Check token. After
the transaction locks training-data access, it disables the Authentication user
and revokes refresh tokens. An Admin failure remains visible on the protected
request and a same-command retry safely attempts the Auth lock again. It never
deletes participant data or the Authentication user.

The result union distinguishes proof commits, accepted deletion requests,
replayable plan-approval, run-completion, and run-deletion receipts,
run-completion duplicate guards, and stale plan, workout, and run revisions plus
validation, authentication, authorization, unsupported-version, conflict,
retryable, and outcome-unknown states. An outcome-unknown client must resolve
the same command ID before deciding whether to retry.

## Client and offline behavior

`createMaterialCommandClient` accepts a transport and connectivity signal. A
known-offline submission returns a visible retryable result and does not call
the transport. Reconnection never replays it. Transport timeouts and malformed
responses become outcome-unknown results; the caller must resolve the command
ID explicitly.

`createPlanApprovalClient` builds that shared client around the same transport.
Its caller creates and retains the command ID, supplies the exact normalized
input and generated proposal already reviewed by the participant, and passes
the expected active-plan revision. It preserves typed approval receipts, stale
revisions, invalid proposals, authentication and authorization failures, App
Check failures, unsupported versions, ID conflicts, retryable failures, and
unknown outcomes. An unrelated material-command success or malformed response
is treated as outcome unknown, never as plan approval. Known-offline submission
is not queued, and an unknown result must be resolved with the original command
ID before any retry.

`createCompletedRunCommandClient` similarly builds canonical completion and
deletion envelopes from caller-owned command IDs and versioned application
inputs. Its operation-specific submit and resolution methods preserve exact run
receipts and applicable duplicate or stale outcomes without allowing a valid
receipt for the wrong operation to count as success. Generic validation,
authentication, authorization, App Check, beta-membership, version, ID
conflict, retryable, and outcome-unknown results remain distinguishable.
Malformed responses, unrelated command successes, active-plan stale results,
and operation-inapplicable run results become outcome unknown. Known-offline
submission or resolution never calls the transport, queues work, or replays
after reconnection; the caller must explicitly use the matching resolution
method with the original command ID.

`PlanApprovalReview` owns the participant-facing handoff from a fully reviewed
proposal to that client. Its final confirmation snapshots the exact input and
proposal, creates one command ID, disables duplicate submission, and reuses the
same command for known-safe retries. An outcome-unknown response replaces the
submit action with same-command resolution; a confirmed approval can only retry
the training-data reload, never the write. After a successful reload it calls
the supplied completion callback so the owner can reveal the persisted active
plan and next workout. Focus moves to the confirmation, failure, and success
states, while status and alert regions announce asynchronous changes.

The component accepts an injected approval client and reload callback. Its
tests use only the checked-in synthetic contract fixtures. The signed-in
production journey does not mount a generated proposal, and no fixture artifact
is imported into that journey; live use remains blocked on an approved
methodology and generator.

`firebaseMaterialCommandClient.ts` is the browser transport. It attaches the
current Firebase Authentication token through the callable SDK. Local browser
work can opt into the Functions emulator with:

```text
VITE_FIREBASE_FUNCTIONS_EMULATOR=true
```

The Vite configuration rejects that variable outside local development mode,
so production and iOS builds cannot target localhost accidentally.

## Local verification

The Firebase emulator requires Java 21 and Node 22. Run:

```bash
npm test
npm run test:material-commands
```

The emulator command builds the Functions source and starts Authentication,
Functions, and Firestore for the synthetic `demo-marathoner` project. Together,
the unit, contract, and emulator checks prove:

1. anonymous calls are rejected;
2. a request-supplied foreign user ID or deletion target is rejected without an
   effect;
3. duplicate command IDs return the original result and one effect;
4. unsupported app and command-schema versions return typed outcomes;
5. the empty production artifact policy rejects plan approval before storage;
6. a synthetic exact approved tuple alone reaches the injected plan store;
7. an intentionally lost response is resolved by ID before retry;
8. deletion requests require verified email, recent authentication, approved
   membership, and App Check;
9. an accepted request locks one owner without changing another;
10. planned and unplanned run completion return exact replayable receipts;
11. stale, retired-shoe, and cross-owner completion attempts leave no run or
    receipt;
12. a second command cannot complete one workout twice, and an intentionally
    failed completion transaction leaves no partial workout, guard, or receipt;
13. planned and unplanned run deletion replay exactly, while stale, missing,
    cross-owner, mismatched-guard, and malformed attempts preserve all records;
14. an intentionally failed deletion transaction preserves the run, completed
    workout, and guard together; and
15. emitted application logs contain outcome metadata only.

Pull-request CI provisions Java 21 and runs the same command.

## Logging and privacy boundary

Application logs contain only the fixed event name, supported command type or
`unknown`, and result status. They never contain authentication UIDs, emails,
command IDs, request bodies, payloads, participant records, or error objects.
Firebase's local callable verifier may separately report whether Auth and App
Check tokens are missing or valid; it does not receive application payloads
from Marathoner's logger.

## Deployment ownership

These issues do not deploy a live function. `firebase.json` contains the local
runtime definition, while `assert-material-command-deploy-target.mjs` has an
empty approved-project list and blocks every deployment. `firebase.beta.json`
does not define a Functions source.

A later reviewed deployment issue must deliberately name the exact project,
preserve the development/beta environment boundary, confirm billing and region,
apply the beta membership policy, enable the App Check plan owned by #161, and
replace the empty deploy allowlist. Removing the guard merely to make a deploy
command succeed is not approved.

## Follow-up migrations

- #72 moves initial-plan activation onto this boundary.
- #115 continues the atomic workflow with adaptation after the emulator-proven
  completion and deletion transactions.
- #121 removes direct client material writes after every owning workflow moves.
- #159 adds live reads, freshness, and account cache isolation.
- #138 may use the boundary on iOS only after its required workflow migrations.
- #197 implements the fixed, idempotent account-deletion runner and manifest
  verification after the #195 request lock; its live-project allowlist remains
  empty pending #124.
- #196 adds recent password reauthentication and the user-facing deletion
  experience without changing ownership or target selection.
