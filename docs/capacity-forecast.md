# Capacity-based founding-beta forecast

- **Status:** Active commercially conditioned forecast
- **As of:** October 6, 2026
- **Owner:** Kevin Tulloch
- **Baseline issue:** [#116](https://github.com/marathoner-app/marathoner/issues/116)
- **Recalibration issue:** [#208](https://github.com/marathoner-app/marathoner/issues/208)
- **Master tracker:** [#104](https://github.com/marathoner-app/marathoner/issues/104)
- **Scope:** Marathoner beta critical path; Creator Radar is excluded

## Decision summary

The first two weeks of committee-remediation delivery retired substantially
more of the September estimate than the baseline model anticipated. The
selected Capacitor architecture is now running in the production-shaped root
application, Waves 00 and 01 have passed, and implementation has advanced into
runner intake, deletion, and App Check work.

The observation window is short and unusually concentrated, so the forecast
does not extend its raw rate linearly. It uses only one-fifth to just under
one-half of the observed likely-estimate burn, adds newly exposed App Check and
live-synchronization scope, and keeps qualified review, TestFlight review,
non-owner rehearsal, and participant scheduling as independent gates.

The October 6 commercial review also replaces the original 14 / 19 / 26-unit
placeholder for issue #126 with the 41 / 63 / 95-unit
[commercial proof sprint](commercial-proof-sprint.md). The sprint begins now,
uses the external-review wait where possible, and conditions the full
adaptation engine on problem, commitment, and reservation evidence.

With those controls, the corrected scope forecasts:

| Scenario | Earliest invitation decision | Meaning |
| --- | --- | --- |
| Optimistic | January 10, 2027 | Commercial interviews and the initial concierge proof complete at the short end of their scheduling range, twenty-four units land per week, external waits overlap, and little rework occurs. |
| Likely | April 4, 2027 | Commercial proof reaches its December 6 checkpoint, sixteen units land per week, the reviewer path consumes six weeks, and normal integration and correction work occur. |
| Conservative | November 14, 2027 | Commercial scheduling reaches its planning bound, ten units land per week, high estimates govern, and reviewer plus TestFlight waits reach their planning bounds. |

These are forecasts, not promises. Invitations remain blocked until the
evidence gates pass, even if a forecast date arrives. January 15, 2027 still
falls between the optimistic and likely scenarios. It remains an explicit
scope-or-date decision checkpoint, not a capacity-backed promise.

The optimistic January 10 date means the invitation-readiness decision could
pass before the invitation floor. It does not authorize invitations before
January 15 in #104. Opening earlier would require an explicit founding-beta
contract change; this forecast changes the planning evidence, not the
participant promise.

The recommended planning expectation is April 4, 2027 while preserving every
ratified safety, integrity, privacy, and review gate. December is possible only
for commercial learning, not for founding-beta invitations. If earlier product
learning becomes strategically necessary, use the approved non-prescriptive
fallback instead of silently weakening those gates.

## Recalibrated capacity model

A focused session remains 60 to 90 minutes of owner attention. The September
estimates used those sessions directly. The repository did not record enough
owner-attention hours or unattended Codex time to claim a new hours-per-issue
conversion. This recalibration therefore treats the old estimates as **legacy
estimate units** and calibrates their weekly retirement against observed
delivery. It does not call merged pull requests owner hours.

| Input | Recalibrated model |
| --- | --- |
| Sustainable owner capacity | At least 14 hours per week, based on at least two flexible hours per day |
| Observed window | September 22 through October 6, 2026; two delivery weeks |
| Observed delivery | 41 merged pull requests, 44 linked issue closures, 18 of 57 baseline rows closed, and 100 likely legacy estimate units retired |
| Forecast delivery rate | 24 optimistic, 16 likely, and 10 conservative legacy estimate units per week |
| Rate haircut | Forecast rates retain only 48%, 32%, and 20% of the observed 50 likely-unit weekly burn |
| Likely owner allocation | About 10 planned owner hours from the 14-hour minimum; additional flexibility belongs only in the optimistic case |
| Reserve | At least 30% of the stated minimum capacity remains for review, support, defects, operations, and estimate error |
| Reserve use | Review, support, defects, operational work, and estimate uncertainty |
| Work in progress | One active implementation issue plus one externally blocked issue |
| Forecast week | Ends Sunday; partial work is rounded to the next forecast week |
| Known blackout periods | None are recorded in the public repository; no blackout credit is assumed |

The reserve is not pre-spent on feature work. If it is unused, the forecast may
improve at the next reforecast; it is not used to make the baseline appear
faster. The optimistic capacity includes only a bounded portion of the owner's
additional flexibility, not every potentially available hour. Personal
blackout details do not belong in the public repository. A future blackout
should be represented only as a reduced session count for the affected week.

The rate haircut is deliberate. The observed work was partly documentation,
architecture, environment setup, and bounded infrastructure; the remaining
work contains the generator, atomic mutations, adaptation, cross-client daily
loop, accessibility, and live operations. Those are expected to require more
owner judgment and correction. The likely model assumes roughly a twofold gain
over the original eight-unit weekly plan, not the sixfold gain suggested by a
literal extension of the two-week sample.

The baseline began with the week ending September 27, 2026. Its issue estimates
remain below as an auditable source. Issue #116 is recorded for completeness
but excluded from both the old and recalibrated remaining totals.

## Estimate rules

- **Optimistic:** The understood path works with little rework.
- **Likely:** Normal integration, review, and one correction cycle occur.
- **Conservative:** Architecture, device, rules, or review findings require
  meaningful correction without changing the approved product contract.
- Epic and gate-review issues are not charged as implementation work when all
  their work is represented by estimated children and normal closeout fits the
  weekly reserve.
- A parent with unfinished work outside its children is listed as a
  **residual** so milestone work cannot disappear between parent and child
  issues.
- An issue marked **candidate deferral** is still estimated because it remains
  in a live beta milestone. Deferring it requires an explicit milestone and
  gate decision.

## September 22 baseline estimates

These tables preserve the original inventory and estimates. Their totals are
not the current remaining-work claim; the October 6 reconciliation following
the Wave 06A table is authoritative.

### Wave 00 — Solo Delivery and Beta Contract

| Issue | Work | Type | Optimistic | Likely | Conservative |
| --- | --- | --- | ---: | ---: | ---: |
| [#19](https://github.com/marathoner-app/marathoner/issues/19) | Organization identity and remaining solo-governance record | Gate | 2 | 3 | 5 |
| [#123](https://github.com/marathoner-app/marathoner/issues/123) | Contain signup and publish honest trust paths | Gate | 4 | 6 | 9 |
| [#116](https://github.com/marathoner-app/marathoner/issues/116) | Publish and verify this capacity forecast | Completed control work; excluded from remaining totals | 2 | 3 | 4 |
| **Remaining Wave 00 total** |  |  | **6** | **9** | **14** |

The likely #123 path assumes the smallest responsible decision is selected. A
broader public waitlist or trust-center implementation must be re-estimated.

### Wave 01 — Shared Mobile Foundation

| Issue | Work | Type | Optimistic | Likely | Conservative |
| --- | --- | --- | ---: | ---: | ---: |
| [#22](https://github.com/marathoner-app/marathoner/issues/22) | Audit Firebase browser configuration and console controls | Gate | 3 | 5 | 8 |
| [#80](https://github.com/marathoner-app/marathoner/issues/80) | Decide real-time, offline, cache, and conflict behavior | Gate | 2 | 3 | 5 |
| [#83](https://github.com/marathoner-app/marathoner/issues/83) | Approve the evidence-backed mobile ADR | Gate | 3 | 5 | 8 |
| [#84](https://github.com/marathoner-app/marathoner/issues/84) | Build comparable Capacitor and Expo spike shells | Gate | 6 | 9 | 14 |
| [#85](https://github.com/marathoner-app/marathoner/issues/85) | Extract one portable training contract | Gate | 3 | 4 | 6 |
| [#86](https://github.com/marathoner-app/marathoner/issues/86) | Prove Firebase authentication on a physical iPhone | Gate | 3 | 5 | 8 |
| [#87](https://github.com/marathoner-app/marathoner/issues/87) | Prove web/iOS Firestore round trip and ownership | Gate | 4 | 6 | 9 |
| [#88](https://github.com/marathoner-app/marathoner/issues/88) | Record build, offline, and EAS findings | Gate | 2 | 3 | 5 |
| [#89](https://github.com/marathoner-app/marathoner/issues/89) | Create cross-client contract fixtures | Gate | 4 | 6 | 9 |
| [#125](https://github.com/marathoner-app/marathoner/issues/125) | Separate development and beta Firebase environments | Gate | 5 | 8 | 12 |
| **Wave 01 total** |  |  | **35** | **54** | **84** |

### Wave 02 — Intake and Initial Plan

| Issue | Work | Type | Optimistic | Likely | Conservative |
| --- | --- | --- | ---: | ---: | ---: |
| [#66](https://github.com/marathoner-app/marathoner/issues/66) | Persist owned runner profiles | Gate | 4 | 6 | 9 |
| [#67](https://github.com/marathoner-app/marathoner/issues/67) | Deliver first-marathon onboarding | Gate | 5 | 8 | 12 |
| [#69](https://github.com/marathoner-app/marathoner/issues/69) | Define versioned plan-generation contracts | Gate | 3 | 5 | 8 |
| [#70](https://github.com/marathoner-app/marathoner/issues/70) | Implement the approved deterministic plan generator | Gate | 10 | 16 | 24 |
| [#71](https://github.com/marathoner-app/marathoner/issues/71) | Deliver plan review and approval | Gate | 5 | 8 | 12 |
| [#72](https://github.com/marathoner-app/marathoner/issues/72) | Persist plan approval atomically | Gate | 6 | 10 | 15 |
| [#119](https://github.com/marathoner-app/marathoner/issues/119) | Define qualified review and obtain approval evidence | Gate plus external wait | 4 | 6 | 9 |
| **Wave 02 total** |  |  | **37** | **59** | **89** |

### Wave 03 — Track, Learn, and Adapt

| Issue | Work | Type | Optimistic | Likely | Conservative |
| --- | --- | --- | ---: | ---: | ---: |
| [#62](https://github.com/marathoner-app/marathoner/issues/62) | Confirm before completed-run deletion | Gate | 1 | 2 | 3 |
| [#73](https://github.com/marathoner-app/marathoner/issues/73) | Capture perceived effort | Gate | 2 | 3 | 5 |
| [#74](https://github.com/marathoner-app/marathoner/issues/74) | Capture bounded optional notes | Gate | 2 | 3 | 5 |
| [#75](https://github.com/marathoner-app/marathoner/issues/75) | Correct a completed-run date | Gate | 2 | 3 | 5 |
| [#76](https://github.com/marathoner-app/marathoner/issues/76) | Add existing shoe mileage | Candidate deferral | 2 | 3 | 5 |
| [#77](https://github.com/marathoner-app/marathoner/issues/77) | Retire a shoe safely | Candidate deferral | 2 | 4 | 6 |
| [#114](https://github.com/marathoner-app/marathoner/issues/114) | Define versioned guidance, triggers, and review state | Gate | 4 | 7 | 10 |
| [#115](https://github.com/marathoner-app/marathoner/issues/115) | Make material mutations atomic and revision-safe | Gate | 8 | 13 | 20 |
| [#120](https://github.com/marathoner-app/marathoner/issues/120) | Persist recommendation evidence and prove kill switches | Gate | 6 | 10 | 15 |
| [#132](https://github.com/marathoner-app/marathoner/issues/132) | Implement the bounded adaptation evaluator | Gate | 8 | 13 | 20 |
| [#133](https://github.com/marathoner-app/marathoner/issues/133) | Deliver guidance timing, suppression, and correction | Gate | 6 | 10 | 15 |
| [#134](https://github.com/marathoner-app/marathoner/issues/134) | Define pain escalation rules and fixtures | Gate plus external review | 4 | 7 | 11 |
| [#135](https://github.com/marathoner-app/marathoner/issues/135) | Author and approve the minimum guidance set | Gate plus external review | 5 | 8 | 12 |
| [#136](https://github.com/marathoner-app/marathoner/issues/136) | Deliver recommendation explanation and approval | Gate | 6 | 10 | 15 |
| **Wave 03 total** |  |  | **58** | **96** | **147** |

### Wave 04 — iOS Daily Companion

| Issue | Work | Type | Optimistic | Likely | Conservative |
| --- | --- | --- | ---: | ---: | ---: |
| [#122](https://github.com/marathoner-app/marathoner/issues/122) | Prove signing and an early external TestFlight build | Gate plus external wait | 6 | 9 | 14 |
| [#137](https://github.com/marathoner-app/marathoner/issues/137) | Implement iOS authentication and account isolation | Gate | 5 | 8 | 12 |
| [#138](https://github.com/marathoner-app/marathoner/issues/138) | Deliver the iOS today and run-logging loop | Gate | 6 | 10 | 15 |
| [#139](https://github.com/marathoner-app/marathoner/issues/139) | Deliver iOS guidance and recommendation review | Gate | 5 | 8 | 12 |
| [#140](https://github.com/marathoner-app/marathoner/issues/140) | Verify iOS accessibility and critical failures | Gate | 5 | 8 | 12 |
| **Wave 04 total** |  |  | **27** | **43** | **65** |

### Wave 05 — Trust and External-Beta Readiness

| Issue | Work | Type | Optimistic | Likely | Conservative |
| --- | --- | --- | ---: | ---: | ---: |
| [#3](https://github.com/marathoner-app/marathoner/issues/3) | Remove animation warnings and verify reduced motion | Gate quality | 1 | 2 | 3 |
| [#4](https://github.com/marathoner-app/marathoner/issues/4) | Finish accessibility scope outside #60, #61, and #64 | Residual | 3 | 5 | 8 |
| [#6](https://github.com/marathoner-app/marathoner/issues/6) | Map authentication failures safely | Gate | 2 | 3 | 5 |
| [#8](https://github.com/marathoner-app/marathoner/issues/8) | Remove unused code and dependencies | Candidate deferral | 2 | 3 | 5 |
| [#9](https://github.com/marathoner-app/marathoner/issues/9) | Align component and file names | Candidate deferral | 2 | 3 | 5 |
| [#23](https://github.com/marathoner-app/marathoner/issues/23) | Implement the public landing page's unsliced work | Residual; must split | 10 | 14 | 20 |
| [#60](https://github.com/marathoner-app/marathoner/issues/60) | Improve login semantics and pending behavior | Gate | 1 | 2 | 3 |
| [#61](https://github.com/marathoner-app/marathoner/issues/61) | Improve signup semantics and pending behavior | Gate | 1 | 2 | 3 |
| [#63](https://github.com/marathoner-app/marathoner/issues/63) | Add phone-width Track regression coverage | Gate quality | 3 | 5 | 8 |
| [#64](https://github.com/marathoner-app/marathoner/issues/64) | Add keyboard coverage for the workout dialog | Gate | 2 | 3 | 5 |
| [#78](https://github.com/marathoner-app/marathoner/issues/78) | Add password reset | Gate | 2 | 4 | 6 |
| [#79](https://github.com/marathoner-app/marathoner/issues/79) | Design and implement complete account/data deletion | Leaf that must split | 7 | 11 | 17 |
| [#121](https://github.com/marathoner-app/marathoner/issues/121) | Strengthen beta rules and negative tests | Gate | 6 | 10 | 15 |
| [#124](https://github.com/marathoner-app/marathoner/issues/124) | Rehearse deletion, restore, incident, and support operations | Gate | 5 | 8 | 13 |
| [#127](https://github.com/marathoner-app/marathoner/issues/127) | Precommit cohort decision thresholds | Gate | 4 | 6 | 9 |
| [#143](https://github.com/marathoner-app/marathoner/issues/143) | Resolve or time-bound development-tool advisories | Gate quality | 3 | 5 | 8 |
| **Wave 05 total** |  |  | **54** | **86** | **133** |

Issue #123 is estimated in Wave 00 because its immediate public-surface
decision is due there, even though it also supports readiness epic #109.
Safety work #119 and #134 is estimated in the waves where its blocking evidence
is first required rather than charged again under epic #107.

### Wave 06A — Founding Cohort Invitations

| Issue | Work | Type | Optimistic | Likely | Conservative |
| --- | --- | --- | ---: | ---: | ---: |
| [#32](https://github.com/marathoner-app/marathoner/issues/32) | Close the cross-client release checklist | Gate residual | 3 | 5 | 8 |
| [#126](https://github.com/marathoner-app/marathoner/issues/126) | Collect and summarize demand and willingness-to-pay evidence | Gate plus participant scheduling | 14 | 19 | 26 |
| [#129](https://github.com/marathoner-app/marathoner/issues/129) | Record the invitation readiness decision | Gate | 2 | 3 | 5 |
| **Wave 06A total** |  |  | **19** | **27** | **39** |

## October 6 remaining-work reconciliation

The September baseline contained 57 pre-invitation rows totaling 236
optimistic, 374 likely, and 571 conservative units. Eighteen of those rows are
now closed. Their original weights total 64, 100, and 155 units, leaving 39
open baseline rows at 172, 274, and 416 units.

The live hierarchy also exposes work that was required by the beta gates but
was not represented as a separate estimate on September 22:

| Issue | Added work | Optimistic | Likely | Conservative |
| --- | --- | ---: | ---: | ---: |
| [#159](https://github.com/marathoner-app/marathoner/issues/159) | Implement live synchronization and account-cache isolation after the #80 decision | 6 | 10 | 15 |
| [#201](https://github.com/marathoner-app/marathoner/issues/201) | Establish the beta billing and Functions deployment boundary | 2 | 4 | 6 |
| [#203](https://github.com/marathoner-app/marathoner/issues/203) | Register distinct development and beta App Check providers | 3 | 5 | 8 |
| [#204](https://github.com/marathoner-app/marathoner/issues/204) | Initialize App Check before Firebase client services | 4 | 6 | 9 |
| [#205](https://github.com/marathoner-app/marathoner/issues/205) | Deploy App Check in observation mode and rehearse rollback | 5 | 8 | 12 |
| [#206](https://github.com/marathoner-app/marathoner/issues/206) | Enforce beta App Check and prove rejected-client behavior | 4 | 6 | 9 |
| **Added-scope total at the initial October 6 recalibration** |  | **24** | **39** | **59** |

No extra estimate is added for #191 because reviewer engagement is contained
within the existing #119 estimate and external-wait allowance. Issues #195
through #197 are the completed decomposition of #79. Issue #162 remains within
the #23 public-surface residual. Issue #161 is an epic represented by #201
through #206. Issue #202 is completed added scope and contributes to the
observed-delivery record rather than remaining work. Production-shell and
material-command foundation children are likewise represented by their
original Wave 01 or downstream parent estimates. These containment rules avoid
charging both a parent and its focused slices.

PR #210 subsequently completed #203 on October 6. Its 3 optimistic, 5 likely,
and 8 conservative units are therefore excluded from current remaining work;
the remaining added-scope subtotal is 21 / 34 / 51.

The authoritative remaining work by wave is therefore:

| Wave | Optimistic | Likely | Conservative |
| --- | ---: | ---: | ---: |
| 02 Intake and Initial Plan | 25 | 40 | 60 |
| 03 Track, Learn, and Adapt, including #159 | 64 | 106 | 162 |
| 04 iOS Daily Companion | 27 | 43 | 65 |
| 05 Trust and External-Beta Readiness, including #201 and #204–#206 | 58 | 92 | 141 |
| Commercial Proof 01, replacing the #126 placeholder | 41 | 63 | 95 |
| 06A Founding Cohort Invitations, excluding moved #126 | 5 | 8 | 13 |
| **Remaining through invitation decision** | **220** | **352** | **536** |

The commercial-proof total is the sum of #211–#218. It replaces rather than
adds to the old #126 row, increasing the remaining scope by 27 optimistic, 44
likely, and 69 conservative units. Issue #126 is therefore represented by its
children and is not charged again.

### Post-invitation reviews

| Issue | Work | Earliest evidence window | Optimistic | Likely | Conservative |
| --- | --- | --- | ---: | ---: | ---: |
| [#130](https://github.com/marathoner-app/marathoner/issues/130) | Two-week operating review | Two weeks after invitations | 2 | 3 | 5 |
| [#131](https://github.com/marathoner-app/marathoner/issues/131) | Four-week validation review | Four weeks after invitations | 2 | 4 | 6 |
| [#128](https://github.com/marathoner-app/marathoner/issues/128) | Eight-week validation review | Eight weeks after invitations | 3 | 5 | 8 |
| **Review-work total** |  |  | **7** | **12** | **19** |

## Work totals

| Boundary | Optimistic | Likely | Conservative |
| --- | ---: | ---: | ---: |
| Remaining legacy estimate units through invitation decision | 220 | 352 | 536 |
| Additional units through the eight-week decision | 7 | 12 | 19 |
| Total through the eight-week decision | 227 | 364 | 555 |

These are planning weights, not measured owner hours. The inventory retains the
open baseline and added-scope rows, with #126 decomposed into #211–#218. Issue
#116 and completed work are excluded. The three post-invitation review issues
remain separate because their evidence windows cannot begin before invitations.

## External elapsed time

External waits do not consume owner sessions, but they can control a gate date.
They must be started as early as their input package allows.

| External dependency | Planning range | How it is modeled | Stop condition |
| --- | --- | --- | --- |
| Qualified reviewer availability | 2–6 calendar weeks to identify and schedule | Start #191 immediately; overlap the wait with non-prescriptive implementation and trust work | If no qualified reviewer is committed when #70 is ready, choose the non-prescriptive fallback or move the date |
| Rules and content review | 1–3 calendar weeks per complete review packet | Owner preparation is in #119, #134, and #135 estimates; reviewer elapsed time is separate | Unapproved high-risk rules or content cannot ship |
| Apple account, signing, and App Store Connect setup | 1–3 calendar weeks as a planning allowance | Begin during the mobile-foundation work; do not wait for Wave 04 | Unresolved ownership or recovery blocks external distribution |
| First external TestFlight review | 1 week likely; 2 weeks conservative including correction allowance | Prioritize #122 early enough to overlap review with the remaining iOS work | No external invitation without an approved build |
| Non-owner device rehearsal | 1–3 calendar weeks to schedule | Book after the first installable candidate exists; owner execution effort is in #122 and #140 | A failed critical journey creates a blocking issue |
| Discovery and participant scheduling | 4–12 calendar weeks | Run #126 across earlier waves while counting every owner session against planned capacity | Invitation readiness cannot claim demand evidence that was not collected |

Apple documents that the first build submitted for external testing receives a
full TestFlight App Review and that later builds may not require one. Apple does
not publish a completion guarantee, so the one- and two-week ranges above are
forecast allowances, not an Apple service-level claim. See Apple's
[TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
and [external tester workflow](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/).

## Gate forecast

The forecast serializes owner work while allowing external scheduling to
overlap. It uses 24 units per week for the optimistic column, 16 for likely,
and 10 for conservative. Dates are rounded to Sunday capacity-week boundaries
beginning October 11, 2026.

The commercial sprint uses four, eight, and twelve calendar weeks for
participant scheduling in the optimistic, likely, and conservative cases. Its
preparation can occupy the existing methodology-review wait, and the Wave 02
foundation may continue when it is safety, research, or trust enabling. The
full adaptation engine waits for both the commercial decision and applicable
qualified approval. Wave 04 retains one optimistic/likely or two conservative
weeks for the first external TestFlight review.

| Evidence gate | Repository target | Optimistic | Likely | Conservative |
| --- | --- | --- | --- | --- |
| Wave 00 Solo Delivery and Beta Contract | October 4, 2026 | Passed September 23 | Passed September 23 | Passed September 23 |
| Wave 01 Shared Mobile Foundation | October 18, 2026 | Passed October 5 | Passed October 5 | Passed October 5 |
| Commercial Proof 01 decision | December 6, 2026 | November 8, 2026 | December 6, 2026 | January 3, 2027 |
| Wave 02 Intake and Initial Plan | November 15, 2026 | October 25, 2026 | November 22, 2026 | January 24, 2027 |
| Wave 03 Track, Learn, and Adapt | December 6, 2026 | November 29, 2026 | January 24, 2027 | May 23, 2027 |
| Wave 04 iOS Daily Companion and external TestFlight review | December 20, 2026 | December 13, 2026 | February 14, 2027 | July 18, 2027 |
| Wave 05 Trust and External-Beta Readiness | January 8, 2027 | January 3, 2027 | March 28, 2027 | October 31, 2027 |
| Wave 06A Invitation decision | January 15, 2027 | January 10, 2027 | April 4, 2027 | November 14, 2027 |
| Wave 06B Two-week operating review | January 29, 2027 | January 24, 2027 | April 18, 2027 | November 28, 2027 |
| Wave 06B Four-week validation review | February 12, 2027 | February 7, 2027 | May 2, 2027 | December 12, 2027 |
| Wave 06C Eight-week validation review | March 12, 2027 | March 7, 2027 | May 30, 2027 | January 9, 2028 |

Review dates include the required observation window and enough planned
sessions to prepare the decision. They are not obtained by relabeling the
invitation date as completed validation.

## Scope-or-date decision

The original January 15 checkpoint is now inside the forecast range, but it is
not the likely case. It follows the optimistic January 10 invitation decision
and precedes the likely April 4 decision. Treating January as a commitment
would require the optimistic delivery rate, the short reviewer path, successful
commercial recruitment and reservations, external TestFlight review, and no
binding correction cycle to occur together. The delivery and commercial
samples do not support making that combination the plan.

The recommended response is therefore:

1. keep all invitation gates in force;
2. treat January 15 as a decision checkpoint rather than an invitation
   expectation;
3. use April 4, 2027 as the current likely forecast and November 14, 2027 as
   the conservative bound;
4. execute #211–#218 now, while #191, #204, and #122 advance when their
   trust and external dependencies permit;
5. condition product payments and the full adaptation engine on the commercial
   gates; and
6. reforecast in #218 from observed participant scheduling, support time, and
   the resulting product decision.

Moving #8, #9, #76, and #77 out of beta milestones would remove only 13 likely
units, less than one likely delivery week. It does not make January the likely
case. No safety, integrity, privacy, qualified-review, deletion, recovery, or
TestFlight gate is a schedule buffer.

## Tiered path to first external learning

The complete invitation forecast should not be confused with the earliest
responsible product experiment.

| Tier | Participant promise | Preliminary owner effort | Forecast at likely capacity |
| --- | --- | ---: | --- |
| Artifact interview and reservation decision | Fifteen to twenty prospects react to fictional concepts; at least ten receive one fixed hosted reservation request | 49 likely units through #211–#216 | December 6 commercial checkpoint, with an earlier stop when a gate fails |
| Constrained concierge entry | Five participants use supplied plans, fictional decisions, or decisions owned by a qualified reviewer; no unreviewed coaching | 11 likely units within the 63-unit commercial total through the first two operating weeks | Included in the December 6 likely commercial checkpoint |
| Functional founding beta | The ratified bounded product works for five to eight participants, with iOS, deterministic rules, and the mandatory safety, privacy, integrity, deletion, and support gates | Product work remains conditional on the commercial and qualified-review decisions | April 4, 2027 likely |
| Diligence-ready founding beta | The complete current milestone scope, including public positioning, market evidence, operational rehearsals, and repository-quality work | 352 likely legacy units remain through invitations | April 4, 2027 likely |

Neither research tier permits unreviewed algorithmic or founder-originated
coaching. The exact trust, access, consent, artifact, refund, support,
withdrawal, and deletion boundaries now live in #211–#217 rather than an
undecomposed placeholder.

## Measured-velocity calibration

The September 22 through October 6 observation window contains:

- 41 merged pull requests and 44 linked issue closures;
- governance, CI, Firebase-boundary, mobile-spike, physical-iPhone,
  production-shell, typed-persistence, onboarding, trust, deletion, and
  dependency work;
- 18 closed baseline estimate rows totaling 64 optimistic, 100 likely, and 155
  conservative units; and
- two passed evidence gates: Wave 00 and Wave 01.

The sample proves that the original eight-unit likely rate understated
AI-assisted delivery. It does not prove a sustainable 50-unit rate. Work was
clustered into seven merge days, owner-attention hours were not consistently
recorded, and the remaining feature and operations work is deeper. The 16-unit
likely rate is therefore a conservative calibration judgment, not an
hours-derived productivity claim.

For the next calibration window, record without private calendar details:

- planned owner-review hours available and used;
- legacy units retired and whether the issue was implementation, device,
  operations, or documentation work;
- material rework or failed acceptance criteria;
- external wait time; and
- whether the 30% reserve was preserved.

Reforecast after Wave 02 passes or four additional delivery weeks, whichever
comes first. The next sample must include #70–#72 or comparable end-to-end
feature work; another documentation-heavy sample may not justify a higher
rate. Do not reduce the owner-understanding requirement to improve the metric.

## Reforecast rules

Reforecast #104 and this document when any of the following occurs:

- Wave 02 passes or four additional delivery weeks provide a feature-heavy
  sample;
- #119 identifies the reviewer and a real review calendar;
- two consecutive weeks retire fewer than ten likely legacy units;
- an external wait reaches its conservative bound;
- an issue's likely estimate changes by more than 25%;
- milestone scope is added, removed, or moved;
- another active maintainer demonstrates sustainable capacity; or
- an evidence gate misses its recorded date.

Each weekly update should record legacy units retired, reserve use, the active
issue, the externally blocked issue, and remaining likely units. Where
available, record aggregate owner-review hours without private calendar
details.

When a gate misses, #104 must record one of: reduce nonessential scope, move the
date, use the research fallback, or change the product contract. Silence is not
a schedule decision.

## Verification against live milestones

The baseline was built from the live subissue hierarchy and open milestone
contents on September 22, 2026. The first recalibration used state through the
merge of #207 on October 6. This same-day correction also removes completed
#203 and incorporates the #211–#218 commercial-proof hierarchy and milestone.

- All open baseline rows and newly exposed critical-path leaves through the
  invitation decision have a three-point estimate or an explicit containment
  rule.
- #4 and #23 retain estimated residual rows because their open parent scope is
  not fully represented by their current children.
- The completed #79 decomposition is not charged again through #195–#197.
- Completed #203 is excluded, and #126 is charged only through #211–#218.
- #191 is contained within #119, #162 within the #23 residual, and #161 within
  #201–#206.
- External elapsed time is separate from owner effort.
- Every repository evidence gate has likely and conservative dates.
- Post-invitation reviews are scheduled from the forecast invitation date, not
  from the historical January target.

Adding a required leaf outside these containment rules, moving milestone scope,
or changing a three-point estimate by more than 25% invalidates the forecast
and triggers the reforecast rule.
