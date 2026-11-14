# Garmin Activity push boundary

- **Status:** Implemented, deployed, and provider-configured in the closed beta; first real run proof remains open
- **Issue:** [#651](https://github.com/marathoner-app/marathoner/issues/651)
- **Provider scope:** Completed running summaries and deregistration only

## Outcome

Marathoner has a disabled-by-default server boundary that accepts an approved
Garmin Activity push, acknowledges durable receipt before run processing, and
submits supported running summaries through the existing
`run.import-activity` command. The browser and iOS shell never receive Garmin
credentials, grants, stable provider identities, raw push bodies, or private
endpoint configuration.

The live Garmin app, receiver, asynchronous processor, permission-change
endpoint, secret custody, provider configuration, and owner connection are now
active in the closed beta. Source defaults remain fail-closed. A real running
activity recorded after connection has not yet proved end-to-end delivery.

## Trusted receipt and processing

1. `garminActivityPush` is reachable only when the closed-beta project,
   completed-run command boundary, beta environment, and push activation flag
   all agree.
2. The receiver checks the configured provider client identity, the
   provider-owned source ranges held in private runtime configuration, HTTPS
   proxy position, content type, request size, and supported schema before any
   owner data changes.
3. Non-running summaries are acknowledged and ignored. Malformed supported
   summaries are rejected without a queue or owner write.
4. The receiver keeps only the minimum normalized run facts, including optional
   whole-BPM average and maximum workout heart rate when Garmin supplies them.
   Stable provider user and activity identities are one-way digests; names,
   devices, routes, coordinates, raw heart-rate samples, calories, raw payloads,
   and token material are not queued or logged.
5. A Firestore queue create is the durable acknowledgment boundary. The HTTPS
   response closes before the Firestore-triggered processor resolves an owner
   or changes a run.
6. `processGarminActivityPush` resolves the digested provider account to one
   connected, approved Marathoner owner and that owner's saved time zone.
   Unknown, disconnected, cross-environment, or unapproved mappings make no
   training change.
7. The processor submits a deterministic `run.import-activity` command. The
   existing import store owns same-provider replay, update ordering, one-run
   identity, and conservative Apple Health duplicate review.
8. A provider deregistration removes the server-held grant and account mapping
   so later deliveries cannot reach an owner. Existing completed runs follow
   Marathoner's normal correction and account-deletion policy.

## OAuth-to-push owner mapping

The provider's token response alone is not enough to route a later push.
After the server exchanges the authorization code, it performs the approved
server-side user lookup with the new access grant. The stable provider user
identity is digested immediately. Firestore atomically binds that digest to
the authenticated Marathoner owner while retaining the raw value nowhere.

One digest can map to only one owner in one environment. Reconnect replaces
the mapping atomically; disconnect and provider deregistration delete it.
Firestore Rules deny browser access to the mapping, OAuth state, grant record,
and push queue.

## Idempotency and failure behavior

- The same normalized push facts produce the same delivery document and the
  same material-command ID.
- Provider retry before or after processing does not create another queue item
  or visible run.
- A changed summary creates a new deterministic delivery and reaches the
  existing provider-activity ordering boundary.
- An older stored provider version is rejected as stale; equal ordering with
  different facts requires review.
- A Garmin-origin workout already seen through Apple Health produces one
  visible run plus a review state rather than a silent merge or duplicate.
- Processor failure leaves a durable pending delivery and the Firestore trigger
  retries the same command safely.

The approved push summary used for this integration does not expose raw route
data and does not provide a separate completed-activity deletion notification.
Marathoner's normalized contract and persistence layer retain tested deletion
semantics for a future provider-supported deletion event; this receiver does
not invent one. Provider deregistration is handled independently as consent
withdrawal.

## Runtime configuration

Live values belong only in the closed beta runtime and private provider tools.
The repository contains configuration names, empty examples, and synthetic
documentation ranges only.

| Name | Custody |
| --- | --- |
| `GARMIN_ACTIVITY_PUSH_ENABLED` | Non-secret activation flag; false by default in source and enabled in the reviewed closed-beta runtime |
| `GARMIN_ACTIVITY_PUSH_SOURCE_CIDRS` | Private beta runtime configuration copied from the approved provider documentation |
| `GARMIN_CLIENT_ID` | Beta server configuration used for OAuth and push verification |
| `GARMIN_USER_ID_URL` | Private beta server endpoint for the post-OAuth user lookup |
| `GARMIN_ACTIVITY_PUSH_URL` | Exact deployed receiver URL registered in the private Garmin app configuration |

## Verification

- Pure handler tests cover activation, source and client validation, body
  bounds, supported running types, unsupported-type ignore, stable replay
  identity, unknown owners, deregistration, sanitized queue data, and sanitized
  logs.
- OAuth adapter and handler tests cover the post-exchange user lookup without
  exposing the stable provider identity to clients.
- Firestore emulator tests cover atomic owner mapping, one visible run,
  provider retry, Apple Health duplicate review, unknown-owner isolation,
  deregistration cleanup, and client denial for every trusted collection.
- The full lint, test, build, material-command emulator, and Firestore Rules
  suites remain required before merge.

Endpoint registration, provider configuration, hostile-request rejection, and
one owner connection have passed. The first real post-connection run,
same-provider retry/update behavior, cross-provider duplicate handling,
disconnect, relaunch, and limited-account observation remain release proof in
#623 and #624, not evidence that may be fabricated in this repository.
