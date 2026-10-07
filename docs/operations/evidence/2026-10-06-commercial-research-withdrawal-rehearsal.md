# Commercial research synthetic withdrawal rehearsal

- **Date:** October 6, 2026
- **Owner and operator:** Kevin Tulloch
- **Consent version:** `commercial-research-consent@1.0.0`
- **Synthetic case:** one fictional participant; no real participant data
- **Started:** 5:18 PM PDT
- **Completed and verified:** 5:31 PM PDT
- **Service-level result:** Pass — completed in the same operating session,
  inside the seven-calendar-day target
- **Runbook:**
  [Commercial research operations](../commercial-research-operations.md)

## Purpose and boundaries

This rehearsal tested the selected Google Workspace operating path before any
real participant recruitment. It used one synthetic research ID and a
fictional email address. Neither value is published here. No payment was made,
and no audio, video, transcript, or automated notes were created.

The rehearsal covered Google Forms, its linked Google Sheet, the restricted
Drive folder structure, Google Calendar, and the participant-support mailbox.
It did not test Stripe; seller activation and the payment/refund proof belong
to issue #215.

## Result

| Check | Result | Evidence observed |
| --- | --- | --- |
| Consent boundary | Pass | The live Form displayed four separate required Yes/No decisions using `commercial-research-consent@1.0.0`. Editor access was restricted to the operator; responder access was limited to the Marathoner organization. |
| Consent deletion | Pass | The single synthetic response was deleted. The Form reported `0 responses` after verification. |
| Linked response data | Pass | The original response Sheet was permanently deleted and replaced with a fresh empty Sheet. Drive showed the replacement in `02 Consent` without a shared-access indicator. |
| Identity and contact | Pass | The synthetic identity record was permanently deleted. |
| Scheduling | Pass | The synthetic scheduling record and private Calendar event were deleted. Calendar search returned no matching event. |
| Raw notes | Pass | The synthetic raw-notes record was permanently deleted. No recording or transcript existed. |
| Evidence ledger | Pass | The synthetic coded-evidence record was permanently deleted. |
| Reservation ledger | Pass | The synthetic reservation record was permanently deleted. No payment was attempted. |
| Public aggregation | Pass | The one-record public-summary candidate was suppressed because the subgroup was below the five-participant publication threshold. |
| Drive search | Pass | Search by the synthetic research ID returned no files or folders after the control record was updated. The identity-bearing synthetic records, including the fictional email, had been permanently deleted. |
| Drive trash | Pass | Workspace Drive reported that Trash was empty after permanent deletion. |
| Mailbox search | Pass | Gmail reported that no messages matched the synthetic research ID. |

The accidentally created blank Form used during setup was also permanently
deleted. It contained no response or participant data and was not part of the
approved operating path.

## Conclusion

The private research boundary is operational for the planned single-operator,
small-study workflow. The rehearsal demonstrates that the declared
participant-linked records can be found and removed from the user-visible
Workspace systems within the promised service level while preserving only a
non-identifying public result.

Google controls internal backup, version-history, and provider-retention
behavior that is not exposed through the operator interfaces tested here. The
runbook therefore promises deletion from declared user-visible stores and does
not claim deletion from provider systems that Marathoner cannot independently
inspect or control.

No corrective issue was required. Real recruitment remains blocked by the
remaining commercial-proof sprint gates; this rehearsal alone does not
authorize participant collection, payments, or a live-product pilot.
