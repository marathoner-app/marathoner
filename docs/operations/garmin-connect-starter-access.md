# Garmin Connect Starter Activity API access

- **Status:** Starter access approved and configured for closed-beta proof
- **Prepared:** November 3, 2026
- **Submitted:** November 3, 2026
- **Portal reviewed:** November 4, 2026
- **Owner:** Kevin Tulloch
- **Application issue:** [#622](https://github.com/marathoner-app/marathoner/issues/622)
- **Access-verification issue:** [#649](https://github.com/marathoner-app/marathoner/issues/649)
- **Requested product:** Garmin Connect Starter business access, Activity API only
- **Dependent delivery:** [#623](https://github.com/marathoner-app/marathoner/issues/623)

This record began as the smallest truthful Garmin Connect request needed for
automatic completed-run import. Garmin now exposes active Starter access to the
owner account. The owner accepted the private provider checkpoint, created the
Activity-API-only beta app, placed its secret in private custody, registered the
reviewed endpoints, and enabled the closed-beta integration. The first real run
recorded after connection and the full #624 proof matrix remain open.

## Current posture

Marathoner is a founder-operated, pre-beta marathon-training product. It has
two internal owner/partner accounts today, no public account registration, no
public beta, no current revenue, and no public-production Garmin integration. The
planned closed experience cohort is five to eight invited adults, with no
expansion beyond eight without a new recorded decision.

The Garmin integration is active only for allowlisted closed-beta accounts. It
is not a public production integration and does not open signup or invitations.

The [closed-beta decision](../closed-beta-gate-decision.md) selects an
individual Apple membership and defers California LLC and Apple organization
enrollment. The application must therefore use the current legal owner/business
posture. It must not use the planned `Marathoner Technologies LLC` name or
imply that an LLC or Apple organization team already exists.

## Requested access and exclusions

Use Starter business access for the **Activity API only**. The intended
integration receives completed running activities after each runner gives
explicit OAuth consent. It uses Garmin's Starter push delivery and does not
request historical backfill.

This request excludes:

- the all-day Health API and Women's Health API;
- the Training API and Courses API;
- workout, plan, or course publishing to Garmin devices;
- live location or live activity recording;
- historical activity backfill;
- raw-data resale, advertising, or data-broker use; and
- processing Garmin device-sourced data with an external AI or machine-
  learning platform.

If Garmin presents a bundled entitlement, Marathoner still subscribes to and
processes only the Activity API data needed for this use case. Any proposal to
add another product requires a separate issue and privacy review.

The portal currently presents Starter access for up to 1,000 connected users,
push-only delivery, and no historical-data access. It also displays Health,
Women's Health, Training, and Courses as available products. Their presence is
not approval to configure or process them; the Marathoner app must select
Activity API only.

## Submitted app-creation answers

The approved portal exposed the app-creation fields below. Private owner
identity, phone number, provider-account details, app identifiers, and
credentials belong only in the live portal and private provider record. They
must not be copied into GitHub.

| Garmin field | Prepared answer |
| --- | --- |
| App name | `Marathoner` |
| OAuth redirect URL | The stable beta callback owned by `marathonerapp-beta`; do not submit a placeholder or development URL before #650 publishes the route. |
| Description | Use the bounded application overview below. |
| Activity-data association | `Associated with identifiable users` |
| APIs | Select `Activity API` only. Leave Health, Women's Health, Training, and Courses unselected. |
| Branding image URL | `https://marathonerapp.com/brand/marathoner-icon-256.png` |
| Company website | `https://marathonerapp.com/` |
| Contact phone number | Owner enters privately. |
| Sell Garmin activity data | `No` |
| Full legal company name | Owner enters the current sole-proprietor legal name. Do not use the planned LLC name. |
| Privacy policy | `https://marathonerapp.com/#privacy-data-use` after the corrected automatic-import notice is deployed. |
| How data is used or sold | State the minimum import use below and that Garmin data is not sold. |
| Specific purposes | Create or reconcile the consenting runner's completed running records and compare them with that runner's training plan. |
| Product | `Connect Developer - Starter` |

Do not select the portal's initial `Anonymous` or `Yes`-to-data-sale defaults.
Marathoner associates a Garmin activity with the consenting runner's account
and does not sell it.

### Application overview

> Marathoner is a founder-operated, pre-beta marathon-training companion. It
> helps adult runners prepare for a first marathon by reviewing a training plan,
> comparing completed runs with scheduled workouts, and adding their own effort,
> notes, shoes, and plan associations. Current access is limited to two internal
> owner/partner accounts. A future founding beta is planned for five to eight
> invited adults and remains capped at a small validation cohort.
>
> We request Garmin Connect Starter access to the Activity API only. After a
> runner gives explicit OAuth consent, Garmin push delivery would send completed
> running activity summaries to trusted Marathoner server infrastructure.
> Marathoner would normalize the minimum activity facts needed to create or
> reconcile a completed run: source identity, activity type, start time,
> duration, and distance. The runner could then add Marathoner-owned context.
>
> Marathoner does not yet have a production Garmin integration. This request
> excludes all-day Health data, historical backfill, workout or course
> publishing, advertising, and sale or resale of Garmin data.

### Business model

> Marathoner is a pre-revenue, founder-operated product in private internal
> testing. It has no public signup, paid beta, advertising, or sale of user data.
> A future commercial model has not been finalized; if launched, the expected
> direction is a runner-paid subscription for training-plan and analysis
> features. Garmin access would remove manual run entry for consenting runners.
> It would not be sold or monetized as a separate data product.

### Third-party services

> Google Firebase and Google Cloud are the only third-party services currently
> intended to process or store Garmin device-sourced data. They provide
> authentication, trusted server functions, OAuth secret and token custody,
> push-event processing, and owner-scoped training-record storage. No
> advertising platform or external AI or machine-learning platform will process
> Garmin device-sourced data in this integration. The integration does not
> collect all-day Health data, historical backfill, or FIT/GPS route files in
> this scope.

These answers preserve the public-safe application record. The current deployed
boundary is documented below; provider-private identifiers and credentials do
not belong in this repository.

## Data, consent, and deletion boundary

The provider-neutral contract in
[automatic completed-run import](../architecture/automatic-run-import.md)
limits the stored Garmin facts to the activity source and opaque provider
identity, supported running type, start time and time zone, duration, distance,
import timestamps, and the minimum metadata required for idempotency and
support. Marathoner-owned perceived effort, notes, shoe selection, and planned-
workout association remain separate.

- OAuth authorization must explain that Marathoner will receive completed
  Garmin running activities and why.
- Provider tokens and credentials never enter the browser bundle, native
  WebView, repository, logs, screenshots, issue evidence, or support messages.
- Garmin events terminate at a trusted server endpoint. Client code cannot
  accept provider callbacks or write provider payloads directly to Firestore.
- Repeated pushes are idempotent. Cross-provider duplicates remain conservative
  and uncertain matches require runner review.
- Disconnect stops future import and revokes provider authorization as Garmin
  requires.
- Account deletion removes Marathoner-owned imported records and provider token
  material according to the reviewed deletion workflow. Provider deletion or
  deauthorization callbacks must be implemented if Garmin's approved terms
  require them.
- Raw Garmin payloads are not operational evidence and must not be retained in
  ordinary logs.

The public privacy copy acknowledges Apple Health and Garmin as optional workout
sources and describes Google Firebase and Google Cloud processing, sale and
advertising exclusions, the absence of AI processing for imported workouts,
and the runner's access, correction, export, consent-withdrawal, and deletion
routes. It must continue to distinguish closed-beta availability from public
access.

## Reviewed technical boundary

The public Starter posture defines a server-to-server integration at this
level:

- Garmin uses OAuth 2.0 for runner authorization. Provider credentials and
  runner token material stay on Marathoner's backend.
- Starter delivery is HTTPS push only. Garmin sends new summaries after
  connection; there is no historical backfill.
- Configure only the completed-activity delivery needed to normalize supported
  running records into the provider-neutral import contract. Do not configure
  activity files, GPS tracks, all-day Health, Training, Courses, or Women's
  Health in this scope.
- The trusted push receiver must use the provider-supported delivery checks,
  strict request-size and schema validation, idempotent persistence, and a
  privacy-safe asynchronous processing boundary.
- Disconnect must remove Marathoner-held token material and stop future import
  according to the approved provider flow.

The repository may name configuration contracts but never store their values:

| Configuration name | Custody and purpose |
| --- | --- |
| `GARMIN_CLIENT_ID` | Beta server configuration; identifies Marathoner's live Starter app. It is never a development fixture value. |
| `GARMIN_CLIENT_SECRET` | Secret Manager in `marathonerapp-beta`; used only by backend token exchange and refresh. |
| `GARMIN_OAUTH_REDIRECT_URI` | Non-secret beta configuration matching the exact deployed callback registered with Garmin. |
| `GARMIN_ACTIVITY_PUSH_URL` | Non-secret deployed beta endpoint registered in Garmin's private configuration tools. |
| `GARMIN_ACTIVITY_PUSH_ENABLED` | Non-secret beta activation flag; false by default in source and enabled only in the reviewed beta runtime. |
| `GARMIN_ACTIVITY_PUSH_SOURCE_CIDRS` | Private beta runtime configuration copied from the approved provider documentation; never issue or PR evidence. |
| `GARMIN_USER_ID_URL` | Private beta server endpoint used to bind a connected provider account to one Marathoner owner. |

Issue #650 implements the trusted callback as the exported
`garminOAuthCallback` HTTPS function and keeps source defaults disabled. The
[trusted OAuth boundary](../architecture/garmin-oauth-boundary.md) defines the
additional private runtime endpoint names, state lifecycle, environment guard,
grant custody, replay behavior, and disconnect cleanup. The route is deployed,
registered, and enabled in the reviewed beta runtime, and one owner connection
has completed provider authorization.

Issue #651 implements `garminActivityPush` plus its asynchronous Firestore
processor and keeps both default-off in source. The
[Activity push boundary](../architecture/garmin-activity-push-boundary.md)
defines source validation, durable acknowledgment, hashed owner mapping,
minimal normalization, duplicate review, deregistration, and privacy-safe
evidence. Both functions are deployed and the receiver is registered in the
private Garmin configuration. The first real running delivery remains open.

Provider-specific details that are not public belong in private implementation
configuration, not this repository. #650 and #651 must preserve that boundary
while keeping the provider adapter independently testable with synthetic
fixtures.

## Environment ownership

Marathoner does not share live provider credentials across environments:

| Environment | Garmin posture |
| --- | --- |
| Development and emulators | Synthetic OAuth outcomes and push fixtures only. No live Garmin client ID, secret, runner grant, or provider endpoint. |
| Closed beta (`marathonerapp-beta`) | Sole live Garmin client, backend callback, token custody, push receiver, runner mapping, and disconnect path. Access remains allowlisted. |
| Public production | Not configured. A future transition requires a separate release and provider review. |

The exact callback and push URLs are outputs of #650 and #651 and are registered
only in the beta app. Do not reuse localhost, the GitHub Pages origin, the
development project, or a temporary URL for live provider configuration.

## Ownership and private custody

| Responsibility | Owner | Private custody rule |
| --- | --- | --- |
| Garmin application and provider correspondence | Kevin Tulloch | Owner-controlled provider account and private mailbox; GitHub records only status and non-sensitive provider requirements. |
| OAuth client credentials and webhook verification secrets | Kevin Tulloch | Google Cloud Secret Manager or the provider-supported equivalent for the selected Firebase project; never client configuration or repository variables. |
| Per-runner OAuth grants and refresh material | Trusted server implementation owned by Kevin Tulloch | Encrypted provider/token store scoped by Firebase owner identity; never exposed to the browser or operating-partner workflow. |
| Push endpoint, verification, retry, and incident response | Kevin Tulloch | Cloud Functions/Cloud Run configuration and private provider portal. Public evidence is pass/fail only. |
| Runner consent, disconnect, and deletion behavior | Kevin Tulloch | Product and deletion records; no Garmin credentials or raw payloads in support tickets. |
| Participant communication and relationship feedback | Operating partner | May explain the product and collect ordinary feedback; has no provider credential, token, webhook, or participant-record access. |

The repository may name secret keys or configuration contracts only after an
implementation issue defines them. It must never contain secret values,
provider account identifiers, personal addresses, contracts, participant
identities, or private correspondence.

## Submission and external-dependency record

Update this table after every provider response. Do not paste private messages;
record only the status, public-safe requirement, and next action.

| Field | Current record |
| --- | --- |
| Application date | November 3, 2026 |
| Portal review date | November 4, 2026 |
| Status | `approved and usable`; the private Activity-API-only beta app and reviewed endpoints are configured. |
| Requested product | Starter business access; Activity API only |
| Portal entitlement | Starter access for up to 1,000 connected users, push-only delivery, and no historical data. Only Activity API is in Marathoner's approved scope. |
| Public-safe application reference | None; the confirmation page supplied no reference number |
| Provider blocker | None for implementation. Private terms and credentials remain outside the public repository. |
| Product prerequisite | Completed: privacy notice, trusted OAuth, push receiver, permission-change endpoint, private secret custody, and provider endpoint registration. |
| Next action | Record a real owner-controlled run after connection and complete the bounded proof in #623 and #624. |
| #623 state | Unblocked implementation is complete; the parent remains open for real-run and remaining live evidence. |

Possible provider outcomes are `submitted`, `more information requested`,
`approved but terms pending`, `approved and usable`, `rejected`, or `legal
entity required`. Record the outcome here and on #622 without private content.

## Stop-and-review conditions

Stop before accepting or committing if Garmin presents any of the following:

- a fee, minimum spend, device purchase, revenue share, or paid support term;
- an Enterprise upgrade or user capacity beyond Starter;
- a contract, data-processing addendum, indemnity, exclusivity, or material
  retention obligation not already approved by the owner;
- access to Health, Women's Health, Training, Courses, historical data, FIT/GPS
  files, or another product outside this request;
- a requirement to claim a legal entity that does not exist;
- a privacy, deletion, branding, attribution, security, or support obligation
  Marathoner cannot truthfully satisfy; or
- a request to expose credentials, personal addresses, contracts, or private
  correspondence in public evidence.

The owner reviewed the exact terms privately before configuration. Any later
scope, pricing, contract, or product change still triggers this stop-and-review
boundary.

## Completed configuration checkpoint

1. The corrected public privacy notice is deployed at the submitted policy URL.
2. The owner reviewed the binding agreement privately; it is not reproduced in
   issues or source control.
3. The stable beta OAuth callback was deployed before registration.
4. The app uses Activity API only, identifiable-user association, no data sale,
   the current sole-proprietor legal name, and Starter product.
5. The generated secret moved directly into beta Secret Manager and is absent
   from chat, terminal transcripts, source control, screenshots, and issues.
6. The provider tools accept the registered endpoints. #623 now remains open
   for real-run evidence rather than configuration work.

## Official references

- [Garmin Connect Developer Program overview](https://developer.garmin.com/gc-developer-program/overview/)
- [Garmin Starter access request](https://www.garmin.com/en-US/forms/StarterGarminConnectDeveloperAccess/)
- [Garmin Activity API](https://developer.garmin.com/gc-developer-program/enterprise/activity-api/)
- [Garmin API brand guidelines](https://developer.garmin.com/downloads/brand/Garmin-Developer-API-Brand-Guidelines.pdf)
