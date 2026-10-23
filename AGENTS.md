# Marathoner Working Agreement

## Project context

Marathoner is a React and TypeScript application built with Vite. It currently
uses Firebase for authentication and data-related services.

- `src/App.tsx`: top-level application composition
- `src/components/`: reusable UI and feature components
- `src/services/`: integrations and application services
- `src/firebaseConfig.ts`: Firebase initialization
- `src/index.css`: shared application styling

## Development commands

- Install dependencies: `npm install`
- Start the development server: `npm run dev`
- Run linting: `npm run lint`
- Run the automated test suite: `npm test`
- Run tests while developing: `npm run test:watch`
- Run the production build and TypeScript checks: `npm run build`
- Preview the production build: `npm run preview`

## Collaboration approach

The maintainer is developing this project outside of their day job and wants to
understand every line they commit.

- Scope work into a focused 60-90 minute daily slice whenever practical.
- Before editing, briefly explain the intended behavior, files involved, and
  verification plan.
- Prefer teaching and plain-language explanations over unexplained code output.
- Keep changes small, cohesive, and tied to the active GitHub issue.
- Avoid unrelated refactors, speculative abstractions, and drive-by cleanup.
- Call out assumptions and meaningful tradeoffs before they shape the solution.
- Explain new dependencies before adding them.
- Preserve existing user changes, including uncommitted work.
- Do not commit, push, create branches, or change GitHub state unless explicitly
  requested.

## Required GitHub workflow

- Start every change from an existing open GitHub issue.
- Create a dedicated branch from an up-to-date `main`. When Codex creates the
  branch, use `codex/issue-<number>-<short-description>`.
- Never commit directly to or push directly to `main`.
- Open a pull request for every repository change, including documentation and
  configuration changes.
- Include `Closes #<issue-number>`, `Fixes #<issue-number>`, or
  `Resolves #<issue-number>` in the pull request body.
- Do not merge until required checks pass and all review conversations are
  resolved.
- Required approving reviews remain at zero while there is one active technical
  maintainer. The maintainer performs the final diff review and merge. Raise the
  rule to one approving review only after another technical maintainer can
  provide meaningful independent code review; non-engineering partner access
  alone does not trigger that change.

## Code expectations

- Follow the existing strict TypeScript and ESLint configuration.
- Prefer clear React function components and descriptive names.
- Keep data access and external integrations in service modules when practical.
- Keep unit and component tests beside the code they verify.
- Prefer Testing Library roles and user interactions over implementation details.
- Mock external integrations at the service boundary in component tests.
- Match existing project conventions unless the task intentionally improves them.
- Never expose credentials or commit environment secrets.

## Definition of done

For implementation work:

1. Confirm the requested behavior and acceptance criteria are satisfied.
2. Run `npm run lint`.
3. Run `npm test`.
4. Run `npm run build`.
5. Manually exercise affected UI behavior with `npm run dev` when relevant.
6. Review the final diff for regressions and unrelated changes.
7. Summarize what changed, why it changed, and any remaining verification gaps.

If a check cannot be run or fails for a pre-existing reason, report that clearly
instead of treating the work as fully verified.
