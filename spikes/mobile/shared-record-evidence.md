# Shared iOS and web Firestore proof

- **Issue:** [#87](https://github.com/marathoner-app/marathoner/issues/87)
- **Environment:** legacy development project only
- **Status:** passed on web, Capacitor, Expo, emulator, and physical iPhone
- **Retirement:** historical evidence only; issue #178 removed the proof UI,
  contract, client adapters, allow rule, and temporary comparison key

The commands and paths below describe the repository at the immutable issue
#87 merge commit linked from [`README.md`](./README.md). The exact proof record
was absent before retirement, and the former path is now denied by default.

## Scope and non-production boundary

This proof verifies that the existing web client and each current iOS candidate
can exchange one typed, owner-scoped record through Firestore. It deliberately
does not write a plan, workout, completed run, shoe, adjustment, or beta record.

The only allowed proof path is:

```text
users/{authenticatedUserId}/mobileSpikeProofs/issue-87-shared-record
```

The record is defined by `@marathoner/training-contract` and contains exactly:

| Field | Required value |
| --- | --- |
| `schemaVersion` | `1` |
| `recordType` | `shared_training_record_proof` |
| `userId` | the authenticated path owner |
| `sampleRunId` | `issue-87-sample-run` |
| `distanceMeters` | `5000` |
| `sourceClient` | `web`, `capacitor`, or `expo` |

The fixed sample run identity and distance exercise the same portable types used
by both clients without creating a production training entity.

## Ownership and shape controls

The development rules grant read and delete only when Firebase Authentication's
UID matches the owner path. Create and update additionally require the exact
document ID, exact field set, version, record type, owner field, sample values,
and one of the three supported source labels. The rules continue to deny every
unmatched path by default.

The beta rules are unchanged and do not permit this proof collection. Both
mobile clients continue to reject beta configuration, and the preserved web
proof mode uses the existing development browser configuration.

The local Firestore emulator passed all 20 integration cases on October 2,
2026. The issue #87 cases prove:

- owner create, read, delete, and confirmed absence after cleanup;
- anonymous read and write denial;
- cross-owner read, write, and delete denial;
- mismatched `userId` denial;
- extra-field denial; and
- denial for any other proof document ID.

## Client boundaries

- **Preserved web:** a separate `web-shared-record-spike` Vite mode retains the
  existing React, Authentication, Firebase application, and browser key while
  replacing only the top-level UI. Normal development, test, and production
  modes remain unchanged.
- **Capacitor:** `mobile-shared-record-spike` uses the same React proof UI and
  Firestore adapter inside the existing signed iOS shell. It retains the
  explicit WebView Auth persistence configuration proven by #86.
- **Expo:** the React Native proof creates Firestore from the same named Firebase
  application as Auth and uses a small native presentation over the shared
  contract.

Both adapters parse remote data through the portable contract before displaying
it. A malformed record therefore fails visibly rather than being accepted as a
training value.

The first signed Capacitor launch exposed a useful boundary defect before any
record was written: the Firestore adapter imported the default web Firebase app
while mobile Auth had created a named app, so module initialization stopped on a
blank screen. The adapter now imports a small Firebase-client bridge that Vite
replaces with the same named mobile client used by Auth. The exact copied iOS
bundle rendered after rebuilding, and the physical-device sequence then passed.

## Live round-trip procedure

Before this sequence, deploy the reviewed development rules and add Cloud
Firestore API to the temporary `marathoner-ios-auth-spike` key. Do not broaden
the browser key or touch beta.

For each iOS candidate:

1. Sign into the physical iPhone with the existing development account.
2. Confirm the proof reports that no sample record exists.
3. Select **Write as capacitor** or **Write as expo**.
4. Open `npm run dev:web-shared-record-spike` locally, sign into the same
   development account, and confirm the iOS source plus the fixed run and
   distance appear.
5. Select **Write as web** and refresh the iOS client; confirm the source changes
   to `web` while the typed values remain unchanged.
6. Select **Delete sample**, refresh the other client, and confirm both report
   that no sample record exists.

Use the same deterministic document for the second candidate only after the
first candidate's cleanup has been confirmed.

## Live result

The development rules were compiled and deployed to `marathoner-d9bf9` on
October 2, 2026 through the guarded repository command. The temporary
`marathoner-ios-auth-spike` key was reopened after saving and showed exactly
Cloud Firestore API, Identity Toolkit API, and Token Service API. The existing
browser key and beta project were unchanged.

Both candidates passed the procedure on the same physical iPhone and existing
development account:

| Direction | Capacitor result | Expo result |
| --- | --- | --- |
| iOS write, web read | Web displayed `capacitor`, the fixed run ID, and 5000 meters. | Web displayed `expo`, the fixed run ID, and 5000 meters. |
| Web write, iOS read | Capacitor refreshed to `web` with the same typed values. | Expo refreshed to `web` with the same typed values. |
| iOS delete, web read | Both clients reported the sample missing. | Both clients reported the sample missing. |

One Capacitor refresh remained on “Reading the shared record...” longer than the
other requests, then returned the correct web-authored record without retry or
data loss. This proof establishes eventual request completion, not the offline,
timeout, retry, or recovery behavior owned by issue #88.

Capacitor reused the web React proof and Firestore adapter inside its WebView;
Expo used a React Native presentation and constructed Firestore from the same
named Firebase application as Auth. Both use the Firebase JavaScript SDK rather
than a native Firestore SDK. The Expo iOS runtime scan continued to contain no
grpc implementation or reviewed CLI-only advisory package.

## Cleanup contract

The proof UI is the primary cleanup mechanism. Completion requires a successful
delete followed by a missing read in both clients. If an interrupted test leaves
data behind, delete only the exact document shown above through an authenticated
owner client or the Firebase console; never delete the parent user document.

No proof document may remain after #87 closes. The final web read after each
candidate reported that the exact sample was absent. Issue #83's architecture
decision and #88's spike closeout must remove the temporary development rule
and mobile key when the comparison no longer needs them.

## Automated verification

The following passed before and after live deployment:

- root lint and focused unit tests;
- web and Capacitor proof type-checks and builds;
- Firestore emulator ownership and shape suite, 20 of 20 tests;
- Expo TypeScript plus 11 candidate tests under Node 22.22.0;
- Expo iOS export with Firestore included;
- unminified Expo runtime scan with no grpc, `uuid`, `xcode`, `node-forge`, or
  Expo code-signing package path;
- exact copied-Capacitor-bundle render after the named-app boundary fix;
- signed Capacitor and Expo launches on the physical iPhone;
- both bidirectional iOS/web live round trips; and
- missing reads in both clients after each cleanup.
