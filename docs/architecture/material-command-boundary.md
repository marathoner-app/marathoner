# Material-command boundary

- **Status:** Local boundary and emulator evidence complete; live deployment blocked
- **Decision date:** 2026-10-05
- **Owner:** Marathoner maintainer
- **Tracking issue:** [#158](https://github.com/marathoner-app/marathoner/issues/158)

## Purpose and scope

Marathoner has one authenticated, online-only command boundary for material
writes. Issue #158 proves the boundary with a harmless counter command; it does
not migrate plan approval, run completion, adaptation, consent, or deletion.
Those workflows remain in their owning issues.

The browser and server share the portable contract in
`src/domain/materialCommands/contract.ts`. It imports neither React nor
Firebase. The only supported proof envelope contains:

- envelope version `1`;
- app protocol version `1`;
- a client-generated command ID;
- command type `proof.material-command`; and
- command schema version `1`; and
- one of two fixed, non-sensitive proof variants used to exercise ID conflicts.

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

The result union distinguishes committed, validation, authentication,
unsupported-version, conflict, retryable, and outcome-unknown states. An
outcome-unknown client must call `resolveMaterialCommand` with the same command
ID before deciding whether to retry.

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
2. a request-supplied foreign user ID is rejected without an effect;
3. duplicate command IDs return the original result and one effect;
4. unsupported app and command-schema versions return typed outcomes;
5. an intentionally lost response is resolved by ID before retry; and
6. emitted application logs contain outcome metadata only.

Pull-request CI provisions Java 21 and runs the same command.

## Logging and privacy boundary

Application logs contain only the fixed event name, supported command type or
`unknown`, and result status. They never contain authentication UIDs, emails,
command IDs, request bodies, payloads, participant records, or error objects.
Firebase's local callable verifier may separately report whether Auth and App
Check tokens are missing or valid; it does not receive application payloads
from Marathoner's logger.

## Deployment ownership

This issue does not deploy a live function. `firebase.json` contains the local
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
- #115 adds atomic, revision-safe completion and adaptation commands.
- #121 removes direct client material writes after every owning workflow moves.
- #159 adds live reads, freshness, and account cache isolation.
- #138 may use the boundary on iOS only after its required workflow migrations.
- #79 applies the same ownership, idempotency, outcome-resolution, and private
  logging rules to the account-deletion request before operator completion.
