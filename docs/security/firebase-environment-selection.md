# Firebase environment selection

- **Status:** Distinct projects provisioned; beta rules live and boundary verified
- **Tracking issues:** [#164](https://github.com/marathoner-app/marathoner/issues/164),
  [#168](https://github.com/marathoner-app/marathoner/issues/168),
  parent [#125](https://github.com/marathoner-app/marathoner/issues/125)
- **Current selection:** `development`

## Boundary

Marathoner has two supported Firebase environment names:

- `development` is the existing audited `marathoner-d9bf9` project. It supports
  local work and the registration-closed GitHub Pages prototype while
  environment separation is completed.
- `beta` is the isolated `marathonerapp-beta` project. Its public web
  configuration, membership-gated rules deployment, and fictional live-boundary
  evidence are recorded, but only an explicit production-mode selection can
  initialize it.

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

## Beta activation sequence

The distinct project, web registration, rules deployment, and live access proof
now exist. Beta still is not an application default and is not ready for
participants. Issue #125 must complete the remaining activation sequence
through separately reviewed changes:

1. keep the reviewed alias and public client configuration aligned with the
   deployed project;
2. preserve the deployed, live-verified
   [membership and verified-email gate](firebase-beta-membership.md);
3. verify representative web and selected iOS builds choose the intended
   project; and
4. change only the approved beta deployment to
   `VITE_FIREBASE_ENVIRONMENT=beta`.

Local development, CI, the selected iOS development build, and the current
GitHub Pages deployment remain explicitly pinned to development. Until the
remaining cloud controls and live verification evidence exist, failing closed
is the intended behavior.
