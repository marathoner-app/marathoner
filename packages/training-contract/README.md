# Marathoner training contract spike

This private package is the deliberately small cross-client boundary from
[issue #85](https://github.com/marathoner-app/marathoner/issues/85). It exposes
two representative concepts proven across the web application and the retired
mobile candidates:

- a branded, runtime-validated `CompletedRunId` that rejects blank, padded, and
  path-like values;
- a branded `DistanceMeters` value stored as a non-negative whole number, plus
  the existing mile conversion helpers.

The ESM runtime and TypeScript declaration are published together so Vite,
Metro, and plain Node tests can consume the same validation without a package
build step. The root web domain re-exports the contract to preserve its current
imports. The historical Expo candidate imported this package directly; that
runtime was removed after Capacitor was selected.

This is evidence for a package boundary, not a complete shared domain model.
Dates, durations, plans, workouts, shoes, completed-run records, persistence,
offline behavior, and schema migration remain in their current owners until the
mobile ADR has enough evidence to approve a wider boundary.

Issue [#87](https://github.com/marathoner-app/marathoner/issues/87) temporarily
added a fixed `SharedRecordProof` shape so web, Capacitor, and Expo could prove
the same Firestore round trip. Issue #178 removed that proof-only contract and
path after the architecture decision. The result lives in the preserved
[mobile evidence](../../spikes/mobile/README.md), not in the current API.

## Canonical fixtures

The `@marathoner/training-contract/fixtures/v1` export is a technology-neutral
JSON conformance set. It covers the current identifiers, base units, dates,
runner profiles, training plans, planned workouts, completed runs, and shoes
without making their implementations part of this package. Each case declares
its schema version and expected acceptance result.

See [`fixtures/v1/README.md`](./fixtures/v1/README.md) for the conformance
workflow and the distinction between fixture compatibility and production
persistence compatibility.
