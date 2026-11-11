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

## Runtime eligibility control

Issue #687 adds the server-owned eligibility decision that must be used before
any pinned methodology capability is served. The decision reads the caller's
`betaMemberships/{userId}` record and
`operatorControls/closedBetaMethodology` in one Firestore transaction. Clients
cannot read or write either the operator control or the resulting eligibility
evidence.

The operator control has this exact shape:

```json
{
  "schemaVersion": "closed-beta-methodology-control@1",
  "revision": 1,
  "enabled": true,
  "manifestVersion": "closed-beta-provisional-methodology@0.1.0",
  "artifactVersions": {
    "plan": "beta-rules@0.2.0-draft",
    "adaptation": "beta-adaptation@0.2.0-draft",
    "guidance": "beta-guidance@0.1.0-draft",
    "safety": "beta-safety@0.1.0-draft"
  },
  "updatedAt": "2026-11-11T20:00:00.000Z"
}
```

The server fails closed when the control is absent, malformed, disabled, stale,
or inconsistent with its bundled manifest. An allowed decision records the
exact control revision, manifest version, full artifact-version set,
capability, and selected artifact version. It does not copy membership details
into the evidence.

Unsupported inputs never fall through to ordinary methodology. Pain or unusual
symptom inputs may reach only the pinned safety capability; plan, adaptation,
and guidance capabilities return a typed escalation decision instead.

Creating or enabling the control is an explicit deployment operation. The
runtime code in #687 does not seed or silently enable it. The later
capability-specific slices must call this shared decision before producing a
plan, adaptation, or guidance result.
