# Firebase client configuration audit

- **Status:** Verified browser, selected iOS, and registered App Check environment boundaries
- **Audit dates:** 2026-09-30 browser audit; 2026-10-05 development and beta iOS audits; 2026-10-06 App Check registration audit
- **Owner:** Kevin Tulloch
- **Tracking issues:** [#22](https://github.com/marathoner-app/marathoner/issues/22),
  [#178](https://github.com/marathoner-app/marathoner/issues/178),
  [#125](https://github.com/marathoner-app/marathoner/issues/125)
- **Current projects:** `marathoner-d9bf9` development and `marathonerapp-beta` beta

## Purpose and boundary

This record distinguishes Marathoner's public Firebase web configuration from
privileged credentials, records the live console controls inspected for issue
#22, and names every remaining change before the project can support founding-
beta participants.

The audit covers the Marathoner web app, Firebase Authentication, Cloud
Firestore, Google Cloud API-key restrictions, GitHub Pages, and repository
secret scanning. Creator Radar is outside this review boundary.

Firebase web configuration identifies a project and app; it does not authorize
access to participant records. Firebase Authentication, Security Rules, App
Check, command validation, and operator access provide the actual control
layers. Moving the same browser-delivered values into an environment variable
would not turn them into secrets.

## Verified current state

| Surface | Live evidence | Disposition |
| --- | --- | --- |
| Firebase project | The committed project ID, app ID, sender ID, auth domain, and storage-bucket name identify `marathoner-d9bf9`. | This remains the development/prototype side of the separated environment boundary. |
| Environment selector | Web, CI defaults, Pages, and the selected iOS development build select the audited project as `development`; the distinct beta registration is available only to an explicit production web build or separately keyed `ios-beta` mode. | The [environment selection contract](firebase-environment-selection.md) and [beta project record](firebase-beta-project.md) define the verified boundary. App Check and participant activation remain separate gates. |
| Browser API key | The committed value exactly matches the only `Browser key (auto created by Firebase)` in the project without printing or copying the value into this record. | It is an intentionally public Firebase client identifier. Rotation is not required solely because it appears in source or a browser bundle. |
| API allowlist | The key is restricted to the eight APIs listed below. Generative Language and the previously allowed unused AI, SQL, Storage, Realtime Database, distribution, hosting, messaging, ML, and Remote Config APIs are not allowed. | Keep this inventory narrow. A later feature must deliberately update this record before adding an API. |
| Application restriction | The key accepts browser requests only from the current GitHub Pages host, `localhost`, and `127.0.0.1`, using the exact patterns below. | Keep these origins until environment separation is complete. Add the custom domain only when #162 publishes it. |
| Selected iOS development key | `marathoner-ios-development` belongs only to the development project and permits Cloud Firestore API, Identity Toolkit API, and Token Service API. | It supports the canonical Capacitor shell through an ignored mode-`0600` local environment file. It is not committed, printed, or shared with beta. |
| Selected iOS beta key | `marathoner-ios-beta` belongs only to `marathonerapp-beta` and permits Cloud Firestore API, Identity Toolkit API, and Token Service API. | The real beta bundle and physical approved/denied evidence passed. Its value exists only in `.env.ios-beta.local`. |
| iOS application restriction | The iOS shell currently uses the Firebase JavaScript SDK inside a Capacitor WebView, so the key cannot use an iOS bundle restriction and has no application restriction. | The narrow API allowlist limits the key's reach. Issue #161 must complete live token proof, observation, and staged App Check enforcement before external invitations. |
| Sign-in providers | Email/Password is enabled and Google is disabled. The application implements only Email/Password, and the five visible legacy accounts all use the Email provider. | Keep Email/Password until the beta identity decision changes it. Do not migrate the legacy account list wholesale into beta. |
| Authorized domains | `localhost`, the two Firebase default hosts, and `marathoner-app.github.io` are authorized. `marathonerapp.com` is not. | Keep the current hosts while this project serves local/prototype use. Issue #162 adds the apex and `www` hosts with the actual deployment. |
| Cloud Firestore | The default `nam5` database is active. The live rule editor is byte-equivalent after whitespace normalization to the tracked `firestore.rules`. | Current rules enforce owner-path access and schema version 1. The separate [beta membership candidate](firebase-beta-membership.md) adds verified-email and approved-membership access but remains undeployed; #121 and the server-command migration must close the remaining beta rule boundary. |
| Realtime Database | The console offers **Create Database**; no database exists. | Remain disabled. |
| Cloud Storage | Storage is not configured and the Spark project cannot enable it without billing. | Remain disabled unless a future approved feature and ruleset require it. |
| App Check | Development and beta each have a distinct Fraud Defense web registration and App Attest iOS registration. No debug token was created. Client initialization now fails closed before Firebase services, while live browser and paid-team physical-iPhone token evidence remain pending and API enforcement remains off. | The [registration record](app-check-provider-registration.md) is the authority for provider identity, native configuration selection, debug-token custody, and the #204–#206 rollout gates; the [initialization record](app-check-client-initialization.md) separates implemented behavior from pending live proof. |
| GitHub Pages | The workflow serves `https://marathoner-app.github.io/marathoner/` with HTTPS. No Pages custom domain is configured. | The GitHub Pages host is the only current production origin. Issue #162 owns the coordinated custom-domain migration. |
| Repository credentials | Current tracked files and historical filenames contain no Marathoner service-account file, private key, password, Firebase CLI token, or administrative credential. | Continue to prohibit privileged credentials in source. Use workload identity or provider-managed operator sessions. |
| GitHub secret controls | Secret scanning and push protection were disabled at audit start and are now enabled for the public repository. Alerts #1 and #2 identify the development and beta browser keys; alerts #3 and #4 identify the versioned beta and development Apple client keys. | All four were resolved as documented false positives after their exact public-client locations and intended Firebase registrations were verified. |

No secret value, participant identifier, or account email belongs in this
record. Console screenshots and logs used as evidence must be redacted before
they are linked publicly.

## Applied current-project hardening

The current browser key keeps only these API restrictions:

- Cloud Datastore API;
- Cloud Firestore API;
- Cloud Logging API;
- Firebase App Check API;
- Firebase Installations API;
- Firebase Management API;
- Identity Toolkit API; and
- Token Service API.

These entries support the current Auth and Firestore client plus the already
approved App Check follow-up. The client does not use Gemini/Generative
Language, Firebase AI Logic, SQL, Storage, Realtime Database, Hosting,
distribution, messaging, ML, Remote Config, or Dynamic Links through this key.
A later feature must update this inventory deliberately before adding an API.

The current browser key allows requests only from:

- `https://marathoner-app.github.io/*`;
- `http://localhost/*`; and
- `http://127.0.0.1/*`.

Local origins remain temporary because this project still supports the current
development workflow. Issue #125 preserves them only on the distinct
development project; beta does not allow those origins. Issue #162 adds
`marathonerapp.com` and `www.marathonerapp.com` only when those hosts actually
serve the supported app.

Google sign-in is disabled because no shipped UI, service, test, or current
account depends on it. Email/Password remains enabled. Public signup remains
disabled in the application, but UI removal is not an authorization control.
The beta project independently enforces approved membership and verified email.

## Selected iOS keys and spike retirement

Issue [#177](https://github.com/marathoner-app/marathoner/issues/177) promoted
the selected Capacitor shell into the canonical root application. On
2026-10-05, issue [#178](https://github.com/marathoner-app/marathoner/issues/178)
replaced the shared proof credential with `marathoner-ios-development`. The
replacement key belongs only to `marathoner-d9bf9` and allows exactly:

- Cloud Firestore API;
- Identity Toolkit API; and
- Token Service API.

The key has no application restriction because Firebase runs through the
JavaScript SDK inside the Capacitor WebView. Its value exists only in the
ignored mode-`0600` `.env.ios-development.local`; the iOS build fails closed
when it is absent, rejects the beta project, and does not affect the restricted
browser key. This is an accepted development-only boundary, not the final beta
control. Issue #161 must establish the selected Apple attestation path and
enforce App Check before external invitations.

The replacement was verified on a physical iPhone before retirement: an
existing development account authenticated, survived an intended persistence
check, signed out cleanly, and loaded the canonical Plan surface after its
Firestore reads completed. The development project had no
`mobileSpikeProofs/issue-87-shared-record` document for the verified account.
The updated default-deny rules were then deployed to development.

Only after those checks passed, the temporary `marathoner-ios-auth-spike` key
was deleted from Google Cloud and the obsolete local auth and shared-record
spike environment files were removed. The beta project was not changed. The
retired cloud key remains recoverable through Google Cloud's deleted-credential
workflow for 30 days; it must not be restored unless rollback is explicitly
approved.

The historical comparison evidence remains in
[`spikes/mobile/auth-evidence.md`](../../spikes/mobile/auth-evidence.md) and
[`spikes/mobile/shared-record-evidence.md`](../../spikes/mobile/shared-record-evidence.md).
The disposable candidate runtimes, commands, proof contract, and proof-specific
Firestore allowance are no longer part of the product repository.

The selected beta path mirrors the same client boundary without sharing a
credential. `ios-beta` requires the isolated beta configuration and a separate
ignored API-key override, while `ios-development` refuses beta and the beta
mode refuses development. The repository boundary test builds and inspects
both variants using non-live placeholder keys and rejects a copied beta bundle
that contains the development project identity. The real restricted key then
passed approved and denied physical-iPhone smoke checks, and the fictional
fixtures were removed before the copied bundle was restored to development.

## App Check decision

App Check is required before external invitations, but enabling enforcement
before client and observation evidence would be premature. The mobile ADR
selects Capacitor. Issue #202 approved and compiled the pinned native App Attest
bridge. Issue #203 then registered distinct development and beta Fraud Defense
web providers plus App Attest iOS providers and added fail-closed native
configuration selection. Issue #204 implements the App Check-before-services
bootstrap, bounded error/retry UI, and production App Attest entitlement. No
live browser or physical-iPhone token has been proven yet, and enforcement
remains off. The
[registration record](app-check-provider-registration.md) distinguishes those
facts from the remaining rollout; the
[initialization record](app-check-client-initialization.md) records the current
Apple provisioning blocker and remaining device evidence.

Issue [#161](https://github.com/marathoner-app/marathoner/issues/161) is now an
epic with #201 through #206. Those slices own:

1. bounded beta billing and the exact Functions deployment guard (#201);
2. the reviewed Firebase 12 and native bridge dependency graph (#202);
3. the completed App Check registrations that preserve the distinct
   development and beta web/iOS boundary plus protected debug-token ownership
   (#203);
4. reCAPTCHA Enterprise and App Attest initialization before Firebase services
   are used (#204);
5. a monitoring-only observation window and rollback rehearsal (#205); and
6. staged enforcement and negative proof for beta Authentication, Firestore,
   and Functions before the invitation decision (#206).

App Check complements Authentication and Security Rules. It does not replace
ownership checks, membership enforcement, request validation, revision
preconditions, or incident monitoring.

## Environment separation decision

The current project is treated as legacy prototype/development infrastructure.
It must not silently become the founding-beta project, and its five legacy
accounts must not be copied to beta as an allowlist.

Issue [#168](https://github.com/marathoner-app/marathoner/issues/168) provisioned
the distinct `marathonerapp-beta` project and web registration without changing
the development defaults. Issue
[#125](https://github.com/marathoner-app/marathoner/issues/125) completed the
selected iOS key, explicit beta mode, and approved and denied physical-device
proof. The [beta project record](firebase-beta-project.md) contains the verified
public controls.

Beta operator access should use the dedicated privileged administrator identity
and recovery process. Public support uses `kevin@marathonerapp.com` and must not
hold cloud-administration authority. Development credentials, debug tokens, and
service identities must not be shared with beta.

## Secret-scanning alerts #1 through #4

Alert #1 reports a Google API key first committed in the original Firebase
configuration and repeated in historical compiled assets. GitHub marks it
publicly leaked because the detector cannot infer Firebase's public-client-key
model.

Alert #2 reports the separate beta Firebase browser key introduced with issue
#168. Its location is the versioned `marathonerapp-beta` client registration,
not a mobile-spike environment file or administrative credential. The beta key
is restricted to the same eight required Firebase APIs and only
`marathonerapp.com` and `www.marathonerapp.com`; it is unavailable from
localhost and GitHub Pages. The beta project remains an explicit, non-default
selection with membership-gated Firestore rules.

Alerts #3 and #4 report the beta and development API keys inside the versioned
Apple `GoogleService-Info.plist` files added by #203. Each location matches one
intended Firebase iOS registration and its exact project, bundle, sender, and
app ID are enforced by the build policy. These keys are necessarily delivered
inside the app bundle; neither file contains an administrator credential,
private key, or App Check debug token.

Alert #1 was resolved as **false positive** on 2026-09-30 after the live API and
website restrictions were saved and the deployed client passed Auth and
Firestore smoke tests. The recorded rationale is:

> Public Firebase browser key, not a credential. Verified intended project;
> limited to 8 required APIs and approved web origins. Live Auth login and owned
> Firestore read passed. Security Rules are deployed; App Check is tracked in
> #161. Rotation is not indicated.

Alert #2 was resolved as **false positive** on 2026-10-05 after its exact
historical location was matched to the isolated beta registration and the
already recorded API and website restrictions were reviewed. The resolution
does not classify the value as secret, does not broaden its permissions, and
does not activate beta.

Alerts #3 and #4 were resolved as **false positive** on 2026-10-06 after each
single location was matched to the intended beta or development Apple client
configuration and the exact registration validation passed. The resolutions
record that public Firebase Apple keys are shipped client identifiers, not
privileged credentials; they do not claim App Check initialization or
enforcement.

Rotation becomes necessary if the key belongs to the wrong project, permits an
unrelated or billable non-Firebase API, restrictions cannot be applied, abuse is
observed, or Google/Firebase advises rotation for a specific incident.

## Verification and change control

Evidence recorded on 2026-09-30, without secret values or participant data:

1. The live key showed exactly the eight API display names and three website
   referrers listed above after saving and reopening its settings.
2. The live provider table showed Email/Password enabled and Google disabled.
3. An existing account successfully signed in on the GitHub Pages deployment.
4. The authenticated Track view loaded that account's existing runs and shoe
   mileage, confirming an owned Firestore read. The repository rules suite
   covers anonymous and cross-owner denial.
5. GitHub secret-scanning alert #1 recorded the false-positive resolution and
   hardened-key rationale.
6. No check failed and no rollback was required.

Additional evidence recorded on 2026-10-05 for issue #178:

1. The replacement iOS development key showed exactly the three APIs listed
   above after saving and reopening its settings.
2. The canonical Capacitor application built, synchronized, and passed its
   repository boundary check with that key.
3. A physical-device authentication and Firestore-loading smoke test passed.
4. The proof-only document was absent, and the development Firestore rules were
   successfully compiled and deployed without the proof allowance.
5. The temporary cloud key and obsolete local spike environment files were
   removed only after the replacement proof passed.
6. The final development-project credential inventory contained the restricted
   browser key and `marathoner-ios-development`; the temporary spike key was
   absent.
7. The repository secret scan identified only the pre-existing beta public
   browser-key alert; its exact commit and file location matched issue #168,
   and it was resolved with the documented restricted-client rationale.

Additional evidence recorded on 2026-10-05 for issue #125:

1. `marathoner-ios-beta` appeared in `marathonerapp-beta` with no application
   restriction and exactly Cloud Firestore, Identity Toolkit, and Token Service
   APIs.
2. The explicit beta build and copied-bundle inspection passed with the real
   key while rejecting development project identity.
3. A fictional approved verified member authenticated on the physical iPhone
   and reached the empty **Plan** ready state.
4. A fictional verified non-member authenticated but received the expected
   permission error and no training data.
5. Sign-out plus force-quit returned to the signed-out state without prior
   account data.
6. Both temporary Auth users, the membership document, and their ignored local
   credential manifest were removed, then the development bundle boundary was
   restored and verified.

Any later console change must update this record or its owning issue. A Firebase
setting is not complete merely because the application still builds locally.

## Authoritative references

- [Firebase API key guidance](https://firebase.google.com/docs/projects/api-keys)
- [Firebase security checklist](https://firebase.google.com/support/guides/security-checklist)
- [Google Cloud API-key restrictions](https://cloud.google.com/docs/authentication/api-keys)
- [Firebase App Check for web](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
- [Marathoner App Check provider registration](app-check-provider-registration.md)
- [GitHub secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
- [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
