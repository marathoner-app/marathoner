# Marathoner

Plan, track, and understand marathon training in one focused workspace.

Marathoner is an actively developed training companion for runners preparing
for a marathon. The product is being built in small, understandable increments
toward a conditional iOS founding beta. January 15, 2027 remains a
scope-or-date decision checkpoint, not a capacity-backed invitation forecast.
The first invitation batch is limited to five to eight allowlisted adults who
already run consistently and are preparing for a first marathon. The existing
responsive web application remains the planning and analysis surface; Android
external release is not on the beta critical path.

## Project status

Marathoner is currently a foundation-stage prototype. The existing experience
includes:

- **Plan:** browse persisted training weeks and inspect planned-workout details.
- **Track:** persist shoes and runs, associate runs with planned workouts, and
  edit or delete completed runs.
- **Analyze:** calculate mileage, pace, and run counts from completed-run history.
- **Authentication:** create an account and sign in with Firebase email/password
  authentication.

The visible features share the typed Firestore persistence layer. Follow the
[open issues](https://github.com/marathoner-app/marathoner/issues) to see what is
being built next.

The canonical [zero-to-beta plan](docs/zero-to-beta-plan.md) defines the product
commitments, delivery waves, monthly evidence gates, safety boundary, and solo
working model. The [capacity forecast](docs/capacity-forecast.md) tests those
gates against owner sessions and external waits; it concludes that the current
scope does not support January 2027 invitations.
[GitHub issue #104](https://github.com/marathoner-app/marathoner/issues/104)
is its live execution tracker, and
[issue #117](https://github.com/marathoner-app/marathoner/issues/117) records
the founding-beta contract. The
[committee remediation sprint](docs/committee-remediation-sprint.md) records
the prioritized work and evidence required to resolve the September 2026
product, investor, architecture, delivery, and operations review. The
[product vision](docs/product-vision.md) describes the larger destination, and
the [founding cohort plan](docs/founding-cohort-plan.md) describes recruitment
and validation.

## Technology

- React and TypeScript
- Vite
- Firebase Authentication and Cloud Firestore
- Framer Motion
- Vitest and Testing Library
- ESLint

## Current architecture

Marathoner is currently a client-only, single-page React application. It does
not have an application server, API, or router. Its authenticated training data
uses typed repositories backed by Cloud Firestore.

| Path | Responsibility |
| --- | --- |
| `index.html` | Provides the browser document and loads the React entry point. |
| `src/main.tsx` | Mounts the application in React strict mode and loads the global stylesheet. |
| `src/App.tsx` | Owns the active Plan, Track, or Analyze section and renders the application shell. |
| `src/components/` | Contains the feature views, authentication forms, title, subtitle, and supporting UI. |
| `src/domain/training/` | Defines shared training entities, identifiers, units, validation, and calculations without React or Firebase dependencies. |
| `src/persistence/` | Defines typed training repositories, Firestore conversion, storage paths, ownership integration tests, and recoverable persistence errors. |
| `src/training/` | Owns authenticated training-data loading, shared feature state, and cross-feature mutations. |
| `src/services/firebaseClient.ts` | Initializes the shared Firebase app and Authentication instance. |
| `src/services/authService.ts` | Contains authentication operations against the shared Firebase client. |
| `src/firebaseConfig.ts` | Identifies the Firebase web project used by the client. |
| `src/**/*.test.ts(x)` | Keeps unit and component tests beside the code they verify. |
| `src/test/` | Contains shared test setup and environment-level tests. |
| `server/creatorRadarEvents/` | Contains an inert server-only development attribution publisher; it is excluded from the browser graph and has no deployed runtime. |
| `infrastructure/creator-radar-events-development/` | Declares the unapplied, keyless development caller identity with no source-project roles. |
| `src/styles/` | Contains global and application-shell styles. Feature-specific styles remain beside their components. |
| `vite.config.ts` | Configures React, production assets, and the GitHub Pages base path. |

The current application flow is deliberately small:

1. `src/main.tsx` mounts `App`.
2. `AuthProvider` resolves the Firebase session and gates personal features.
3. `TrainingDataProvider` loads repositories for the signed-in user and keeps
   one shared plan, workout, run, and shoe snapshot.
4. Opening Plan, Track, or Analyze mounts a view over that shared snapshot.
5. Feature mutations persist through repositories and update the shared state,
   so every open panel observes the same records.

The shared training domain model is documented in
[`docs/architecture/training-domain-model.md`](docs/architecture/training-domain-model.md).
Cross-feature behavior is documented in
[`docs/architecture/training-feature-integration.md`](docs/architecture/training-feature-integration.md).
The development/test-only Creator Radar boundary is documented in
[`docs/architecture/creator-radar-event-publisher.md`](docs/architecture/creator-radar-event-publisher.md).

## Current data limitations

- Personalized plan generation and plan-creation UI are not implemented yet.
  Accounts without a plan receive an honest empty state. This work is tracked in
  [issue #29](https://github.com/marathoner-app/marathoner/issues/29).
- Training data loads as a persisted snapshot. Mutations remain synchronized
  inside the current session, while real-time cross-device listeners remain a
  future enhancement.
- The first Track form captures date, distance, elapsed time, shoe, and optional
  planned-workout association. Perceived effort and the remaining coaching
  inputs will be added in later product slices.
- Firestore structure and security behavior are documented in
  [`docs/architecture/training-data-persistence.md`](docs/architecture/training-data-persistence.md).

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
   `http://localhost:5173/marathoner/`.

Use `npm ci` instead of `npm install` when you want a clean, reproducible install
that exactly matches `package-lock.json`.

## Firebase configuration

Firebase performs email/password authentication and supplies the Firestore
client for persisted training data. The web client
configuration is defined in `src/firebaseConfig.ts`. Importing
`src/services/firebaseClient.ts` initializes one shared Firebase app and creates
the Authentication instance. The persistence entry point creates Firestore from
that same app only when training repositories are requested.

The authentication service exports operations for signup, sign in, sign out,
reading the current user, and subscribing to authentication changes. The
training-data provider uses the authenticated UID as its ownership boundary.

The committed configuration connects the app to its current Firebase project.
To use a different project:

1. Create or select a Firebase project.
2. Register a web app in that project.
3. Enable the **Email/Password** provider under Firebase Authentication.
4. Add local development and deployment hosts to the project's authorized
   domains when Firebase requires them.
5. Replace the web client configuration values in `src/firebaseConfig.ts`.

Firebase web configuration identifies a Firebase project; it is not a server
credential and must not be treated as authorization. Protect any future
database or storage service with appropriate Firebase Security Rules. Never
commit service-account files, private keys, passwords, or other secrets.

Moving environment-specific configuration out of the source file is tracked in
[issue #22](https://github.com/marathoner-app/marathoner/issues/22).

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot module replacement. |
| `npm run lint` | Check the repository with ESLint. |
| `npm test` | Run the automated test suite once. |
| `npm run test:firestore` | Run ownership and persistence integration tests against the local Firestore emulator. |
| `npm run test:watch` | Keep the test runner open and rerun affected tests after changes. |
| `npm run build` | Run TypeScript project checks and create a production build in `dist/`. |
| `npm run preview` | Serve the production build locally for a final browser check. |

## GitHub Pages deployment

The current production site is published at
[https://marathoner-app.github.io/marathoner/](https://marathoner-app.github.io/marathoner/).
GitHub Actions builds and deploys the site whenever a pull request is merged
into `main`. The workflow can also be started manually from the repository's
Actions tab when a deployment needs to be repeated without a source change.

`vite.config.ts` sets `base` to `/marathoner/`. Vite uses that value to prefix
production asset URLs for a GitHub Pages project site. If the repository name
or hosting path changes, update `base` before deploying. The `homepage` value
in `package.json` does not control Vite's asset paths.

The deployment workflow installs the locked dependencies, runs the production
build, uploads `dist` as a Pages artifact, and deploys that artifact through the
`github-pages` environment. The repository's Pages source must remain set to
**GitHub Actions**.

Before publishing, verify the production build locally:

```bash
npm run build
npm run preview
```

Open the URL printed by Vite, including its `/marathoner/` suffix, and confirm
that the page and its assets load. After a pull request is merged, check its
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

The current suite covers the shared training model, initial App screen and
section transitions, persisted calendar views, shoe and run mutations,
authentication error states, derived analytics, and cross-feature consistency.

Firestore integration tests require Java and run separately with
`npm run test:firestore`; they are not part of the fast jsdom unit suite.

## Validate a change

Before opening a pull request, run:

```bash
npm run lint
npm test
npm run test:firestore
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
- **Unit tests** runs `npm test`.
- **Production build** runs `npm run build`, including TypeScript checks.
- **Firestore emulator tests** runs `npm run test:firestore` with Java 21.

All checks must pass before the owner performs the final diff review and merges.
The pull-request workflow does not deploy or modify application environments;
the separate Pages workflow runs only after a merge to `main` or a manual
dispatch.
