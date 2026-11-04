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
candidates. Neither result authorizes a silent cross-provider merge; the
trusted import command introduced by issue #619 must preserve the review
outcome.
