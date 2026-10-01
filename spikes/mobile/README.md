# Wave 01 mobile architecture spikes

These candidates support [issue #152](https://github.com/marathoner-app/marathoner/issues/152),
a child of the physical-iPhone comparison in
[issue #84](https://github.com/marathoner-app/marathoner/issues/84). They are
disposable evidence, not production clients and not a mobile-stack decision.

Both candidates are deliberately disconnected from remote services:

- `capacitor/` wraps the responsive root application in a Capacitor iOS shell,
  but its `mobile-spike` Vite mode replaces authentication, persistence, and the
  public login screen at bundle time. Its test rejects a bundle containing the
  current web Firebase project identifier.
- `expo-js/` proves Expo and Firebase JavaScript SDK bundle compatibility. It
  reports whether an explicit development environment exists but never calls
  Firebase initialization. Authentication and data writes remain disabled.

Both paths now consume the same small
[`@marathoner/training-contract`](../../packages/training-contract/README.md)
boundary for completed-run identity and meter-based distance. Capacitor receives
it through the preserved web domain; Expo imports it directly. The package is a
boundary proof, not approval to relocate the full training model.

Do not add real Firebase values, signing material, an EAS project, or production
features to either candidate. Those belong to later, separately reviewed issues.

## Supported toolchain

The comparison should use Node 22.13 or newer within the Node 22 LTS line and
Xcode 26.4 or newer. That common floor satisfies both candidates:

| Candidate | JavaScript requirement | Apple requirement | Source |
| --- | --- | --- | --- |
| Capacitor 8.5.2 | Node 22+ | Xcode 26.0+, iOS 15+; SPM is the Capacitor 8 default | [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup), [Capacitor iOS support](https://capacitorjs.com/docs/ios) |
| Expo SDK 57 | Node 22.13+, React Native 0.86, React 19.2.3 | Xcode 26.4+, iOS 16.4+ | [Expo SDK reference](https://docs.expo.dev/versions/latest/) |
| Expo Firebase JS | Firebase 12+ | Firebase JS provides Auth and Firestore but not native Analytics or Crashlytics | [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/) |

Observed on September 22, 2026:

- this workstation has Node 23.4.0 and npm 11.0.0, so installs warn that the
  active non-LTS Node release is outside the supported React Native range;
- only `/Library/Developer/CommandLineTools` is selected;
- `xcodebuild` and `xcrun xctrace` cannot run because full Xcode is absent;
- JavaScript type checks, tests, web bundles, Expo iOS export, Capacitor project
  generation, and Capacitor SPM sync can run without full Xcode.

Use the Node 22 toolchain before treating performance, launch, or device results
as comparison evidence.

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

`ios/` is committed as a reproducible SPM-based project. If it is intentionally
regenerated in a disposable checkout, build the web candidate first and run:

```sh
npx cap add ios --packagemanager SPM
```

With Xcode 26.4 or newer selected, `npm run open:ios` opens the project. Choose a
development team, use the issue #84 test iPhone, and record build, launch,
responsive layout, session, and shared-record observations in that issue.

Verify the Expo plus Firebase JS candidate separately:

```sh
cd spikes/mobile/expo-js
npm ci
npm run typecheck
npm test
npm run export:ios
```

With the supported Xcode and Node versions installed, `npm run ios` launches the
candidate for simulator testing. The physical-iPhone criteria remain open until
issue #84 records observed device evidence for both candidates.

## What this slice proves

- The current responsive React application can produce a Firebase-free
  Capacitor bundle without changing the normal web build.
- Capacitor 8 can generate and sync an iOS project using Swift Package Manager.
- Expo SDK 57, React Native 0.86, React 19.2.3, and Firebase JS 12 can type-check,
  pass the local boundary tests, and export an iOS JavaScript bundle.

It does not prove Apple signing, native compilation, physical-device launch,
session restoration, a Firestore round trip, background behavior, accessibility,
or performance. Those remain acceptance gates in #84 and its later child issues.

## Dependency evidence

The September 30, 2026 Node 22.13 review updated the Expo candidate to SDK
57.0.26 and reproduced 14 audit paths: 10 moderate paths to `uuid` through
Expo's Xcode tooling and four high paths through Firestore to two grpc
advisories. The affected packages are absent from the generated iOS runtime
bundle, and the individual code paths concern Xcode tooling APIs or gRPC server
behavior that the disconnected candidate does not use.

The complete version, reachability, remediation, and time-bounded risk record is
in [`dependency-audit.md`](./dependency-audit.md). The finding is accepted only
for this disposable spike through October 18, 2026. It remains a production
decision blocker if issue #83 selects Expo; npm's forced Expo 46 and Firebase 9
downgrades were not applied.
