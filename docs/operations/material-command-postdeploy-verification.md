# Material-command post-deploy verification

Use this checklist after every deployment of `submitMaterialCommand` or
`resolveMaterialCommand` to development or beta. It verifies three boundaries
that a successful Firebase CLI deployment does not prove by itself:

1. HTTPS reaches Marathoner's callable authentication boundary;
2. each Cloud Run service uses the narrowly reviewed Domain Restricted Sharing
   recovery and a runtime service identity with Firestore access; and
3. one real authenticated command produced a server-owned Firestore receipt.

The build service account and runtime service identity are different. Build
permissions cannot substitute for runtime data access. The runtime identity
used by each material-command service must have `roles/datastore.user` in the
same target project. Do not grant Owner, Editor, or a broader role to make a
failed command pass.

## Domain Restricted Sharing boundary

The organization policy prevents an `allUsers` invoker binding. Do not weaken
that policy and do not add such a binding. Only the reviewed
`submitmaterialcommand` and `resolvematerialcommand` Cloud Run services use the
service annotation `run.googleapis.com/invoker-iam-disabled: true`. This lets
the HTTPS request reach Firebase's callable handler; it does not bypass
Marathoner's Firebase Authentication, App Check, membership, ownership,
artifact-policy, or revision checks.

An unauthenticated empty callable request must return HTTP 200 with the typed
result `authentication_error` / `authentication-required`. HTML 403, a proxy
error, or any other result means client testing must stop.

## Real receipt prerequisite

Before running the verifier, complete one real authenticated command from the
supported Marathoner client. Privately confirm that its owner-scoped receipt
exists in `materialCommandReceipts` and matches the client result. Do not paste
the UID, email, command ID, payload, document path, or raw receipt into a shell
command, issue, pull request, or operating log. Retain only the fixed committed
status, elapsed time, and pass/fail outcome.

Accepted receipt statuses are `plan_approved`, `run_completed`, `run_updated`,
and `run_deleted`.

## Automated checks

Run from the clean deployed commit in an authenticated Google Cloud Shell, or
on a workstation that has `gcloud` installed and authenticated as the dedicated
domain administrator:

```sh
npm run verify:functions-postdeploy -- development \
  --receipt-status plan_approved
```

For beta, use the beta environment and the fixed status from its fictional
authenticated smoke command, for example:

```sh
npm run verify:functions-postdeploy -- beta \
  --receipt-status run_completed
```

The script is pinned to `marathoner-d9bf9` and `marathonerapp-beta`. It:

- describes only the two reviewed Cloud Run services in `us-central1`;
- requires the scoped invoker-IAM-disabled annotation;
- reads each service's runtime identity without printing it;
- requires `roles/datastore.user` for that identity;
- sends an empty envelope to both callable URLs and requires the typed
  authentication rejection; and
- records only the environment and fixed receipt status.

It never accepts participant identifiers, command IDs, payloads, document
paths, tokens, or raw errors. A failed check emits a fixed diagnostic and exits
nonzero. Correct the missing prerequisite and rerun; do not broaden IAM or
organization policy.

## Safe failure diagnostics

Material-command logs contain only fixed event, command type, result status,
and, for caught persistence failures, one optional fixed classification:

| Failure class | Meaning | Operator action |
| --- | --- | --- |
| `persistence-permission-denied` | The runtime reached persistence without sufficient access | Recheck the service runtime identity and its exact `roles/datastore.user` binding |
| `persistence-transient` | Firestore reported aborted, unavailable, or resource exhaustion | Preserve idempotency, wait briefly, then resolve or retry the same command |
| `persistence-unclassified` | Persistence failed without a recognized safe code | Stop testing and inspect bounded provider telemetry privately |

No class includes the provider error message or code, UID, email, command ID,
payload, note, record, or document path. If any such value appears in an
application log, stop the rehearsal and open a private security incident.
