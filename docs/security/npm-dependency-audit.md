# npm dependency security review

**Original remediation:** [#31](https://github.com/marathoner-app/marathoner/issues/31)

**Current follow-up:** [#143](https://github.com/marathoner-app/marathoner/issues/143)

**Last reviewed:** September 22, 2026

## Current outcome

The committed production dependency tree has no known npm audit findings. The
full tree has 19 development-tool findings: 16 moderate and 3 high. There are
no low or critical findings in the current result.

These results come from the committed lockfile on the issue #118 branch. No
dependency version changed during the repository-truth repair.

| Command | September 22, 2026 result | Required posture |
| --- | --- | --- |
| `npm audit --omit=dev` | 0 findings | Must remain at zero before external beta. |
| `npm audit` | 16 moderate, 3 high | Resolve or record a specific, time-bounded risk decision in #143. |

Audit databases change independently of the lockfile. Treat these counts as a
dated result, not a permanent property of a package version.

## Production boundary

Firebase remains the only direct production dependency with a substantial
transitive tree. The current production-only audit is clean after the earlier
Firebase 11 upgrade. A future production finding, any critical finding, or any
finding reachable from participant-controlled input requires immediate review;
it is not covered by the development-tool rationale below.

## Current development findings

The affected paths are rooted in tools that are not imported into the browser
application bundle:

### ESLint filesystem and parser tooling

`@humanfs/node` is reported through the lint toolchain for a recursive-copy
symlink issue. ESLint also shares the affected `js-yaml` installation with
other development tools. Marathoner runs ESLint against reviewed repository
files and configuration, not participant-provided paths. npm reports some
non-forced fixes; issue #143 must test them with the supported Node 22 toolchain
before the lockfile is changed.

### Vitest mock tooling

`@vitest/mocker` and `vitest` are reported for a redirect-mock path-traversal
issue. `nanoid` is reported through Vite and PostCSS. The test and build tools
execute reviewed local inputs and are not shipped as tooling to participants.
npm's forced recommendation for Vitest is a downgrade to `vitest@2.0.5`, which
is not an acceptable automatic remediation. Issue #143 owns evaluation of
supported upgrades and regression verification.

### Firebase CLI and emulator tooling

Most remaining findings flow through the development-only Firebase CLI and its
emulator dependencies. The current audit names paths involving:

- `@opentelemetry/core` and `@google-cloud/pubsub`;
- `csv-parse`;
- `gaxios` and `uuid`;
- `stream-json`;
- `fast-uri`;
- `hono`;
- `js-yaml`, which is also used by ESLint;
- `morgan`;
- `qs`, `body-parser`, and `express`; and
- `re2`.

The three high findings are reported in `fast-uri`, `js-yaml`, and `nanoid`.
These packages are not in the production application dependency tree, but
their presence still requires active remediation rather than a permanent
blanket exception.

## Temporary risk boundary

The current development-only findings are accepted only while #143 remains an
owned external-beta-readiness issue and all of these conditions hold:

- `npm audit --omit=dev` remains at zero findings;
- the affected tools run only from reviewed repository commands and trusted
  configuration;
- the Firestore emulator binds only to the local development environment and
  is not exposed as a service;
- no affected tool or dependency is imported into the browser bundle or a
  participant-facing server path;
- no critical finding appears; and
- high findings receive a specific removal or time-bounded acceptance decision
  before external invitations.

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

The full audit is expected to exit nonzero until #143 resolves or explicitly
time-bounds every remaining development-tool finding. The production-only audit
must exit successfully.
