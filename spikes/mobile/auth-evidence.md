# iOS Firebase authentication proof

- **Issue:** [#86](https://github.com/marathoner-app/marathoner/issues/86)
- **Observed:** October 2, 2026
- **Device:** iPhone 15 running iOS 26.6.2
- **Toolchain:** Node 22.22.0, Xcode 27.0, Capacitor 8.5.2, and Expo SDK 57
- **Result:** both candidates passed the required authentication sequence

## Scope and boundary

This proof answers one question: can each proposed JavaScript mobile path
observe and persist Marathoner's Firebase Email/Password authentication state
on the same physical iPhone?

Both candidates connect only to the legacy development project,
`marathoner-d9bf9`, and use the same existing development account that was
confirmed on the web client. Neither candidate exposes public signup, accesses
Firestore, writes training data, initializes the beta project, or represents a
production authentication screen. No account email, password, service account,
signing material, or other private credential is recorded in the repository.

## Shared device result

The following sequence was completed independently in the Capacitor and Expo
candidates:

| Step | Capacitor + Firebase JS | Expo + Firebase JS |
| --- | --- | --- |
| Fresh launch reports a loading state | Passed | Passed |
| Auth listener resolves to signed out | Passed | Passed |
| Existing development account signs in | Passed | Passed |
| Displayed account matches the web test account | Passed | Passed |
| Force-quit and reopen restores the signed-in state | Passed | Passed |
| Logout resolves to signed out | Passed | Passed |
| Force-quit and reopen preserves the signed-out state | Passed | Passed |

This demonstrates loading, signed-out, signed-in, session restoration, logout,
and durable logout on iOS. It does not demonstrate account creation, password
reset, verified-email enforcement, membership authorization, or Firestore
access.

## Firebase configuration and key controls

The proof uses a temporary public Firebase client key named
`marathoner-ios-auth-spike`. The key belongs to the development project and is
restricted to the Identity Toolkit API and Token Service API. It has no
application restriction during this comparison because one browser-referrer
restriction cannot authenticate both the Capacitor WebView and Expo's React
Native runtime.

That temporary exception is bounded as follows:

- the value is present only in ignored, mode-`0600` local environment files;
- neither the key value nor any privileged Firebase credential is committed;
- missing configuration fails closed instead of falling back to a web or beta
  key;
- both clients reject any project other than `marathoner-d9bf9`;
- the dedicated Vite mode rejects the temporary key in normal web builds;
- the key permits only the two APIs needed for Email/Password authentication;
- the candidate UI contains no signup or data-access path; and
- the key will be deleted by issue #178 after issue #177 promotes the selected
  Capacitor shell.

The ignored local files are `.env.mobile-auth-spike.local` at the repository
root and `spikes/mobile/expo-js/.env.local`. The checked-in
`.env.mobile-auth-spike.example` and `spikes/mobile/expo-js/.env.example` files
document field names without the temporary key value. The normal browser key
and beta-project configuration were not changed.

## Capacitor observation

The `mobile-auth-spike` Vite mode replaces the normal application composition
with the small authentication proof while retaining Marathoner's existing auth
provider and login boundary. The resulting web bundle is copied into the
committed Swift Package Manager-based iOS shell and signed locally with the
maintainer's Personal Team. The team identifier was removed from tracked Xcode
settings after installation.

Two failed configurations were useful evidence:

1. Firebase's default `getAuth` initialization remained on “Loading your
   session...” in the physical WebView.
2. Explicit `browserLocalPersistence` resolved the listener but did not restore
   the signed-in session after a force-quit.

The passing configuration uses `initializeAuth` with IndexedDB first and local
storage as a fallback. It deliberately omits the popup redirect resolver,
because this proof supports Email/Password only. This is a candidate-specific
WebView requirement, not a change to the normal web application.

## Expo observation

The Expo candidate uses a named Firebase application and
`getReactNativePersistence(AsyncStorage)`. Its proof UI initializes Auth only
after all required public fields are present and the development project ID is
confirmed.

The local-area-network development URL lost its connection on the test device.
An explicitly approved Expo tunnel was used instead; Expo Go and the CLI were
signed into the same development Expo account, and the tunnel was stopped after
the proof. The tunnel was transport for the local bundle, not a Firebase or
production deployment choice.

## Android implications

Android remains outside issue #86's beta gate, but the iOS result does not
remove these follow-ups:

- an Android test must use a separately controlled key and verify the chosen
  runtime's package-name and signing-certificate restrictions;
- an Expo Go result cannot prove the package identity, signing configuration,
  App Check provider, or persistence behavior of a production Android build;
- if the selected stack uses native Firebase modules or plugins, its Android
  application registration and `google-services.json` boundary must be reviewed
  separately; and
- Email/Password does not require a signing-certificate hash by itself, but
  Google sign-in, phone authentication, Dynamic Links, and some App Check paths
  would add Android configuration that this proof does not evaluate.

Issue #83 should therefore treat Android signed-build evidence as a separate
architecture gate, not infer it from this iPhone comparison.

## Decision implications

Both candidates remain technically viable for Marathoner's current
Email/Password flow:

- Capacitor preserves the most existing React and UI code, but its physical
  WebView required explicit persistence configuration and a dedicated build
  boundary.
- Expo's React Native persistence path worked with AsyncStorage, but it implies
  a separate presentation layer plus Expo-specific development and release
  operations.

Authentication alone does not select a winner. The typed shared-record proof
in #87, network-loss behavior in #88, and the complete decision record in #83
must evaluate data, offline, release, accessibility, observability, and
maintenance tradeoffs before either spike becomes production architecture.

## Reproduction and verification

Populate the ignored local environment files from their examples, using only
the dedicated development-project client key. Then run:

```sh
# Repository root: build the isolated Capacitor auth bundle.
npm run build:mobile-auth-spike

# Capacitor candidate.
cd spikes/mobile/capacitor
npm run typecheck
npm run build:auth
npm run sync:ios

# Expo candidate.
cd ../expo-js
npm run typecheck
npm test
npm run export:ios
```

Build or launch each candidate on a physical device and repeat the sequence in
the shared result table. Never print the environment files or include their
values in screenshots, logs, issues, commits, or pull requests.

## References

- [Customize Firebase Auth dependencies](https://firebase.google.com/docs/auth/web/custom-dependencies)
- [Firebase Auth state persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence)
- [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/)
