# Garmin Connect Starter access application

- **Status:** Submitted; awaiting Garmin review
- **Prepared:** November 3, 2026
- **Submitted:** November 3, 2026
- **Owner:** Kevin Tulloch
- **Issue:** [#622](https://github.com/marathoner-app/marathoner/issues/622)
- **Requested product:** Garmin Connect Starter business access, Activity API only
- **Dependent delivery:** [#623](https://github.com/marathoner-app/marathoner/issues/623)

This record prepares the smallest truthful Garmin Connect request needed for
automatic completed-run import. It is an operations record, not evidence that
Garmin has approved Marathoner or that a production integration exists.

## Current posture

Marathoner is a founder-operated, pre-beta marathon-training product. It has
two internal owner/partner accounts today, no public account registration, no
public beta, no current revenue, and no production Garmin integration. The
planned founding cohort is five to eight invited adults, bounded to at most 12
concurrent participants and 15 accepted participants during validation.

The California LLC and Apple organization enrollment described in the
[legal-entity decision](legal-entity-and-apple-enrollment.md) are intentionally
deferred. The application must therefore use the current legal owner/business
posture. It must not use the planned `Marathoner Technologies LLC` name or
imply that the LLC, an Apple organization team, or outside beta already exists.

## Requested access and exclusions

Request Starter business access to the **Activity API only**. The intended
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

## Public form answers

Garmin's current Starter request form asks for the fields below. Private owner
identity, address, email, and provider-account details belong only in the live
form and the private provider record. They must not be copied into GitHub.

| Garmin field | Prepared answer |
| --- | --- |
| Company name | Enter the current legal owner/business name and identify Marathoner as the product. Do not enter the planned LLC name. |
| Company website | `https://marathonerapp.com/` |
| Company privacy policy | `https://marathonerapp.com/#privacy-data-use` |
| Contact name, title, email, address | Owner enters privately. Use `Founder and technical maintainer` as the title. |
| Primary business service | `Coaching & Training Programs` |
| Industry | `Fitness & Wellness` |
| APIs requested | Select `Activity API` only. Leave Courses, Health, Training, and Women's Health unselected. |
| Expected connected users in next 12 months | `0-100` |
| Existing Garmin contact | `No` |

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

These answers describe the requested direction, not deployed behavior. If the
implementation changes before submission, update the answers first.

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

The public privacy copy is truthful for today's product: it says watch data is
not currently imported. Update that copy and the complete privacy inventory
before enabling the integration for any outside participant.

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
| Status | Submitted; Garmin displayed `Thank you for your interest, we'll be reaching out to you soon.` |
| Requested product | Starter business access; Activity API only |
| Approved products | None |
| Public-safe application reference | None; the confirmation page supplied no reference number |
| Provider blocker | Awaiting provider review; Garmin publishes no approval-time guarantee |
| Next action | Monitor the private owner mailbox and record Garmin's response without copying private correspondence |
| #623 state | Blocked until usable Activity API access and acceptable terms are confirmed |

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

The owner must review the exact term before commitment. Provider approval alone
does not unblock #623 if the access is unusable or the attached terms have not
been accepted.

## Verification after submission

1. Confirm the submitted request selected Activity API only.
2. Record the submission date and a non-sensitive reference if Garmin provides
   one that is safe to publish.
3. Keep the confirmation and correspondence in the private provider record.
4. Record any provider request or blocker in the external-dependency table.
5. Do not close #622 or start #623 until the repository status matches the real
   provider state.

## Official references

- [Garmin Connect Developer Program overview](https://developer.garmin.com/gc-developer-program/overview/)
- [Garmin Starter access request](https://www.garmin.com/en-US/forms/StarterGarminConnectDeveloperAccess/)
- [Garmin Activity API](https://developer.garmin.com/gc-developer-program/enterprise/activity-api/)
- [Garmin API brand guidelines](https://developer.garmin.com/downloads/brand/Garmin-Developer-API-Brand-Guidelines.pdf)
