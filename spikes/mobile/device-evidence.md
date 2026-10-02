# Issue #84 physical-iPhone evidence

- **Issue:** [#84](https://github.com/marathoner-app/marathoner/issues/84)
- **Observed:** October 2, 2026
- **Result:** both disposable candidates built and launched on a physical iPhone
- **Decision status:** shell viability passed; no production mobile stack is selected

## Scope and safeguards

This exercise compared the minimum Capacitor and Expo plus Firebase JavaScript
shells already isolated under `spikes/mobile/`. It did not enable Firebase,
authenticate a participant, write remote data, create an EAS project, or add
production mobile behavior.

The physical-device credentials remained workstation-local:

- Xcode automatic signing used a Personal Team only for the device build. The
  team identifier, certificate, and provisioning profile are not committed.
- The Expo candidate contained no Firebase configuration and preserved its
  fail-closed remote-service boundary.
- Expo Go and the Expo CLI used the same development account. A temporary,
  explicitly approved Expo tunnel was used after the LAN server failed, then
  stopped immediately after visual confirmation.
- `@expo/ngrok` was installed as global workstation tooling for that tunnel. It
  is not a repository dependency and changed no Marathoner lockfile.

## Observed environment

| Component | Observed value |
| --- | --- |
| Mac toolchain | Xcode 27.0 (build 27A266a), iOS 27 SDK |
| JavaScript toolchain | Node 22.22.0, npm 10.9.4 |
| Physical device | iPhone 15 (`iPhone15,4`), iOS 26.6.2 |
| Capacitor candidate | Capacitor 8.5.2, Swift Package Manager |
| Expo candidate | Expo SDK 57.0.26, React Native 0.86.3, React 19.2.3, Firebase JS 12.19.0 |

The workstation's default Node 23 installation was not used as evidence. An
official Node 22 distribution was checksum-verified and placed outside the
repository for the comparison.

## Clean and native verification

The following checks passed under Node 22:

| Candidate | Passed evidence |
| --- | --- |
| Preserved web | clean install, lint, 112 scoped tests, production build |
| Capacitor | clean install, TypeScript, safe-bundle test, Firebase-free web build, iOS sync |
| Expo plus Firebase JS | clean install, TypeScript, seven candidate tests, iOS export |

Capacitor then passed all native gates used in this slice:

1. Xcode resolved `capacitor-swift-pm` 8.5.2.
2. An unsigned generic iOS-device compile succeeded.
3. Xcode automatic signing produced a signed Debug build for the test iPhone.
4. `devicectl` installed and launched
   `com.marathonerapp.spike.capacitor`.
5. The maintainer confirmed the Marathoner Capacitor spike remained visible
   without an error.

Expo then passed its physical-device gate:

1. Expo Go and the CLI authenticated to the same development account.
2. Metro completed a 719-module iOS bundle through the temporary tunnel.
3. The maintainer confirmed the **Expo + Firebase JS candidate** screen rendered
   correctly on the same iPhone.
4. The tunnel was stopped immediately after confirmation.

These results satisfy shell build and launch viability. They also prove both
candidates can proceed to the deliberately separate authentication proof in
[#86](https://github.com/marathoner-app/marathoner/issues/86), followed by the
shared-record and ownership proof in
[#87](https://github.com/marathoner-app/marathoner/issues/87). They do not claim
that either later proof has passed.

## Setup effort and duplication

### Capacitor

- Reuses the current responsive React application, routing, feature UI, and
  shared training contract.
- Adds a generated native wrapper plus 67 lines across three service-boundary
  stubs. The safe-bundle test prevents the web Firebase project identifier from
  entering the disposable iOS bundle.
- Requires the ordinary Apple device setup: full Xcode, pairing, Developer
  Mode, an Apple Development identity, automatic provisioning, and first-use
  trust on the phone.
- Swift Package Manager resolved and compiled successfully; the committed
  `Package.resolved` pins the exact tested Capacitor revision.

### Expo plus Firebase JavaScript

- Reuses the 24-line Firebase boundary and the versioned shared training
  contract, but its 133-line `App.tsx` is a separate React Native presentation.
  That 157-line runtime slice is small, yet it demonstrates that production
  screens and design-system components would need React Native equivalents.
- Expo Go avoided generating a native project for this shell test, but required
  an Expo account on both the CLI and device.
- The local LAN URL accepted connections but returned empty responses. The
  authenticated Expo tunnel succeeded, making network path and account state
  additional local-development dependencies to resolve before selection.
- Metro emitted a `SafeAreaView` deprecation warning. A selected Expo client
  should use `react-native-safe-area-context`; the disposable shell was not
  expanded solely to remove that warning.

The comparison therefore favors Capacitor on near-term code reuse and favors
Expo on a native React Native UI surface. It does not establish that either
tradeoff outweighs authentication, shared-record, offline, accessibility,
TestFlight, or long-term release evidence.

## Concerns and decision implications

1. **No architecture winner yet.** Physical launch removes a feasibility risk;
   it does not satisfy the decision evidence in #83.
2. **Capacitor has lower demonstrated duplication.** That advantage matters for
   a solo maintainer, but still needs daily-use, accessibility, and App Review
   evidence.
3. **Expo has additional development-service friction.** The observed LAN
   failure and authenticated tunnel requirement must be revisited before the
   local workflow is described as dependable.
4. **Expo dependency health changed during the test.** The October 2 audit
   added the high-severity `node-forge` advisory to the existing `uuid` and
   grpc findings. The affected signature-verification behavior was not used by
   this disconnected shell and the package was absent from the iOS bundle, but
   there is no patched `node-forge` release. The updated, time-bounded
   disposition is in [`dependency-audit.md`](./dependency-audit.md).

## What remains unproven

- Firebase authentication and session recovery (#86)
- shared iOS/web Firestore access and ownership denial (#87)
- network loss, offline cache, and conflict behavior
- VoiceOver, text scaling, keyboard, and touch behavior
- TestFlight or another external distribution path
- production App Check, telemetry, crash reporting, and release ownership
- the final repository boundary and mobile-stack ADR (#83)

Issue [#88](https://github.com/marathoner-app/marathoner/issues/88) owns the
cross-cutting closeout and recommendation after those later proofs exist.
