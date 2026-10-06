# Account-deletion operator runbook

- **Status:** Emulator-proven runner; live projects intentionally blocked
- **Implementation issue:** [#197](https://github.com/marathoner-app/marathoner/issues/197)
- **Approved design:** [Account and training-data deletion](../architecture/account-deletion.md)
- **Final rehearsal:** [#124](https://github.com/marathoner-app/marathoner/issues/124)

## Safety boundary

Account deletion is irreversible. There is no rollback that restores records
already removed. Recovery from an interruption means running the same request
ID again until its manifest verifies empty and its anonymous completion receipt
is written.

The command accepts only:

- the exact `emulator` environment;
- the synthetic `demo-marathoner` project;
- one random version-4 deletion request ID; and
- a typed confirmation containing that project and request ID.

It never accepts a UID, email address, Firestore path, wildcard, or service
account key. Ownership comes only from the protected request created by the
server boundary. The approved live-project list is empty. The command also
requires the exact local Auth and Firestore emulator endpoints, so changing the
project flag cannot redirect this implementation to development or beta.

Do not add `marathoner-d9bf9` or `marathonerapp-beta` to the runner merely to
make a command succeed. Live activation requires all of the following in a
reviewed pull request:

1. issue #124 names the private participant-record system, its deletion step,
   verification step, retention policy, and operator owner;
2. a short-lived operator identity replaces emulator credentials without a
   downloaded service-account key;
3. exact development and beta project guards and typed confirmations are
   reviewed;
4. the dated fictional development rehearsal passes; and
5. the beta release-candidate rehearsal is explicitly approved.

## Fixed deletion stages

The runner owns one manifest version and performs these stages in order:

1. validate the protected request and prove membership is not `approved`;
2. disable the Authentication user and revoke refresh tokens;
3. recursively delete `users/{uid}`, including unknown descendants;
4. recursively delete `materialCommandReceipts/{uid}` and delete
   `materialCommandProofs/{uid}`;
5. complete the declared private-record deletion adapter;
6. delete `betaMemberships/{uid}`;
7. verify every Firestore manifest root and the private adapter are empty;
8. delete the Authentication user, treating `user-not-found` as success only
   after verification; and
9. replace the protected request with an anonymous completion receipt.

Each completed stage is persisted. A failed attempt records only an allowlisted
error category, stage, attempt count, and timestamps. Reruns skip completed
stages and safely repeat any operation whose result was ambiguous. Logs contain
the random request ID, fixed stage, status, duration, and allowlisted error
category—never a UID, email, command ID, document path, record content, or raw
exception.

## Emulator command

Keep the emulators running with the repository ports before invoking the
operator command. For an accepted fictional request, use:

```bash
npm run delete-account:emulator -- run \
  --environment emulator \
  --project demo-marathoner \
  --request 11111111-1111-4111-8111-111111111111 \
  --confirm "DELETE demo-marathoner 11111111-1111-4111-8111-111111111111"
```

The normal verification path is the automated emulator suite:

```bash
npm run test:material-commands
```

It creates only fictional records, injects an interruption after every stage,
reruns the same request, proves a second owner is untouched, proves Auth is not
deleted before manifest verification, and checks the final receipt and logs for
identifiers.

## Completion receipt and cleanup

The completion receipt contains exactly schema version, manifest version,
random request ID, `completed` status, requested time, completed time, and
expiry. It contains no UID, email, command ID, error, count, or participant
content. Its expiry is 30 days after completion.

The private operating record must schedule exact-ID cleanup on or after that
date. The emulator proof uses a separate typed action:

```bash
npm run delete-account:emulator -- purge-receipt \
  --environment emulator \
  --project demo-marathoner \
  --request 11111111-1111-4111-8111-111111111111 \
  --confirm "PURGE demo-marathoner 11111111-1111-4111-8111-111111111111"
```

The command refuses early cleanup, malformed receipts, wildcard cleanup, and
collection-wide cleanup. Issue #124 must prove the dated cleanup procedure as
part of the full rehearsal before invitations open.
