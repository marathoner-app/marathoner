# Owner-development Functions activation and rollback

- **Status:** Owner-development material-command exports deployed and verified
  for the closed internal accounts on October 30, 2026
- **Tracking issue:**
  [#347](https://github.com/marathoner-app/marathoner/issues/347)
- **Provider migration:**
  [#346](https://github.com/marathoner-app/marathoner/issues/346)
- **External beta path:**
  [Founding-beta Functions deployment](beta-functions-deployment.md)

This path lets the owner and operating partner internally exercise plan and
completed-run commands without waiting for Apple organization enrollment. The
development billing link, budget notifications, callable transport, runtime
Firestore role, and one authenticated plan-approval receipt were verified on
October 30, 2026. Billing identifiers, runtime principals, participant
identifiers, and receipt contents remain private.

It is not an external-beta deployment, an App Attest proof, or permission to
invite participants.

## What remains unapproved

The development project is now billable and the two material-command exports
are live. This does not authorize additional exports, a broader deployment,
new runtime roles, a higher instance ceiling, or use by external participants.

Before any later deployment, the owner must separately approve:

1. attaching the exact development project to the intended billing account;
2. a development-project budget and notifications;
3. the exact guarded deployment command below; and
4. the owner-only smoke window and rollback owner.

Apple Developer Program enrollment is not a prerequisite. The development iOS
build uses the existing explicit native App Check debug provider. Real App
Attest, organization signing, TestFlight, and participant use remain gated by
[#281](https://github.com/marathoner-app/marathoner/issues/281),
[#205](https://github.com/marathoner-app/marathoner/issues/205), and
[#206](https://github.com/marathoner-app/marathoner/issues/206).

## Repository containment

The development path remains fail-closed in four independent places:

1. `firebase.json` invokes the development-only predeploy guard.
2. The guard requires `GCLOUD_PROJECT=marathoner-d9bf9`, the `development`
   configuration, and the non-secret owner-intent phrase.
3. The runtime requires the exact reviewed project plus
   `MARATHONER_COMPLETED_RUN_COMMANDS_ENABLED=true`.
4. Each completed-run command requires authenticated ownership, verified App
   Check context, an exact approved membership, supported versions, and valid
   revisions before a transaction can write.

Unknown projects, the beta project through the development configuration,
missing intent, missing configuration, and a false activation value all fail
closed.

## Local parameter preparation

Only after the owner approves the remote billing boundary, prepare the ignored
project-specific parameter file in a clean checkout:

```sh
cp functions/.env.marathoner-d9bf9.example \
  functions/.env.marathoner-d9bf9
chmod 600 functions/.env.marathoner-d9bf9
```

Change the completed-run Boolean to `true` for the smoke window. Do not add a
Firebase token, App Check debug token, participant identifier, payment detail,
or other credential. Confirm the file is ignored with `git status --short`.

The same ignored file also contains
`MARATHONER_PROVISIONAL_PLAN_DOGFOOD_ENABLED`. Set it to `true` only when the
two existing development accounts should be able to activate the exact pinned
provisional plan. This does not approve the methodology and does not enable the
policy in the beta project.

## Predeployment checklist

- [ ] The owner explicitly approved the billing attachment and reviewed its
      current terms.
- [ ] A development-project budget and notification recipients are visible in
      the console.
- [ ] Firebase CLI is signed in as the dedicated domain administrator.
- [ ] The checkout is clean and points to the reviewed issue #347 commit.
- [ ] Lint, unit tests, Functions build, material-command emulators, production
      build, and development iOS boundary check pass.
- [ ] The development App Check debug token is registered privately and is not
      present in source, logs, build output, or GitHub.
- [ ] The owner account has one exact approved `betaMemberships/{uid}` record
      in the development project. The UID and record stay out of GitHub.
- [ ] The ignored parameter file contains only the reviewed true activation
      value.
- [ ] The rollback owner is present for the full smoke window.
- [ ] The runtime service identity for each reviewed Cloud Run service has
      exactly the project access it needs, including `roles/datastore.user`;
      build-service-account permissions are not treated as runtime access.

If any item is false or uncertain, stop.

## Remote inventory and guarded deployment

First inspect the exact development project:

```sh
npx firebase functions:list --project marathoner-d9bf9
```

Reconcile any unexpected export before deploying. Then deploy only the two
reviewed material-command exports:

```sh
MARATHONER_DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION=DEPLOY-DEVELOPMENT-FUNCTIONS-FOR-OWNER-DOGFOOD \
  npx firebase deploy \
  --config firebase.json \
  --project marathoner-d9bf9 \
  --only functions:material-commands:submitMaterialCommand,functions:material-commands:resolveMaterialCommand
```

Immediately list the remote inventory again and require exactly the reviewed
exports in `us-central1`. Do not replace the scoped filter with
`--only functions`.

## Runtime prerequisites and post-deploy verification

A successful Firebase deployment does not prove callable reachability or
runtime Firestore access. Follow the shared
[material-command post-deploy verification](material-command-postdeploy-verification.md)
after every deployment. The development project inherits Domain Restricted
Sharing: keep the organization policy intact, do not add an `allUsers` binding,
and scope the invoker-IAM-disabled annotation only to
`submitmaterialcommand` and `resolvematerialcommand`.

After one real authenticated owner command has produced a privately confirmed
receipt, run:

```sh
npm run verify:functions-postdeploy -- development \
  --receipt-status plan_approved
```

Any transport, IAM, or receipt failure blocks further client testing. Do not
convert a platform failure into a client retry loop.

## Reversible owner smoke

Build the normal `ios-development` target. Its owner-only **Live run-command
rehearsal** must:

1. create one fixed fictional unplanned 5 km run through `run.complete`;
2. wait for the signed-in listener to show the server record;
3. delete the exact returned record through `run.delete`;
4. wait for the listener to confirm cleanup; and
5. show only the pass/fail result, never command IDs or account identifiers.

Also verify that missing authentication, invalid or missing App Check, absent
membership, unsupported versions, and wrong-project configuration create no
run or receipt. Use private console/log inspection only as needed and retain
redacted outcomes.

The ordinary Track provider must not migrate under #346 until this rehearsal
passes and listener cleanup is confirmed.

## Rollback

To contain completed-run commands without removing the reviewed exports, set
`MARATHONER_COMPLETED_RUN_COMMANDS_ENABLED=false` in the ignored development
parameter file and redeploy only the two scoped exports. Confirm the same
fictional command returns the disabled result without a write.

If the whole development Functions path must be removed, delete only the exact
two exports after confirming the target project and region:

```sh
npx firebase functions:delete \
  submitMaterialCommand \
  resolveMaterialCommand \
  --project marathoner-d9bf9 \
  --region us-central1
```

Then confirm the remote inventory is empty. Removing Functions does not detach
billing; that is a separate console decision with separate consequences.

## Evidence boundary

The GitHub record may retain dates, commit hashes, export names, regions,
redacted result statuses, safe persistence-failure classifications, elapsed
times, and pass/fail outcomes. Keep billing identifiers, payment details, UIDs,
emails, command IDs, debug tokens, request bodies, raw participant records, raw
provider codes and messages, and raw logs private.
