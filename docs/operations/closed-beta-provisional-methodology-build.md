# Closed-beta provisional methodology build

Issue #686 pins one provisional methodology set for Marathoner's five-to-eight-person founding beta. This boundary makes the exact artifacts testable without representing them as professionally reviewed guidance or exposing them in an ordinary public build.

## Pinned set

The authoritative manifest is `docs/methodology/artifacts/closed-beta-provisional-methodology/0.1.0/manifest.json`.

| Capability | Pinned version |
| --- | --- |
| Plan generation | `beta-rules@0.2.0-draft` |
| Adaptation | `beta-adaptation@0.2.0-draft` |
| Guidance | `beta-guidance@0.1.0-draft` |
| Safety | `beta-safety@0.1.0-draft` |

Each entry also pins its repository path and SHA-256 digest. The Vite build verifies every digest before it can include the manifest.

## Build boundaries

- `npm run build` creates the ordinary production build and fails if any closed-beta manifest marker is present.
- `npm run build:closed-beta` creates `dist-closed-beta` with the pinned manifest. It requires Vite mode `closed-beta`, the beta Firebase environment, and `VITE_CLOSED_BETA_PROVISIONAL_METHODOLOGY=true`.
- `npm run build:ios:beta` creates the unsigned iOS beta web payload with the same explicit guard.
- Development dogfood and closed-beta methodology cannot be enabled in the same build.

The guard is deliberately unavailable in ordinary production, development, dogfood, and iOS development modes. Setting the environment variable in any of those modes fails the build rather than widening access.

## Updating the set

Do not change a pinned artifact in place. A content change must:

1. Publish a new version of the affected artifact.
2. Create a new versioned methodology manifest that points to it.
3. Recompute and review each SHA-256 digest.
4. Update the explicit build import only after the new manifest is accepted for the closed beta.

This slice only establishes the immutable build boundary. Participant eligibility, disclosure and consent, runtime guidance, adaptation approval, rollback, and invitation-readiness proofs remain tracked by #687 through #691.
