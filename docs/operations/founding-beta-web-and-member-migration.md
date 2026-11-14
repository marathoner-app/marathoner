# Founding-beta web and member migration

- **Status:** Implemented; live cutover and member migrations require reviewed operator actions
- **Tracking issue:** [#746](https://github.com/marathoner-app/marathoner/issues/746)
- **Web project:** `marathonerapp-beta`
- **Source project for selected founders:** `marathoner-d9bf9`

## Shared product boundary

The founding-beta web app at `marathonerapp.com` and the TestFlight app are two
clients of the same product. Both must authenticate against `marathonerapp-beta`
and read the same owner-scoped Firestore records. Local development and ordinary
development iOS builds remain isolated on `marathoner-d9bf9`.

The Pages workflow publishes `npm run build:closed-beta` from
`dist-closed-beta`. The build includes the pinned provisional-methodology
disclosure and fails unless the output contains the exact beta Firebase identity
and no development project identity. Public account creation remains disabled;
only approved, verified members can access training data.

## Member migration boundary

Do not recreate a founder manually in the beta console. A second UID would
strand the runner's web history under the development UID. Use the guarded
operator tool so the beta Auth account preserves the source UID.

The tool copies only these owner-scoped records:

- `users/{uid}`;
- `planState`, `plans`, `runs`, and `shoes` below that user;
- plan `metadata` and `workouts`; and
- workout `completionState`.

It does not copy command receipts, recommendation evidence, guidance history,
operator controls, deletion requests, or any other server-owned evidence. Those
records belong to the environment that produced them. The tool creates a fresh
`betaMemberships/{uid}` approval in beta.

## Preflight

Use the dedicated Firebase operator login. Inspection is read-only and refuses
to continue unless the source account is enabled and verified, the target has no
matching email or UID, and the target has no user or membership records.

```sh
npm run migrate:founding-beta-member -- inspect \
  --email participant@example.com \
  --source-project marathoner-d9bf9 \
  --target-project marathonerapp-beta
```

Review the reported UID and document count without publishing participant data.

## Migration

After explicit approval for the named participant, run the email-specific
confirmation phrase printed by the tool contract:

```sh
npm run migrate:founding-beta-member -- migrate \
  --email participant@example.com \
  --source-project marathoner-d9bf9 \
  --target-project marathonerapp-beta \
  --confirm MIGRATE-FOUNDING-BETA-MEMBER:participant@example.com
```

The target account receives an unprinted random password. After migration, the
participant must use Marathoner's password-reset flow before the first beta
sign-in. Do not transmit a password through chat, an issue, or a local manifest.

The command writes an ignored mode-`0600`
`.founding-beta-migration-<email>.local` manifest containing only the UID,
document paths, project IDs, and timestamp needed for rollback. It contains no
password, token, or document contents. If a write fails before the manifest is
created, the command attempts to remove every target document and the target
Auth account automatically.

## Cross-client proof

After Pages deploys and the participant resets the beta password:

1. sign in at `marathonerapp.com` and confirm the expected plan and runs;
2. sign in to the current TestFlight build with the same email and password;
3. add a controlled run on one client and confirm it appears on the other;
4. edit or remove that controlled run and confirm the change crosses clients;
5. confirm an unapproved account still cannot read or write training data; and
6. record the date, deployed commit, TestFlight build, participant-safe result,
   and any failure without recording credentials or training details.

## Existing beta account with a different UID

The same-UID member migration above must refuse an account that already exists
in beta. If a founder already has a canonical beta account under a different
UID and only unlinked development runs need recovery, use the narrower
owner-run migration. It never changes either Auth account, profiles, plans,
shoes, command receipts, provider records, or the development source.

First inspect with both UIDs copied from the reviewed live diagnosis:

```sh
npm run migrate:owner-runs-to-beta -- inspect \
  --email participant@example.com \
  --source-project marathoner-d9bf9 \
  --source-uid SOURCE_UID \
  --target-project marathonerapp-beta \
  --target-uid TARGET_UID
```

Inspection refuses unless both accounts are enabled and verified, the target
profile and approved membership exist, the target run collection is empty, and
every source run belongs to the source UID and is not linked to a plan. The
output contains only project IDs, UIDs, the run count, and the empty-target
decision.

After reviewing that output, run the exact confirmation phrase printed by the
tool contract:

```sh
npm run migrate:owner-runs-to-beta -- migrate \
  --email participant@example.com \
  --source-project marathoner-d9bf9 \
  --source-uid SOURCE_UID \
  --target-project marathonerapp-beta \
  --target-uid TARGET_UID \
  --confirm MIGRATE-OWNER-RUNS:participant@example.com:SOURCE_UID:TARGET_UID
```

The tool creates each target document only if it does not already exist,
rewrites only the stored `userId`, verifies the final count and owner, and
writes an ignored mode-`0600` rollback manifest containing target paths and
write versions but no run contents. Verify the run count on both web and iOS
before continuing integration recovery.

Rollback is permitted only while every migrated run still has its original
write version. If any run has changed or disappeared, the tool refuses to
delete anything and requires a participant-specific recovery plan:

```sh
npm run migrate:owner-runs-to-beta -- rollback \
  --email participant@example.com \
  --source-project marathoner-d9bf9 \
  --source-uid SOURCE_UID \
  --target-project marathonerapp-beta \
  --target-uid TARGET_UID \
  --confirm ROLLBACK-OWNER-RUNS:participant@example.com:SOURCE_UID:TARGET_UID
```

## Rollback

If the migration itself is wrong and the participant has not begun using beta,
use the exact local manifest and email-specific rollback phrase:

```sh
npm run migrate:founding-beta-member -- rollback \
  --email participant@example.com \
  --source-project marathoner-d9bf9 \
  --target-project marathonerapp-beta \
  --confirm ROLLBACK-FOUNDING-BETA-MEMBER:participant@example.com
```

Rollback removes only paths recorded by that migration and then removes the
target Auth account. It never changes the source project. Once new beta activity
exists, stop and make a participant-specific recovery plan instead of using this
rollback.

To roll back only the Pages cutover, revert the reviewed workflow change and
redeploy the development build. Do not change DNS, weaken beta rules, or point
TestFlight back at development.
