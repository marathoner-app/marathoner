# Garmin trusted OAuth boundary

- **Status:** Implemented and verified with synthetic provider fixtures; live beta configuration and deployment remain off
- **Issue:** [#650](https://github.com/marathoner-app/marathoner/issues/650)
- **Provider scope:** Garmin Connect Activity API only

## Outcome

Marathoner owns a server-only OAuth boundary for connecting and disconnecting a
Garmin account. The browser receives only a short-lived authorization URL and a
sanitized connection status. Real client credentials, authorization codes,
PKCE verifiers, access grants, refresh grants, and provider responses never
enter the browser bundle, native WebView, repository, application logs, or
ordinary support output.

The implementation is deliberately disabled by default. It does not create a
Garmin application, accept provider terms, create credentials, deploy a live
callback, or authorize a runner. Those remain explicit owner actions after the
private provider setup is ready.

## Trusted flow

1. `startGarminConnection` requires Firebase Authentication, accepted App Check,
   and approved beta membership.
2. The server creates opaque state and a PKCE verifier, stores only a digest of
   the browser-visible state, and binds the record to the authenticated owner,
   selected environment, and a ten-minute expiry.
3. `garminOAuthCallback` accepts the provider redirect over HTTPS. It validates
   the state record, environment, expiry, and one-time callback reservation
   before any token exchange or owner mapping.
4. The server exchanges the code, performs the approved server-side user-ID
   lookup, and stores the normalized grant plus a one-way account digest under
   the authenticated owner's server-only connection record. Callback replay
   returns the prior outcome without repeating the exchange.
5. Reconnect replaces the current grant. Prior grants remain in trusted custody
   until provider revocation succeeds.
6. `disconnectGarminConnection` marks the connection unusable before contacting
   the provider, retries provider revocation safely, and deletes all held grant
   material after revocation succeeds.
7. `getGarminConnection` exposes only `connected`, `disconnecting`, or
   `disconnected` plus the connection time. It never returns provider identity
   or token material.

Firestore Rules explicitly deny browser reads and writes for OAuth state and
provider connection documents. Admin SDK access remains confined to deployed
trusted functions.

## Runner-facing controls

Account Settings uses only the three sanitized callable results above. A
runner can start or replace a connection in a separate provider tab, check the
server-owned connection state after returning, and disconnect safely. The UI
does not receive tokens, provider identifiers, callback details, or raw
provider failures.

Connected runners see a missing-run recovery path that asks them to allow for
provider processing before logging the run manually, because manual fallback
could create a duplicate when a delayed activity arrives. The approved push
model has no truthful client-side "check for runs now" operation, so the UI
offers connection checking and reconnection instead of pretending to poll the
provider. A failed disconnect remains visibly recoverable until server-side
revocation succeeds.

## Environment boundary

Live OAuth is permitted only when all three conditions agree:

- `GARMIN_OAUTH_ENABLED=true`;
- `GARMIN_OAUTH_ENVIRONMENT=beta`; and
- the deployed Google Cloud project is `marathonerapp-beta`.

Development and emulator verification use synthetic provider behavior and
never load a live client, endpoint, runner grant, or secret. State and
connection records also carry the environment name, and mismatched callbacks,
status reads, and disconnect requests are rejected or appear disconnected.

## Runtime configuration

The repository contains configuration names, empty environment examples, and
obviously synthetic `.invalid` test fixtures only. Live values belong in the
closed beta runtime and private provider controls.

| Name | Custody |
| --- | --- |
| `GARMIN_OAUTH_ENABLED` | Non-secret beta activation flag; false by default |
| `GARMIN_OAUTH_ENVIRONMENT` | Non-secret environment guard |
| `GARMIN_CLIENT_ID` | Beta server configuration |
| `GARMIN_CLIENT_SECRET` | Google Secret Manager, bound only to trusted functions |
| `GARMIN_OAUTH_REDIRECT_URI` | Exact deployed `garminOAuthCallback` URL |
| `GARMIN_AUTHORIZATION_URL` | Private beta server configuration |
| `GARMIN_TOKEN_URL` | Private beta server configuration |
| `GARMIN_USER_ID_URL` | Private beta server configuration used after token exchange |
| `GARMIN_REVOCATION_URL` | Private beta server configuration |

No configuration value is required for builds or synthetic checks. A live
deployment must stop if any HTTPS endpoint, callback, client identifier, or
secret is missing.

## Verification

The boundary is covered at three levels:

- pure handler tests cover authentication, App Check, membership, expiry,
  environment isolation, callback replay, reconnect, sanitized logging,
  revocation retry, and deletion;
- HTTP-adapter tests use synthetic endpoints and token responses only;
- Firestore emulator tests cover atomic reservation, owner mapping,
  stable provider-account digest mapping, environment isolation, replay,
  disconnect deletion, and browser denial.
- component and viewport tests cover connect, connected, delayed-run recovery,
  reconnect, disconnect retry, disabled/failure states, phone layout, and 200%
  text without relying on a live provider account.

The resulting digest is the only bridge to the
[Activity push boundary](garmin-activity-push-boundary.md). The raw stable
provider user ID is not persisted, logged, or returned to a client.

Live callback, provider consent, reconnect, and revocation evidence can be
recorded only after the owner accepts the private setup checkpoint and creates
the beta application without copying credentials or provider-private material
into GitHub.
