# Founding-cohort decision thresholds

- **Version:** 1.0
- **Precommitted:** October 23, 2026
- **Status:** Active before the first founding-cohort invitation
- **Owner and final decision authority:** Kevin Tulloch
- **Field-evidence owner:** Operating partner
- **Tracking issue:** [#127](https://github.com/marathoner-app/marathoner/issues/127)

## Purpose

These thresholds decide whether Marathoner should proceed, refine, or pause at
the two-week and four-week cohort reviews. They were committed before any
founding-cohort product results were observed. Friendly interest, a verbal
agreement to test, a waitlist entry, or a successful prototype conversation is
not activation or product-use evidence.

The first invitation batch remains five to eight allowlisted participants. No
more than eight may be active before the two-week review. A passing review may
permit at most twelve concurrent participants and fifteen accepted invitations
through the eight-week review.

## Evidence and privacy rules

The private evidence ledger retains participant-level observations only in the
approved owner-controlled workspace. GitHub receives aggregate numerators,
denominators, windows, outcomes, and privacy-safe themes. It must not contain
names, contact details, account identifiers, health information, run records,
or individual support conversations.

Every reported metric must include:

- its numerator and denominator, with counts shown alongside any percentage;
- the observation window and cutoff time;
- missing or excluded observations and the stated reason;
- the evidence source and responsible owner; and
- the original version of this decision table.

Missing evidence never becomes a success. When a required denominator is below
the minimum stated here, the result is **Refine — insufficient evidence** and
cohort expansion remains closed.

## Metric definitions and thresholds

| Metric | Source and owner | Numerator / denominator and window | Proceed | Refine | Pause |
| --- | --- | --- | --- | --- | --- |
| Activation | Owned product records, verified against the private cohort ledger; Kevin | Participants who complete onboarding, understand and approve a plan, identify the next workout, and log a first activity or required check-in within seven calendar days / eligible participants whose seven-day window ended. Minimum denominator: 5. | At least 75% | 50% to below 75%, or fewer than 5 complete windows | Below 50% |
| Plan comprehension | Structured private check-in; operating partner records, Kevin reviews | Participants who can state the next workout, its purpose, the approval boundary, and what they would do if the plan feels wrong without coached correction / participants who approved a plan and completed the check within seven days. Minimum denominator: 5. | At least 80% | 60% to below 80%, or fewer than 5 observations | Below 60%, or any unresolved safety-critical misunderstanding |
| Recommendation trust | Structured private check-in after a bounded recommendation; operating partner records, Kevin reviews | Participants who can explain what changed, why, the practical consequence, and their approve-or-decline choice without coaching / participants exposed to a recommendation who completed the check. Minimum denominator: 3. | At least 80% | 60% to below 80%, or fewer than 3 observations | Below 60%, or any unresolved recommendation that a participant could reasonably mistake as mandatory or medical advice |
| Weekly use | Owned product records; Kevin | Activated participant-weeks containing at least one supported daily-loop action, such as reviewing current training and logging a completion or required check-in / complete activated participant-weeks. | At least 70% | 50% to below 70% | Below 50% across two consecutive complete cohort weeks |
| Safety events | Private incident and support register; Kevin | Unresolved critical recommendation or escalation failures / complete participant-weeks, with every event also reported as a count. | Zero unresolved critical events | A non-critical safety defect exists but is contained, corrected, and disclosed before expansion | Any unresolved critical event, unsafe recommendation, missed escalation, or unbounded health claim |
| Data-integrity failures | Product diagnostics, support reports, and incident register; Kevin | Confirmed material integrity failures / complete participant-weeks, with every event also reported as a count. | Zero critical failures | A non-critical defect is contained and does not alter another participant's state or a material training decision | Any cross-account exposure, duplicate or partial material mutation, silent lost/incorrect plan or run, or accepted unsupported write |
| Support burden | Private support ledger; Kevin | Included support minutes / active participant-weeks, reported with total weekly minutes. Planned research conversations are excluded and reported separately. | At most 30 minutes per active participant-week and at most 4 total owner hours in each week | Above 30 through 60 minutes per active participant-week, or one week above 4 owner hours | Above 60 minutes per active participant-week for two consecutive weeks, two consecutive weeks above 4 owner hours, or a critical response missed because capacity was unavailable |
| Withdrawal | Private withdrawal register; Kevin | Participants who withdraw because of the product, trust, safety, privacy, or support experience / participants who received product access. Unrelated life changes remain visible but separate. Minimum denominator: 5. | At most 20% | Above 20% but below 40%, or fewer than 5 access records | At least 40%, or any withdrawal tied to an unresolved safety, privacy, or integrity failure |
| Four-week activity | Owned product records plus structured check-in; Kevin | Participants who used Marathoner in at least three of their first four weeks and can explain what they are doing next and why / participants whose four-week window ended. Minimum denominator: 5. | At least 70% | 50% to below 70%, or fewer than 5 complete windows | Below 50% |

Percentages are calculated from the unrounded counts. The public decision record
shows both values; a rounded display must not move a result across a threshold.

## Threshold rationale

These are management thresholds for a five-to-eight-person learning cohort, not
population benchmarks. Activation at 75% allows at most two of eight initial
participants to miss the full first-week loop while still requiring a clear
majority. The 80% comprehension and recommendation thresholds make the common
five-person case effectively four of five because misunderstanding changes or
safety boundaries is more consequential than ordinary usability friction. The
70% use thresholds require a durable majority without treating one disrupted
week as automatic failure.

The 30-minute support target keeps eight active participants within four owner
hours per week; the higher Refine range exposes unsustainable behavior before
it becomes a support failure. The 20% withdrawal target permits one of five
participants to leave without hiding the reason, while two of five reaches the
40% Pause boundary. Critical safety, privacy, and integrity outcomes have zero
tolerance because a small cohort cannot make those failures acceptable through
strong engagement elsewhere.

## Decision order

Apply the table in this order:

1. **Pause overrides everything.** Any critical safety, privacy, cross-account,
   or material-integrity failure pauses new invitations and the affected
   workflow even when every growth or engagement measure passes.
2. **Required evidence must be complete.** A missing required metric or a
   denominator below its minimum produces Refine — insufficient evidence. It
   never permits expansion.
3. **Any remaining Refine result makes the review Refine.** Keep the cohort at
   or below its current cap, correct the named problem, and repeat the affected
   observation window.
4. **Proceed requires every metric due at that review to pass.** Proceed permits
   only the already documented next cohort cap; it does not authorize public
   signup, paid acquisition, or a new product claim.

The two-week review requires activation, plan comprehension, weekly use,
safety, data integrity, support burden, and withdrawal. Recommendation trust is
required only after at least one participant receives a bounded recommendation.
The four-week review adds recommendation trust when applicable and four-week
activity. A feature without enough real exposure remains unproved and cannot
expand merely because the rest of the cohort proceeds.

## Representative decisions

| Scenario | Observation | Required outcome |
| --- | --- | --- |
| Healthy first cohort | 6/8 activate, 5/6 pass comprehension, 10/14 participant-weeks show use, support averages 13 minutes, 1/8 withdraws, and no critical event occurs | **Proceed** at the two-week review |
| Interested but confused | 5/8 activate and 4/6 pass comprehension with otherwise safe operation | **Refine**; do not expand until the comprehension correction is re-observed |
| Too early to call | Only 3 participants have completed their seven-day windows | **Refine — insufficient evidence**; do not expand |
| Strong engagement with leaked state | Every engagement metric passes, but one participant sees another participant's record | **Pause** immediately; growth metrics cannot override integrity |
| Unsustainable support | Engagement passes, but owner support exceeds four hours in each of two consecutive weeks | **Pause** new invitations until support capacity or product behavior changes |

The executable mirror in
[`scripts/evaluate-founding-cohort-thresholds.mjs`](../scripts/evaluate-founding-cohort-thresholds.mjs)
keeps these representative outcomes under automated test. The document remains
the decision authority; the script does not ingest participant data or make an
autonomous release decision.

## Change control

Version 1.0 remains in history after invitations begin. A later change must add
a new dated version, preserve the old table and rationale, explain the evidence
or operating constraint that motivated the change, and state whether it applies
prospectively or requires a new cohort window. Thresholds must never be edited
silently after observing a disappointing result.
