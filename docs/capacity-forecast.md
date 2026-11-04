# Capacity-based founding-beta forecast

- **Status:** Active capacity forecast including automatic completed-run import
- **As of:** November 3, 2026
- **Owner:** Kevin Tulloch
- **Baseline issue:** [#116](https://github.com/marathoner-app/marathoner/issues/116)
- **Recalibration issue:** [#208](https://github.com/marathoner-app/marathoner/issues/208)
- **Strategy realignment:** [#223](https://github.com/marathoner-app/marathoner/issues/223)
- **Entity-path update:** October 21, 2026; [#280](https://github.com/marathoner-app/marathoner/issues/280)
- **Resource-sequencing update:** October 26, 2026; [#439](https://github.com/marathoner-app/marathoner/issues/439)
- **Automatic-import scope update:** October 30, 2026;
  [#616](https://github.com/marathoner-app/marathoner/issues/616),
  [#617](https://github.com/marathoner-app/marathoner/issues/617), and
  reforecast [#625](https://github.com/marathoner-app/marathoner/issues/625)
- **Master tracker:** [#104](https://github.com/marathoner-app/marathoner/issues/104)
- **Scope:** Marathoner beta critical path; Creator Radar is excluded

## How to interpret this snapshot

This forecast preserves the September baseline and October 8 calibration as an
auditable source, then reconciles issue state through November 3 and adds the
automatic-import work accepted in #616. The historical tables remain below;
the November 3 reconciliation, work totals, and gate table are the current
planning output.

The automatic-import estimate covers #618–#624 without charging the #617 epic
again. Completed #618 is recorded but excluded from remaining work. Garmin
provider approval is external elapsed time rather than developer capacity, and
Garmin publishes no approval-time guarantee. The dated scenarios therefore
remain conditional on usable provider access arriving before it controls the
critical path.

The operating partner added in October contributes relationship development,
participant discovery, channel learning, interviews, and feedback. That work
may reduce recruitment uncertainty or create product changes, but it is not
counted as owner-developer capacity. A sustained change in technical capacity,
scope, gates, or external waits triggers the existing reforecast rules.

## Decision summary

From October 8 through November 3, closed baseline rows retired 60 optimistic,
99 likely, and 153 conservative legacy estimate units. That evidence includes
plan approval, daily-use tracking, synchronization, accessibility, rules, and
trust work rather than pull-request count alone. The same period also produced
many focused child issues whose effort remains contained in open parent rows;
they are not double-counted as retired units.

The new import program adds 43 / 70 / 106 units in total. Its completed
provider-neutral contract (#618) accounts for 4 / 6 / 9 of those units, leaving
39 / 64 / 97 import units on the critical path. After reconciling both changes,
158 / 254 / 385 units remain through the invitation decision.

Recent retirement averaged about 27 likely legacy units per week, above the
existing 16-unit likely rate. The window is still concentrated, owner-review
hours remain incomplete, and the remaining work includes native HealthKit,
trusted commands, provider OAuth/push delivery, and physical-device proof. The
forecast therefore preserves the cautious 24 / 16 / 10 weekly rates instead of
treating merge volume as sustainable owner capacity.

The October 8 [product-first decision](product-first-beta-decision.md) removes
the optional 41 / 63 / 95-unit
[commercial proof sprint](commercial-proof-sprint.md) from the beta critical
path. Formal interviews, refundable reservations, and paid concierge evidence
remain unresolved commercial questions, but they no longer control product
implementation or founding-beta invitations.

The October 26
[resource-sequencing decision](internal-first-resource-sequencing.md) keeps
material external spending dormant until applicable implementation and
internal-validation predecessors are complete and the dependency is becoming a
real blocker. This reduces premature and repeat spending. It also means the
forecast dates depend on activating external waits early enough once those
criteria are met; deliberate deferral may move the invitation date rather than
waive a gate.

With those controls, the corrected scope forecasts:

| Scenario | Earliest invitation decision | Meaning |
| --- | --- | --- |
| Optimistic | December 27, 2026 capacity-ready; January 15, 2027 invitation floor | Twenty-four units land per week, provider and reviewer waits overlap, and little rework occurs. The existing contract still prevents invitations before January 15. |
| Likely | February 28, 2027 | Sixteen units land per week, normal integration and correction work occur, and external waits do not exceed the remaining implementation path. |
| Conservative | August 8, 2027 or later | Ten units land per week and high estimates govern. Garmin approval has no published completion bound, so a delayed approval can move this date later. |

These are forecasts, not promises. Invitations remain blocked until the
product and responsibility gates pass, even if a forecast date arrives.
January 15, 2027 falls after the optimistic capacity estimate and before the
likely scenario. It remains an explicit invitation floor and
scope-or-date checkpoint, not a capacity-backed promise.

The optimistic December 27 date means capacity work could finish before
the invitation floor. It does not authorize invitations before January 15 in
#104. Opening earlier would require an explicit founding-beta contract change;
this forecast changes planning evidence, not the participant promise.

The recommended planning expectation is February 28, 2027 while preserving
every ratified safety, integrity, privacy, provider, and review gate. If product
work finishes before qualified or provider approval, use an explicitly approved
narrower cohort or wait rather than silently weakening those gates.

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
| Initial observed window | September 22 through October 6, 2026; two delivery weeks |
| Current reconciliation window | October 8 through November 3, 2026; 26 elapsed days |
| Current measured delivery | 22 additional baseline or added-scope forecast rows closed; 60 optimistic, 99 likely, and 153 conservative legacy estimate units retired |
| Context only, not capacity | Focused child issues and pull requests demonstrate integration progress but are not converted into owner hours or extra retired units while their estimated parent remains open |
| Forecast delivery rate | 24 optimistic, 16 likely, and 10 conservative legacy estimate units per week |
| Current rate check | About 27 likely legacy units retired per elapsed week; the 16-unit likely forecast remains a deliberate haircut for deeper remaining work and incomplete owner-hour evidence |
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

The rate haircut is deliberate. Recent work mixed complete user journeys with
documentation, architecture, bounded infrastructure, and many small children
whose parent gates remain open. The remaining work contains native HealthKit,
provider OAuth and push delivery, trusted mutations, methodology reconciliation,
physical-device proof, and live operations. Those are expected to require more
owner judgment and correction. The likely model retains the prior twofold gain
over the original eight-unit weekly plan rather than extending a concentrated
delivery window linearly.

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
| [#129](https://github.com/marathoner-app/marathoner/issues/129) | Record the invitation readiness decision | Gate | 2 | 3 | 5 |
| **Wave 06A total** |  |  | **5** | **8** | **13** |

## October 8 critical-path reconciliation

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
| 06A Founding Cohort Invitations | 5 | 8 | 13 |
| **Remaining through invitation decision** | **179** | **289** | **441** |

The optional commercial-proof total of 41 / 63 / 95 units is excluded from
these beta totals by #223. Issues #211–#214 are completed preparation and
#215–#218 are retired from this critical path. The estimates remain documented
in the dormant commercial plan if that work is reactivated later.

## November 3 critical-path reconciliation

The October 8 table is retained as the auditable starting point. Since that
calibration, the following estimated rows closed:

- Wave 02: #71 and #72, retiring 11 / 18 / 27 units;
- Wave 03: #62, #73–#77, #114, and #159, retiring 21 / 35 / 54 units; and
- Wave 05: #3, #4, #8, #9, #60, #61, #63, #64, #127, #143, #201, and #204,
  retiring 28 / 46 / 72 units.

Together those 22 rows retire 60 / 99 / 153 units. Focused children completed
inside still-open estimated parents are evidence of progress but do not retire
the parent weight. This keeps the reconciliation conservative and avoids
turning issue or pull-request volume into owner hours.

The October 30 automatic-import decision adds these three-point estimates under
the existing estimate rules:

| Issue | Work | Type | Optimistic | Likely | Conservative | Remaining on November 3 |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| [#618](https://github.com/marathoner-app/marathoner/issues/618) | Provider-neutral completed-activity contract | Shared contract | 4 | 6 | 9 | Completed; 0 / 0 / 0 |
| [#619](https://github.com/marathoner-app/marathoner/issues/619) | Trusted imported-run persistence and emulator proof | Gate | 6 | 10 | 15 | 6 / 10 / 15 |
| [#620](https://github.com/marathoner-app/marathoner/issues/620) | HealthKit bridge, normalization, and physical-iPhone proof | Gate plus device evidence | 8 | 13 | 20 | 8 / 13 / 20 |
| [#621](https://github.com/marathoner-app/marathoner/issues/621) | Imported-run enrichment and duplicate-review UI | Gate | 5 | 8 | 12 | 5 / 8 / 12 |
| [#622](https://github.com/marathoner-app/marathoner/issues/622) | Truthful Garmin Starter Activity API application | Gate plus external wait | 2 | 3 | 5 | 2 / 3 / 5 |
| [#623](https://github.com/marathoner-app/marathoner/issues/623) | Garmin OAuth, push ingestion, recovery, and limited-account proof | Gate plus external wait | 12 | 20 | 30 | 12 / 20 / 30 |
| [#624](https://github.com/marathoner-app/marathoner/issues/624) | Cross-provider physical-device and failure-state proof | Gate plus device evidence | 6 | 10 | 15 | 6 / 10 / 15 |
| **Automatic-import total** |  |  | **43** | **70** | **106** | **39 / 64 / 97** |

Issue #617 is the delivery epic and adds no separate implementation weight.
Garmin's review time also adds no owner-capacity units; it is modeled under
external elapsed time below.

The current remaining work by wave is:

| Wave | Legacy or prior added scope | Automatic import | Current optimistic | Current likely | Current conservative |
| --- | ---: | ---: | ---: | ---: | ---: |
| 02 Intake and Initial Plan | 14 / 22 / 33 | 0 / 0 / 0 | 14 | 22 | 33 |
| 03 Track, Learn, and Adapt | 43 / 71 / 108 | 8 / 13 / 20 (#619, #622) | 51 | 84 | 128 |
| 04 iOS Daily Companion | 27 / 43 / 65 | 13 / 21 / 32 (#620, #621) | 40 | 64 | 97 |
| 05 Trust and External-Beta Readiness | 30 / 46 / 69 | 18 / 30 / 45 (#623, #624) | 48 | 76 | 114 |
| 06A Founding Cohort Invitations | 5 / 8 / 13 | 0 / 0 / 0 | 5 | 8 | 13 |
| **Remaining through invitation decision** | **119 / 190 / 288** | **39 / 64 / 97** | **158** | **254** | **385** |

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
| Remaining legacy and prior added-scope units through invitation decision | 119 | 190 | 288 |
| Remaining automatic-import units through invitation decision | 39 | 64 | 97 |
| Total remaining units through invitation decision | 158 | 254 | 385 |
| Additional units through the eight-week decision | 7 | 12 | 19 |
| Total through the eight-week decision | 165 | 266 | 404 |

These are planning weights, not measured owner hours. The inventory retains the
open product baseline, prior added scope, and automatic-import rows. Optional
commercial-research issues are not charged. Issue #116, completed #618, and
other completed work are excluded from remaining totals. The three post-
invitation review issues remain separate because their evidence windows cannot
begin before invitations.

## External elapsed time

External waits do not consume owner sessions, but they can control a gate date.
Start them when the required input is stable, practical internal predecessors
are complete, and the wait is approaching the critical path. Preparation alone
does not justify material spending.

| External dependency | Planning range | How it is modeled | Stop condition |
| --- | --- | --- | --- |
| Qualified reviewer availability | 2–6 calendar weeks to identify and schedule | Keep the combined packet ready; activate #191 when the prescriptive journey is stable and internally testable and the wait is within the next four to six weeks of blocking external beta | If review remains unavailable when internal predecessors are complete, choose the non-prescriptive fallback or move the date |
| Rules and content review | 1–3 calendar weeks per complete review packet | Owner preparation is in #119, #134, and #135 estimates; reviewer elapsed time is separate | Unapproved high-risk rules or content cannot ship |
| Garmin Starter Activity API approval | No published approval-time guarantee; Garmin says a typical integration takes 1–4 weeks after approval | Submit #622 before the wait controls Wave 05; #623 owner work is estimated separately and cannot start until usable access and terms exist | If approval is not usable when #623 reaches the active path, explicitly move the invitation date or approve a cohort limited to ecosystems with a verified automatic path |
| California entity formation, D-U-N-S synchronization, Apple organization enrollment, signing, and App Store Connect setup | 1–3 calendar weeks after accepted formation as a planning allowance | Preserve the prepared [#281](https://github.com/marathoner-app/marathoner/issues/281) path and continue Personal Team development; activate the paid path when organization identity, App Attest, or external distribution is within the next four to six weeks of becoming the blocker | The Personal Team cannot supply the intended seller identity or App Attest profile; unresolved enrollment blocks #205 beta proof and external distribution |
| First external TestFlight review | 1 week likely; 2 weeks conservative including correction allowance | Prioritize #122 early enough to overlap review with the remaining iOS work | No external invitation without an approved build |
| Non-owner device rehearsal | 1–3 calendar weeks to schedule | Book after the first installable candidate exists; owner execution effort is in #122 and #140 | A failed critical journey creates a blocking issue |

Apple documents that a new D-U-N-S record can take up to five business days and
then up to two additional business days to become available to Apple. Neither
California nor Apple publishes a completion guarantee for the full formation
and organization-enrollment path, so the one-to-three-week range is a forecast
allowance after accepted formation, not a service-level claim. Start the
[entity and enrollment path](operations/legal-entity-and-apple-enrollment.md)
when its activation test passes; it does not block ordinary web or Personal
Team development, but it eventually controls App Attest and external
distribution.

Garmin's current program overview identifies Starter Business access as the
entry point for organizations and includes push-only Activity API delivery with
limited user capacity. Its FAQ says access follows approval and describes a
typical integration as one to four weeks, but it does not publish a duration or
guarantee for the approval itself. See Garmin's
[program overview](https://developer.garmin.com/gc-developer-program/overview/)
and [program FAQ](https://developer.garmin.com/gc-developer-program/enterprise/program-faq/).
The forecast therefore does not convert approval time into owner units or
pretend the August conservative capacity date bounds the provider wait.

Apple documents that the first build submitted for external testing receives a
full TestFlight App Review and that later builds may not require one. Apple does
not publish a completion guarantee, so the one- and two-week ranges above are
forecast allowances, not an Apple service-level claim. See Apple's
[TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
and [external tester workflow](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/).

## Gate forecast

The forecast serializes owner work while allowing external scheduling to
overlap. It uses 24 units per week for the optimistic column, 16 for likely,
and 10 for conservative. The November 3 checkpoint falls inside a capacity
week, so the partial week is excluded and dates use full Sunday-ending weeks
beginning November 15, 2026.

The product waves serialize owner capacity while qualified-review, Garmin,
Apple, and TestFlight elapsed time overlap as their inputs become ready. The
bounded adaptation engine waits for applicable qualified approval, not a
commercial decision. Wave 04 retains one optimistic/likely or two conservative
weeks for the first external TestFlight review; later owner work can continue
while that review is pending. Dated provider-complete gates also require usable
Garmin access and therefore can move later than the capacity dates.

| Evidence gate | Repository target | Optimistic | Likely | Conservative |
| --- | --- | --- | --- | --- |
| Wave 00 Solo Delivery and Beta Contract | October 4, 2026 | Passed September 23 | Passed September 23 | Passed September 23 |
| Wave 01 Shared Mobile Foundation | October 18, 2026 | Passed October 5 | Passed October 5 | Passed October 5 |
| Wave 02 Intake and Initial Plan | November 15, 2026 | November 15, 2026 | November 22, 2026 | December 6, 2026 |
| Wave 03 Track, Learn, and Adapt | December 6, 2026 | November 29, 2026 | December 27, 2026 | March 7, 2027 |
| Wave 04 iOS Daily Companion and external TestFlight review | December 20, 2026 | December 20, 2026 | January 31, 2027 | May 23, 2027 |
| Wave 05 Trust and External-Beta Readiness | January 8, 2027 | December 27, 2026 capacity; provider access required | February 28, 2027 capacity; provider access required | August 1, 2027 capacity; provider access required |
| Wave 06A Invitation decision | January 15, 2027 | December 27 capacity-ready; January 15 floor | February 28, 2027 | August 8, 2027 or later |
| Wave 06B Two-week operating review | January 29, 2027 | January 29, 2027 | March 14, 2027 | August 22, 2027 or later |
| Wave 06B Four-week validation review | February 12, 2027 | February 12, 2027 | March 28, 2027 | September 5, 2027 or later |
| Wave 06C Eight-week validation review | March 12, 2027 | March 12, 2027 | April 25, 2027 | October 3, 2027 or later |

Review dates include the required observation window and enough planned
sessions to prepare the decision. They are not obtained by relabeling the
invitation date as completed validation.

## Scope-or-date decision

The original January 15 checkpoint remains inside the forecast range. It
follows the optimistic December 27 capacity date and precedes the likely
February 28 decision. Treating January as a commitment would require the
optimistic delivery rate, usable Garmin access, the short reviewer path,
external TestFlight review, and no binding correction cycle to occur together.
The delivery sample does not support making that combination the plan.

The recommended response is therefore:

1. keep all invitation gates in force;
2. treat January 15 as a decision checkpoint rather than an invitation
   expectation;
3. plan around February 28, 2027 as the likely capacity-backed invitation
   decision and August 8, 2027 as the conservative capacity date, while
   recognizing Garmin approval can move either later;
4. prioritize the product waves while #191, #281/#205, and #122 advance when
   their trust and external dependencies permit, and submit #622 before Garmin
   approval controls the critical path;
5. keep product payments outside beta and condition bounded adaptation on
   qualified review rather than payment evidence; and
6. preserve the intended HealthKit and direct-Garmin cohort for now. If Garmin
   access becomes the controlling delay, make a separate explicit decision to
   move the date or narrow the cohort; do not fall back silently to manual
   logging.

Moving #8, #9, #76, and #77 out of beta milestones would remove only 13 likely
units, less than one likely delivery week. It does not make January the likely
case. No safety, integrity, privacy, qualified-review, deletion, recovery, or
TestFlight gate is a schedule buffer.

## Tiered path to first external learning

The complete invitation forecast should not be confused with the earliest
responsible product experiment.

| Tier | Participant promise | Preliminary owner effort | Forecast at likely capacity |
| --- | --- | ---: | --- |
| Internal functional candidate | The end-to-end product journey works for the owner on web and iOS, without claiming external readiness | Included in Waves 02–04 | January 31, 2027 likely after the first TestFlight review allowance |
| Functional founding beta | The ratified bounded product works for five to eight participants, with verified automatic import for each included ecosystem plus the mandatory methodology, safety, privacy, integrity, deletion, and support gates | 254 likely units remain through invitations | February 28, 2027 likely if provider access does not control the gate |
| Optional commercial evidence | Formal interviews, payment behavior, and acquisition evidence are collected only after a later activation decision | Excluded from beta totals; prior reference estimate is 63 likely units | No active date and no beta dependency |

No tier permits unreviewed algorithmic or founder-originated coaching. Optional
commercial research does not substitute for live-product safety, privacy,
integrity, deletion, release, or support evidence.

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

The October 8 through November 3 reconciliation adds a more feature-heavy
sample: 22 estimated rows closed and 99 likely legacy units retired over 26
elapsed days, or about 27 likely units per week. Plan approval, Track and
Analyze daily-use work, synchronization, accessibility, Firestore rules, and
operator controls are represented. Numerous smaller child issues also merged,
but they do not retire additional units while their estimated parent remains
open. Because native provider integration and live external gates are not yet
represented in the sample, the 24 / 16 / 10 forecast rates remain unchanged.

For the next calibration window, record without private calendar details:

- planned owner-review hours available and used;
- legacy units retired and whether the issue was implementation, device,
  operations, or documentation work;
- material rework or failed acceptance criteria;
- external wait time; and
- whether the 30% reserve was preserved.

Reforecast after Wave 02 passes, Garmin returns a material provider decision,
or four additional delivery weeks pass, whichever comes first. The next sample
should include #619–#621 or comparable native/trusted integration work; another
documentation-heavy sample may not justify a higher rate. Do not reduce the
owner-understanding requirement to improve the metric.

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
merge of #207 on October 6. The October 8 strategy correction removed optional
#211–#218 commercial proof from beta totals. This November 3 reconciliation
uses issue state through merged #618 and adds #618–#624 explicitly.

- All open baseline rows and newly exposed critical-path leaves through the
  invitation decision have a three-point estimate or an explicit containment
  rule; #618–#624 now have their own estimate table.
- #4 and #23 retain estimated residual rows because their open parent scope is
  not fully represented by their current children.
- The completed #79 decomposition is not charged again through #195–#197.
- Completed #203 is excluded, and #126 plus #211–#218 carry no beta-critical
  capacity.
- Completed #618 is recorded in the import estimate but excluded from remaining
  work; #617 is an epic and is not charged again.
- #191 is contained within #119, #162 within the #23 residual, and #161 within
  #201–#206.
- External elapsed time is separate from owner effort, including Garmin access
  review, which has no published approval-time guarantee.
- Every repository evidence gate has likely and conservative dates.
- Post-invitation reviews are scheduled from the forecast invitation date, not
  from the historical January target.

Adding a required leaf outside these containment rules, moving milestone scope,
or changing a three-point estimate by more than 25% invalidates the forecast
and triggers the reforecast rule.
