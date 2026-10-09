# Founding-beta Firebase project record

- **Status:** Provisioned; live rules, access boundary, and App Check providers verified
- **Tracking issue:** [#168](https://github.com/marathoner-app/marathoner/issues/168)
- **Parent:** [#125](https://github.com/marathoner-app/marathoner/issues/125)

The live billing state was reverified on October 8, 2026. Issue
[#201](https://github.com/marathoner-app/marathoner/issues/201) records the
approved beta-only Blaze attachment, USD 10 monthly alerts-only budget, and
repository-controlled Functions path. It does not authorize a deployment. The
[beta Functions deployment boundary](../operations/beta-functions-deployment.md)
keeps the verified cost controls and the later #205 deployment separate.

## Project boundary

The founding beta uses `marathonerapp-beta`. It is visibly distinct from the
`marathoner-d9bf9` development/prototype project and belongs to the
`marathonerapp.com` Google Cloud organization.

The dedicated privileged domain-administrator identity owns the beta project.
Its recovery factors are maintained outside the repository. The public support
identity at `kevin@marathonerapp.com` has no cloud-administration role. A
temporary organization-level Project Creator grant was used for provisioning,
verified against project-level ownership, and removed immediately afterward.

## Provisioned controls

The project controls were verified during provisioning on September 30, 2026,
the live rules and access boundary were verified on October 1, 2026, and the
selected iOS client boundary was verified on October 5, 2026:

| Control | Live setting |
| --- | --- |
| Billing | Blaze plan on the approved billing account; fixed USD 10 monthly alerts-only budget scoped to this project, with 50%, 90%, and 100% actual-spend alerts plus a 100% forecasted-spend alert; no enforced spend cap |
| Analytics and AI assistance | Google Analytics and Gemini disabled during project creation |
| Web registration | `Marathoner Beta Web`; Firebase Hosting not configured |
| Authentication | Email/Password enabled; Google and every other provider disabled |
| Firestore | Standard edition, default database, `nam5`, production-mode deny-all initialization |
| Browser-key APIs | Datastore, Firestore, Logging, App Check, Installations, Firebase Management, Identity Toolkit, and Token Service only |
| Browser-key websites | `https://marathonerapp.com/*` and `https://www.marathonerapp.com/*` only |
| Selected iOS key | `marathoner-ios-beta`; Cloud Firestore, Identity Toolkit, and Token Service APIs only; no application restriction for the Capacitor Firebase JavaScript client |
| App Check registrations | `Marathoner Beta Web` uses the beta-only Fraud Defense site key for `marathonerapp.com` and `www`; `Marathoner Beta iOS` uses App Attest for `com.marathonerapp.marathoner`; enforcement remains off |

The public Firebase web identifiers are versioned in `src/firebaseConfig.ts`.
They are identifiers delivered to browser clients, not administrator
credentials. Service-account keys, private keys, CLI tokens, passwords,
recovery material, and App Check debug tokens remain prohibited from source.

## Deployment boundary

The repository default, local development, CI defaults, GitHub Pages, and the
selected iOS development build remain pinned to development or emulators. Beta
can initialize only when a production web build explicitly selects
`VITE_FIREBASE_ENVIRONMENT=beta` or when the separately keyed `ios-beta` mode
is invoked for its reviewed device proof.

The beta Firebase configuration now also names the reviewed callable Functions
codebase behind an exact-project, beta-config-only predeploy guard. The default
development configuration remains blocked, and the beta guard additionally
requires a non-secret operator-intent phrase that names the prerequisite #143
and #204 gates. No Function was deployed, deleted, or invoked to establish this
repository boundary. Runtime configuration scales each current export to zero
and permits at most one instance per export.

The beta browser key intentionally permits no localhost or GitHub Pages
referrer. It will remain unusable from those origins. The custom-domain
publication and Authentication authorized-domain changes remain owned by #162.

The beta iOS path uses a separate `marathoner-ios-beta` key because the
browser key's website restrictions correctly reject the Capacitor WebView. The
iOS key allows only Cloud Firestore API, Identity Toolkit API, and Token
Service API. It has no application restriction because the selected shell uses
the Firebase JavaScript SDK rather than the native Apple SDK. Its value exists
only in the ignored mode-`0600` `.env.ios-beta.local`. The distinct web and
Apple App Check providers are now registered, with public native configuration
selected by the fail-closed build boundary. Client initialization and its
automated retry boundary are implemented. Live localhost/browser and
paid-Team physical-iPhone proof remain in #204, with observation and rollback
in #205 and enforcement in #206 before external invitations. See the
[provider registration record](app-check-provider-registration.md).

The reviewed rules were deployed on October 1, 2026, with this explicit target:

```sh
npx firebase deploy --config firebase.beta.json --project marathonerapp-beta --only firestore
```

The predeploy guard printed `Verified beta Firestore deploy target
marathonerapp-beta` before the CLI compiled and released
`firestore.beta.rules`. If the selected project differs from the `beta` alias,
deployment stops before upload.

## Repeatable live boundary verification

The operator-only verifier requires an active Firebase CLI session for
`kevin-admin@marathonerapp.com`, the exact beta project ID, and an explicit
confirmation phrase:

```sh
firebase login
npm run verify:beta-boundary -- \
  --project marathonerapp-beta \
  --confirm CREATE-TEST-AND-DELETE-BETA-FIXTURES
```

The verifier refuses every other project or operator. It first checks for
collisions with its fixed fictional UIDs, generates passwords only in memory,
and never prints credentials or tokens. It creates three fictional Auth users,
creates only the membership and training records required for the checks, and
removes every account and document it created in a `finally` cleanup. If a
collision exists, it stops rather than assuming ownership of an existing
account.

The October 1, 2026 live run produced this evidence:

| Boundary | Live result |
| --- | --- |
| Anonymous training write | Denied, HTTP 403 |
| Unverified user with an approved membership | Denied, HTTP 403 |
| Verified user without a membership | Denied, HTTP 403 |
| Approved verified user's own membership read | Allowed, HTTP 200 |
| Approved verified owner's own training write | Allowed, HTTP 200 |
| Approved verified owner's own training read | Allowed, HTTP 200 |
| Approved member's cross-owner training read and write | Denied, HTTP 403 |
| Participant mutation of its membership | Denied, HTTP 403 |
| Training read immediately after membership revocation | Denied, HTTP 403 |
| Fixture cleanup | All Auth users and Firestore documents removed |

No participant identity or data was used. The verifier's unit tests cover the
project, operator, confirmation, public-configuration, fixed-identity, OAuth
scope, and expected-response guards.

## Quota monitoring and recovery

The dedicated administrator owns quota review. Before each invitation batch
and daily while a founding cohort is active, the operator must review the beta
project's Firebase and Google Cloud usage pages for Firestore operations and
storage, Authentication activity, API errors, and quota saturation. The review
result belongs in the private operating log because it can contain participant
and traffic information.

The Blaze plan can create paid overage, and the alerts-only budget is not a hard
cap. A budget alert, quota warning, unexplained usage increase, or service-limit
error pauses new invitations and the affected workflow while the operator
investigates. Raising the budget, enabling a spend cap, or raising a paid quota
requires a separately reviewed decision; none is an incident workaround.
Administrator recovery factors remain outside the repository, and the
versioned project alias, rules, deployment guard, and this runbook provide the
rebuild path after account recovery.

## Remaining participant-activation gates

- Complete live App Check proof, observation, enforcement, and rollback in #204
  through #206.
- Publish the custom domain and authorized-domain configuration in #162.
- Complete participant-data integrity, deletion, incident, and support controls
  before invitations.
