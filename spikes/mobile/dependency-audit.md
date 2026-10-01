# Expo SDK 57 dependency advisory disposition

- **Issue:** [#153](https://github.com/marathoner-app/marathoner/issues/153)
- **Reviewed:** September 30, 2026
- **Owner:** Kevin Tulloch
- **Applies to:** the disconnected `spikes/mobile/expo-js` candidate only
- **Disposition expires:** October 18, 2026
- **Production status:** not accepted for a selected or participant-facing client

## Decision

The current advisories are temporarily accepted for the disposable Expo
architecture candidate because the affected code is not present in its iOS
runtime bundle and the candidate neither initializes Firebase nor processes
untrusted Xcode projects. This acceptance permits continued comparison work; it
does not approve Expo, Firebase JS, an override, or these versions for the
production mobile client.

If issue #83 selects Expo with the Firebase JavaScript SDK, its ADR is blocked
until either upstream packages remove the affected paths or a narrowly scoped
override passes the complete automated, generated-native-project, signed-build,
and physical-iPhone verification gate.

## Reproduced result

A clean install under Node 22.13.0 and npm 11.0.0 reported 14 production audit
paths: 10 moderate paths to one `uuid` advisory and four high paths produced by
the Firestore dependency chain to two `@grpc/grpc-js` advisories. npm groups
dependency paths by the highest advisory severity; one of the two grpc
advisories is independently rated low by GitHub.

The audited direct and transitive versions are:

| Dependency path | Installed version | Current compatible upstream result |
| --- | --- | --- |
| `expo` | 57.0.26 | Latest published SDK 57 patch on September 30 |
| `expo → @expo/config-plugins → xcode → uuid` | 57.0.26 → 57.0.9 → 3.0.1 → 7.0.3 | Still present in Expo 57.0.26 |
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
- npm's forced suggestions would downgrade Expo to 46.0.21 or Firebase to
  9.14.0. Those changes violate the chosen SDK line and Expo's Firebase 12+
  requirement, so they were rejected.
- `uuid@11.1.1` and `@grpc/grpc-js@1.13.6` are patched versions, but they fall
  outside the immediate parents' declared ranges. No override was committed or
  described as approved without physical-device evidence.

## Temporary acceptance controls

This decision remains valid only while all of these statements are true:

- the candidate remains isolated under `spikes/mobile/expo-js`;
- Firebase initialization, authentication, and Firestore calls remain disabled;
- neither advisory package appears in an iOS runtime bundle or source map;
- no build service processes participant-controlled or otherwise untrusted
  Xcode project input; and
- issue #83 has not selected Expo for the production client.

The owner must re-run this review at least by October 18, 2026, and immediately
when any of these triggers occurs:

- Expo, Firebase, Firestore, `xcode`, `uuid`, or grpc changes in the lockfile;
- an advisory changes affected APIs, severity, or patched ranges;
- remote Firebase behavior, EAS/TestFlight distribution, or production mobile
  work begins;
- the iOS bundle starts resolving a Node Firestore entry or either affected
  package; or
- issue #83 is ready to approve an Expo-based architecture.

Monitoring sources are `npm audit --omit=dev`, the three linked GitHub
advisories, and upstream Expo/Firebase release metadata. A new critical finding
or newly reachable path ends the acceptance immediately.

## Verification record

The following passed after the Expo 57.0.26 lockfile update:

- clean `npm ci` under Node 22.13.0;
- Expo Doctor, 21 of 21 checks;
- TypeScript checks and all candidate tests;
- normal iOS export;
- unminified iOS export with external source map; and
- clean iOS native-project generation with `expo prebuild --platform ios
  --no-install --clean`.

Full Xcode, signing, and a physical iPhone remain unavailable on this
workstation. That is why this record rejects an override and stops short of a
production acceptance.

## Reproduction commands

Run these from `spikes/mobile/expo-js` with Node 22.13 or newer in the Node 22
LTS line:

```sh
node --version
npm ci
npm audit --omit=dev
npm ls @grpc/grpc-js @firebase/firestore firebase uuid xcode expo
npx expo install --check
npx expo-doctor
npm run typecheck
npm test
npm run export:ios
npx expo prebuild --platform ios --no-install --clean
npx expo export --platform ios --no-bytecode --source-maps --output-dir <temporary-directory>
rg 'node_modules/@grpc|node_modules/uuid|node_modules/xcode|@grpc/grpc-js' <temporary-directory>
```

The audit is expected to exit nonzero during this temporary acceptance. The
final `rg` command is expected to return no matches.

## Primary advisory sources

- [`uuid` GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
- [`@grpc/grpc-js` GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
- [`@grpc/grpc-js` GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4)
- [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/)
- [Expo SDK upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
