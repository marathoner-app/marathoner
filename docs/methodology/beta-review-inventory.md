# Founding-beta methodology inventory

- **Inventory version:** `beta-review-inventory@0.1.0`
- **Artifact owner:** Kevin Tulloch (`PCO`)
- **Status:** Complete inventory structure; all methodology artifacts remain
  unapproved
- **Protocol:** [Qualified methodology review](README.md)

This inventory defines the complete rule and content surface that must be
reviewed for the ratified founding beta. A row's presence means it must be
decided; it does not mean the behavior or wording has been approved.

The planned artifact versions are identifiers for the first authoring round.
Every row begins `Missing` because the exact rule or content has not yet been
frozen into a review packet. The artifact owner is responsible for preparing
the row; the listed reviewer owns the independent decision.

## Rules and adaptation

| ID | Required decision | Artifact owner | Planned version | Approver | Implementation home | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `ELIG-001` | Adult, English-language, United States, first-marathon, and consistently-running segment boundary | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#70](https://github.com/marathoner-app/marathoner/issues/70) | Missing |
| `ELIG-002` | Required recent mileage, frequency, consistency duration, longest run, availability, and complete-input thresholds | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#70](https://github.com/marathoner-app/marathoner/issues/70) | Missing |
| `FEAS-001` | Minimum and maximum supported race horizon and deterministic infeasible-race rejection | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#70](https://github.com/marathoner-app/marathoner/issues/70) | Missing |
| `PLAN-001` | Supported first-marathon plan family, phases, duration, workout types, weekly structure, and taper | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#70](https://github.com/marathoner-app/marathoner/issues/70) | Missing |
| `PROG-001` | Starting-load selection, mileage and long-run progression ceilings, cutbacks, recovery placement, and intensity limits | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#70](https://github.com/marathoner-app/marathoner/issues/70) | Missing |
| `ADAPT-001` | Conditions and limits for rescheduling an approved workout | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#105](https://github.com/marathoner-app/marathoner/issues/105) | Missing |
| `ADAPT-002` | Conditions and limits for holding progression | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#105](https://github.com/marathoner-app/marathoner/issues/105) | Missing |
| `ADAPT-003` | Conditions and limits for repeating an approved period | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#105](https://github.com/marathoner-app/marathoner/issues/105) | Missing |
| `ADAPT-004` | Conditions for a no-change result and for refusing any other adaptation | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#105](https://github.com/marathoner-app/marathoner/issues/105) | Missing |

## Safety and unsupported cases

