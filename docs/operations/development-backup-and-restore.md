# Development backup and restore rehearsal

- **Status:** Development-only operator implemented; dated live-development
  rehearsal remains part of [#124](https://github.com/marathoner-app/marathoner/issues/124)
- **Owner:** Kevin Tulloch
- **Project boundary:** `marathoner-d9bf9` only
- **Operator login:** `kevin-admin@marathonerapp.com`

## Purpose and limits

This procedure proves that Marathoner can export and restore representative
runner training history without granting an operator a generic Firestore copy
command. It is an incident-recovery rehearsal, not a participant data-download
feature and not a way to reverse an account-deletion request. Account deletion
remains irreversible.

The command refuses the beta project and every unknown project. Restore and
cleanup accept only a distinct, verified development Authentication account
whose email matches `backup-restore-*@marathonerapp.com`. The destination owner
tree must be empty. Every local snapshot and restore manifest must be an
ignored `*.local` file inside the repository and is created with owner-only
permissions.

Do not copy a snapshot into GitHub, an issue, email, chat, or an unrestricted
folder. Delete it after the private rehearsal record has captured only the
date, counts, digest, result, and corrective issue references.

## Included and excluded records

The export contains the runner profile and these known owner-scoped training
collections, including their approved descendants:

- plans, workouts, generation metadata, completion state, and active-plan
  state;
- runs, shoes, and activity-import records;
- plan revision snapshots and recommendation evidence; and
- guidance presentation history.

The operator intentionally excludes:

- Garmin provider connections and credentials;
- methodology consent records, which the fictional target must not inherit;
- adaptation command receipts and other idempotency state; and
- retired mobile-spike proof records.

Authentication passwords, refresh tokens, beta memberships, global Garmin
provider mappings and deliveries, material-command receipts, and account-
deletion requests are outside the `users/{uid}` export and are never copied.
If the source tree contains an unknown collection, export stops so the recovery
inventory must be reviewed instead of silently producing an incomplete backup.

## One-time fictional target

In Firebase Authentication for `marathoner-d9bf9`, create and verify a
dedicated account such as `backup-restore-issue-124@marathonerapp.com`. Record
its exact UID privately. Do not approve a beta membership and do not connect
Apple Health or Garmin. The Firestore `users/{uid}` tree must not exist before
restore.

Use a fictional or owner-controlled development source account. Never use a
beta participant for this rehearsal.

## Inspect and export

Sign the Firebase CLI into the dedicated operator account. Substitute the
private source values below; do not paste them into GitHub.

```bash
npm run rehearse:development-backup-restore -- inspect \
  --project marathoner-d9bf9 \
  --source-email SOURCE_EMAIL \
  --source-uid SOURCE_UID
```

Review the document count and the explicit excluded-collection list. Then
write the local snapshot without overwriting any existing file:

```bash
npm run rehearse:development-backup-restore -- export \
  --project marathoner-d9bf9 \
  --source-email SOURCE_EMAIL \
  --source-uid SOURCE_UID \
  --output .issue-124-development-backup.local
```

## Restore and verify

Restore requires the exact source and fictional target identities plus the
confirmation printed by this pattern:

```bash
npm run rehearse:development-backup-restore -- restore \
  --project marathoner-d9bf9 \
  --source-email SOURCE_EMAIL \
  --source-uid SOURCE_UID \
  --target-email backup-restore-issue-124@marathonerapp.com \
  --target-uid TARGET_UID \
  --input .issue-124-development-backup.local \
  --confirm "RESTORE-DEVELOPMENT-BACKUP:SOURCE_UID:TARGET_UID"
```

The command rewrites only the owner UID and owner paths, creates each document
only when absent, verifies restored fields against the snapshot, and records
exact paths and Firestore update versions in a second ignored local manifest.
If restore fails, it removes documents created during that attempt.

Run an independent read-back before recording success:

```bash
npm run rehearse:development-backup-restore -- verify \
  --project marathoner-d9bf9 \
  --source-email SOURCE_EMAIL \
  --source-uid SOURCE_UID \
  --target-email backup-restore-issue-124@marathonerapp.com \
  --target-uid TARGET_UID \
  --input .issue-124-development-backup.local
```

On the development app, sign in as the fictional target and confirm the runner
profile, plan, workouts, runs, and Analyze history are representative. Do not
connect an external provider or use the account as a real runner.

## Version-guarded cleanup

Cleanup refuses to delete a restored document if any document is missing or
has changed since restore. Resolve that discrepancy manually before taking
another destructive action.

```bash
npm run rehearse:development-backup-restore -- cleanup \
  --project marathoner-d9bf9 \
  --source-email SOURCE_EMAIL \
  --source-uid SOURCE_UID \
  --target-email backup-restore-issue-124@marathonerapp.com \
  --target-uid TARGET_UID \
  --input .issue-124-development-backup.local \
  --confirm "REMOVE-DEVELOPMENT-RESTORE:TARGET_UID"
```

After cleanup, delete the snapshot locally and disable or delete the fictional
Authentication account. Record only privacy-safe evidence: date, source type
(`fictional` or `owner-controlled`), document count, excluded collection names,
snapshot digest, restore/verification/cleanup result, operator, and linked
issues. Do not record email addresses, UIDs, paths, or document content.

## What this proves

A passing dated rehearsal proves the reviewed development operator can recover
the allowlisted training-history surface into an isolated fictional account
and remove it safely. It does not prove beta-project recovery, provider-token
recovery, Authentication recovery, deletion rollback, or a managed whole-
database disaster-recovery system. Those claims require their own reviewed
design and explicit authorization.
