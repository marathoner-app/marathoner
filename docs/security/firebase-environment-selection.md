# Firebase environment selection

- **Status:** Distinct projects provisioned; explicit web, iOS, and App Check registration boundaries verified
- **Tracking issues:** [#164](https://github.com/marathoner-app/marathoner/issues/164),
  [#168](https://github.com/marathoner-app/marathoner/issues/168),
  parent [#125](https://github.com/marathoner-app/marathoner/issues/125)
- **Current deployed selections:** `development` for local/CI; `beta` for Pages and TestFlight

## Boundary

Marathoner has two supported Firebase environment names:

- `development` is the existing audited `marathoner-d9bf9` project. It supports
  local work and development iOS builds; it is not the founding-beta product
  data store.
- `beta` is the isolated `marathonerapp-beta` project. Its public web
  configuration, membership-gated rules deployment, and fictional live-boundary
  evidence are recorded. Only an explicit production-mode web build or the
  separately keyed `ios-beta` mode can initialize it.

The root `.env` file contains only the public environment name. The Firebase
browser configurations remain in `src/firebaseConfig.ts` because browser
clients necessarily receive those identifiers. Never place service-account
keys, private keys, passwords, CLI tokens, App Check debug tokens, or other
privileged credentials in `.env`, source, workflows, or client bundles.

`src/firebaseEnvironment.ts` is the only validation boundary. Vite validates
the selected environment before serving or building, and the browser resolves
the same selection before Firebase initializes. The boundary rejects a missing
or unknown environment, incomplete public configuration, a missing project
registration, and any beta entry that reuses the development project ID.

## Command behavior

The committed default is deliberately `development`, so these commands cannot
silently reach a future beta project:

```sh
npm run dev
npm test
npm run build
npm run build:ios
```

Pull-request defaults remain on development. GitHub Pages instead runs the
explicit `closed-beta` build and verifies the emitted beta project identity
while rejecting every development identity marker. The selected iOS
development build requires its reviewed development-only API key and fails
closed without it.

The beta iOS proof is intentionally separate from every default command:

```sh
npm run check:ios:beta
```

That command requires both `VITE_FIREBASE_ENVIRONMENT=beta` and the reviewed
beta-only iOS key in the ignored `.env.ios-beta.local` file. It fails if beta
is absent, if development is selected, or if either development project
identity appears in the built bundle. Running it replaces the copied Xcode web
bundle with beta, so an operator must run `npm run check:ios` afterward before
returning to development-device work.

Both iOS commands also require the distinct, versioned public native Firebase
configurations. They validate the exact project, sender, bundle, storage
bucket, and registered iOS app ID before copying the chosen configuration to
the ignored Xcode resource. The
[App Check registration record](app-check-provider-registration.md) defines
that boundary and the separate debug-token policy.

## Beta activation sequence

The distinct project, web registration, rules deployment, web selection, and
selected-iOS live access proof now exist. Beta still is not an application
default and is not ready for participants. Later activation work must preserve
this sequence through separately reviewed changes:

1. keep the reviewed alias and public client configuration aligned with the
   deployed project;
2. preserve the deployed, live-verified
   [membership and verified-email gate](firebase-beta-membership.md);
3. retain the recorded representative web and selected iOS project-selection
   evidence, including approved and denied physical-iPhone results; and
4. publish only the reviewed Pages and TestFlight beta clients with
   `VITE_FIREBASE_ENVIRONMENT=beta`.

Local development, CI defaults, and the selected iOS development build remain
explicitly pinned to development. The GitHub Pages deployment is the web beta
client and is pinned to beta by its artifact boundary. The
pull-request iOS job checks both environment bundles with non-live placeholder
keys, but it does not contact beta. App Check providers are registered and the
client now initializes them before Firebase services. The #204 implementation
and supported development proof are complete, while paid-team beta App Attest,
the #205–#206 observation/enforcement rollout, and invitation controls stay
separate gates. Publishing the custom-domain build activates only the
registration-closed web beta; it does not open account creation or weaken the
membership gate.
