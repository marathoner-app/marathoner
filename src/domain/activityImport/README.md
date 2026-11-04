# Completed activity import contract

This directory owns the portable boundary between external activity providers
and Marathoner. Provider adapters may read HealthKit or Garmin SDK types, but
they must convert those values into `CompletedActivityImportEventV1` before the
data reaches shared domain, command, persistence, or UI code.

The contract keeps only the facts needed to identify and represent a completed
run: owner-scoped provider identity, adapter observation time, an optional
provider update time, running activity type, start/end or duration, time zone,
distance, and a bounded reported origin.
It deliberately excludes raw routes, FIT payloads, OAuth data, all-day health
data, perceived effort, notes, shoes, and planned-workout decisions.

Same-provider replay is resolved from the owner, provider, and opaque provider
activity ID. Cross-provider comparison uses exact normalized facts for a
deterministic duplicate fingerprint and narrow tolerances for ambiguous
candidates. Neither result authorizes a silent cross-provider merge.

`run.import-activity` is the trusted persistence boundary. The caller omits
ownership; the callable function derives it from the authenticated session and
reconstructs the portable event before validation. A first accepted upsert
creates one ordinary completed run so existing Track and Analyze listeners see
it. Provider identity, lifecycle state, and duplicate evidence live in a
separate server-only import record and cannot be changed through ordinary run
editing.

Same-provider replay keeps one canonical command and completed-run identity.
Newer facts update only provider-owned run fields, leaving Marathoner-owned
workout, shoe, effort, pain, and note fields intact. Deletes retain a tombstone
so stale provider events cannot resurrect a run. A cross-provider candidate is
recorded for review without creating another visible run.
