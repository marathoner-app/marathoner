# Contributing to Marathoner

Marathoner uses a small, issue-led workflow so the current owner can understand
every line that reaches `main`. The same workflow is available to future
contributors, but no delivery plan assumes that another contributor joins.

The [README](README.md) explains the current application and local commands.
The [zero-to-beta plan](docs/zero-to-beta-plan.md) defines the delivery gates,
and the [committee remediation sprint](docs/committee-remediation-sprint.md)
records the active evidence backlog. Creator Radar is not a Marathoner product
or launch dependency.

## 1. Prepare a clean local checkout

Install Node.js 22 LTS, npm, Git, and Java 21 or later for Firestore emulator
tests. Then clone and verify the repository:

```bash
git clone https://github.com/marathoner-app/marathoner.git
cd marathoner
npm ci
npm run lint
npm test
npm run test:firestore
npm run build
```

Do not commit Firebase service accounts, private keys, passwords, participant
records, raw research notes, or other secrets. The Firebase web configuration
identifies a public client; it is not authorization.

## 2. Select or create a focused issue

Start every change from an open issue. Use the bug, product/feature, or focused
engineering form when creating one; a blank issue remains available for early
planning discussions.

Default to one focused issue and one coherent outcome per pull request. If two
small issues cannot be reviewed or verified independently, name both explicitly
and explain why one pull request is the clearer unit. Split large outcomes into
owner-sized child issues before implementation.

A useful issue states:

- the required outcome;
- the smallest useful scope and explicit non-goals;
- observable acceptance criteria;
- dependencies, assumptions, and safety boundaries; and
- the exact evidence required before merge.

Do not begin work that is blocked by an unresolved product, methodology,
architecture, privacy, or safety decision.

## 3. Start from current `main`

Update `main` before creating a branch:

```bash
git switch main
git pull --ff-only
git switch -c issue-58-short-description
```

Use `issue-<number>-<short-description>` for a human-created branch. When Codex
creates the branch, it uses
`codex/issue-<number>-<short-description>`. The `codex/` prefix records how the
branch was created; using Codex is not required to contribute.

Never commit directly to `main`.

## 4. Make one understandable change

Prefer a 60-to-90-minute slice when practical. Keep the diff tied to the active
issue and preserve unrelated user work. Avoid speculative abstractions,
unrelated refactors, and drive-by cleanup.

Before editing, be able to explain:

1. the intended behavior;
2. the files or systems involved;
3. meaningful assumptions and tradeoffs; and
4. how the result will be verified.

Follow the existing strict TypeScript, React, service-boundary, and Testing
Library conventions. Add new dependencies only when their purpose, risk, and
maintenance cost are understood.

## 5. Verify the change

Run the standard checks before opening or updating the pull request:

```bash
npm run lint
npm test
npm run build
```

Also run:

```bash
npm run test:firestore
```

when changing Firestore rules, Firebase or emulator configuration, persistence
code, or persisted contracts. GitHub Actions runs the emulator suite on every
pull request even when it was not required locally.

Manually exercise affected browser behavior with `npm run dev` when relevant.
Use `npm run preview` when changing production asset paths or deployment
behavior. Review the final diff and confirm it contains no unrelated changes:

```bash
git status --short
git diff --check
git diff
```

If a check cannot run, state the exact environment limitation in the pull
request. Do not describe an unrun check as passing.

## 6. Commit and push

Stage only the intended files, then use a short outcome-oriented commit message:

```bash
git add path/to/changed-file
git commit -m "docs: add focused issue workflow"
git push -u origin issue-58-short-description
```

Inspect staged changes before committing when the working tree contains other
work.

## 7. Open an issue-linked pull request

Open the pull request against `main`. Replace the template's placeholder with a
closing reference such as:

```text
Closes #58
```

`Fixes #58` and `Resolves #58` are also accepted. A plain `Refs #58` does not
satisfy the linked-issue check or close the issue after merge.

Complete the verification and review-focus sections honestly. Explain what
changed, why it changed, what the reviewer should inspect closely, and any
remaining limitation. GitHub automatically runs these required checks:

- **Linked issue**
- **Lint**
- **Unit tests**
- **Production build**
- **Firestore emulator tests**

The pull-request workflow is read-only. Deployment occurs only from the
separate Pages workflow after merge to `main` or manual dispatch.

## 8. Perform the owner review

The current repository has one active maintainer, so required approving reviews
remain at zero. That is not permission to skip review. Before merge, the owner
must:

1. read the complete diff;
2. confirm the pull request satisfies every acceptance criterion;
3. confirm all required checks pass;
4. resolve every review conversation;
5. verify that no secret, participant data, or unrelated change is present; and
6. record any follow-up risk as a focused issue rather than an informal note.

Raise the ruleset to one required approving review after an active collaborator
is added and can provide meaningful independent review.

## 9. Merge and update local `main`

The owner performs the final merge in GitHub after the checks and review are
complete. Then update the local checkout:

```bash
git switch main
git pull --ff-only
```

Confirm that the linked issue closed and that any parent issue, dependency,
milestone, roadmap, or gate record now reflects the merged evidence. Delete the
local topic branch only after confirming the merge and preserving any work that
still belongs on it.

## When to stop and ask

Pause the change when completion requires new authority, participant data,
external credentials, a product-contract expansion, an unreviewed methodology
decision, or a destructive action whose target is unclear. Record the blocker
on the issue instead of guessing.
