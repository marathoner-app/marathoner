# iOS environment workflow

The root application is the canonical web and iOS product. Capacitor copies an
iOS-specific Vite build into the committed Swift Package Manager Xcode project;
there is no second feature application under `ios/`.

The ordinary workflow proves the selected development shell. A separate,
explicit beta proof below verifies environment selection without changing the
development, CI, Pages, or production-web defaults. Neither workflow activates
App Check, migrated material mobile workflows, TestFlight, or Android. The
local command foundation is proved in #158; workflow migration, live reads,
and release work remain in #72, #115, #138, #159, #161, #122, and #90.

## Prerequisites

- Node 22
- Xcode 27.0 or the currently reviewed compatible Xcode version
- an iOS simulator for unsigned compilation
- the physical test iPhone and an owner-controlled Apple development identity
  only when recording device evidence
- the reviewed development-only iOS Firebase API key
- the separately reviewed beta-only iOS Firebase API key only when running the
  explicit beta proof

Do not put Apple credentials, team identifiers, profiles, certificates, device
identifiers, beta configuration, or the populated Firebase key in Git.

## One-time local configuration

Create the ignored Firebase environment file:

```sh
cp .env.ios-development.example .env.ios-development.local
```

Set `VITE_FIREBASE_IOS_API_KEY` in that local file. The `ios-development` mode
fails closed when the value is absent or when the selected environment is not
`development`.

Do not reuse the development key for beta. The beta proof uses a separate
ignored file:

```sh
cp .env.ios-beta.example .env.ios-beta.local
chmod 600 .env.ios-beta.local
```

The `ios-beta` file must retain `VITE_FIREBASE_ENVIRONMENT=beta` and contain
only the reviewed beta iOS API key. The key belongs to `marathonerapp-beta`,
allows only Cloud Firestore API, Identity Toolkit API, and Token Service API,
and has no application restriction because Firebase runs through the
JavaScript SDK inside a Capacitor WebView. The key value must never appear in
Git, an issue, a pull request, a screenshot, or command output.

For a physical development build, create the ignored signing override:

```sh
cp ios/local.xcconfig.example ios/local.xcconfig
```

Set `DEVELOPMENT_TEAM` only in `ios/local.xcconfig`. The tracked Xcode project
must remain team-neutral; do not use a committed project change to remember a
Personal Team selection.

## Clean build and boundary check

From the repository root:

```sh
npm ci
npm run check:ios
```

That command:

1. type-checks and builds the root product in `ios-development` mode;
2. writes the relative-path bundle to ignored `dist-ios/`;
3. runs `cap sync ios` into the ignored copied-bundle directory;
4. verifies the fixed bundle identifier, exact Capacitor versions, and SPM
   boundary;
5. rejects tracked signing/account artifacts and disposable identifiers; and
6. verifies that the copied bundle exactly matches the development build and
   contains no beta configuration.

The normal `npm run build` remains the GitHub Pages build with its existing
`/marathoner/` base. It does not read the iOS key.

## Explicit beta selection and physical proof

This is an operator proof, not a day-to-day development command. Start with a
clean working tree and the reviewed `.env.ios-beta.local`. Prepare the two
temporary, fictional beta accounts with the dedicated Firebase CLI operator:

```sh
npm run prepare:beta-ios-smoke -- \
  --project marathonerapp-beta \
  --confirm CREATE-BETA-IOS-SMOKE-FIXTURES
```

The command refuses every other project and operator, checks for fixed-fixture
collisions, and writes random credentials only to the ignored mode-`0600`
`.beta-ios-smoke.local` file. It creates:

- one verified account with an active membership document; and
- one verified account with no membership document.

Do not use participant identities or copy development accounts into beta. Do
not record either temporary password or Firebase UID. Open the local manifest
only on the operator machine and delete it through the cleanup command after
the proof.

Build, copy, and inspect the beta bundle:

```sh
npm run check:ios:beta
```

The check must report that the copied beta bundle preserves the reviewed iOS
boundary. It rejects the development project ID and sender ID, disposable
spike identities, a missing beta project ID, or a copied bundle that differs
from the Vite output.

Open the already synchronized project with `npm run open:ios`, select the
physical test iPhone, and run these checks:

If Xcode focuses a stale project reference and reports a missing
`project.pbxproj` even though the tracked file is present, close that Xcode
window and open `ios/App/App.xcodeproj` directly. Do not recreate the project.

1. Sign in with the approved verified account. Open **Plan**. Training data
   must reach its ready state and show either the account's plan or **No
   training plan yet**; a permission error does not pass.
2. Sign out and confirm the public entry state appears before changing
   accounts.
3. Sign in with the verified account that has no membership. Authentication
   may succeed, but opening **Plan** must show **You do not have permission to
   access this training data.** Retrying must remain denied; any plan, run, or
   shoe data is a failure.
4. Sign out, force-quit, reopen, and confirm no approved-account state or
   training data appears.

Record the date, iOS and Xcode versions, source commit, beta project ID,
approved ready-state result, denied permission-state result, and cleanup result
in the issue or pull request. Do not record account emails, UIDs, passwords,
device identifiers, or the API key. Delete the temporary membership, both
temporary Auth users, and the local credential manifest after recording the
evidence:

```sh
npm run cleanup:beta-ios-smoke -- \
  --project marathonerapp-beta \
  --confirm DELETE-BETA-IOS-SMOKE-FIXTURES
```

The beta command leaves the copied Xcode web bundle pointed at beta. Restore
the normal development boundary immediately after the proof:

```sh
npm run check:ios
```

Confirm that this reports the development bundle boundary before doing any
further development-account testing.

### Recorded beta-environment evidence

