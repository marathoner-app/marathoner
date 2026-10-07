# Commercial interview protocol synthetic rehearsal

- **Date:** October 6, 2026
- **Protocol version:** `commercial-interview-protocol@1.0.0`
- **Artifact version:** `commercial-research-artifacts@0.1.0`
- **Ledger version:** `commercial-evidence-ledger@1.0.0`
- **Owner:** Kevin Tulloch
- **Result:** Pass

## Purpose

Prove before recruitment that the frozen rubric can reproduce classifications
from atomic observations for enthusiastic, ambiguous, and negative interviews.
The cases are entirely synthetic. They are not participants, market evidence,
payment activity, or a reason to open recruitment.

## Results

| Synthetic case | Qualified interview | Recurring workaround | Eight-week commitment | Comprehension | Reservation candidate | Qualified prospect | Fixed request | Confirmed deposit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Enthusiastic `SYNTHETIC-E01` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Ambiguous `SYNTHETIC-A01` | Yes | No | No | No | No | No | No | No |
| Negative `SYNTHETIC-N01` | Yes | No | No | Yes | Yes | Yes | Yes | No |

The rehearsal demonstrates three intended controls:

1. Positive language does not create a commitment, qualified prospect, or
   comprehension success when the required atomic observations are absent.
2. A negative participant who meets the segment and task requirements remains
   a qualified interview and, when otherwise qualified, receives the same
   reservation request and remains in its denominator.
3. Understanding the concept is distinct from valuing or paying for it.
4. Pre-offer candidate routing is separate from offer comprehension, preventing
   a circular or cherry-picked payment denominator.

Only three synthetic cases exist, so no commercial gate is evaluable. Their
ratios are not directional market evidence and must never be copied into a
public commercial decision.

## Reproduction

`scripts/commercial-interview-protocol.test.mjs` reads the synthetic case file,
applies the frozen named-field rules, and requires an exact match with every
expected classification. The same test confirms that the templates preserve
the source categories, private/public boundary, small-sample warning, fixed
prompts, evidence owner, observation window, and version-change controls.
