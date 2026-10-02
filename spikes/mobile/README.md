# Wave 01 mobile architecture spikes

These candidates support [issue #152](https://github.com/marathoner-app/marathoner/issues/152),
a child of the physical-iPhone comparison in
[issue #84](https://github.com/marathoner-app/marathoner/issues/84). They are
disposable evidence, not production clients and not a mobile-stack decision.

Issue #84 established disconnected build and launch viability:

- `capacitor/` wraps the responsive root application in a Capacitor iOS shell,
  but its `mobile-spike` Vite mode replaces authentication, persistence, and the
  public login screen at bundle time. Its test rejects a bundle containing the
  current web Firebase project identifier.
- `expo-js/` proves Expo and Firebase JavaScript SDK bundle compatibility and
  keeps remote services disabled unless the explicit issue #86 Auth
  configuration is present.

Issue [#86](https://github.com/marathoner-app/marathoner/issues/86) adds a
separate, fail-closed authentication mode to each candidate. Its
[`auth-evidence.md`](./auth-evidence.md) records successful Email/Password
authentication, session restoration, logout, and durable logout on the same
physical iPhone. That gate did not access Firestore or training data.

Issue [#87](https://github.com/marathoner-app/marathoner/issues/87) adds one
exact, owner-scoped Firestore proof document without enabling production
training writes. Its contract, emulator evidence, live procedure, and cleanup
requirements are in
[`shared-record-evidence.md`](./shared-record-evidence.md).

Both paths now consume the same small
[`@marathoner/training-contract`](../../packages/training-contract/README.md)
boundary for completed-run identity and meter-based distance. Capacitor receives
it through the preserved web domain; Expo imports it directly. The package is a
boundary proof, not approval to relocate the full training model.

Do not commit Firebase values, signing material, an EAS project, or production
features to either candidate. The approved issue #86 values belong only in the
ignored local environment files and connect only to the development project.
Other remote behavior belongs to later, separately reviewed issues.

The October 2, 2026 signed-build and physical-iPhone results are recorded in
[`device-evidence.md`](./device-evidence.md). Both shells passed build and launch
viability. Issue #86 subsequently proved authentication on that device; shared
data, offline behavior, accessibility, and external distribution remain
separate gates.

## Supported toolchain

The comparison should use Node 22.13 or newer within the Node 22 LTS line and
Xcode 26.4 or newer. That common floor satisfies both candidates:

| Candidate | JavaScript requirement | Apple requirement | Source |
| --- | --- | --- | --- |
| Capacitor 8.5.2 | Node 22+ | Xcode 26.0+, iOS 15+; SPM is the Capacitor 8 default | [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup), [Capacitor iOS support](https://capacitorjs.com/docs/ios) |
| Expo SDK 57 | Node 22.13+, React Native 0.86, React 19.2.3 | Xcode 26.4+, iOS 16.4+ | [Expo SDK reference](https://docs.expo.dev/versions/latest/) |
| Expo Firebase JS | Firebase 12+ | Firebase JS provides Auth and Firestore but not native Analytics or Crashlytics | [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/) |

Initial workstation observation on September 22, 2026:

- this workstation has Node 23.4.0 and npm 11.0.0, so installs warn that the
  active non-LTS Node release is outside the supported React Native range;
- only `/Library/Developer/CommandLineTools` is selected;
- `xcodebuild` and `xcrun xctrace` cannot run because full Xcode is absent;
- JavaScript type checks, tests, web bundles, Expo iOS export, Capacitor project
  generation, and Capacitor SPM sync can run without full Xcode.

Use the Node 22 toolchain before treating performance, launch, or device results
as comparison evidence.

Physical-device validation on October 2 used Node 22.22.0, Xcode 27.0, an
iPhone 15 running iOS 26.6.2, and the exact candidate versions above. Both
candidates launched successfully. The local Personal Team selection was removed
from tracked project settings after the test. Both candidates subsequently
passed the issue #87 owner-scoped Firestore round trip against the preserved web
client, and both cleaned up the deterministic sample.

## Clean verification

From the repository root, install and verify the preserved web application:

```sh
npm ci
npm run lint
npm test
npm run build
```

Then verify the Capacitor candidate:

```sh
cd spikes/mobile/capacitor
npm ci
npm run typecheck
npm run build:web
npm test
npm run sync:ios
```

After populating the ignored root `.env.mobile-auth-spike.local` from its
example, build the separate authentication proof with:

```sh
npm run build:mobile-auth-spike
cd spikes/mobile/capacitor
npm run build:auth
npm run sync:ios
```

The shared-record proof reuses the same temporary development key through the
ignored `.env.mobile-shared-record-spike.local` file:

```sh
npm run build:mobile-shared-record-spike
cd spikes/mobile/capacitor
npm run build:shared-record
npm run sync:ios
```

Run the corresponding preserved-web proof without changing the normal app:

```sh
npm run dev:web-shared-record-spike
```

`ios/` is committed as a reproducible SPM-based project. If it is intentionally
regenerated in a disposable checkout, build the web candidate first and run:

```sh
npx cap add ios --packagemanager SPM
```

With Xcode 26.4 or newer selected, `npm run open:ios` opens the project. Choose a
local development team and the issue #84 test iPhone. Do not commit the team
identifier or provisioning material. The exact tested Swift package revision is
recorded in the shared Xcode workspace's `Package.resolved`.

Verify the Expo plus Firebase JS candidate separately:

```sh
cd spikes/mobile/expo-js
npm ci
npm run typecheck
npm test
npm run export:ios
```

The authentication proof additionally requires a local `.env.local` populated
from `.env.example`. The resolver accepts only a complete development-project
configuration and otherwise renders a blocked state without attempting a
Firebase connection.

With the supported Xcode and Node versions installed, `npm run ios` launches the
candidate for simulator testing. For the October 2 physical test, Expo Go and
the CLI used the same development account. An explicitly approved temporary
Expo tunnel was required after the LAN server returned empty responses; it was
stopped immediately after confirmation. This is evidence, not a default
production-development workflow.

## What this slice proves

- The current responsive React application can produce a Firebase-free
  Capacitor bundle without changing the normal web build.
- Capacitor 8 can generate and sync an iOS project using Swift Package Manager.
- Expo SDK 57, React Native 0.86, React 19.2.3, and Firebase JS 12 can type-check,
  pass the local boundary tests, and export an iOS JavaScript bundle.
- Both candidates can compile or bundle and render their isolated shell on the
  same physical iPhone.
- Both candidates can observe Firebase Auth state, authenticate the same
  existing development account used by the web app, restore the session after
  a force-quit, log out, and preserve that signed-out state after another
  force-quit.
- The shared contract, client adapters, and development rules can build and pass
  owner, anonymous, cross-owner, malformed-record, and cleanup tests for one
  exact proof document.
- Both candidates can write that document on the physical iPhone, have it read
  and replaced by the preserved web client, read the web replacement, and
  delete it with absence confirmed in both clients. The live detail is recorded
  in the issue #87 evidence.

It does not prove production training writes, network-loss behavior, external
distribution, background behavior, accessibility, Android signed-build
configuration, or performance. Those remain acceptance gates in #88 and #83.

## Dependency evidence

The October 2, 2026 Node 22 review reproduced 16 vulnerable dependency entries:
eight moderate and eight high. In addition to the existing `uuid` and grpc
advisories, Expo CLI now reaches `node-forge@1.4.0`, for which GitHub reports a
high-severity RSA signature-verification advisory and no patched release. The
affected packages are absent from the generated iOS runtime bundle, and the
specific APIs were not used by the disconnected candidate.

The complete version, reachability, remediation, and time-bounded risk record is
in [`dependency-audit.md`](./dependency-audit.md). The findings are accepted only
for this disposable spike through October 18, 2026. It remains a production
decision blocker if issue #83 selects Expo; npm's forced Expo 46 and Firebase 9
downgrades were not applied.
