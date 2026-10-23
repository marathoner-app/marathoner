# npm dependency security review

**Original remediation:** [#31](https://github.com/marathoner-app/marathoner/issues/31)

**Current remediation:** [#143](https://github.com/marathoner-app/marathoner/issues/143)

**Advisory follow-up:** [#424](https://github.com/marathoner-app/marathoner/issues/424)

**Last reviewed:** October 23, 2026

## Current outcome

The current lockfile has no production dependency findings. The full npm tree
has six development-tool path findings, all moderate, and no high or critical
findings.

| Command | October 23, 2026 result | Required posture |
| --- | --- | --- |
| `npm audit --omit=dev` | zero findings | Required before live command deployment and external beta. |
| `npm audit` | 6 moderate, 0 high, 0 critical | The remaining paths are time-bound below and must be reviewed again by November 15, 2026 or before the next Firebase/Capacitor toolchain upgrade, whichever happens first. |

Audit databases change independently of the lockfile. Treat these counts as a
dated result, not a permanent property of a package version.

## Remediation retained in the lockfile

Issue #143 retained supported direct upgrades rather than npm's proposed forced
downgrades:

- `firebase-tools` 15.34.0;
- Vite 6.4.5; and
- Vitest 4.1.12, the patched Vitest 4 line compatible with Vite 6 and Node 22.

Narrow root overrides keep stale compatible transitive ranges on patched
releases:

- `@grpc/grpc-js` 1.14.6 for browser Firestore and server dependencies;
- `proxy-addr` 2.0.8 for Express paths;
- `gaxios@6.7.1 > uuid` 11.1.1;
- `@modelcontextprotocol/sdk` 1.32.0;
- `compression` 1.8.2; and
- `source-map-js` 1.2.2.

Issue #424 also refreshed the existing transitive ranges without adding a
direct dependency or override. The deployed
`firebase-functions > express > body-parser` path now resolves `body-parser`
2.4.0, and development-only 1.x paths resolve 1.20.9. Those are the first
patched releases for
[GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), a
high-severity denial of service in which trailing bytes after a compressed
request body can cause an uncaught exception. The advisory was published after
the October 21 audit and was detected by the pull-request OSV check even though
the npm audit feed had not reported it.

The overrides do not introduce runtime imports or change Marathoner product
behavior. They select patched releases through existing APIs. Lint, unit tests,
Firestore emulator tests, the Functions/material-command emulator suite, and
the production build verify the retained graph. Do not remove an override until
the owning direct dependency resolves an equal or newer safe version and the
same checks pass.

## Production boundary

The production-only audit now reports zero findings. In particular:

- Firebase 12.19 Firestore resolves `@grpc/grpc-js@1.14.6`, above the patched
  threshold for the authorization and error-message advisories;
- Functions and Firebase CLI Express paths resolve `proxy-addr@2.0.8`;
- the Firebase Admin storage path's `gaxios@6.7.1` resolves `uuid@11.1.1`; and
- the deployed Functions Express path resolves `body-parser@2.4.0`, above the
  patched threshold for GHSA-27r3-jxmh-p828; and
- the reviewed Functions dependencies do not carry a production audit finding.

This removes the dependency-audit blocker from the reviewed code graph. It does
not authorize a deployment by itself: #205 retains beta App Check proof,
observation, rollback, and operator-approval ownership after #204's completed
client implementation.

## Remaining development-tool findings

The remaining findings are not imported into the browser bundle or deployed
Functions. Each is still owned and time-bound rather than dismissed.

| Path | Severity | Exposure and mitigation | Owner and review date |
| --- | --- | --- | --- |
| `firebase-tools > @google-cloud/pubsub > @opentelemetry/core@1.30.1` | Moderate (two reported path findings) | The path exists only inside local Firebase tooling. Marathoner does not import the Pub/Sub client or accept untrusted baggage headers through this CLI path. A major transitive override is not accepted without upstream compatibility support. | Maintainer; recheck by November 15, 2026 or when Firebase CLI updates Pub/Sub. |
| `@capacitor/cli > xcode@3.0.1 > uuid@7.0.3` | Moderate (three reported path findings through `uuid`, `xcode`, and Capacitor CLI) | The Xcode project writer runs only against the reviewed local native project and Marathoner does not pass caller-supplied UUID buffers. Capacitor 8.5.2 still requires Xcode 3; overriding it to Xcode 4 would be an unreviewed major tool change. | Maintainer; recheck by November 15, 2026 or when Capacitor supports the patched Xcode package. |

If any remaining path becomes participant-reachable, enters the shipped bundle,
or gains a supported upstream fix, the temporary decision expires immediately.

## Rejected automatic fixes

Do not run `npm audit fix --force`. The current npm recommendations include
forced downgrades of Firebase, Firebase CLI, Capacitor CLI, and Vitest. Those
changes would cross reviewed architecture and compatibility boundaries without
proving that the resulting application is safer or functional.

The lockfile was resolved and clean-installed with Node 22 and npm 10. The host
Node 23/npm 11 pair is outside the repository's supported runtime and hit an npm
optional-peer resolver crash before writing a lockfile; that host-only failure
is not a reason to weaken package constraints.

## Historical record

| Review point | Production-only result | Full result |
| --- | --- | --- |
| Before issue #31 | 2 moderate, 1 high, 2 critical | 3 low, 4 moderate, 9 high, 2 critical |
| After issue #31 | 0 findings | 5 high |
| After Firestore emulator tooling was added | 0 findings | 2 moderate, 20 high |
| September 22, 2026 refresh | 0 findings | 16 moderate, 3 high |
| October 5, 2026 issue #158 refresh | 2 moderate, 4 high | 8 moderate, 12 high |
| October 6, 2026 issue #202 alignment | 2 moderate, 5 high, 1 critical | 7 moderate, 15 high, 3 critical |
| October 21, 2026 issue #143 remediation | 0 findings | 5 moderate, 3 high, 0 critical |
| October 23, 2026 issue #424 advisory refresh | 0 findings | 6 moderate, 0 high, 0 critical |

The historical counts explain earlier decisions; only the latest row describes
the current lockfile and advisory database.

## Verification commands

Run these commands on the supported Node 22 line:

```sh
npm ci
npm audit --omit=dev
npm audit
npm run lint
npm test
npm run test:firestore
npm run test:material-commands
npm run build
```

The production audit must exit successfully. The full audit is expected to exit
nonzero only for the exact time-bound development paths above; any new path,
critical finding, or production finding reopens remediation.
