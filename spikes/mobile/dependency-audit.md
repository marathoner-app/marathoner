# Expo SDK 57 dependency advisory disposition

- **Issue:** [#153](https://github.com/marathoner-app/marathoner/issues/153)
- **Reviewed:** October 2, 2026
- **Owner:** Kevin Tulloch
- **Applies to:** the isolated `spikes/mobile/expo-js` candidate only
- **Disposition expires:** October 18, 2026
- **Production status:** not accepted for a selected or participant-facing client

## Decision

The current advisories are temporarily accepted for the disposable Expo
architecture candidate because the affected code is not present in its iOS
runtime bundle and the candidate neither verifies untrusted Expo update
signatures nor processes untrusted Xcode projects. Issue #86 initializes
Firebase Auth, and issue #87 adds one exact development-only Firestore proof
document under the narrow controls recorded below. This
acceptance permits continued comparison work; it does not approve Expo,
Firebase JS, an override, or these versions for the production mobile client.

Issue #83 selected Capacitor, so this temporary acceptance never became a
production waiver. Issue #178 removes the disposable Expo runtime and its
dependency graph after the selected shell replaces the comparison path. If the
mobile ADR later reopens to Expo, production adoption remains blocked until
either upstream packages remove the affected paths or a narrowly scoped
override passes the complete automated, generated-native-project, signed-build,
and physical-iPhone verification gate.

## Reproduced result

A clean install under Node 22.22.0 and npm 10.9.4 reported 16 vulnerable
production dependency entries: eight moderate and eight high. The underlying
advisories are one moderate `uuid` advisory, two grpc advisories reached through
Firestore, and one newly reported high `node-forge` advisory reached through
Expo CLI tooling. npm groups dependency entries by their highest transitive
severity; one of the two grpc advisories is independently rated low by GitHub.

The audited direct and transitive versions are:

| Dependency path | Installed version | Current compatible upstream result |
| --- | --- | --- |
| `expo` | 57.0.26 | Latest published SDK 57 patch on September 30 |
| `expo → @expo/config-plugins → xcode → uuid` | 57.0.26 → 57.0.9 → 3.0.1 → 7.0.3 | Still present in Expo 57.0.26 |
| `expo → @expo/cli → node-forge` | 57.0.26 → 57.0.27 → 1.4.0 | GitHub reports no patched `node-forge` version as of October 2 |
| `expo → @expo/cli → @expo/code-signing-certificates → node-forge` | 57.0.26 → 57.0.27 → 0.0.6 → 1.4.0 | Same unpatched advisory path |
| `firebase → @firebase/firestore → @grpc/grpc-js` | 12.19.0 → 4.17.2 → 1.9.16 | Firebase 12.19.0 and Firestore 4.17.2 are current; Firestore still declares `@grpc/grpc-js~1.9.0` |

`npm outdated` reported no newer version within the declared Expo, Firebase,
React, React Native, or TypeScript ranges. React, React Native, TypeScript, and
React type definitions have newer releases outside the SDK 57-compatible
ranges; they are not a remediation for these findings.

## Reachability findings

### `uuid` GHSA-w5hq-g745-h8pq

The advisory affects the v3, v5, and v6 methods when a caller provides an
undersized output buffer or invalid offset. Expo's transitive `xcode@3.0.1`
package imports `uuid` only in its Node-based Xcode project writer and calls
`uuid.v4()` without a caller-provided buffer. The package is architecture and
build tooling, not application runtime code.

An unminified Expo iOS export with an external source map contained no
`node_modules/uuid`, `node_modules/xcode`, or matching package reference.

### `node-forge` GHSA-86w9-cpqp-85rv

The high advisory concerns RSA PKCS#1 v1.5 signature verification accepting an
invalid nested `DigestAlgorithm` structure. GitHub lists all versions through
1.4.0 as affected and no patched version.

Expo SDK 57 reaches `node-forge@1.4.0` through Node-based CLI and certificate
tooling. The CLI path used for local iOS signing parses the developer's local
Apple certificate; the vulnerable verification behavior is also exposed by
`@expo/code-signing-certificates`, which supports Expo update-signing
certificates. This disconnected candidate does not configure `expo-updates`
code signing or accept an external signing certificate.

The generated iOS export contained no `node-forge`,
`@expo/code-signing-certificates`, or matching package reference. The October 2
physical run executed the application bundle in Expo Go but did not turn this
Node tooling into iOS runtime code. This narrows the spike's observed exposure;
it is not a production waiver for build, update, or release tooling.

### `@grpc/grpc-js` GHSA-m9gg-hp2v-232j and GHSA-f596-whhp-79r4

The high advisory concerns authentication decisions made by a gRPC server using
`getAuthContext` with optional client certificates. The low advisory concerns a
gRPC server returning thrown handler messages to its clients. Marathoner is a
mobile client and does not create or run a gRPC server.

Firestore declares grpc for its Node build. Its package exports select
`dist/index.rn.js` for React Native, and that entry uses Firestore's WebChannel
transport rather than grpc. The same unminified iOS export and source map
contained no `node_modules/@grpc` or `@grpc/grpc-js` reference.

## Remediation evaluation

- Expo was updated from 57.0.24 to the latest SDK 57 patch, 57.0.26. `expo
  install --fix` reported that all SDK-managed dependencies were aligned.
- Firebase 12.19.0 and Firestore 4.17.2 were the latest registry releases at the
  review time; no compatible upstream update removed the grpc declaration.
- Expo CLI 57.0.27 installs `node-forge@1.4.0`. The advisory lists no patched
  release, so there is no safe version override to evaluate yet.
- npm's forced suggestions would downgrade Expo to 46.0.21 or Firebase to
  9.14.0. Those changes violate the chosen SDK line and Expo's Firebase 12+
  requirement, so they were rejected.
- `uuid@11.1.1` and `@grpc/grpc-js@1.13.6` are patched versions, but they fall
  outside the immediate parents' declared ranges. No override was committed or
  described as approved without physical-device evidence.

## Temporary acceptance controls

This decision remains valid only while all of these statements are true:

- the candidate remains isolated under `spikes/mobile/expo-js`;
- remote use remains limited to Email/Password Auth plus the exact issue #87
  owner-scoped Firestore proof in the development project;
- production training and all other remote data calls remain disabled;
- none of the advisory packages appears in an iOS runtime bundle or source map;
- Expo update code signing remains unconfigured and the candidate does not
  verify externally supplied certificates or signatures;
- no build service processes participant-controlled or otherwise untrusted
  Xcode project input; and
- Expo remains an unselected, disposable candidate rather than a production
  client.

The owner must re-run this review at least by October 18, 2026, and immediately
when any of these triggers occurs:

- Expo, Firebase, Firestore, `xcode`, `uuid`, or grpc changes in the lockfile;
- Expo CLI, `@expo/code-signing-certificates`, or `node-forge` changes in the
  lockfile;
- an advisory changes affected APIs, severity, or patched ranges;
- Firebase use expands beyond the reviewed issue #86 Auth and issue #87 proof,
  EAS/TestFlight distribution begins, or production mobile work begins;
- the iOS bundle starts resolving a Node Firestore entry or any affected
  package; or
- the mobile ADR reopens to evaluate an Expo-based architecture.

Monitoring sources are `npm audit --omit=dev`, the four linked GitHub
advisories, and upstream Expo/Firebase release metadata. A new critical finding
or newly reachable path ends the acceptance immediately.

## Verification record

The following passed with Expo 57.0.26 during the October 2 review:

- clean `npm ci` under Node 22.22.0;
- Expo Doctor, 21 of 21 checks;
- TypeScript checks and all candidate tests;
- normal iOS export;
- unminified iOS export with external source map;
- clean iOS native-project generation with `expo prebuild --platform ios
  --no-install --clean`;
- a 719-module physical-iPhone bundle and visible Expo Go launch; and
- eleven candidate tests covering fail-closed configuration and the shared
  training-contract boundary;
- Email/Password sign-in with the same development account used on web,
  signed-in restoration after force-quit, logout, and durable logout on the
  physical iPhone; and
- an Expo iOS export containing the issue #87 Firestore adapter; and
- an iOS export scan with no `node-forge`, code-signing-certificate, `uuid`,
  `xcode`, or grpc package match; and
- a live Expo-to-web and web-to-Expo Firestore round trip on the physical iPhone,
  followed by deletion and a missing read from both clients.

Full Xcode, Apple signing, and a physical iPhone are now available on this
workstation, and the shell-level and Firebase Auth physical tests passed. The
issue #87 Firestore-enabled runtime scan and live device round trip also passed.
A generated Expo native application, TestFlight path,
production Firestore access, Android signed build, and production update-signing
flow have not passed. The record therefore continues to reject an override and
stops short of production acceptance.

## Reproduction commands

Run these from `spikes/mobile/expo-js` with Node 22.13 or newer in the Node 22
LTS line:

```sh
node --version
npm ci
npm audit --omit=dev
npm ls @grpc/grpc-js @firebase/firestore firebase uuid xcode expo node-forge @expo/code-signing-certificates @expo/cli
npx expo install --check
npx expo-doctor
npm run typecheck
npm test
npm run export:ios
npx expo prebuild --platform ios --no-install --clean
npx expo export --platform ios --no-bytecode --source-maps --output-dir <temporary-directory>
rg 'node_modules/@grpc|node_modules/uuid|node_modules/xcode|@grpc/grpc-js|node-forge|@expo/code-signing-certificates' <temporary-directory>
```

The audit is expected to exit nonzero during this temporary acceptance. The
final `rg` command is expected to return no matches.

## Primary advisory sources

- [`uuid` GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
- [`node-forge` GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
- [`@grpc/grpc-js` GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
- [`@grpc/grpc-js` GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4)
- [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/)
- [Expo SDK upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
