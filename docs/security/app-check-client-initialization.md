# App Check client initialization

- **Status:** #204 implementation closeout complete; owner-only development
  browser and iPhone debug proof passed; paid-team beta App Attest, observation,
  and enforcement remain in #281 and #205–#206
- **Implementation date:** 2026-10-06
- **Implementation issue:**
  [#204](https://github.com/marathoner-app/marathoner/issues/204) (closed
  October 22, 2026)
- **Remaining rollout:**
  [#281](https://github.com/marathoner-app/marathoner/issues/281) and
  [#205–#206](https://github.com/marathoner-app/marathoner/issues/205)
- **Hardening issue:**
  [#270](https://github.com/marathoner-app/marathoner/issues/270)
- **Parent:**
  [#161](https://github.com/marathoner-app/marathoner/issues/161)

## Startup boundary

Marathoner now treats App Check as a prerequisite for Firebase client services,
not as a best-effort background task. The application starts in this order:

1. Vite selects and validates exactly one development or beta Firebase
   configuration and its public reCAPTCHA Enterprise site key.
2. The JavaScript Firebase app is created. Authentication, Firestore, and
   Functions are not acquired yet.
3. Browser builds initialize `ReCaptchaEnterpriseProvider` with the selected
   environment's site key. Capacitor iOS builds initialize the pinned native
   bridge, which selects App Attest, and expose its token and expiration through
   a Firebase JavaScript `CustomProvider`.
4. Both paths enable automatic token refresh and must obtain a non-empty token
   within ten seconds.
5. Only after that proof succeeds does Marathoner acquire Authentication and
   render `AuthProvider`. Firestore repositories and callable Functions remain
   lazy and obtain the already-protected Firebase app only when used.

If attestation fails or stalls, the protected application and Firebase services
remain unavailable. The startup gate presents one accessible, provider-neutral
error with current-build, connection, support, and retry guidance. Retry proves
a token again while reusing an initialized App Check instance. A rejected
native initialization promise is cleared so an explicit retry can make a fresh
attempt. Concurrent callers share the same native attempt within its startup
deadline; when that deadline expires, the abandoned cached attempt is cleared
so the visible retry can start a new one.

## Environment and debug policy

`src/firebaseConfig.ts` binds each web app ID to its own public Enterprise site
key. The development key is limited to `marathoner-app.github.io`,
`marathonerapp.com`, and `www.marathonerapp.com`; the beta key remains limited
to `marathonerapp.com` and `www.marathonerapp.com`.
iOS uses the separately selected `GoogleService-Info.plist` identities described
in the [provider registration record](app-check-provider-registration.md).

Beta, production-web, and iOS Release builds never select a debug provider. A
fixed browser debug token may be provided only through
`VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN` when all of these conditions are true:

- Vite is serving the application (`npm run dev` or
  `npm run dev:plan-rehearsal`), not building an artifact;
- Vite mode is `development` or the owner-only `internal-plan-rehearsal`;
- the selected Firebase environment is `development`;
- the value is a fixed Firebase debug-token UUID stored only in an ignored
  mode-`0600` `.env.development.local` or
  `.env.internal-plan-rehearsal.local` file selected by the command.

Boolean or generated-at-runtime debug mode is rejected because it can print a
credential. Every build command rejects the variable before bundling, including
`vite build --mode development`, production, beta, `ios-development`, and
`ios-beta`. Runtime initialization also rejects an implicit debug global or one
that does not match explicit local configuration. The served local client may
contain the fixed token in memory because Firebase requires it for the debug
provider; no committed or uploaded build artifact may contain it.

### Localhost debug-token workflow and evidence

The development Enterprise site key authorizes the supported GitHub Pages
hosts, not localhost. Local Auth and Firestore use therefore require one
separately registered development debug token. The following workflow is the
reviewed procedure used for the owner-only browser rehearsal:

1. In the **development** Firebase project only, an administrator creates an App
   Check debug token named `development-local-<operator>-<device>` and records
   its owner, creation date, next rotation date, and later revocation date—not
   its value—in the private credential inventory.
2. The named operator creates the ignored mode-specific file for the intended
   command—`.env.development.local` for `npm run dev`, or
   `.env.internal-plan-rehearsal.local` for
   `npm run dev:plan-rehearsal`—limits it to mode `0600`, and adds exactly
   `VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN=<console-issued UUID>`. The file is
   covered by `*.local` in `.gitignore`; run `git check-ignore -v` against the
   exact selected filename and confirm that rule is reported before adding the
   value.
3. The operator runs the matching serve command. Do not run or upload a build
   while the variable is present; the repository policy rejects one rather
   than relying on operator memory.
4. From localhost, prove the startup gate completes, Email/Password Auth works,
   and an owner-scoped Firestore read carries a valid App Check token. Record
   only pass/fail, origin, environment, date, and token display name.
5. Remove the local file when it is not needed. Revoke immediately after
   suspected exposure or loss of custody, and at least every 90 days while the
   token remains active.

On October 28, 2026, the development web registration received the owner-only
token `development-local-kevin-mac`. From `http://127.0.0.1:5173/`, Vite mode
`internal-plan-rehearsal` passed the App Check startup gate, completed
Email/Password sign-in, and loaded the saved runner-setup state through an
owner-scoped Firestore read. The token value remained only in the ignored
mode-`0600` `.env.internal-plan-rehearsal.local` file and was not recorded in
the repository, test output, screenshots, issues, or pull requests. The next
required rotation date is January 26, 2027.

Never use the development browser token for beta, iOS, production output, another
operator/device, or CI artifacts. Never set the debug global manually.

### Owner-only iOS development debug workflow

The explicit `ios-development` build is the only native exception to the
no-debug-build rule. It must set
`VITE_FIREBASE_NATIVE_APP_CHECK_DEBUG=true`, select the development Firebase
project, and run with Xcode's Debug configuration. The value is a non-secret
provider selector. It tells the native bridge to use Firebase's Apple debug
provider, but it does not contain or generate the credential inside the web
bundle.

The administrator creates one fixed debug token under the **development iOS
App Check registration only**. The owner supplies that token privately to the
Xcode Run scheme as the `AppCheckDebugToken` environment variable. Xcode's
user-local scheme data is ignored, and the token must not appear in source,
`*.local` Vite files, tracked schemes, copied web output, screenshots, logs, or
GitHub. Do not add `-FIRDebugEnabled`; this workflow deliberately avoids
printing a generated credential.

The token is for the owner's development phone and development project only.
Do not distribute that build. Rotate or revoke the token after suspected
exposure, loss of custody, or no more than 90 days. `ios-beta`, production, and
ordinary browser modes reject the native debug selector before Firebase
services initialize.

Provider selection also occurs in `AppDelegate` before
`FirebaseApp.configure()`. Debug selects `AppCheckDebugProviderFactory`; Release
selects the bridge's App Attest-capable `CustomAppCheckProviderFactory`. This
native ordering is required because the later Capacitor JavaScript call cannot
replace a provider after Firebase has already configured its default app.

## Apple App Attest capability

The application target includes `App.entitlements` with
`com.apple.developer.devicecheck.appattest-environment` set to `production`.
Firebase does not accept App Attest sandbox tokens. The Xcode Release
configuration must reference this entitlement for beta and distribution. The
Debug configuration intentionally does not reference it, allowing an
owner-controlled Personal Team development build to use the development-only
debug provider. The iOS boundary test rejects the inverse configuration.

The 2026-10-06 App Attest signed-device build stopped before compilation
because the current Personal Team provisioning profile does not contain App
Attest. This remains expected for Release and beta. A Marathoner Apple
Developer Program team must enable the capability and issue a new profile
before the physical-iPhone App Attest acceptance test can pass. The approved
[entity and Apple organization-enrollment path](../operations/legal-entity-and-apple-enrollment.md)
is tracked in [#281](https://github.com/marathoner-app/marathoner/issues/281).
The development Debug workflow can support owner dogfooding, but it is not App
Attest evidence and cannot satisfy #205, TestFlight, or an external-beta gate.

## Evidence and remaining proof

Automated tests cover:

- App Check-before-Auth ordering and refusal to acquire Auth after failure;
- exact development/beta app-ID and site-key pairings;
- Enterprise and native custom-provider selection;
- native token and expiration validation without exposing the token;
- serve-only fixed debug selection, implicit/mismatched runtime rejection, and
  development-build, beta, production, and iOS build rejection;
- successful startup, provider failure, ten-second timeout, and both token and
  rejected/timed-out native-initialization retry behavior; and
- the exact production App Attest entitlement plus independent App-target Debug
  and Release signing settings.

Development and beta web builds and copied iOS bundles pass. Both iOS boundary
variants select the correct native Firebase configuration. On October 21, 2026,
the owner-only development Debug build at commit `ed40094` obtained an accepted
debug token on an iPhone 15 running iOS build `23G90`, completed Email/Password
sign-in, and reached the Firestore-backed onboarding state. No token value,
credential, device identifier, or beta configuration was recorded. This proves
the #351 development exception only; it is not App Attest evidence.

The paid-team beta rollout still requires:

1. enroll or select an Apple Developer Program team, enable App Attest for the
   explicit App ID, and regenerate the development profile;
2. run the release-shaped build on a physical iPhone and prove App Attest token,
   sign-in, Firestore read, sign-out, persistence, cold start, and the bounded
   failure/retry state;
3. create a separately custodied development-local browser debug token only if
   localhost smoke testing is required, or perform the browser smoke test from
   a registered GitHub Pages origin;
4. confirm live browser Auth and Firestore traffic carries valid App Check
   tokens; and
5. reconfirm Authentication, Firestore, and Functions enforcement remains off
   through the #205 observation and rollback window.

Issue #281 owns the paid-team provisioning dependency, #205 owns the remaining
beta token evidence plus observation and rollback rehearsal, and #206 alone may
enable beta enforcement after that evidence passes. Closing #204 recorded the
implemented fail-closed bootstrap and supported development evidence; it did
not waive these external-beta gates.

## References

- [Firebase App Check with App Attest](https://firebase.google.com/docs/app-check/ios/app-attest-provider)
- [Firebase App Check with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Firebase App Check debug provider](https://firebase.google.com/docs/app-check/web/debug-provider)
- [Apple App Attest entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.devicecheck.appattest-environment)
- [Apple program membership comparison](https://developer.apple.com/support/compare-memberships/)
