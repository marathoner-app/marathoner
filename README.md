# Marathoner

Plan, track, and understand marathon training in one focused workspace.

Marathoner is an actively developed training companion for runners preparing
for a marathon. The product is being built in small, understandable increments
toward a conditional iOS founding beta. January 15, 2027 remains a
scope-or-date decision checkpoint and optimistic invitation floor, not a
delivery promise. The November 3 capacity forecast places the likely invitation
decision on February 28, 2027 and the conservative capacity date on August 8,
subject to every evidence gate. Apple Health import has passed owner-device
proof, and the approved Garmin integration is configured for the closed beta;
its first real completed-run delivery and the cross-provider proof matrix remain
open.
The first invitation batch is limited to five to eight allowlisted adults who
already run consistently and are preparing for a first marathon. The existing
responsive web application remains the planning and analysis surface; Android
external release is not on the beta critical path.

The active [closed-beta delivery decision](docs/closed-beta-gate-decision.md)
uses an individual Apple Developer Program membership for that small TestFlight
cohort and permits clearly disclosed, versioned provisional methodology during
the experience beta. California entity formation, Apple organization migration,
and independent methodology review are deferred to explicit expansion triggers;
TestFlight App Review and every privacy, access, reliability, safety, support,
and consent gate remain required.

If you are reviewing Marathoner for the first time, follow the numbered
[operating partner start-here guide](docs/operating-partner-guide.md). It
separates implemented behavior, active commitments, dated forecasts, and
historical evidence so a new reviewer does not have to reconstruct the project
from hundreds of issues.

## Project status

Marathoner is currently a deployed pre-beta product under active development.
It is not open for public signup or founding-beta invitations. The existing
experience includes:

- **Plan:** explicit closed-beta builds can generate, review, approve, and
  persist a plan from the pinned provisional rules for eligible, consented
  accounts; ordinary public builds cannot import those artifacts.
- **Track:** import completed runs from Apple Health or Garmin, retain manual
  entry as a fallback, associate runs with planned workouts, and enrich, edit,
  or delete completed runs.
- **Analyze:** calculate mileage, pace, and run counts from completed-run history.
- **Runner setup:** save and revise the minimum first-marathon context, including
  target timing, recent running, availability, constraints, and unit preference.
- **Authentication:** existing accounts can sign in or request a password reset
  through Firebase email/password authentication. Public account creation is
  disabled while the beta trust and access controls are incomplete.