The #125 selected-client boundary was verified on 2026-10-05 from the working
tree based on `main` commit `aeb6d20`, using Xcode 27.0 and the same physical
iPhone running iOS 26.6.2 used for the selected-shell evidence:

- the live `marathoner-ios-beta` key belonged to `marathonerapp-beta`, had no
  application restriction, and allowed exactly Cloud Firestore API, Identity
  Toolkit API, and Token Service API;
- `npm run check:ios:beta` built and synchronized the selected Capacitor shell,
  found the beta project identity, and rejected development and disposable
  identities from the copied bundle;
- a temporary verified approved member authenticated on the physical iPhone,
  and **Plan** reached its ready state with **No training plan yet**;
- a temporary verified account without membership authenticated but **Plan**
  displayed **You do not have permission to access this training data** and no
  participant data;
- after sign-out, a force-quit cold start returned to the signed-out state with
  no approved-account state or training data;
- the guarded cleanup removed both fictional Auth users, the temporary
  membership document, and the ignored credential manifest; and
- `npm run check:ios` then restored and verified the development bundle.

No participant identity, training record, credential, API-key value, Firebase
UID, or device identifier was recorded. The environment-selection proof does
not satisfy App Check, TestFlight, accessibility, or daily-use failure-state
gates.

## Unsigned simulator compile

Compile the committed native project without signing:

```sh
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

To list and run an available simulator through Capacitor:

```sh
npx cap run ios --list
npx cap run ios --target <simulator-id>
```

## Physical iPhone proof

After `npm run check:ios` and local signing configuration:

```sh
npm run open:ios
```

In Xcode, select the `App` scheme and the physical test iPhone, then build and
run. Confirm that the canonical Marathoner UI appears and that the expected
development account state resolves. Test sign-in only with an existing
development account; signup remains disabled.

### Launch-continuity acceptance test

Run this test after a startup, authentication-bootstrap, WebView, or native
launch-screen change. Record one clean installation and five true cold starts
on the physical test iPhone. A warm foreground transition does not count.

1. Delete the development app from the iPhone, then build and run it from
   Xcode. This is the clean-install launch.
2. Confirm that the native `Marathoner.` / `Loading your session...` presentation
   is visible immediately and remains continuous while the native bridge starts
   and React paints the matching web loading state. There must be no blank or
   black frame between those layers. Both native overlays have a 10-second
   safety timeout so a broken web bundle cannot hide behind them indefinitely.
3. Complete a development-account sign-in, force-quit the app, and reopen it.
   Confirm the signed-in session returns. Repeat enough times to record three
   signed-in cold starts.
4. Sign out, force-quit the app, and reopen it. Confirm the signed-out state
   returns. Repeat once to record two signed-out cold starts.

The result passes only when all six launches have zero observed blank, black,
or unbranded plain-white frames and each launch reaches the expected signed-in
or signed-out state. If Firebase Auth has not resolved within 10 seconds, the
app must replace the loading state with its retryable recovery message; an
indefinite loading state does not pass. If the WebView itself cannot load the
bundle, the static `Marathoner could not start` recovery page must appear.

Record the date, device/iOS version, Xcode version, build commit, launch result,
restored state, and any visible transition defect in the issue or pull request.
Do not record account credentials or device identifiers.

### Recorded foundation evidence

The selected root shell was verified on 2026-10-05 with Xcode 27.0:

- a clean `npm ci` completed and `npm run check:ios` built, synchronized, and
  inspected the root iOS bundle;
- an unsigned simulator compile succeeded and the simulator rendered the
  canonical Marathoner entry experience;
- the physical test iPhone launched the root application against the
  development Firebase project;
- the replacement `marathoner-ios-development` key completed Email/Password
  authentication and the canonical Plan surface reached its ready state after
  the required Firestore reads;
- an existing development account remained signed in after a force-quit and
  cold start;
- signing out remained effective after a second force-quit and cold start; and
- the ordinary browser application rendered its existing signed-in navigation
  without console errors.

The first physical launch briefly showed a blank black WebView before the
application rendered. The condition did not recur on the next cold start and
prompted the startup-continuity work tracked in #181.

### Recorded launch-continuity evidence

The #181 launch boundary was verified on 2026-10-05 from the working tree based
on `main` commit `1c11727`, using Xcode 27.0 and a physical iPhone running iOS
26.6.2:

- the clean-install launch remained branded without a blank, black, or
  plain-white frame and reached the signed-out state;
- three signed-in force-quit cold starts remained continuously branded and
  restored the expected development account;
- two signed-out force-quit cold starts remained continuously branded and
  restored the public entry state; and
- all six launches passed with zero visible transition defects.

The accepted sequence uses the immutable Apple launch screen, an immediate
storyboard bridge overlay, Capacitor's launch overlay, and the matching React
loading state. React dismisses both native overlays after its first paint; both
native layers retain the 10-second failure timeout.

The local Firestore emulator check could not start because this Mac does not
have Java installed. Pull-request CI installs Java 21 and remains the required
Firestore rules and persistence gate.

Before recording the result, run:

```sh
git status --short
npm run check:ios
```

Only the intended source, configuration, tests, documentation, and unsigned
native project may appear. `dist-ios/`, `ios/App/App/public/`,
`ios/App/App/capacitor.config.json`, `ios/App/App/config.xml`, `xcuserdata/`,
and `ios/local.xcconfig` must remain ignored.

## Native dependency changes

Use `npm run sync:ios` after any reviewed Capacitor or plugin change. Commit the
resulting SPM manifest and resolution changes, run the unsigned native compile,
and repeat physical-device evidence when the Firebase bootstrap, Auth
persistence, lifecycle, or native dependency graph changes.
