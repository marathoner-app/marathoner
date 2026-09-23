# Capacity-based founding-beta forecast

- **Status:** Baseline forecast for owner decision
- **As of:** September 22, 2026
- **Owner:** Kevin Tulloch
- **Forecast issue:** [#116](https://github.com/marathoner-app/marathoner/issues/116)
- **Master tracker:** [#104](https://github.com/marathoner-app/marathoner/issues/104)
- **Scope:** Marathoner beta critical path; Creator Radar is excluded

## Decision summary

The current founding-beta scope is not supportable by the January 15, 2027
invitation target at the repository's stated solo-owner capacity.

With the assumptions below, the current scope forecasts:

| Scenario | Earliest invitation decision | Meaning |
| --- | --- | --- |
| Optimistic | November 14, 2027 | Most work lands at the low estimate, external waits overlap, and no material rework occurs. |
| Likely | July 16, 2028 | Work lands near the likely estimate and the first external TestFlight review receives one week of calendar buffer. |
| Conservative | July 1, 2029 | Work lands near the high estimate and external review or rework consumes two additional weeks. |

These are forecasts, not promises. Invitations remain blocked until the
evidence gates pass, even if a forecast date arrives. January 15, 2027 remains
an explicit scope-or-date decision checkpoint, not a capacity-backed launch or
invitation date.

The recommended decision is to move the invitation expectation and keep the
ratified safety, integrity, privacy, and review gates. If an earlier research
study is strategically necessary, use the already approved non-prescriptive
fallback instead of silently weakening those gates.

## Capacity model

A focused session is 60 to 90 minutes of owner attention. Estimates include
implementation, tests, documentation, review preparation, and the normal
issue-to-pull-request handoff. They do not include unattended CI time or an
external party's elapsed time.

| Input | Baseline |
| --- | --- |
| Sustainable owner capacity | 6 focused sessions per week |
| Planned delivery allocation | 4 sessions per week |
| Reserve | 2 sessions per week, or 33% |
| Reserve use | Review, support, defects, operational work, and estimate uncertainty |
| Work in progress | One active implementation issue plus one externally blocked issue |
| Forecast week | Ends Sunday; partial work is rounded to the next forecast week |
| Known blackout periods | None are recorded in the public repository; no blackout credit is assumed |

The reserve is not pre-spent on feature work. If it is unused, the forecast may
improve at the next reforecast; it is not used to make the baseline appear
faster. Personal blackout details do not belong in the public repository. A
future blackout should be represented only as a reduced session count for the
affected week.

The baseline begins with the week ending September 27, 2026. Issue #116 is
estimated and recorded below for completeness, but its completed forecast work
is excluded from remaining-capacity totals.

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

## Three-point estimates

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
| Remaining owner sessions through invitation decision | 236 | 374 | 571 |
| Additional owner sessions through the eight-week decision | 7 | 12 | 19 |
| Total through the eight-week decision | 243 | 386 | 590 |

The invitation total covers 57 remaining leaf or residual work items across
Waves 00 through 06A. Issue #116 is the fifty-eighth item in the inventory but
is excluded from remaining totals because this document completes it. The
three post-invitation review issues bring the complete estimated set to 61
items.

## External elapsed time

External waits do not consume owner sessions, but they can control a gate date.
They must be started as early as their input package allows.

| External dependency | Planning range | How it is modeled | Stop condition |
| --- | --- | --- | --- |
| Qualified reviewer availability | 2–6 calendar weeks to identify and schedule | Start #119 before generator work; overlap the wait with contracts, profile, and onboarding work | If no qualified reviewer is committed when #70 is ready, choose the non-prescriptive fallback or move the date |
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

The forecast serializes planned owner sessions because the working agreement
limits active implementation work. External waits may overlap when the listed
input package is ready. Dates are rounded to the end of a capacity week. The
Wave 04 and later likely and conservative dates include TestFlight buffer.

| Evidence gate | Repository target | Optimistic | Likely | Conservative |
| --- | --- | --- | --- | --- |
| Wave 00 Solo Delivery and Beta Contract | October 4, 2026 | October 4, 2026 | October 11, 2026 | October 18, 2026 |
| Wave 01 Shared Mobile Foundation | October 18, 2026 | December 6, 2026 | January 10, 2027 | March 14, 2027 |
| Wave 02 Intake and Initial Plan | November 15, 2026 | February 7, 2027 | April 25, 2027 | August 15, 2027 |
| Wave 03 Track, Learn, and Adapt | December 6, 2026 | May 16, 2027 | October 10, 2027 | April 30, 2028 |
| Wave 04 iOS Daily Companion | December 20, 2026 | July 11, 2027 | January 2, 2028 | September 3, 2028 |
| Wave 05 Trust and External-Beta Readiness | January 8, 2027 | October 17, 2027 | May 28, 2028 | April 22, 2029 |
| Wave 06A Invitation decision | January 15, 2027 | November 14, 2027 | July 16, 2028 | July 1, 2029 |
| Wave 06B Two-week operating review | January 29, 2027 | December 5, 2027 | August 6, 2028 | July 29, 2029 |
| Wave 06B Four-week validation review | February 12, 2027 | December 19, 2027 | August 20, 2028 | August 12, 2029 |
| Wave 06C Eight-week validation review | March 12, 2027 | January 16, 2028 | September 24, 2028 | September 9, 2029 |

Review dates include the required observation window and enough planned
sessions to prepare the decision. They are not obtained by relabeling the
invitation date as completed validation.

## Scope-or-date decision

The January target is not recoverable through normal estimate variance. Meeting
January 15 with the likely scope would require roughly 23 planned sessions per
week before reserve. At 60 to 90 minutes per session and a 35% reserve, that is
approximately 35 total sessions, or 35 to 53 hours, every week in addition to
the owner's full-time job and other commitments.

The recommended response is therefore:

1. keep all invitation gates in force;
2. treat January 15 as a decision checkpoint rather than an invitation
   expectation;
3. use July 16, 2028 as the current likely forecast and July 1, 2029 as the
   conservative forecast until measured throughput replaces assumptions;
4. reforecast immediately after the mobile ADR in #83; and
5. choose explicitly among a later date, the non-prescriptive research
   fallback, or a materially narrower gate contract.

Moving #8, #9, #76, and #77 out of beta milestones would remove only 13 likely
sessions. It would improve the forecast by about three weeks, not rescue the
January date. No safety, integrity, privacy, qualified-review, deletion,
recovery, or TestFlight gate is a schedule buffer.

## Reforecast rules

Reforecast #104 and this document when any of the following occurs:

- #83 selects the mobile architecture and replaces spike uncertainty with
  measured implementation throughput;
- #119 identifies the reviewer and a real review calendar;
- two consecutive weeks deliver fewer than four planned sessions;
- an external wait reaches its conservative bound;
- an issue's likely estimate changes by more than 25%;
- milestone scope is added, removed, or moved;
- another active maintainer demonstrates sustainable capacity; or
- an evidence gate misses its recorded date.

Each weekly update should record planned sessions completed, reserve sessions
used, active issue, externally blocked issue, and remaining likely sessions.
Do not record private calendar details.

When a gate misses, #104 must record one of: reduce nonessential scope, move the
date, use the research fallback, or change the product contract. Silence is not
a schedule decision.

## Verification against live milestones

This forecast was built from the live subissue hierarchy and open milestone
contents on September 22, 2026.

- All open critical-path leaves through the invitation decision have a
  three-point estimate.
- #4 and #23 retain estimated residual rows because their open parent scope is
  not fully represented by their current children.
- #79 is estimated but must be split after its deletion design is approved.
- External elapsed time is separate from owner effort.
- Every repository evidence gate has likely and conservative dates.
- Post-invitation reviews are scheduled from the forecast invitation date, not
  from the historical January target.

Closing or adding an issue without updating this inventory invalidates the
forecast and triggers the reforecast rule.
