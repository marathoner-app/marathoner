# Firebase environment selection

- **Status:** Development/prototype boundary implemented; beta provisioning pending
- **Tracking issues:** [#164](https://github.com/marathoner-app/marathoner/issues/164),
  parent [#125](https://github.com/marathoner-app/marathoner/issues/125)
- **Current selection:** `development`

## Boundary

Marathoner has two supported Firebase environment names:

- `development` is the existing audited `marathoner-d9bf9` project. It supports
  local work and the registration-closed GitHub Pages prototype while
  environment separation is completed.
- `beta` is reserved but intentionally has no configuration. Selecting it fails
  before Firebase initializes.

The root `.env` file contains only the public environment name. The Firebase
browser configuration remains in `src/firebaseConfig.ts` because browser
clients necessarily receive those identifiers. Never place service-account
keys, private keys, passwords, CLI tokens, App Check debug tokens, or other
privileged credentials in `.env`, source, workflows, or client bundles.

`src/firebaseEnvironment.ts` is the only validation boundary. Vite validates
the selected environment before serving or building, and the browser resolves
the same selection before Firebase initializes. The boundary rejects a missing
or unknown environment, incomplete public configuration, an unprovisioned beta
environment, and any beta entry that reuses the development project ID.

## Command behavior

The committed default is deliberately `development`, so these commands cannot
silently reach a future beta project:

```sh
npm run dev
npm test
npm run build
npm run build:mobile-spike
```

The GitHub Pages and pull-request production-build workflows also set
`VITE_FIREBASE_ENVIRONMENT=development` explicitly. The disconnected mobile
spikes continue to replace or omit Firebase initialization and reject the
audited development values if they leak into the Capacitor bundle.

## Activating beta later

Issue #125 must complete all of these steps in a separately reviewed change:

1. provision a visibly distinct beta project and web registration;
2. record its public identifiers without copying development credentials;
3. enforce allowlisted, verified-email writes and negative rules tests;
4. document deployment target and operator ownership;
5. verify representative web and selected iOS builds choose the intended
   project; and
6. change only the approved beta deployment to
   `VITE_FIREBASE_ENVIRONMENT=beta`.

Do not fill the reserved beta entry merely to make a build pass. Until the
cloud controls and verification evidence exist, failing closed is the intended
behavior.
