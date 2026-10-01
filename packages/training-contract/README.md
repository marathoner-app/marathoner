# Marathoner training contract spike

This private package is the deliberately small cross-client boundary from
[issue #85](https://github.com/marathoner-app/marathoner/issues/85). It exposes
two representative concepts used by both the preserved web application and the
Expo mobile proof:

- a branded, runtime-validated `CompletedRunId` that rejects blank, padded, and
  path-like values;
- a branded `DistanceMeters` value stored as a non-negative whole number, plus
  the existing mile conversion helpers.

The ESM runtime and TypeScript declaration are published together so Vite,
Metro, and plain Node tests can consume the same validation without a package
build step. The root web domain re-exports the contract to preserve its current
imports. The Expo spike imports this package directly.

This is evidence for a package boundary, not a complete shared domain model.
Dates, durations, plans, workouts, shoes, completed-run records, persistence,
offline behavior, and schema migration remain in their current owners until the
mobile ADR has enough evidence to approve a wider boundary.
