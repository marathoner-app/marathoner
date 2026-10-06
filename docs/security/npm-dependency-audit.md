# npm dependency security review

**Original remediation:** [#31](https://github.com/marathoner-app/marathoner/issues/31)

**Current follow-up:** [#143](https://github.com/marathoner-app/marathoner/issues/143)

**Last reviewed:** October 6, 2026

## Current outcome

The issue #202 Firebase 12 and App Check bridge alignment reports eight
production-tree path findings: two moderate, five high, and one critical. The
full tree reports 25 path findings: seven moderate, fifteen high, and three
critical. There are no low findings in the current result.

These results come from the issue #158 lockfile after `npm audit fix` applied
only non-breaking transitive updates. No forced downgrade or major-version
change was accepted.

| Command | October 5, 2026 result | Required posture |
| --- | --- | --- |
| `npm audit --omit=dev` | 2 moderate, 5 high, 1 critical | Resolve before live command deployment or external beta. |
| `npm audit` | 7 moderate, 15 high, 3 critical | Resolve or record a specific, time-bounded risk decision in #143. Critical findings cannot be accepted for live deployment. |

Audit databases change independently of the lockfile. Treat these counts as a
dated result, not a permanent property of a package version.

## Production boundary

Firebase remains the only direct browser dependency with a substantial
transitive tree. The combined application and Functions workspace findings
include:

- the Firebase 12.19 web Firestore tree resolves `@grpc/grpc-js@1.9.16`, below the
  patched `1.14.5` release named by the current authorization and error-message
  advisories; and
- the undeployed Functions dependency graph resolves `proxy-addr@2.0.7`, which
  is named by the current IPv4-mapped IPv6 trust-subnet advisory; and
- the combined workspace audit includes `gaxios@6.7.1` and `uuid@9.0.1`, below
  the patched UUID release for caller-supplied buffer bounds.

The material-command code imports only Firebase Admin Firestore. Its active
Firestore path resolves `@grpc/grpc-js@1.14.5`; it does not call Cloud Storage
or UUID generation. Live Functions deployment is blocked by the repository
guard, issue #201, and now explicitly by #143. These reachability limits reduce
immediate exposure but do not meet the external-beta gate. Issue #143 must
upgrade, override with tested patched versions, or explicitly replace the
affected paths before the first live deployment in #205.

## Current development findings

The affected paths are rooted in tools that are not imported into the browser
application bundle:

### Vitest mock tooling

`@vitest/mocker` and `vitest` are reported for a redirect-mock path-traversal
issue. `tinypool` is reported for prototype-pollution paths that can reach code
execution when attacker-controlled worker options are accepted. Marathoner
tests execute reviewed local inputs and do not expose Vitest as a service.
npm's forced recommendation is a downgrade to `vitest@2.0.5`, which is not an
acceptable automatic remediation. Issue #143 owns evaluation of supported
upgrades and regression verification.

### Build and native-project tooling

Vite resolves the affected `source-map-js` through PostCSS, and the Capacitor
CLI resolves an affected UUID version through its Xcode project writer. These
tools process reviewed repository source and the committed native project; they
are not shipped as participant-callable tooling. That reachability limit does
not remove the findings.

### Firebase CLI and emulator tooling

Most remaining development findings flow through the Firebase CLI and emulator
dependencies. The current audit names paths involving:

- `@opentelemetry/core` and `@google-cloud/pubsub`;
- `basic-ftp` through the proxy-agent path;
- `braces` through Chokidar;
- `compression` through Superstatic;
- `gaxios` and `uuid`; and
- `proxy-addr` through Express and MCP tooling.

These tools are not imported into the browser bundle, but their presence still
requires active remediation rather than a permanent blanket exception.

## Temporary risk boundary

The current development-only findings are accepted only while #143 remains an
owned external-beta-readiness issue and all of these conditions hold:

- the issue #158 Functions deployment guard remains closed while production
  findings exist;
- the affected tools run only from reviewed repository commands and trusted
  configuration;
- the Firestore emulator binds only to the local development environment and
  is not exposed as a service;
- no affected tool or dependency is imported into the browser bundle or a
  participant-facing server path;
- the current critical findings remain a hard stop for live Functions
  deployment and external invitations; and
- every unresolved high or moderate finding receives a specific removal or
  time-bounded acceptance decision before external invitations.

Do not run `npm audit fix --force`. The current forced recommendations include
breaking downgrades of direct tools and do not constitute reviewed fixes.
Non-forced audit changes must still be inspected, tested, and committed through
their own issue-linked pull request.

## Historical record

| Review point | Production-only result | Full result |
| --- | --- | --- |
| Before issue #31 | 2 moderate, 1 high, 2 critical | 3 low, 4 moderate, 9 high, 2 critical |
| After issue #31 | 0 findings | 5 high |
| After Firestore emulator tooling was added | 0 findings | 2 moderate, 20 high |
| September 22, 2026 refresh | 0 findings | 16 moderate, 3 high |
| October 5, 2026 issue #158 refresh | 2 moderate, 4 high | 8 moderate, 12 high |
| October 6, 2026 issue #202 alignment | 2 moderate, 5 high, 1 critical | 7 moderate, 15 high, 3 critical |

The historical counts explain earlier decisions; only the latest row describes
the current lockfile and advisory database.

## Node version

The repository automation uses Node 22. Local audit and remediation work should
use the same supported LTS line so engine behavior and dependency resolution
match CI. Do not weaken or downgrade patched dependencies to accommodate an
unsupported non-LTS local runtime.

## Verification commands

```sh
npm ci
npm audit --omit=dev
npm audit
npm run lint
npm test
npm run test:firestore
npm run build
```

Both audits are currently expected to exit nonzero. Issue #143 must resolve the
production paths before live command deployment or external beta and must
resolve or explicitly time-bound every remaining development-tool finding.
