# Beta state reconciliation

- **Date:** November 14, 2026
- **Tracking issue:** [#770](https://github.com/marathoner-app/marathoner/issues/770)
- **Scope:** public-safe repository status only

## Confirmed state

- Version 1.0 build 9 is processed and assigned to the internal
  `Marathoner Internal Beta` TestFlight group.
- The owner and operating partner have exercised the internal iOS beta. This is
  internal testing, not external TestFlight App Review or founding-cohort
  invitation approval.
- Apple Health automatic import has owner-device evidence.
- A real owner-controlled run recorded after Garmin connection arrived
  automatically through the direct Garmin Activity API path.
- The beta App Check console's November 8-15 view reported all observed
  Firestore and Authentication traffic as verified, with zero invalid,
  unknown-origin, or outdated-client requests in those views. A bounded
  Functions log review showed valid authentication and App Check context on a
  current import-resolution path.
- The individual Apple Developer Program membership is the selected first-beta
  path. California entity formation and Apple organization migration remain a
  deferred future migration, not a founding-beta dependency.
- The guarded provisional-methodology implementation slices are complete.
  Issue #691 still owns parity, control, rollback, operations, and the explicit
  invitation-readiness decision.

## Not proved by this checkpoint

- External TestFlight App Review or access for the five-to-eight-person cohort.
- The complete App Check observation window, cold-start/token-refresh matrix,
  rollback, rejected-client proof, or enforcement.
- Same-provider Garmin live replay, cross-provider duplicate handling, live
  Garmin-state account-deletion rehearsal, or limited-account import proof.
- The locked owner/J daily loop, accessibility and failure-state matrix on one
  current candidate.
- The complete provisional-methodology web/iOS parity, kill-switch, retirement,
  rollback, recovery, and invitation-readiness record.
- A passing founding-beta invitation decision.

## Next locked candidate

Issue [#772](https://github.com/marathoner-app/marathoner/issues/772) owns
TestFlight build 10. It must start from reviewed merged `main`, include the
post-build-9 Garmin recovery, Track heart-rate ordering, safe imported-run
deletion, Apple Health heart-rate fallback, Garmin-aware account deletion, and
run-save stage diagnostics, then become the sole candidate for the remaining
physical proof unless a documented defect requires a replacement.

No credential, participant identity, account identifier, device identifier,
private run detail, provider token, App Check token, or unredacted console
capture is retained in this record.
