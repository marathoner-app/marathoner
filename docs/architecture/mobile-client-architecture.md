# Mobile client architecture

- **Status:** Accepted architecture; production-shell implementation and release gates remain open
- **Decision date:** 2026-10-02
- **Decision owner:** Marathoner maintainer
- **Decision issue:** [#83](https://github.com/marathoner-app/marathoner/issues/83)
- **Parent spike:** [#33](https://github.com/marathoner-app/marathoner/issues/33)

## Decision

Marathoner will deliver the founding-beta iOS client by placing the canonical
root Vite and React application inside a Capacitor 8 iOS shell. The shell uses
Swift Package Manager and the Firebase JavaScript SDK already used by the web
application. It does not create a second feature UI, persistence model, or
application workspace.

The production target reserves this identifier, subject to availability when
the Apple and Firebase records are created:

```text
com.marathonerapp.marathoner
```

Expo plus the Firebase JavaScript SDK is the tested fallback, not a maintained
production client. Expo plus React Native Firebase is rejected for the founding
beta because no accepted requirement currently justifies its second
presentation layer and native Firebase boundary. Either alternative may be
reconsidered only through the reopen rules in this decision.

This decision selects a framework and repository boundary. It does **not** say
that the iOS client is implemented, externally distributable, accessible,
App Check protected, production configured, or beta ready.

## Why Capacitor won

Both implemented candidates passed the same relevant physical-device proof:

- [PR #172](https://github.com/marathoner-app/marathoner/pull/172) recorded
  Capacitor's signed local build/install and Expo's Expo Go launch on the same
  iPhone;
- [PR #174](https://github.com/marathoner-app/marathoner/pull/174) recorded
  Email/Password sign-in, force-quit session restoration, logout, and durable
  signed-out state for both candidates; and
- [PR #175](https://github.com/marathoner-app/marathoner/pull/175) recorded
  typed, owner-scoped iOS-to-web and web-to-iOS Firestore round trips for both
  candidates, plus cleanup and negative rule evidence.

The [issue #88 closeout](../../spikes/mobile/closeout.md) separates those facts
from the unproven release and production behavior. With shell, Auth, and data
feasibility tied, the differentiator is ownership cost:

| Driver | Capacitor result | Decision effect |
| --- | --- | --- |
| Product UI | Reused the root React presentation and adapter. | Avoid a second feature application for one solo maintainer. |
| Web preservation | Normal web modes remained unchanged. | Keep the deployed web product first class rather than treating it as migration input. |
| Auth | Required one explicit WebView persistence adapter, then passed. | A bounded platform adapter is cheaper than a separate Auth/UI implementation. |
| Shared data | Used the same typed contract and JavaScript SDK boundary. | No new persistence model is required. |
| Local build ownership | Produced a normal Xcode/SPM application and signed owner-device build. | The first release path can remain locally owned without EAS. |
| Offline product contract | The beta rejects offline material writes and uses memory-only training reads. | Native Firestore persistence is not an accepted reason to add React Native Firebase. |
| Android follow-on | Capacitor has an Android target over the same web application. | It preserves a credible later path without claiming untested parity. |

Capacitor did expose a named/default Firebase-app integration defect and one
delayed Firestore read during the proof. Those observations prevent a claim
that a WebView makes integration automatic. They support the adapter and
failure-state gates below rather than overturning the lower-duplication result.

## Current state versus target state

The root now contains the selected Capacitor configuration and committed,
team-neutral SPM Xcode project produced by issue
[#177](https://github.com/marathoner-app/marathoner/issues/177). Issue #178
removed the candidate runtimes, proof rule, and temporary key; only historical
evidence remains under `spikes/mobile/`. Issue #181 proved continuous physical-
device startup, and issue #125 proved explicit beta selection plus approved and
denied beta access. The shell is still not a shipping iOS client: App Check,
daily-use failure states, accessibility, and TestFlight remain unproven.

## Repository boundary

The target remains one application with thin native shells:

```text
marathoner/
├── src/                         canonical React UI, domain, and services
├── packages/
│   └── training-contract/      portable runtime schemas and fixtures
├── capacitor.config.ts         selected native-shell configuration
├── ios/                        committed SPM Xcode project
├── android/                    absent until Android issue #90 begins
├── server/                     trusted command handlers; never a mobile UI
└── spikes/mobile/              historical evidence documents only after #178
```

Binding repository rules:

1. `src/` remains the only feature presentation for web and Capacitor.
2. The iOS project loads the root production bundle; it does not copy or fork
   feature components into a mobile application directory.
3. Platform detection, Auth persistence, App Check, native bridges, and
   lifecycle behavior stay behind small service adapters.
4. Components do not import native SDKs, Capacitor plugins, or Firestore.
5. `packages/training-contract` stays limited to versioned runtime schemas,
   identifiers, canonical units, and fixtures that cross a client/server or
   future-platform boundary. It does not become a generalized shared workspace.
6. Firebase, React, Capacitor, and Apple types do not enter portable domain
   contracts.
7. The repository does not adopt npm workspaces, a monorepo framework, or a
   second build graph merely because a native shell exists.
8. The future Android project belongs at root `android/` and consumes the same
   root application. Android remains unproven until its own issues pass.

## Selected dependency boundary

The promotion begins from the versions that passed the physical spike:

| Boundary | Selected baseline | Rule |
| --- | --- | --- |
| Native runtime | `@capacitor/core` and `@capacitor/ios` 8.5.2 | Keep core, CLI, and platform packages on one compatible version. |
| Native dependency manager | Swift Package Manager | CocoaPods is not added without a plugin requirement and recorded change. |
| Web build | Existing root Vite and React application | Do not introduce a mobile-only presentation build. |
| Auth, Firestore, and Functions | Root Firebase JavaScript SDK 12.19.0 | The lockfile is authoritative; upgrades require web, copied-bundle, Auth, rules, and device evidence. |
| Apple App Check bridge | `@capacitor-firebase/app-check` 8.5.2 | Approved by #202 as a pinned native-to-JavaScript token bridge; registration, initialization, observation, and enforcement remain separate gates. |
| Portable contracts | `@marathoner/training-contract` | Expand only for an implemented cross-boundary consumer. |

Version upgrades are ordinary reviewed issues, not automatic permission to
cross this architecture boundary.

## Firebase and authentication boundary

Web and Capacitor use the same selected Firebase project configuration and
logical service interfaces, but persistence initialization may differ by
runtime:

- the browser retains its reviewed Firebase application and Auth behavior;
- the Capacitor WebView uses the explicit IndexedDB-first Auth persistence with
  local-storage fallback proven in #86;
- both routes return the same application-owned Auth interface to React;
- the selected environment is validated before Firebase initializes;
- missing, incomplete, colliding, or unexpected project configuration fails
  closed; and
- logout and account switching must clear participant state through the shared
  session-generation contract before ending Auth.

Development and beta remain separate. The development mode requires its
development-only key and rejects beta, while the explicit beta mode requires
its beta-only key and rejects development. Issue
[#125](https://github.com/marathoner-app/marathoner/issues/125) proved the
selected shell against `marathonerapp-beta` on a physical iPhone: an approved
verified fixture reached the empty training-data ready state, a verified
non-member received the expected permission denial, sign-out cleared the
session across a cold start, all fictional fixtures were removed, and the
copied bundle was restored to development.

Firebase public client configuration is not a server secret, but it is still
environment-controlled configuration. Apple signing keys, provisioning
profiles, App Store Connect private keys, App Check debug tokens, service
credentials, and account-recovery material are secrets and never belong in the
repository, screenshots, issue bodies, or build logs.

## Data, offline, and conflict boundary

The mobile selection does not change the accepted
[training-data synchronization decision](training-data-synchronization.md):

- reads use Firestore listeners and explicit memory-only training-data caching;
- a cached view is labeled stale until a server snapshot confirms freshness;
- material mutations use authenticated server commands rather than direct
  client Firestore writes;
- offline material writes fail visibly and are never queued for background
  replay;
- idempotency keys, expected revisions, and transactions prevent duplicate,
  stale, and partial outcomes;
- an ambiguous response is reconciled before a retry; and
- logout/account switching detach listeners, reject old callbacks, and clear
  participant state.

The issue #87 `setDoc` flow was disposable architecture evidence. It is not the
mobile write design. Issue #158 now provides the undeployed command foundation.
No plan approval, run completion, adjustment, consent, or deletion flow may ship
in Capacitor until its owning issue migrates to that boundary, #159 provides the
read foundation, and #138 passes the corresponding physical-device failure
states.

## App Check decision and go/no-go rule

External beta requires Apple-platform attestation through
[#161](https://github.com/marathoner-app/marathoner/issues/161). The current
Firebase JavaScript proof did not exercise App Attest or DeviceCheck. Firebase's
built-in Web SDK provider is reCAPTCHA Enterprise; its built-in Apple providers
belong to the native Apple SDK.

Issue #202 approved `@capacitor-firebase/app-check` 8.5.2 as the pinned
Capacitor 8-compatible bridge. It exposes Apple's App Attest token to the
Firebase JavaScript SDK through a `CustomProvider`, so the selected JavaScript
Auth, Firestore, and Functions boundary does not need to be replaced with
parallel native service adapters. The approval is limited to the dependency
and compiled native graph; [the dependency review](../security/app-check-bridge-review.md)
records:

- maintainer and release health;
- transitive and native dependencies;
- Firebase SDK version alignment;
- token attachment to Authentication, Firestore, and callable Functions;
- App Attest and debug-provider behavior;
- the native and JavaScript dependency footprint; and
- the remaining physical-iPhone, web, local, emulator, CI, refresh, revocation,
  observation, and enforcement evidence.

Marathoner supports iOS 15 and later, so the bridge's iOS 13 DeviceCheck path is
not a founding-beta fallback. Issue #203 must register distinct development and
beta native apps plus web providers. Issue #204 must initialize the native
provider before the JavaScript Firebase clients and fail closed on provider
errors. Issues #205 and #206 own observation, rollback, and staged enforcement.

A custom App Check provider and token-minting backend are outside this decision
because they create a new security service. Do not build one without a separate
threat model and ADR.

If no reviewed Capacitor bridge can satisfy #161 without unacceptable security,
maintenance, or operations cost, stop mobile feature expansion and reopen #83.
That failure is sufficient evidence to build the narrow Expo plus React Native
Firebase comparison rather than forcing Capacitor through an unsafe exception.

## Build, signing, and distribution ownership

The initial iOS release path is locally owned Xcode and App Store Connect:

1. a Marathoner-controlled Apple Developer identity owns the team, agreements,
   bundle identifier, App Store Connect record, and recoverable two-factor path;
2. the repository produces the web bundle and syncs the committed SPM project;
3. the owner creates a clean archive in Xcode from the reviewed commit;
4. distribution signing material remains in Apple-managed services and the
   controlled keychain, not Git;
5. the build is uploaded to App Store Connect and processed through TestFlight;
   and
6. the exact source revision, build number, review result, replacement, and
   rollback procedure are recorded without exposing credentials.

EAS is not part of the selected architecture. Capacitor produces a normal
native iOS application, and the owner already has the required Mac/Xcode path.
A hosted native-build service may be evaluated later when repeatability or
team scale justifies its credential and vendor surface.

Issue [#122](https://github.com/marathoner-app/marathoner/issues/122) owns Apple
account recovery, the clean distribution archive, external TestFlight review,
one non-owner journey, and replacement/rollback rehearsal. Local Personal Team
installation from #84 does not satisfy it.

## CI boundary and expected cost

The normal four Ubuntu pull-request jobs remain the universal gate. Issue #177
adds one bounded mobile JavaScript/configuration job for relevant root,
Capacitor, native-config, and contract changes. It must cover the web bundle,
mobile bundle boundary, type checks, tests, and sync/config validation without
signing.

Native compilation uses a path-filtered macOS job or a controlled local clean
build when the iOS project, native dependency graph, or release configuration
changes. Signed archives are explicit release operations, not per-PR jobs.
This keeps scarce macOS capacity and credential exposure proportional to the
native risk while every feature change still passes root application tests.

The repository must not add EAS, Appflow, Xcode Cloud, or another recurring
service merely to make the architecture diagram look complete. Any automation
proposal must name cost, credential custody, failure recovery, and an exit path.

## Monitoring and diagnostics

The initial distribution path uses Xcode Organizer and App Store
Connect/TestFlight crash and diagnostic reports. The application must also
surface recoverable UI errors and may emit privacy-reviewed operational events,
but no training record, note, credential, App Check token, or raw command body
may enter logs or analytics.

Native Firebase Crashlytics is not part of the selected baseline. If observed
support burden shows that Apple diagnostics and bounded client telemetry are
insufficient, #109 may evaluate a cross-platform error service or a native
bridge with a data map, retention rule, access owner, dependency review, and
kill switch. A monitoring preference alone does not silently change the
mobile SDK boundary.

## Accessibility and daily-use gates

The responsive application was visually usable in the owner proof, but the
spike did not test VoiceOver, Dynamic Type, focus order, keyboard entry, touch
targets, reduced motion, or representative failure states. Capacitor selection
does not waive those requirements.

- #137 owns expiry, revocation, account switching, and stale-callback isolation.
- #138 owns the online/offline daily completion loop and cross-client result.
- #140 owns physical-device accessibility and critical failure-state evidence.

A defect in application markup or styling is fixed in the shared UI. A systemic
WebView limitation that makes a critical flow inaccessible or unreliable at
reasonable cost triggers ADR review.

## Android implication

Android external distribution remains outside the founding-beta critical path.
The decision gives #90 a default direction—generate a Capacitor Android shell
over the same root application—but does not prove it.

Android requires its own package identifier, Firebase registration, key and App
Check restriction, signing custody, memory-cache behavior, lifecycle tests,
accessibility evidence, and physical-device build. Issue #93 owns its Firebase
registration. No iOS result may be presented as Android compatibility evidence.

## Rejected alternatives

### Expo plus Firebase JavaScript SDK

The Expo candidate passed the shell, Auth, and shared-record proofs, but it
required a separate React Native presentation and adapter, an Expo account on
CLI and device, and an authenticated tunnel when LAN serving failed. Its
time-bounded dependency disposition also contains production blockers. Native
UI quality did not demonstrate enough accepted beta value to pay for that
duplicated application surface.

The merged proof remains historical fallback evidence. Issue #178 removes its
runtime and candidate-only dependency graph after Capacitor promotion; Git
history and the evidence documents are sufficient to reconstruct a new spike
if this ADR reopens.

### Expo plus React Native Firebase

This option was explicitly evaluated but not built. Its benefits—native
attestation, native Firebase telemetry, and native Firestore behavior—were not
proven necessary for the current beta contract. Building it speculatively would
combine the duplicated React Native presentation with a second Firebase
adapter and native configuration before the need exists.

It becomes the next comparison only if App Check or another hard native
Firebase requirement triggers the reopen rules.

### Swift-only iOS client

A separate SwiftUI application would maximize native control and duplication.
It is outside the solo-owner founding-beta scope and received no comparable
spike evidence.

### Web-only founding beta

The web application remains the responsible fallback if the selected iOS path
cannot pass its binding gates in time. It does not satisfy the ratified iOS
founding-beta promise without an explicit product/date decision.

## Migration and cleanup sequence

1. The ADR merged and #83 closed.
2. #177 promoted the tested Capacitor boundary to root with the reserved bundle
   identifier, committed SPM project, production Firebase bootstrap, bounded CI,
   simulator evidence, and a physical development launch.
3. #125 proved the selected client intentionally targets the beta environment;
   it never falls back from development to beta.
4. #178 removed candidate runtimes, the proof-only Firestore rule/tests, and the
   temporary unrestricted mobile comparison key while preserving evidence.
5. #158 established the local server-confirmed command foundation. #72 and #115
   migrate the material workflows, while #159 implements live reads,
   memory-only caching, freshness, and account-isolation contracts in web first.
6. #161 proves and observes App Check before enforcement.
7. #137, #138, and #140 implement and exercise the selected iOS behavior.
8. #122 proves the external distribution and non-owner release journey.
9. Android stays held until #90 begins after the iOS boundary is stable.

No step may borrow completion evidence from a later step. In particular, a
local signed launch is not TestFlight, an online proof write is not an offline
contract, and a JavaScript package's platform claim is not physical attestation.

## Reopen triggers

Reopen #83 before external beta if any of these occurs:

- #161 cannot produce valid Apple attestation for Authentication, Firestore,
  and Functions without an unacceptable bridge or custom security service;
- App Store Connect or TestFlight identifies a framework-level distribution or
  policy blocker that a focused fix cannot resolve;
- #140 finds a systemic critical accessibility failure in the WebView path;
- #137 or #138 shows unacceptable lifecycle, session-isolation, performance,
  network-loss, or daily-use behavior that is intrinsic to the selected shell;
- a hard beta requirement for native telemetry, background execution, health
  data, or another device API cannot be met through a small reviewed plugin;
- the selected native dependency becomes unmaintained or develops an
  unresolved reachable critical vulnerability; or
- Android becomes a beta-critical client and its physical evidence materially
  changes the duplication calculation.

Ordinary UI defects, plugin setup work, and the existence of a more fashionable
framework do not reopen the ADR.

## Consequences

Positive consequences:

- one canonical feature UI and domain for web and iOS;
- the lowest demonstrated maintenance and exit cost for a solo owner;
- a normal native Xcode project and standard TestFlight path;
- existing web behavior, contracts, and Firebase investment are preserved; and
- Android retains a plausible shared-shell route without entering the beta
  critical path.

Accepted costs and doubts:

- WebView-specific Auth, lifecycle, keyboard, accessibility, and performance
  behavior must be tested rather than assumed;
- native App Check probably requires one separately audited bridge;
- Apple-native crash telemetry is less integrated with JavaScript than a fully
  native Firebase client;
- native projects, signing, Xcode drift, and store operations still exist; and
- failure of a binding gate can reopen the decision after some promotion work.

Those costs are visible, owned, and smaller than maintaining two product
applications before the beta has validated its core value.

## References

- [Mobile spike closeout](../../spikes/mobile/closeout.md)
- [Physical-device evidence](../../spikes/mobile/device-evidence.md)
- [Authentication evidence](../../spikes/mobile/auth-evidence.md)
- [Shared-record evidence](../../spikes/mobile/shared-record-evidence.md)
- [Expo dependency disposition](../../spikes/mobile/dependency-audit.md)
- [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor iOS documentation](https://capacitorjs.com/docs/ios)
- [Firebase App Check for Apple platforms](https://firebase.google.com/docs/app-check/ios/app-attest-provider)
- [Firebase App Check for web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Capawesome Capacitor Firebase App Check plugin](https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/app-check)
- [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