| ID | Required decision | Artifact owner | Planned version | Approver | Implementation home | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `SAFE-001` | Minimum pain and unusual-symptom input, retention boundary, ambiguity behavior, and red-flag fixtures | Kevin Tulloch | `beta-safety@0.1.0-draft` | `CSR` | [#134](https://github.com/marathoner-app/marathoner/issues/134) | Missing |
| `SAFE-002` | Exact stop-activity, seek-qualified-help, and seek-emergency-help triggers and wording | Kevin Tulloch | `beta-safety@0.1.0-draft` | `CSR` | [#134](https://github.com/marathoner-app/marathoner/issues/134) | Missing |
| `SAFE-003` | Training actions disabled after a safety escalation and the conditions for restoring access | Kevin Tulloch | `beta-safety@0.1.0-draft` | `CSR`, `EMR` | [#134](https://github.com/marathoner-app/marathoner/issues/134) | Missing |
| `UNSUP-001` | Honest rejection for no-running, inconsistent-running, return-to-running, and insufficient-base inputs | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#70](https://github.com/marathoner-app/marathoner/issues/70) | Missing |
| `UNSUP-002` | Honest rejection for infeasible race horizons, unsupported availability, or incomplete/conflicting planning inputs | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR` | [#70](https://github.com/marathoner-app/marathoner/issues/70) | Missing |
| `UNSUP-003` | Honest refusal for active pain or unusual-symptom escalation, diagnosis requests, and individual clinical needs | Kevin Tulloch | `beta-safety@0.1.0-draft` | `CSR` | [#134](https://github.com/marathoner-app/marathoner/issues/134) | Missing |
| `UNSUP-004` | Refusal when an artifact version is draft, unknown, retired, rejected, conditional, or outside its approved scope | Kevin Tulloch | `beta-rules@0.1.0-draft` | `EMR`, `CSR`, `SNR` as applicable | [#120](https://github.com/marathoner-app/marathoner/issues/120) | Missing |

## Guidance and claims

| ID | Required decision | Artifact owner | Planned version | Approver | Implementation home | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `GUIDE-001` | Easy-effort purpose, perception, and approved action language | Kevin Tulloch | `beta-guidance@0.1.0-draft` | `EMR` | [#135](https://github.com/marathoner-app/marathoner/issues/135) | Missing |
| `GUIDE-002` | Shoe selection, tracking, inspection, and replacement language without universal mileage or injury claims | Kevin Tulloch | `beta-guidance@0.1.0-draft` | `EMR` | [#135](https://github.com/marathoner-app/marathoner/issues/135) | Missing |
| `GUIDE-003` | General endurance-fueling education, audience, timing boundary, limitations, and refer-out conditions | Kevin Tulloch | `beta-guidance@0.1.0-draft` | `SNR` | [#135](https://github.com/marathoner-app/marathoner/issues/135) | Missing |
| `GUIDE-004` | General hydration education, audience, environmental limitations, and refer-out conditions | Kevin Tulloch | `beta-guidance@0.1.0-draft` | `SNR` | [#135](https://github.com/marathoner-app/marathoner/issues/135) | Missing |
| `GUIDE-005` | Sleep education and limits on health or treatment claims | Kevin Tulloch | `beta-guidance@0.1.0-draft` | `EMR`; `CSR` if health claims remain | [#135](https://github.com/marathoner-app/marathoner/issues/135) | Missing |
| `GUIDE-006` | Recovery education, expected training context, escalation boundary, and limitations | Kevin Tulloch | `beta-guidance@0.1.0-draft` | `EMR`; `CSR` for symptom claims | [#135](https://github.com/marathoner-app/marathoner/issues/135) | Missing |
| `GUIDE-007` | Explanation for every generation and adaptation reason code and the runner's available decision | Kevin Tulloch | `beta-guidance@0.1.0-draft` | Reviewer for the underlying rule | [#135](https://github.com/marathoner-app/marathoner/issues/135), [#136](https://github.com/marathoner-app/marathoner/issues/136) | Missing |
| `GUIDE-008` | Product limitations, unsupported-result language, and distinction from medical care or an individual coach | Kevin Tulloch | `beta-guidance@0.1.0-draft` | `EMR`, `CSR`, `SNR` for their domains | [#135](https://github.com/marathoner-app/marathoner/issues/135) | Missing |
| `CLAIM-001` | Prohibited diagnosis, treatment, injury-prevention, guaranteed-outcome, and finish-time claims | Kevin Tulloch | `beta-guidance@0.1.0-draft` | `EMR`, `CSR`, `SNR` for their domains | [#107](https://github.com/marathoner-app/marathoner/issues/107) | Missing |

## Coverage check

The inventory covers every review family required by #119:

- eligibility: `ELIG-001` and `ELIG-002`;
- progression and plan construction: `PLAN-001` and `PROG-001`;
- hold, repeat, reschedule, and no change: `ADAPT-001` through `ADAPT-004`;
- race-date rejection: `FEAS-001` and `UNSUP-002`;
- pain and unusual symptoms: `SAFE-001` through `SAFE-003` and `UNSUP-003`;
- fueling and hydration: `GUIDE-003` and `GUIDE-004`;
- sleep and recovery: `GUIDE-005` and `GUIDE-006`; and
- limitations and all other unsupported cases: `UNSUP-001` through
  `UNSUP-004`, `GUIDE-008`, and `CLAIM-001`.

No row may be deleted to make a review pass. A feature may be removed from the
beta only by changing its row to `Retired`, documenting the product-scope
change, and proving the implementation cannot serve it.
