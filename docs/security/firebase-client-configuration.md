# Firebase client configuration audit

- **Status:** Verified and hardened current prototype configuration
- **Audit date:** 2026-09-30
- **Owner:** Kevin Tulloch
- **Tracking issue:** [#22](https://github.com/marathoner-app/marathoner/issues/22)
- **Current project:** `marathoner-d9bf9` (`Marathoner`)

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
| Environment selector | Web, CI, Pages, and disconnected mobile-spike commands select the audited project as `development`; the distinct beta registration is available only to an explicit production-mode selection. | The [environment selection contract](firebase-environment-selection.md) and [beta project record](firebase-beta-project.md) define the boundary. Issue #125 still owns complete beta activation. |
| Browser API key | The committed value exactly matches the only `Browser key (auto created by Firebase)` in the project without printing or copying the value into this record. | It is an intentionally public Firebase client identifier. Rotation is not required solely because it appears in source or a browser bundle. |
| API allowlist | The key is restricted to the eight APIs listed below. Generative Language and the previously allowed unused AI, SQL, Storage, Realtime Database, distribution, hosting, messaging, ML, and Remote Config APIs are not allowed. | Keep this inventory narrow. A later feature must deliberately update this record before adding an API. |
| Application restriction | The key accepts browser requests only from the current GitHub Pages host, `localhost`, and `127.0.0.1`, using the exact patterns below. | Keep these origins until environment separation is complete. Add the custom domain only when #162 publishes it. |
| Sign-in providers | Email/Password is enabled and Google is disabled. The application implements only Email/Password, and the five visible legacy accounts all use the Email provider. | Keep Email/Password until the beta identity decision changes it. Do not migrate the legacy account list wholesale into beta. |
| Authorized domains | `localhost`, the two Firebase default hosts, and `marathoner-app.github.io` are authorized. `marathonerapp.com` is not. | Keep the current hosts while this project serves local/prototype use. Issue #162 adds the apex and `www` hosts with the actual deployment. |
| Cloud Firestore | The default `nam5` database is active. The live rule editor is byte-equivalent after whitespace normalization to the tracked `firestore.rules`. | Current rules enforce owner-path access and schema version 1. The separate [beta membership candidate](firebase-beta-membership.md) adds verified-email and approved-membership access but remains undeployed; #121 and the server-command migration must close the remaining beta rule boundary. |
| Realtime Database | The console offers **Create Database**; no database exists. | Remain disabled. |
| Cloud Storage | Storage is not configured and the Spark project cannot enable it without billing. | Remain disabled unless a future approved feature and ruleset require it. |
| App Check | The console shows **Get started**; no app or API enforcement is configured. | Implement and observe it through #161 after environment and mobile decisions, then enforce it before external invitations. |
| GitHub Pages | The workflow serves `https://marathoner-app.github.io/marathoner/` with HTTPS. No Pages custom domain is configured. | The GitHub Pages host is the only current production origin. Issue #162 owns the coordinated custom-domain migration. |
| Repository credentials | Current tracked files and historical filenames contain no Marathoner service-account file, private key, password, Firebase CLI token, or administrative credential. | Continue to prohibit privileged credentials in source. Use workload identity or provider-managed operator sessions. |
| GitHub secret controls | Secret scanning and push protection were disabled at audit start and are now enabled for the public repository. Alert #1 identified the public Firebase browser key. | Alert #1 was resolved as a documented false positive after the restrictions and live smoke tests passed. |

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
development workflow. Issue #125 must move local development to a separate
project or emulator-only default. Issue #162 adds `marathonerapp.com` and
`www.marathonerapp.com` only when those hosts actually serve the supported app.

Google sign-in is disabled because no shipped UI, service, test, or current
account depends on it. Email/Password remains enabled. Public signup remains
disabled in the application, but UI removal is not an authorization control;
#125 must enforce beta membership and verified email in the beta project.

## Temporary mobile Firebase key

Issues [#86](https://github.com/marathoner-app/marathoner/issues/86) and
[#87](https://github.com/marathoner-app/marathoner/issues/87) use a
separate temporary public client key, `marathoner-ios-auth-spike`, to compare
Firebase Email/Password authentication and one exact Firestore proof in the
Capacitor and Expo candidates. It belongs only to the development project and
allows exactly Cloud Firestore API, Identity Toolkit API, and Token Service API.
It does not replace or broaden the current browser key.

The temporary key has no application restriction because the proof must support
both a Capacitor WebView and Expo's React Native runtime. This exception is
accepted only for the isolated, non-production comparison: the value is stored
in ignored mode-`0600` local environment files, each client fails closed when
it is absent, the clients reject the beta project, no signup or Firestore path
other than `users/{uid}/mobileSpikeProofs/issue-87-shared-record` is exposed,
that path requires the authenticated owner and an exact fixed shape. The mobile
ADR selects Capacitor; issue #178 deletes the key after #177 provides the
replacement development path.
The value must never be printed or added to source, logs, screenshots, issues,
or pull requests.

The complete device sequence, failed persistence configurations, and Android
implications are recorded in
[`spikes/mobile/auth-evidence.md`](../../spikes/mobile/auth-evidence.md). The
live Firestore rule, device round trips, SDK differences, and confirmed cleanup
are recorded in
[`spikes/mobile/shared-record-evidence.md`](../../spikes/mobile/shared-record-evidence.md).
The selected production clients require their own platform-appropriate
application restrictions and App Check controls before external invitations.

## App Check decision

App Check is required before external invitations, but enabling enforcement in
the shared prototype project today would be premature. The mobile ADR selects
Capacitor and explicitly leaves its native App Attest bridge unproven.
Marathoner must first complete the selected development/beta boundary (#125),
promote the production shell (#177), and establish the material-command
endpoint (#158).

Issue [#161](https://github.com/marathoner-app/marathoner/issues/161) then owns:

1. distinct development and beta registrations;
2. reCAPTCHA Enterprise for beta web and the selected Apple attestation path;
3. protected debug tokens for local, emulator, and CI use;
4. a monitoring-only observation window;
5. negative and rollback rehearsals; and
6. enforcement for beta Authentication, Firestore, and Functions before the
   invitation decision.

App Check complements Authentication and Security Rules. It does not replace
ownership checks, membership enforcement, request validation, revision
preconditions, or incident monitoring.

## Environment separation decision

The current project is treated as legacy prototype/development infrastructure.
It must not silently become the founding-beta project, and its five legacy
accounts must not be copied to beta as an allowlist.

Issue [#168](https://github.com/marathoner-app/marathoner/issues/168) provisioned
the distinct `marathonerapp-beta` project and web registration without changing
the development defaults. The [beta project record](firebase-beta-project.md)
contains its verified public controls. Issue
[#125](https://github.com/marathoner-app/marathoner/issues/125) continues to own
rules activation, selected mobile-app registration, live access verification,
and the final environment boundary.

Beta operator access should use the dedicated privileged administrator identity
and recovery process. Public support uses `kevin@marathonerapp.com` and must not
hold cloud-administration authority. Development credentials, debug tokens, and
service identities must not be shared with beta.

## Secret-scanning alert #1

Alert #1 reports a Google API key first committed in the original Firebase
configuration and repeated in historical compiled assets. GitHub marks it
publicly leaked because the detector cannot infer Firebase's public-client-key
model.

Alert #1 was resolved as **false positive** on 2026-09-30 after the live API and
website restrictions were saved and the deployed client passed Auth and
Firestore smoke tests. The recorded rationale is:

> Public Firebase browser key, not a credential. Verified intended project;
> limited to 8 required APIs and approved web origins. Live Auth login and owned
> Firestore read passed. Security Rules are deployed; App Check is tracked in
> #161. Rotation is not indicated.

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

Any later console change must update this record or its owning issue. A Firebase
setting is not complete merely because the application still builds locally.

## Authoritative references

- [Firebase API key guidance](https://firebase.google.com/docs/projects/api-keys)
- [Firebase security checklist](https://firebase.google.com/support/guides/security-checklist)
- [Google Cloud API-key restrictions](https://cloud.google.com/docs/authentication/api-keys)
- [Firebase App Check for web](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
- [GitHub secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
- [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
