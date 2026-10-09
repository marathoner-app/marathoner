# Founding-beta Functions deployment boundary

- **Status:** Repository boundary and console cost controls verified; first
  live deployment remains prohibited
- **Tracking issue:**
  [#201](https://github.com/marathoner-app/marathoner/issues/201)
- **First deployment owner:**
  [#205](https://github.com/marathoner-app/marathoner/issues/205), after
  [#143](https://github.com/marathoner-app/marathoner/issues/143) and
  [#204](https://github.com/marathoner-app/marathoner/issues/204) are complete
- **Operator:** Dedicated `marathonerapp.com` domain administrator

Issue #201 creates a reviewable path to the exact beta project. The maintainer
approved and verified the bounded beta billing configuration on October 8,
2026. This issue still does not authorize a deployment or deploy, delete, or
invoke a Function. Keep those distinctions visible in every review.

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
7. The beta App Check observation plan remains unenforced, and #205 has an
   active rollback owner and observation window.

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
