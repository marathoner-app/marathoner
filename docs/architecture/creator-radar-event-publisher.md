# Creator Radar development event publisher

Issue #102 adds Marathoner's half of the development/test-only integration
tracked by `marathoner-app/marathoner-creator-radar#58`. The code is inert: it
does not add an application server, deploy a function, call Creator Radar, or
change either cloud project.

## Boundary

The publisher lives outside `src/`. The Vite browser application has no import,
route, credential, audience, or transport for it. A future Marathoner backend
may compose the package with:

- an atomic referral-claim store that accepts only a SHA-256 token digest;
- a Google OIDC token provider that obtains a short-lived identity token for
  the exact private endpoint audience; and
- an HTTPS transport that sends the validated v1 envelope.

The package never accepts a Firebase ID token or a Google credential file. The
OIDC adapter returns a short-lived token in server memory; no key or secret is
stored by the package.

The audience and POST destination are both pinned to
`https://us-central1-marathoner-creator-radar-dev.cloudfunctions.net/ingestMarathonerEvent`.
The publisher rejects host, path, query, scheme, or trailing-slash differences
before requesting an identity token or invoking the transport.

The concrete metadata adapter makes one request to the fixed GCE metadata
identity endpoint with `Metadata-Flavor: Google`, validates the bounded JWT's
issuer, subject, exact caller email, audience, issue time, and expiry, and never retries. The HTTPS
adapter makes one canonical-JSON POST with the bearer token and event checksum,
rejects redirects, bounds time and response size, and never retries. Retry
policy stays with a future durable Marathoner backend; an explicit retry must
reuse the same validated event and deterministic ID.

## Privacy and attribution rules

- A raw referral token is accepted only by the server-side claim function. It
  must be high entropy, is digested immediately, and is never returned, logged,
  or included in an event.
- The claim store atomically consumes a digest once and returns an opaque
  handoff. Reuse fails closed, and the claim validity cannot exceed 24 hours.
- A separate provider-neutral account-binding store atomically creates or
  returns the binding for an opaque handoff. Only an exact retry of the same
  handoff, pseudonymous user, and account timestamp is idempotent; a different
  user or timestamp fails closed. Its input never contains the raw claim token
  or token digest.
- First eligible touch remains fixed. The acquisition window is 30 days from
  that touch; the activation window is 30 days from account binding.
- Store handoff is evidence of navigation, not installation. The contract has
  `firstAuthenticatedNativeUse`, not an install event. Aggregate store reports
  may corroborate download counts but cannot create individual credit.
- Events contain only an opaque handoff ID, SHA-256 digest, pseudonymous user
  ID when one exists, timestamps, environment, application version, and the
  event-specific minimum. Names, email, device or advertising IDs, IP address,
  fingerprint material, health data, workout history, plan contents, goals,
  and Firebase tokens are excluded.
- `referralVisit` and `storeHandoff` structurally exclude a pseudonymous user
  ID. `signup` and every authenticated event require the exact opaque
  `usr_`-plus-32-lowercase-hex form.
- An unbound app-store detour intentionally loses individual attribution.

Retries reuse the deterministic `mev_` event ID: the first 32 lowercase hex
characters of SHA-256 over recursively key-sorted canonical JSON of the complete
event with `eventId` omitted. A retry never creates a new event identity. Creator Radar remains the
idempotent receiver and may accept a repeated identical event without creating
a second record.

## Deployment phases

All phases are paused at the end of this pull request.

1. **Code review (this PR).** Run tests with fictional data and review the two
   repositories' canonical v1 contract. Do not authenticate to Google Cloud.
2. **Caller-identity plan.** Initialize
   `infrastructure/creator-radar-events-development` with the separately
   approved private GCS backend. Save and review a refreshed plan that creates
   exactly one resource:
   `creator-radar-events-dev@marathoner-d9bf9.iam.gserviceaccount.com`, with no
   project IAM grants, keys, secrets, APIs, workloads, or production resources.

   After an operator privately creates ignored
   `infrastructure/creator-radar-events-development/backend.private.tfbackend`
   from the checked-in example, the exact commands are:

   ```bash
   terraform -chdir=infrastructure/creator-radar-events-development init \
     -reconfigure \
     -backend-config=backend.private.tfbackend
   terraform -chdir=infrastructure/creator-radar-events-development plan \
     -refresh=true \
     -out=issue-102-caller-identity.tfplan
   terraform -chdir=infrastructure/creator-radar-events-development show \
     issue-102-caller-identity.tfplan
   ```

   The private artifact is exactly `issue-102-caller-identity.tfplan`. Accept
   only one create, zero updates, and zero destroys: the exact approved caller
   service account. Stop if initialization cannot use an approved private
   backend or the plan contains any other action.
3. **Target plan.** Separately review Creator Radar's development plan. The
   caller may receive only `roles/run.invoker` on the exact private development
   ingestion service. The receiver and deployer impersonation are owned by the
   target repository.
4. **Apply only after a new explicit approval.** Apply in dependency order,
   verify IAM and endpoint privacy independently, then run one fictional
   journey. Production remains prohibited.

Do not use local Terraform state. The real backend bucket input and saved plan
are private operational artifacts. The checked-in `.tfbackend.example` names a
unique state prefix but intentionally does not identify the private bucket.

## Structural Terraform guarantees

This stack declares one `google_service_account` and no IAM member,
IAM binding, key, secret, API-service, runtime, or production resource. Its
project and account ID are literals. The declaration is intentionally unapplied;
the saved-plan review and later explicit approval are the deployment gates. The
target repository owns the resource-level invoker binding; adding that
cross-project grant here would broaden this source-project stack's authority and
is intentionally excluded.
