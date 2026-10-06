# App Check provider registration

- **Status:** Development and beta web/iOS providers registered; client
  initialization, observation, and enforcement remain off
- **Registration date:** 2026-10-06
- **Tracking issue:**
  [#203](https://github.com/marathoner-app/marathoner/issues/203)
- **Parent:**
  [#161](https://github.com/marathoner-app/marathoner/issues/161)

## Registered boundary

The same application surfaces exist in two Firebase projects, but no app ID,
site key, native configuration, or future debug token is shared between them.
The registrations are public client identities, not administrator credentials.

| Environment | Firebase app | Public app identity | Provider | Provider boundary |
| --- | --- | --- | --- | --- |
| Development | `Marathoner` web | `1:677998037771:web:9269b3b5f82909ccc3b00e` | Fraud Defense (reCAPTCHA Enterprise) | Site key `6LcjU-ItAAAAAFduN8dYLc-0HiI1yLtaI0liOX5Q`; `marathoner-app.github.io` only |
| Development | `Marathoner Development iOS` | `1:677998037771:ios:71c7b70132f83f57c3b00e` | App Attest | Bundle `com.marathonerapp.marathoner`; no DeviceCheck fallback |
| Beta | `Marathoner Beta Web` | `1:156851031272:web:a6ab19f6b760fcf5084d5d` | Fraud Defense (reCAPTCHA Enterprise) | Site key `6Ld7-uEtAAAAAMi5OH-KIzx7e0ZkMm3xrwehkxEl`; `marathonerapp.com` and `www.marathonerapp.com` only |
| Beta | `Marathoner Beta iOS` | `1:156851031272:ios:8ad247902c872823084d5d` | App Attest | Bundle `com.marathonerapp.marathoner`; no DeviceCheck fallback |

Both providers retain the console's one-hour token TTL. No custom provider,
reCAPTCHA v3 registration, DeviceCheck fallback, or App Check debug token was
created by #203.

## Native configuration selection

The public Firebase Apple configuration files are versioned separately:

- `ios/firebase/development/GoogleService-Info.plist`
- `ios/firebase/beta/GoogleService-Info.plist`

`npm run build:ios` validates both registrations and copies only development to
the ignored Xcode resource at `ios/App/App/GoogleService-Info.plist`.
`npm run build:ios:beta` performs the same check and selects beta. The Xcode
project includes that generated destination in the application resources.

Selection fails before Xcode use when either source is missing, the bundle,
project, sender, storage bucket, or exact Firebase app ID is wrong, the two
environments reuse an app ID or API key, the file contains a debug token or
privileged credential field, or the generated resource is not byte-for-byte
equal to the selected source. The generated destination is ignored so a beta
selection cannot become an accidental source change.

`GoogleService-Info.plist` contains public Firebase client configuration. It
must not be confused with a service-account file, Apple private key, signing
certificate, App Attest key, password, Firebase CLI token, or App Check debug
token; none of those belong in Git.

## Debug-token custody

Debug providers are an exception for local and CI testing, not a beta runtime
fallback. Issue #204 may create them only under this policy:

| Scope | Identity and storage | Owner | Rotation and revocation |
| --- | --- | --- | --- |
| Development local | One token per operator/device, named `development-local-<operator>-<device>`; value only in an ignored mode-`0600` `*.local` file | The named operator; console custody remains with the Marathoner administrator | Revoke immediately for suspected exposure, lost/retired device, or custody change; replace at least every 90 days while active |
| Development CI | Dedicated `development-ci-github-actions` token; value only in a development GitHub environment secret | Repository administrator | Rotate on runner/workflow trust changes and at least every 90 days; replace the secret, prove the new token, then revoke the old token |
| Beta local | One beta-only token per approved operator/device; never reuse a development token or file | Marathoner administrator | Same immediate revocation rules; remove after the bounded beta proof when no longer needed |
| Beta CI | Dedicated `beta-ci-github-actions` token in a protected beta GitHub environment secret | Marathoner administrator | Rotate on environment/workflow trust changes and at least every 90 days; revoke before removing the environment control |

Token values must never be committed, copied into issues or pull requests,
printed by scripts, included in screenshots, placed in build artifacts, or
shared across environments. A token inventory may record only its display
name, owner, creation date, last verification date, and revocation date.

## Enforcement state and rollout gates

Provider registration does not reject unverified traffic. The 2026-10-06
console review left enforcement off:

| API | Development | Beta |
| --- | --- | --- |
| Authentication | Unenforced | Unenforced |
| Cloud Firestore | Unenforced | Not enabled for App Check enforcement |
| Functions | No console enforcement enabled; Functions must enforce in code | No console enforcement enabled; Functions must enforce in code |

The rollout remains deliberately staged:

1. #204 initializes the correct provider before Firebase services are acquired,
   proves release builds exclude debug mode, and fails closed on mismatches.
2. #205 observes valid/invalid traffic and rehearses rollback without blocking
   users.
3. #206 alone may enable beta enforcement after the observation evidence passes
   and must prove rejected-client behavior for Authentication, Firestore, and
   Functions.

Do not treat the four registered rows as evidence that a client currently
sends App Check tokens or that any backend rejects missing tokens.

## Console verification evidence

After registration, both project App Check **Apps** tables showed the web row
as **Fraud Defense / Registered** and the iOS row as **App Attest /
Registered**. The development API table showed Authentication and Firestore as
**Unenforced**. The beta API table showed Authentication as **Unenforced**,
Firestore as not yet receiving eligible App Check traffic, and no Functions
enforcement control. No enforcement action or debug-token creation was taken.

## References

- [Firebase App Check with App Attest](https://firebase.google.com/docs/app-check/ios/app-attest-provider)
- [Firebase App Check with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Firebase App Check debug provider](https://firebase.google.com/docs/app-check/web/debug-provider)
- [Firebase Apple configuration files](https://firebase.google.com/docs/ios/setup#add-config-file)
