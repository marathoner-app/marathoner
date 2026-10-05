# Retired mobile architecture spike evidence

The Wave 01 comparison is complete. Issues
[#83](https://github.com/marathoner-app/marathoner/issues/83) and
[#88](https://github.com/marathoner-app/marathoner/issues/88) selected the root
Vite application in a Capacitor iOS shell. Issue
[#177](https://github.com/marathoner-app/marathoner/issues/177) promoted that
shell into the product boundary, and issue
[#178](https://github.com/marathoner-app/marathoner/issues/178) retired the
comparison runtimes and proof-only cloud access.

This directory now contains historical evidence only. It is not a second
application, a supported build surface, or a source of current Firebase rules.
The disposable Capacitor candidate, Expo candidate, shared-record proof UI,
their adapters, and their lockfiles have been removed from current `main`.

## Preserved evidence

| Evidence | What it established | Immutable implementation record |
| --- | --- | --- |
| Initial candidates | Capacitor and Expo JS could be isolated from normal web behavior. | [PR #154](https://github.com/marathoner-app/marathoner/pull/154), [`0c164bc`](https://github.com/marathoner-app/marathoner/commit/0c164bc25a636434d9a027d3a346bb5e03725f7c) |
| Portable contract | Both candidates consumed common identifiers and canonical units. | [PR #155](https://github.com/marathoner-app/marathoner/pull/155), [`3737d53`](https://github.com/marathoner-app/marathoner/commit/3737d53222581a7fb669fc6ee2a2db57fd2ceed7) |
| Cross-client fixtures | Web and Expo agreed on technology-neutral fixture behavior. | [PR #156](https://github.com/marathoner-app/marathoner/pull/156), [`4157c67`](https://github.com/marathoner-app/marathoner/commit/4157c6710c1a15b530c29f7eb8e019eb94b77f58) |
| Expo dependency review | Candidate-only advisory exposure was bounded; production acceptance was withheld. | [PR #157](https://github.com/marathoner-app/marathoner/pull/157), [`5f776a0`](https://github.com/marathoner-app/marathoner/commit/5f776a04ccd443ce219423bbf44dc10d1f4a95c6) |
| Device viability | Both candidates rendered on the same physical iPhone. | [PR #172](https://github.com/marathoner-app/marathoner/pull/172), [`181ddc8`](https://github.com/marathoner-app/marathoner/commit/181ddc89839c6a8854a04f2e144bbe31d1e3938e) |
| Authentication | Both candidates passed sign-in, restoration, logout, and durable logout. | [PR #174](https://github.com/marathoner-app/marathoner/pull/174), [`8a30b2b`](https://github.com/marathoner-app/marathoner/commit/8a30b2ba7c7f60a00380d8b487d8cbcd25eef62e) |
| Shared Firestore record | Both candidates completed the same owner-scoped web/iOS round trip and cleanup. | [PR #175](https://github.com/marathoner-app/marathoner/pull/175), [`e019d1c`](https://github.com/marathoner-app/marathoner/commit/e019d1cc7ad725474478cafc2202912183e8ffc7) |

The narrative records remain in
[`device-evidence.md`](./device-evidence.md),
[`auth-evidence.md`](./auth-evidence.md),
[`shared-record-evidence.md`](./shared-record-evidence.md),
[`dependency-audit.md`](./dependency-audit.md), and
[`closeout.md`](./closeout.md). Their commands and paths describe the repository
at the linked commits; they are intentionally not runnable from current `main`.

## Current product boundary

- The root application and [`ios/`](../../ios/) directory are the canonical
  web and iOS product.
- [`docs/mobile/ios-development.md`](../../docs/mobile/ios-development.md) is
  the current local iOS workflow.
- The portable training contract retains reusable identifiers, canonical units,
  and fixtures. The temporary shared-record schema has been removed.
- Firestore denies the retired `mobileSpikeProofs` path by default.
- The temporary comparison API key and ignored comparison environment files are
  retired; the selected shell uses its separately reviewed development key.
- Beta remains a separate environment and was not touched by this cleanup.

Historical evidence proves why Capacitor was selected. It does not prove
TestFlight readiness, App Check, material-write integrity, accessibility,
network-loss recovery, Android support, or founding-beta readiness. Those remain
owned by their active roadmap issues.