Explicit closed-beta web and iOS builds can map a saved runner profile into the
pinned provisional plan rules, produce supported or unsupported results,
present guarded guidance and conservative symptom escalation, and require
approval for a bounded material adaptation. Eligibility, current consent,
exact artifact versions, and server-owned controls are rechecked at the trusted
boundary. Ordinary builds still exclude the artifacts, and development
rehearsal remains separate. Issue
[#691](https://github.com/marathoner-app/marathoner/issues/691) owns the dated
cross-client, rollback, and invitation-readiness proof; implemented behavior is
not represented as professionally approved or invitation-ready.

The visible features share the typed Firestore persistence layer. Follow the
[open issues](https://github.com/marathoner-app/marathoner/issues) to see what is
being built next.

## Governance and security

Marathoner is founder-led, with Kevin Tulloch as the one active technical
maintainer and an operating-partner role focused on in-person relationships,
participant discovery, recruiting, interviews, and feedback. The
[governance record](GOVERNANCE.md) separates that operating role from current
merge, release, credential, and participant-data authority. Repository access
does not establish equity or legal co-ownership. [CONTRIBUTING.md](CONTRIBUTING.md)
defines the issue-to-PR workflow, and [SECURITY.md](SECURITY.md) provides the
private vulnerability reporting path and safe-research boundaries.

The active [product-first free-beta decision](docs/product-first-beta-decision.md)
makes a functional, responsibly testable product the critical path. Formal
commercial interviews, refundable reservations, and payment evidence are
optional future work rather than release gates. The canonical
[zero-to-beta plan](docs/zero-to-beta-plan.md) defines the product
commitments, delivery waves, monthly evidence gates, safety boundary, and
single-maintainer technical delivery model. The
[capacity forecast](docs/capacity-forecast.md) tests those
gates against measured AI-assisted delivery and external waits. The dormant
[commercial proof sprint](docs/commercial-proof-sprint.md) and completed
preparation artifacts remain available if commercial validation becomes a
future priority; they do not contain real participant evidence.
Their selected private-system boundary, consent separation, retention schedule,
public aggregation rule, and activation state are documented in the
[commercial research operations runbook](docs/operations/commercial-research-operations.md).
The versioned
[fictional readiness and adaptation concepts](docs/design/commercial-research-artifacts/README.md)
provide the non-prescriptive artifacts used by the frozen protocol.
The frozen
[commercial interview protocol and evidence rubric](docs/operations/commercial-interview-protocol.md)
defines how those concepts are screened, facilitated, classified, and reduced
to privacy-safe directional evidence before any real response is collected.
The [internal-first resource-sequencing decision](docs/internal-first-resource-sequencing.md)
keeps implementation and owner-controlled validation moving before material
external spending. Its November 7
[closed-beta update](docs/closed-beta-gate-decision.md) distinguishes gates for
the five-to-eight-person experience beta from the stronger organization and
professional-review gates that return before broader use.
[GitHub issue #104](https://github.com/marathoner-app/marathoner/issues/104)
is its live execution tracker, and
[issue #117](https://github.com/marathoner-app/marathoner/issues/117) records
the founding-beta contract. The
[committee remediation sprint](docs/committee-remediation-sprint.md) records
the prioritized work and evidence required to resolve the September 2026
product, investor, architecture, delivery, and operations review. The
[qualified methodology review](docs/methodology/README.md) defines the future
professional-review protocol, versioned inventory, and approval evidence. The
[founding-beta methodology-review decision](docs/methodology/founding-beta-review-decision.md)
is superseded for the first closed experience beta: independent review remains
deferred until an expansion trigger, while provisional status, versioning,
unsupported results, consent, and conservative safety behavior remain required.
The
[founding-beta endurance-rules draft](docs/methodology/artifacts/beta-rules/0.2.0-draft/README.md)
is the exact unapproved packet prepared for testing and later independent
endurance-methodology review. Only explicit closed-beta builds may import the
pinned set, and only eligible, consented accounts may receive its results. The
owner-only [internal plan rehearsal](docs/methodology/internal-plan-rehearsal.md)
continues to load the same plan artifact in a separate development mode. The
[public prototype access decision](docs/public-prototype-access.md) records why
open registration is disabled and which trust paths must exist before access
expands. The
[product vision](docs/product-vision.md) describes the larger destination, and
the [founding cohort plan](docs/founding-cohort-plan.md) describes recruitment
and validation.

## Technology

- React and TypeScript
- Vite
- Capacitor 8 for the selected root iOS shell
- Firebase Authentication, Cloud Firestore, and Cloud Functions
- Framer Motion
- Apache ECharts
- Vitest and Testing Library
- Playwright
- ESLint

## Current architecture

Marathoner is centered on a single-page React application with no client-side
router or general-purpose application server. Its authenticated training data
uses typed repositories backed by Cloud Firestore, and the repository contains
a bounded Cloud Functions backend for trusted material commands, account
deletion, and Garmin OAuth and push ingestion. Those reviewed boundaries are
emulator-proven and deployed to the beta project. The valid-client observation
window, paid-team iPhone
proof, rollback evidence, and staged enforcement remain gated by issue #205
and its successors. The accepted
[mobile client ADR](docs/architecture/mobile-client-architecture.md) selects a
thin Capacitor iOS shell around this root application. The committed shell is a
development foundation. App Check gates Firebase client startup in code and an
owner-only development browser and iPhone debug path has passed, but monitored
beta traffic and a paid Apple Developer Program profile carrying App Attest
remain unproved; beta activation, daily-use behavior, accessibility, and
TestFlight are still explicit release gates.

| Path | Responsibility |
| --- | --- |
| `index.html` | Provides the browser document and loads the React entry point. |
| `src/main.tsx` | Mounts the application in React strict mode and loads the global stylesheet. |
| `src/App.tsx` | Owns the active Plan, Track, or Analyze section and renders the application shell. |
| `src/components/` | Contains the feature views, authentication forms, title, subtitle, and supporting UI. |
| `src/domain/training/` | Defines shared training entities, identifiers, units, validation, and calculations without React or Firebase dependencies. |
| `src/domain/guidance/` | Defines the shared versioned guidance, review, trigger, suppression, correction, and fail-closed presentation contract. |
| `src/domain/recommendations/` | Defines complete, versioned recommendation evidence and accepted/declined decision invariants. |
| `src/domain/safety/` | Defines the conservative safety-escalation contract used by internal rehearsal and the guarded provisional closed beta. |
| `src/persistence/` | Defines typed training repositories, Firestore conversion, storage paths, ownership integration tests, and recoverable persistence errors. |
| `src/training/` | Owns authenticated training-data loading, shared feature state, and cross-feature mutations. |
| `src/recommendations/` | Owns recommendation-evidence loading and the fail-closed decision-review content boundary. |
| `src/onboarding/` | Owns the resumable runner-profile intake, validation, unit conversion, and completion checks. |
| `src/diagnostics/` | Retains bounded, privacy-safe slow-operation diagnostics for user-reported latency. |
| `functions/` | Contains the bounded trusted material-command and account-deletion handlers plus their emulator coverage. |
| `packages/training-contract/` | Contains versioned portable command and record contracts shared across client and server boundaries. |
| `src/services/appCheckBootstrap.ts` | Selects the browser or iOS App Check provider, proves a bounded token, and enables refresh before Firebase services. |
| `src/services/firebaseClient.ts` | Initializes the shared Firebase app, waits for App Check, and only then exposes Authentication or the app to lazy data services. |
| `src/services/authService.ts` | Contains authentication operations and safe Firebase error mapping against the shared client. |
| `src/firebaseConfig.ts` | Identifies the Firebase web project used by the client. |
| `src/**/*.test.ts(x)` | Keeps unit and component tests beside the code they verify. |
| `src/test/` | Contains shared test setup and environment-level tests. |
| `server/creatorRadarEvents/` | Contains an inert server-only development attribution publisher; it is excluded from the browser graph and has no deployed runtime. |
| `infrastructure/creator-radar-events-development/` | Declares the unapplied, keyless development caller identity with no source-project roles. |
| `src/styles/` | Contains global and application-shell styles. Feature-specific styles remain beside their components. |
| `vite.config.ts` | Configures React, environment-specific asset paths, tests, Firebase selection, and build-time-only injection of internal rehearsal artifacts. |

The current application flow is deliberately small:

1. `src/main.tsx` mounts an App Check startup gate.
2. The gate proves a browser Enterprise or native App Attest token before
   Firebase services; failure stays in an accessible retry state.
3. `AuthProvider` resolves the Firebase session and gates personal features.
4. `TrainingDataProvider` mounts owner-scoped Firestore listeners and keeps one
   shared profile, plan, workout, run, and shoe view. Cache-originated results
   remain visibly stale until server confirmation arrives.
5. An incomplete runner profile opens the resumable onboarding intake before
   plan evaluation; saving progress writes through the same profile repository.
6. Opening Plan, Track, or Analyze mounts a view over that shared snapshot.
7. Current feature mutations reconcile with server-confirmed listener results,
   so every open panel observes the same records. Track creation, update,
   deletion, and automatic imports use the trusted material-command boundary;
   profile and shoe writes remain explicit owner-scoped repository operations.
   The participant recommendation surface stays fail-closed with an empty
   approved-content registry.

The shared training domain model is documented in
[`docs/architecture/training-domain-model.md`](docs/architecture/training-domain-model.md).
The versioned, methodology-neutral input, proposed-plan, unsupported-result,
validation, provenance, and fixture boundary is documented in
[`docs/architecture/plan-generation-contract.md`](docs/architecture/plan-generation-contract.md).
The versioned, fail-closed guidance lifecycle and cross-client selection
contract is documented in
[`docs/architecture/versioned-guidance-contract.md`](docs/architecture/versioned-guidance-contract.md).
The owned, versioned runner-profile contract is documented in
[`docs/architecture/runner-profile-persistence.md`](docs/architecture/runner-profile-persistence.md).
Cross-feature behavior is documented in
[`docs/architecture/training-feature-integration.md`](docs/architecture/training-feature-integration.md).
The accepted live-read, online-write, conflict, and local-cache contract is
documented in
[`docs/architecture/training-data-synchronization.md`](docs/architecture/training-data-synchronization.md).
The accepted founding-beta automatic completed-run import sequence, provider
boundaries, duplicate rules, and invitation gate are documented in
[`docs/architecture/automatic-run-import.md`](docs/architecture/automatic-run-import.md).
The approved account and training-data deletion boundary, complete data
inventory, failure-recovery model, and implementation split are documented in
[`docs/architecture/account-deletion.md`](docs/architecture/account-deletion.md).
The guarded emulator-only deletion command, fixed stages, retry procedure, and
30-day receipt cleanup are documented in
[`docs/operations/account-deletion-runbook.md`](docs/operations/account-deletion-runbook.md).
The selected Capacitor iOS boundary, rejected alternatives, App Check reopen
rule, and release ownership are documented in
[`docs/architecture/mobile-client-architecture.md`](docs/architecture/mobile-client-architecture.md).
The clean build, simulator, local signing, and physical-device workflow is in
[`docs/mobile/ios-development.md`](docs/mobile/ios-development.md).
The development/test-only Creator Radar boundary is documented in
[`docs/architecture/creator-radar-event-publisher.md`](docs/architecture/creator-radar-event-publisher.md).

## Current data limitations

- Explicit closed-beta builds can serve the exact pinned provisional plan,
  guidance, safety, and bounded-adaptation set to eligible, consented accounts.
  They fail closed on an ordinary environment, stale or unavailable artifacts,
  unsupported inputs, disabled controls, or missing access. The set remains
  unreviewed and cannot appear in an ordinary public build.
- Dated responsive-web and physical-iPhone parity, kill-switch, retirement,
  rollback, and recovery evidence is still missing. The machine-checked
  [invitation-readiness rehearsal](docs/operations/closed-beta-methodology-parity-and-readiness.md)
  keeps invitations blocked until that evidence and an explicit owner decision
  exist.
- Owner-scoped real-time training reads, recommendation-evidence reads, and
  memory-only cache isolation are implemented. Normal Track run creation,
  editing, deletion, and provider imports use atomic commands; profile and shoe
  writes remain explicit client-repository operations.
- The deletion-request lock, fixed idempotent runner, trusted callable, and
  responsive account-settings experience are implemented and deployed to the
  beta project. Limited-account rehearsal, support, incident, and observation
  evidence remain open before external beta under issues #124 and #205.
- Apple Health owner-device proof imported and reconciled completed workouts.
  Direct Garmin connection, token custody, push receipt, permission-change, and
  recovery paths are configured in the closed beta. The first real post-
  connection Garmin run and the full duplicate/disconnect/relaunch matrix remain
  open in issues #623 and #624.
- The Track flow captures date, distance, elapsed time, shoe, optional planned-
  workout association, perceived effort, and notes. The production
  professionally approved-content registry remains empty. The distinct
  closed-beta path may render only its exact pinned, visibly provisional
  guidance and safety set; that does not convert the content into approved
  coaching.
- Firestore structure and security behavior are documented in
  [`docs/architecture/training-data-persistence.md`](docs/architecture/training-data-persistence.md).
- The external-beta negative cases, remaining client writes, command-migration
  gates, and retained CI evidence are indexed in the
  [`Firestore rules acceptance record`](docs/security/firestore-rules-acceptance.md).

## Prerequisites

Install the following before running Marathoner locally:

- [Node.js](https://nodejs.org/) 22 LTS
- npm, which is included with Node.js
- Git
- Java 21 or later when running the local Firestore emulator tests

The repository's automation also uses Node.js 22. Using the same LTS line avoids
engine warnings from development tools on unsupported non-LTS releases.

## Local setup

1. Clone the repository:

   ```bash
   git clone https://github.com/marathoner-app/marathoner.git
   cd marathoner
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local URL printed by Vite, normally
   `http://localhost:5173/`.

The development reCAPTCHA Enterprise key intentionally does not authorize
localhost. Firebase-backed local use therefore fails closed until an
administrator registers one fixed development debug token and the operator
stores it in the ignored mode-specific file for the command being run:
`.env.development.local` for `npm run dev`, or
`.env.internal-plan-rehearsal.local` for `npm run dev:plan-rehearsal`. The token
is accepted only while Vite serves one of those two local development modes;
every Vite build command rejects it before bundling. Follow the
[App Check client initialization record](docs/security/app-check-client-initialization.md#localhost-debug-token-workflow-external-evidence-pending)
without copying the value into Git, logs, screenshots, issues, or pull
requests.

Use `npm ci` instead of `npm install` when you want a clean, reproducible install
that exactly matches `package-lock.json`.

## Firebase configuration

Firebase performs email/password authentication and supplies the Firestore
client for persisted training data. The web client
configuration is defined in `src/firebaseConfig.ts`. `src/main.tsx` mounts a
startup gate that asks `src/services/firebaseClient.ts` to create one shared
Firebase app, prove App Check, and only then acquire Authentication. The
persistence entry point creates Firestore from that protected app only when
training repositories are requested.

The authentication service exports operations for sign in, password reset,
sign out, reading the current user, and subscribing to authentication changes.
Public account creation is disabled. The training-data provider uses the
authenticated UID as its ownership boundary.

The committed registry contains visibly distinct development and founding-beta
projects. `.env`, local development, CI, the selected iOS development build,
and GitHub Pages remain pinned to development. Beta requires an explicit
production-mode `VITE_FIREBASE_ENVIRONMENT=beta` selection and does not become
a deployment default merely because its public identifiers are present.

Firebase web configuration identifies a Firebase project; it is not a server
credential and must not be treated as authorization. Protect any future
database or storage service with appropriate Firebase Security Rules. Never
commit service-account files, private keys, passwords, or other secrets.

The verified client-key, provider, domain, data-service, and App Check posture is
documented in
[`docs/security/firebase-client-configuration.md`](docs/security/firebase-client-configuration.md).
The distinct development/beta provider registrations, native configuration
selection, debug-token custody, and enforcement gates are documented in
[`docs/security/app-check-provider-registration.md`](docs/security/app-check-provider-registration.md).
The selection contract and provisioned beta controls are documented in
[`docs/security/firebase-environment-selection.md`](docs/security/firebase-environment-selection.md)
and
[`docs/security/firebase-beta-project.md`](docs/security/firebase-beta-project.md).

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot module replacement. |
| `npm run dev:plan-rehearsal` | Start the owner-only internal plan and adaptation rehearsal with pinned draft artifacts. |
| `npm run lint` | Check the repository with ESLint. |
| `npm test` | Run the automated test suite once. |
| `npm run test:firestore` | Run ownership and persistence integration tests against the local Firestore emulator. |
| `npm run test:material-commands` | Run authenticated command and atomic-write tests against the Auth, Functions, and Firestore emulators. |
| `npm run test:viewport` | Exercise the Track surface at the supported phone viewport with Playwright. |
| `npm run check:ios` | Build, sync, and inspect the development iOS boundary. |
| `npm run check:ios:beta` | Build, sync, and inspect the explicit beta iOS boundary without signing or distribution. |
| `npm run verify:beta-boundary -- --project marathonerapp-beta --confirm CREATE-TEST-AND-DELETE-BETA-FIXTURES` | Operator-only live check that creates and removes fixed fictional beta fixtures. |
| `npm run verify:closed-beta-methodology-readiness -- --record <evidence.json>` | Block invitations unless one dated record proves exact cross-client methodology versions, states, controls, operations, and physical-iPhone evidence. |
| `npm run manage:closed-beta-methodology-controls -- status --project marathonerapp-beta` | Inspect the two server-owned provisional-methodology controls through the dedicated beta operator account; mutations require action-specific confirmation phrases documented in the rehearsal. |
| `npm run test:watch` | Keep the test runner open and rerun affected tests after changes. |
| `npm run build` | Run TypeScript project checks and create a production build in `dist/`. |
| `npm run preview` | Serve the production build locally for a final browser check. |

## GitHub Pages deployment

The supported web surface is published at
[https://marathonerapp.com/](https://marathonerapp.com/). GitHub Actions builds
and deploys the site whenever a pull request is merged into `main`. The
workflow can also be started manually from the repository's Actions tab when a
deployment needs to be repeated without a source change.

`vite.config.ts` sets the web `base` to `/` because the custom domain serves the
application at its root. iOS builds keep their separate relative `./` base so
the copied Capacitor bundle can load without a web origin. The `homepage` value
in `package.json` does not control Vite's asset paths.

GitHub redirects the legacy
`https://marathoner-app.github.io/marathoner/` project URL to the custom domain
while the Pages custom-domain setting is active. Do not publish a second copy
there. DNS, Firebase allowlists, verification, and rollback steps are recorded
in the [custom-domain runbook](docs/operations/github-pages-custom-domain.md).

The deployment workflow installs the locked dependencies, runs the production
build, uploads `dist` as a Pages artifact, and deploys that artifact through the
`github-pages` environment. The repository's Pages source must remain set to
**GitHub Actions**.

Before publishing, verify the production build locally:

```bash
npm run build
npm run preview
```

Open the root URL printed by Vite and confirm that the page and its assets load.
After a pull request is merged, check its
**Deploy to GitHub Pages** workflow run in the Actions tab. GitHub Pages may
take a short time to serve the new commit after that run completes.

## Testing

Vitest runs the automated suite in jsdom, which provides a browser-like DOM
without opening a real browser. `src/test/setup.ts` loads the shared DOM
matchers and cleans up rendered React components after every test.

| Test type | Convention |
| --- | --- |
| Unit | Place `*.test.ts` beside a domain or utility module and test its public inputs and outputs. |
| Component | Place `*.test.tsx` beside the component and exercise visible behavior with Testing Library. |
| Service | Test service functions at their public boundary and replace the remote SDK or emulator connection. |
| Integration | Name Firestore emulator suites `*.integration.ts`; place future UI integration flows under `src/test/integration/`. |

When writing tests:

- Prefer accessible roles and names over CSS selectors or implementation
  details.
- Use `userEvent` for typing, clicking, and selecting so tests resemble real
  interaction.
- Mock modules in `src/services/` from component tests instead of mocking
  Firebase inside each component.
- Mock animation timing only when the test is about application behavior rather
  than the animation itself.
- Keep each test focused on one observable behavior and give it a description
  that explains the expected outcome.

The current suite covers the shared training model, app and authentication
states, persisted calendar views, shoe and run mutations, analytics,
cross-feature consistency, internal plan and adaptation rehearsal, guidance and
safety contracts, recommendation evidence and decisions, synchronization and
account isolation, account deletion, App Check boundaries, material commands,
mobile viewport behavior, and iOS bundle boundaries.

Firestore integration tests require Java and run separately with
`npm run test:firestore`; they are not part of the fast jsdom unit suite.

## Validate a change

Before opening a pull request, run:

```bash
npm run lint
npm test
npm run test:firestore
npm run test:material-commands
npm run test:viewport
npm run check:ios
npm run check:ios:beta
npm run build
```

Use `npm run preview` when the change affects browser behavior or production
asset paths. Add or update focused tests whenever behavior changes.

## Contributing workflow

The complete [contributing guide](CONTRIBUTING.md) documents local setup, issue
selection, branch naming, focused implementation, verification, pull requests,
owner review, merge, and local cleanup. Every repository change starts from an
open issue and reaches `main` through a pull request. Include
`Closes #<issue-number>`, `Fixes #<issue-number>`, or
`Resolves #<issue-number>` in the pull request description so GitHub can verify
the relationship.

Every pull request targeting `main` runs these read-only GitHub Actions checks:

- **Linked issue** verifies that the pull request closes an existing open issue.
- **Lint** runs `npm run lint`.
- **Production dependency audit** rejects advisories in the production
  dependency inventory.
- **Unit tests** runs `npm test`.
- **Production build** runs `npm run build`, including TypeScript checks.
- **Firestore emulator tests** runs `npm run test:firestore` with Java 21.
- **Material command emulators** runs `npm run test:material-commands` with
  Auth, Functions, and Firestore emulators.
- **Track mobile viewport** runs `npm run test:viewport` in Chromium.
- **iOS boundary** builds and inspects both development and explicit beta
  Capacitor bundles without requiring App Store signing.

All checks must pass before the owner performs the final diff review and merges.
The pull-request workflow does not deploy or modify application environments;
the separate Pages workflow runs only after a merge to `main` or a manual
dispatch.
