# Firebase environment selection

- **Status:** Distinct projects provisioned; explicit web and iOS selection boundaries verified
- **Tracking issues:** [#164](https://github.com/marathoner-app/marathoner/issues/164),
  [#168](https://github.com/marathoner-app/marathoner/issues/168),
  parent [#125](https://github.com/marathoner-app/marathoner/issues/125)
- **Current selection:** `development`

## Boundary

Marathoner has two supported Firebase environment names:

- `development` is the existing audited `marathoner-d9bf9` project. It supports
  local work and the registration-closed GitHub Pages prototype; it does not
  hold founding-beta participant data.
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

The GitHub Pages and pull-request production-build workflows also set
`VITE_FIREBASE_ENVIRONMENT=development` explicitly. The selected iOS build
requires its reviewed development-only API key and fails closed without it.

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
4. change only the approved beta deployment to
   `VITE_FIREBASE_ENVIRONMENT=beta`.

Local development, CI defaults, the selected iOS development build, and the
current GitHub Pages deployment remain explicitly pinned to development. The
pull-request iOS job checks both environment bundles with non-live placeholder
keys, but it does not contact beta. App Check, custom-domain publication, and
the remaining invitation controls stay separate gates; failing closed remains
the intended behavior until each is complete.
