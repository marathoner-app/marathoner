# Founding-beta Functions deployment boundary

- **Status:** Repository boundary, client attestation bootstrap, and console
  cost controls verified; first live deployment remains owned by #205
- **Tracking issue:**
  [#201](https://github.com/marathoner-app/marathoner/issues/201)
- **First deployment owner:**
  [#205](https://github.com/marathoner-app/marathoner/issues/205); completed-run
  activation is prepared by
  [#349](https://github.com/marathoner-app/marathoner/issues/349) and verified
  live by [#347](https://github.com/marathoner-app/marathoner/issues/347)
- **Operator:** Dedicated `marathonerapp.com` domain administrator

Issue #201 created a reviewable path to the exact beta project. The maintainer
approved and verified the bounded beta billing configuration on October 8,
2026. This runbook does not itself authorize a deployment or deploy, delete,
or invoke a Function. Keep those distinctions visible in every review.

## Hard repository boundary

Only `firebase.beta.json` carries an eligible Functions configuration. Its
predeploy command requires all three of these facts at the same time:

1. the configuration declares the `beta` environment;
2. Firebase CLI resolves the exact project `marathonerapp-beta`; and
3. the operator supplies the non-secret intent phrase
   `DEPLOY-BETA-FUNCTIONS-AFTER-ISSUES-143-AND-204`.

The default `firebase.json` invokes the same guard as `development`, so it
remains deployment-blocked even if the beta project and intent phrase are
supplied. Missing and unknown project IDs also fail before the Functions build.
The Firestore development and beta guards are unchanged.

The intent phrase is an acknowledgement, not a credential or an authorization
by itself. Never put a Firebase token, service-account key, billing identifier,
payment detail, recovery address, App Check debug token, participant identity,
or participant record in the command, repository, issue, or deployment log.

## Completed-run activation parameter

The runtime omits completed-run stores by default. It installs them outside the
emulator only when both of these conditions are true:

1. the built-in Google Cloud project parameter is exactly
   `marathonerapp-beta`; and
2. the Boolean Functions parameter
   `MARATHONER_COMPLETED_RUN_COMMANDS_ENABLED` is `true`.

Prepare the non-secret, ignored Firebase parameter file only in the clean
release-candidate checkout:

```sh
cp functions/.env.marathonerapp-beta.example \
  functions/.env.marathonerapp-beta
chmod 600 functions/.env.marathonerapp-beta
```

Edit the copied file so its one activation value is `true`. Do not add tokens,
credentials, participant identifiers, or unrelated configuration. Confirm
`git status --short` does not list the ignored file. If the file is missing,
false, malformed, or loaded for another project, completed-run commands remain
disabled. Never set the parameter in the development project.

Project-level App Check enforcement remains off during #205's observation
window. The callable nevertheless requires a verified App Check context for
`run.complete` and `run.delete`, and each store requires an exact approved
`betaMemberships/{uid}` record in the same transaction as its write. This
command-specific protection does not enable global enforcement early.

## Reviewed codebase and runtime ceiling

The beta configuration names one Node 22 codebase, `material-commands`, with
these current exports:

- `submitMaterialCommand`;
- `resolveMaterialCommand`; and
- `requestAccountDeletion`.

Any new export requires a separate review before the deploy command below is
changed. Do not replace the scoped export list with an unqualified
`--only functions` deployment.

The shared runtime options are deliberately conservative:

| Option | Value | Reason |
| --- | --- | --- |
| Region | `us-central1` | Existing reviewed Functions and Firestore boundary |
| Memory | `256MiB` | Smallest configured memory allocation used by this codebase |
| Timeout | 15 seconds | Prevent a request from consuming a worker indefinitely |
| Minimum instances | 0 | Permit scale-to-zero; no paid warm instance |
| Maximum instances | 1 per export | Smallest credible founding-cohort ceiling |

The maximum applies independently to each exported Function. It is not an
aggregate project limit, and neither it nor a billing budget caps Firestore,
Authentication, logging, networking, or other project charges.

## Console approval record

The maintainer verified the following live-console state on October 8, 2026:

- [x] `marathonerapp-beta`, and no development project, is attached to the
      explicitly approved billing account and uses the Blaze plan.
- [x] `marathoner-d9bf9` remains on Spark with no billing account attached.
- [x] A fixed USD 10 monthly alerts-only budget is scoped only to
      `marathonerapp-beta` and all services in that project.
- [x] Actual-spend alerts are saved at 50%, 90%, and 100%; a forecasted-spend
      alert is saved at 100%.
- [x] Email notifications go to the billing account's administrators and
      billing users.
- [x] No enforced spend cap is enabled.

Record roles or approved organizational addresses only when necessary. Keep the
billing account ID, payment method, billing address, private notification
addresses, and account recovery details outside GitHub. Budget alerts notify;
they do not suspend services or impose a hard spending cap.

## First-deployment prerequisites

Issue #205 owns the first deployment. Before running any command in the next
section, its reviewer must confirm all of the following:

1. #143 records no unresolved deployment-blocking production advisory.
2. #204 has passed its supported browser and physical-iPhone App Check proof.
3. The console approval record above is complete and freshly rechecked.
4. Firebase CLI is signed in as the dedicated domain administrator.
5. The checked-out commit is the reviewed release candidate with no local
   changes.
6. Lint, the complete test suite, the Functions build, and the production build
   pass on that commit.
7. The beta project's default build service account holds only the reviewed
   project roles required for Functions builds, including
   `roles/cloudbuild.builds.builder`. This role lets the build read its uploaded
   source, publish its Artifact Registry image, and write build logs; it does
   not authorize a human or any development-project resource.
8. The beta App Check observation plan remains unenforced, and #205 has an
   active rollback owner and observation window.
9. The ignored beta parameter file contains only the reviewed completed-run
   activation value, and the fictional rehearsal account has an exact approved
   beta membership.

If any item is false or uncertain, stop. Do not remove or weaken the guard to
make a deployment proceed.

## First-deploy remote inventory

Before the first deployment, #205 must prove that the beta project has no
existing Cloud Functions:

```sh
npx firebase functions:list --project marathonerapp-beta
```

If any Function appears, stop. Treat it as an unknown live resource, identify
its source and owner, and reconcile it through a separate reviewed change. The
scoped deployment below does not delete or constrain an unrelated remote
export, so an unexpected Function makes the first-deploy premise false.

## Documented first-deploy command — do not run in #201

The explicit project and scoped export filters prevent Firestore or an
unreviewed Functions codebase from joining this operation:

```sh
MARATHONER_BETA_FUNCTIONS_DEPLOY_CONFIRMATION=DEPLOY-BETA-FUNCTIONS-AFTER-ISSUES-143-AND-204 \
  npx firebase deploy \
  --config firebase.beta.json \
  --project marathonerapp-beta \
  --only functions:material-commands:submitMaterialCommand,functions:material-commands:resolveMaterialCommand,functions:material-commands:requestAccountDeletion
```

Issue #205 must retain the CLI result, deployed export names, regions, and
redacted observation result. It must not retain access tokens, request bodies,
owner IDs, command IDs, participant data, or raw logs in GitHub.

Immediately rerun `npx firebase functions:list --project marathonerapp-beta`
and require exactly `submitMaterialCommand`, `resolveMaterialCommand`, and
`requestAccountDeletion`, all in `us-central1`, with no additional export.
Otherwise stop client testing and follow the rollback procedure.

## Callable transport verification

Firebase callable authentication and App Check validation run inside the
Function handler. The underlying Cloud Run service must therefore accept the
request far enough for that handler to reject an unauthenticated caller. Public
transport does not make a Marathoner command anonymously usable: the handler's
authentication, App Check, membership, ownership, and revision checks remain
the application authorization boundary.

Immediately after the inventory check, send an empty callable envelope to each
of the three reviewed URLs from `functions:list`:

```sh
curl --silent --show-error \
  --header 'Content-Type: application/json' \
  --data '{"data":{}}' \
  https://us-central1-marathonerapp-beta.cloudfunctions.net/submitMaterialCommand
```

Repeat the same request for `resolveMaterialCommand` and
`requestAccountDeletion`. Each endpoint must return JSON with the typed
Marathoner result `authentication_error` / `authentication-required`. An HTML
`403 Forbidden` response is a platform rejection before Marathoner code runs;
do not begin client testing while any endpoint has that result.

### Domain Restricted Sharing recovery

The Marathoner organization inherits the legacy Domain Restricted Sharing
constraint. If a create reports that Firebase could not set the invoker IAM
policy, do not weaken that organization policy and do not add an `allUsers` IAM
binding. For only the three reviewed Cloud Run services, open **Security**,
select **Allow public access**, review the authentication-only diff, and deploy
the change. In this configuration the console disables the Cloud Run invoker
IAM check, which is the documented path for a public endpoint when Domain
Restricted Sharing prevents an `allUsers` grant.

Require each service to return to healthy status, confirm the selected access
setting, and repeat the empty-envelope transport test above. If the setting
cannot be applied or the response remains a platform HTML 403, stop and keep
the Functions out of client use.

An interrupted first create can leave healthy service resources without the
required callable transport setting. A later Firebase update does not prove
that the missed create-time invoker step was repaired. With rollback-owner
approval, delete only the three named beta exports, verify the remote inventory
is empty, and recreate them from the same clean reviewed commit using the
guarded scoped command. Do not change Firestore rules, Authentication users,
or beta fixtures as part of that recovery.

## Deployment-artifact retention

After the first successful create, set the reviewed seven-day cleanup policy
for Functions container artifacts in the deployment region:

```sh
npx firebase --interactive functions:artifacts:setpolicy \
  --project marathonerapp-beta \
  --location us-central1 \
  --days 7
```

Keep the interactive confirmation and require Firebase to report that the
policy was created successfully. Do not add `--force`, change the retention
window, or broaden the location without a separate review. This policy removes
old deployment images; it does not delete the active Functions, Firestore data,
Authentication users, or application records.

## Completed-run smoke and negative proof

Before allowing the Track-provider migration to merge, use the reviewed beta
`ios-beta` Release build and one fictional approved account. Use its
beta-only **Live run-command rehearsal** panel to:

1. submit one unplanned `run.complete` command and retain only its redacted
   result status;
2. wait for the owned run listener to show the committed record;
3. submit `run.delete` with the returned revision and retain only its redacted
   result status;
4. wait for the listener to confirm the run is absent;
5. confirm both owner-scoped receipts exist and the fictional run is cleaned
   up; and
6. prove missing authentication, missing or invalid App Check, and missing or
   non-approved membership produce typed failures with no run or receipt.

Do not place command IDs, UIDs, emails, notes, request bodies, or raw records in
GitHub. An unexpected result, listener timeout, or unexplained legitimate
rejection blocks #346 and begins rollback.

## Log review

Read only the bounded exports and keep the result in the private operating log:

```sh
npx firebase functions:log \
  --project marathonerapp-beta \
  --only submitMaterialCommand,resolveMaterialCommand,requestAccountDeletion \
  --lines 100
```

Application log entries are designed to contain only fixed event, command-type,
and result-status fields. Stop the rehearsal and open a security issue if a UID,
email, command ID, payload, note, participant record, or error object appears.

## Rollback

To contain only completed-run commands while retaining the reviewed exports,
set `MARATHONER_COMPLETED_RUN_COMMANDS_ENABLED=false` in the ignored beta
parameter file and redeploy the same clean reviewed commit with the exact
scoped command above. Confirm a fictional run command returns the disabled
authorization result and creates no record or receipt. This is configuration
containment, not the full first-deployment rollback.

For the first deployment there is no earlier live Functions revision to
redeploy. If #205's first-deploy verification fails, stop client testing and
remove only these exact beta exports after the rollback owner confirms the
project and region:

```sh
npx firebase functions:delete \
  submitMaterialCommand \
  resolveMaterialCommand \
  requestAccountDeletion \
  --region us-central1 \
  --project marathonerapp-beta
```

Keep the interactive confirmation; do not add `--force` to the runbook. Verify
the three exports are absent by rerunning
`npx firebase functions:list --project marathonerapp-beta`. The first-deploy
rollback is complete only when the remote inventory is empty and Firestore
rules and participant records were not changed by the rollback.

After a known-good deployment exists, rollback means deploying that exact
reviewed commit from a clean worktree with the same guarded, scoped command. Do
not hand-edit generated output or deploy an unreviewed local checkout.

## Unexpected-spend response

A budget alert or unexplained usage increase pauses new invitations and the
affected rehearsal. The operator must:

1. verify the alert through the Google Cloud console rather than an email link;
2. scope the billing report to `marathonerapp-beta` and identify the service,
   SKU, time window, and trend;
3. inspect bounded Functions logs and Firebase usage without copying participant
   details into GitHub;
4. delete the exact Functions above if they are causing the spend and the
   rollback owner approves;
5. preserve the beta Firestore and Authentication evidence while investigating;
   and
6. record the cause, containment, remaining cost, and invitation decision in
   the private incident log.

Do not detach billing impulsively: that can disrupt services and evidence. A
billing-account change, quota increase, or higher instance ceiling requires a
new reviewed decision. Budget notifications never substitute for daily usage
review while the founding cohort is active.
