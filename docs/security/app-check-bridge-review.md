# App Check bridge dependency review

- **Status:** Approved for staged implementation; not initialized or enforced
- **Review date:** October 6, 2026
- **Tracking issue:** [#202](https://github.com/marathoner-app/marathoner/issues/202)
- **Parent:** [#161](https://github.com/marathoner-app/marathoner/issues/161)

## Decision

Marathoner may use `@capacitor-firebase/app-check` 8.5.2 as the narrow bridge
between Apple App Attest and the existing Firebase JavaScript clients. This
approval covers the pinned dependency and native build graph only. It does not
approve provider registration, debug tokens, client initialization, billing,
Functions deployment, or enforcement.

The bridge is needed because the Capacitor application continues to use the
Firebase JavaScript SDK for Authentication, Firestore, and callable Functions.
Firebase App Check's JavaScript providers cover browser attestation, while App
Attest belongs to the native Apple SDK. The selected bridge obtains the native
token and supports passing it into the JavaScript SDK through a
`CustomProvider`; the Firebase JavaScript SDK can then attach that token to the
existing service requests.

## Reviewed versions and compatibility

| Boundary | Reviewed selection | Reason |
| --- | --- | --- |
| Capacitor | 8.5.2 across core, CLI, and iOS | Already selected and physically proven by the mobile ADR. |
| App Check bridge | `@capacitor-firebase/app-check` 8.5.2, exact | Active Capacitor 8 line; exact pin prevents an unreviewed native plugin update. |
| Firebase JavaScript | `^12.19.0`, resolved to 12.19.0 | The bridge requires `^12.6.0`; 12.19.0 is the current supported release and contains the later Auth/App Check reCAPTCHA conflict fix. |
| Rules test library | `@firebase/rules-unit-testing` `^5.0.2` | Version 5 is the Firebase 12-compatible test line and requires Node 20 or later. |
| Firebase Apple SDK | 12.19.2 in `Package.resolved` | Selected by the bridge's `12.7.0..<13.0.0` Swift package range and compiled successfully for iOS 15. |

Firebase 12 raises its Node floor to 20 and its JavaScript target to ES2020.
Marathoner CI and Functions use Node 22, and Vite 6 compiles the browser and
WebView bundles, so neither change expands the supported-runtime boundary.

## Maintainer and supply-chain review

The bridge is community-maintained and is not a Google or Firebase product.
That distinction must remain visible in architecture and incident decisions.

Evidence reviewed on October 6, 2026:

- the npm package is Apache-2.0 and lists Robin Genz as its maintainer;
- the package has published compatible major lines since 2023, and the pinned
  8.5.2 release was published September 17, 2026;
- the source repository was active on the review date, was not archived or
  disabled, and had 43 open issues;
- the unpacked npm package is approximately 103 KB and declares only peer
  relationships on Capacitor core and Firebase JavaScript; and
- the repository has one named npm maintainer, so maintainer concentration is
  an explicit continuity risk rather than an assumed team-backed dependency.

The exact npm version, committed JavaScript lockfile, committed Swift package
manifest, and committed Swift resolution file are the reproducibility controls.
Capacitor generates a local absolute SPM symlink during `cap sync`; that symlink
is ignored and must never be committed.

## Native and JavaScript behavior

The reviewed bridge behavior is narrow:

1. On iOS 14 and later, its provider factory selects `AppAttestProvider`; it
   falls back to DeviceCheck only below iOS 14. Marathoner's minimum is iOS 15,
   so App Attest is the only supported founding-beta path.
2. The native plugin initializes Firebase Core from the selected
   `GoogleService-Info.plist`, obtains or refreshes an App Check token, and can
   expose that token to JavaScript.
3. The bridge documentation uses a Firebase JavaScript `CustomProvider` whose
   `getToken` callback calls the native bridge. Issue #204 must implement this
   before any supported Firebase service is acquired.
4. Token auto-refresh is off by default and must be enabled explicitly.
5. Native debug mode selects Firebase's debug provider. A truthy token option
   selects that mode but does not itself make a source-controlled token safe;
   #203 and #204 must prove secret storage, release-build exclusion, and
   revocation.
6. Provider registration and broad Firebase enforcement are console state, not
   consequences of installing this dependency.

The plugin is linked into the iOS target but is not imported or invoked by the
application in this issue. A compiled simulator launch succeeded without a
native Firebase configuration because no App Check call is made. Issue #203
must add distinct development and beta native registrations and a fail-closed
configuration selection before #204 invokes the plugin.

## Native dependency footprint

The application target links the bridge, `FirebaseAppCheck`, and
`FirebaseCore`. Xcode's resolved package graph also records repositories used
across the Firebase Apple package, including App Check Core, GoogleUtilities,
Promises, and interoperability modules. `Package.resolved` contains additional
Firebase package pins that are resolved but are not target dependencies of the
Marathoner build. The unsigned Xcode dependency graph is the authority for what
is compiled; the resolution file alone must not be described as shipped code.

The first clean unsigned compile built 43 targets. The App Check path compiled
Firebase Core, Firebase App Check, App Check Core, the reCAPTCHA support module
used by the Apple SDK, GoogleUtilities, Promises, Capacitor, and the bridge. It
did not add native Auth or native Firestore, preserving the selected
JavaScript-service architecture.

## Security audit disposition

The lockfile audit after alignment reports:

| Audit | Result on October 6, 2026 | Disposition |
| --- | --- | --- |
| `npm audit --omit=dev` | 2 moderate, 5 high, 1 critical | Live Functions deployment remains blocked by #143. |
| `npm audit` | 7 moderate, 15 high, 3 critical | Tooling findings remain owned by #143; no forced downgrade is accepted. |

No reported advisory originates in the App Check bridge implementation. npm
shows the bridge in the Firebase advisory path because Firebase is its peer and
is already a direct Marathoner dependency. The production findings include the
Firebase Web Firestore gRPC path, the undeployed Functions Express proxy path,
and an unused Firebase Admin/CLI UUID path. The full audit additionally includes
test, bundler, Capacitor CLI, and Firebase CLI tooling.

This review does not waive those findings. Issue #143 is a hard dependency of
the first live Functions deployment in #205. Do not run `npm audit fix --force`:
the current recommendation includes breaking downgrades and does not represent
a reviewed security repair.

## Verification completed in this slice

- one deduplicated Firebase 12.19.0 npm tree satisfies the application, bridge,
  and rules-test peers;
- lint, 248 unit/component tests, and the production build pass;
- development iOS build, sync, and copied-bundle inspection pass;
- the unsigned iOS simulator build succeeds with the pinned native graph; and
- the compiled application launches in an iOS simulator without invoking App
  Check or changing the existing Firebase JavaScript behavior.

Firestore and material-command emulator suites, the explicit beta build, and a
physical-iPhone Auth/Firestore regression remain required before merge.

## Reopen and removal rules

Stop App Check rollout and reopen the mobile architecture decision if any of
these occurs:

- the bridge becomes incompatible with the selected Capacitor or Firebase
  major line;
- its native token cannot authenticate Firebase JavaScript Auth, Firestore, and
  Functions requests from the physical iPhone;
- debug mode can enter a beta build or expose a token;
- refresh, expiry, revocation, or failure cannot reach a bounded user-visible
  state;
- maintenance stops or an unresolved bridge vulnerability exceeds the accepted
  pre-beta window; or
- registration requires a custom token-minting backend or an undocumented
  bypass.

Removal means deleting the direct bridge dependency, synchronizing iOS to
remove its package/product entries, verifying the resolution graph, and
repeating the browser plus physical-device regression suite. Do not retain a
dormant native security plugin.

## Primary references

- [Firebase JavaScript release notes](https://firebase.google.com/support/release-notes/js)
- [Firebase App Check with App Attest](https://firebase.google.com/docs/app-check/ios/app-attest-provider)
- [Firebase App Check with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Firebase App Check debug provider](https://firebase.google.com/docs/app-check/web/debug-provider)
- [Capawesome App Check package](https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/app-check)
- [Capawesome Firebase JavaScript bridge guide](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/app-check/docs/firebase-js-sdk.md)
