# App Check client initialization

- **Status:** Implementation and automated boundaries complete; live browser
  and physical-iPhone token evidence pending
- **Implementation date:** 2026-10-06
- **Tracking issue:**
  [#204](https://github.com/marathoner-app/marathoner/issues/204)
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
key. The development key remains limited to `marathoner-app.github.io`; the
beta key remains limited to `marathonerapp.com` and `www.marathonerapp.com`.
iOS uses the separately selected `GoogleService-Info.plist` identities described
in the [provider registration record](app-check-provider-registration.md).

Normal builds never select a debug provider. A fixed browser debug token may be
provided only through `VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN` when all of these
conditions are true:

- Vite is serving the application (`npm run dev`), not building an artifact;
- Vite mode is `development`;
- the selected Firebase environment is `development`;
- the value is a fixed Firebase debug-token UUID stored only in an ignored
  mode-`0600` `.env.development.local` file.

Boolean or generated-at-runtime debug mode is rejected because it can print a
credential. Every build command rejects the variable before bundling, including
`vite build --mode development`, production, beta, `ios-development`, and
`ios-beta`. Runtime initialization also rejects an implicit debug global or one
that does not match explicit local configuration. The served local client may
contain the fixed token in memory because Firebase requires it for the debug
provider; no committed or uploaded build artifact may contain it.

### Localhost debug-token workflow (external evidence pending)

The development Enterprise site key authorizes the GitHub Pages hostname, not
localhost. Local Auth and Firestore use therefore require one separately
registered development debug token. No such token has been created or verified
for this implementation yet; the following workflow is the reviewed procedure,
not a claim of console or traffic evidence:

1. In the **development** Firebase project only, an administrator creates an App
   Check debug token named `development-local-<operator>-<device>` and records
   its owner, creation date, next rotation date, and later revocation date—not
   its value—in the private credential inventory.
2. The named operator creates `.env.development.local`, limits it to mode
   `0600`, and adds exactly
   `VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN=<console-issued UUID>`. The file is
   covered by `*.local` in `.gitignore`; `git check-ignore -v
   .env.development.local` must identify that rule before the value is added.
3. The operator runs `npm run dev`. Do not run or upload a build while the
   variable is present; the repository policy rejects one rather than relying
   on operator memory.
4. From localhost, prove the startup gate completes, Email/Password Auth works,
   and an owner-scoped Firestore read carries a valid App Check token. Record
   only pass/fail, origin, environment, date, and token display name.
5. Remove the local file when it is not needed. Revoke immediately after
   suspected exposure or loss of custody, and at least every 90 days while the
   token remains active.

Never use the development token for beta, iOS, production output, another
operator/device, or CI artifacts. Never set the debug global manually.

## Apple App Attest capability

The application target now includes `App.entitlements` with
`com.apple.developer.devicecheck.appattest-environment` set to `production`.
This is intentional for development and release configurations: Firebase does
not accept App Attest sandbox tokens. The iOS boundary test requires both the
entitlement and the target's `CODE_SIGN_ENTITLEMENTS` setting so a Capacitor
sync or project edit cannot silently remove the capability.

The 2026-10-06 signed-device build stopped before compilation because the
current Personal Team provisioning profile does not contain App Attest. This is
the expected fail-closed behavior. A Marathoner Apple Developer Program team
must enable the capability and issue a new profile before the physical-iPhone
App Attest acceptance test can pass. Unsigned compilation is still useful for
code and dependency verification but is not attestation evidence.

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
variants select the correct native Firebase configuration. The final #204 proof
still requires:

1. enroll or select an Apple Developer Program team, enable App Attest for the
   explicit App ID, and regenerate the development profile;
2. run the development build on the physical iPhone and prove App Attest token,
   sign-in, Firestore read, sign-out, persistence, cold start, and the bounded
   failure/retry state;
3. create a separately custodied development-local browser debug token only if
   localhost smoke testing is required, or perform the browser smoke test from
   the registered GitHub Pages origin;
4. confirm live browser Auth and Firestore traffic carries valid App Check
   tokens; and
5. reconfirm Authentication, Firestore, and Functions enforcement remains off
   before closing #204.

Issue #205 owns observation and rollback rehearsal; issue #206 alone may enable
beta enforcement after the evidence passes.

## References

- [Firebase App Check with App Attest](https://firebase.google.com/docs/app-check/ios/app-attest-provider)
- [Firebase App Check with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Firebase App Check debug provider](https://firebase.google.com/docs/app-check/web/debug-provider)
- [Apple App Attest entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.devicecheck.appattest-environment)
- [Apple program membership comparison](https://developer.apple.com/support/compare-memberships/)
