# Material-command boundary

- **Status:** Local proof and deletion-request boundaries complete; plan-approval contract defined; live plan handler and deployment blocked
- **Decision date:** 2026-10-05
- **Owner:** Marathoner maintainer
- **Proof issue:** [#158](https://github.com/marathoner-app/marathoner/issues/158)
- **Deletion-request issue:** [#195](https://github.com/marathoner-app/marathoner/issues/195)
- **Plan-approval contract issue:** [#227](https://github.com/marathoner-app/marathoner/issues/227)

## Purpose and scope

Marathoner has one shared authenticated, online-only contract for material
writes. Issue #158 proves the boundary with a harmless counter command. Issue
#195 adds the first security-sensitive workflow: requesting deletion and
locking account access. Plan approval, run completion, adaptation, consent, the
destructive deletion runner, and the deletion UI remain in their owning issues.
Issue #227 defines the shared plan-approval envelope and outcomes without
claiming that its server transaction, client adapter, or participant workflow
exists yet.

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
only. The live handler owned by #72 must still reject draft, unknown, retired,
conditional, or rejected methodology artifacts before committing anything.
Until that handler exists, the generic proof endpoint does not execute plan
approval commands.

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

The result union distinguishes proof commits, accepted deletion requests, a
replayable plan-approval receipt, and stale active-plan revisions plus
validation, authentication, authorization, unsupported-version, conflict,
retryable, and outcome-unknown states. An outcome-unknown client must resolve
the same command ID before deciding whether to retry.

## Client and offline behavior

`createMaterialCommandClient` accepts a transport and connectivity signal. A
known-offline submission returns a visible retryable result and does not call
the transport. Reconnection never replays it. Transport timeouts and malformed
responses become outcome-unknown results; the caller must resolve the command
ID explicitly.

`firebaseMaterialCommandClient.ts` is the browser transport. It attaches the
current Firebase Authentication token through the callable SDK. Local browser
work can opt into the Functions emulator with:

```text
VITE_FIREBASE_FUNCTIONS_EMULATOR=true
```

The Vite configuration rejects that variable outside local development mode,
so production and iOS builds cannot target localhost accidentally. No
proof-command UI ships in this issue.

## Local verification

The Firebase emulator requires Java 21 and Node 22. Run:

```bash
npm run test:material-commands
```

The command builds the Functions source, starts Authentication, Functions, and
Firestore emulators for the synthetic `demo-marathoner` project, and proves:

1. anonymous calls are rejected;
2. a request-supplied foreign user ID or deletion target is rejected without an
   effect;
3. duplicate command IDs return the original result and one effect;
4. unsupported app and command-schema versions return typed outcomes;
5. an intentionally lost response is resolved by ID before retry;
6. deletion requests require verified email, recent authentication, approved
   membership, and App Check;
7. an accepted request locks one owner without changing another; and
8. emitted application logs contain outcome metadata only.

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
- #230 adds the plan-approval client adapter without bypassing #72's server gate.
- #115 adds atomic, revision-safe completion and adaptation commands.
- #121 removes direct client material writes after every owning workflow moves.
- #159 adds live reads, freshness, and account cache isolation.
- #138 may use the boundary on iOS only after its required workflow migrations.
- #197 implements the fixed, idempotent account-deletion runner and manifest
  verification after the #195 request lock; its live-project allowlist remains
  empty pending #124.
- #196 adds recent password reauthentication and the user-facing deletion
  experience without changing ownership or target selection.
