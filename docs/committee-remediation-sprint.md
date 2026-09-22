# Committee remediation sprint

- **Status:** Active
- **Started:** September 22, 2026
- **Owner:** Kevin Tulloch
- **Review scope:** The Marathoner product repository, excluding Creator Radar
- **Parent tracker:** [GitHub issue #104](https://github.com/marathoner-app/marathoner/issues/104)
- **Current delivery slice:** [GitHub issue #55](https://github.com/marathoner-app/marathoner/issues/55)
- **Related plans:** [Zero-to-beta plan](zero-to-beta-plan.md),
  [product vision](product-vision.md), and
  [founding cohort plan](founding-cohort-plan.md)

## Purpose

This is the canonical remediation backlog produced from the September 22,
2026 product, investor, architecture, mobile, delivery, and operations review.
It turns the committee's findings into ordered work, evidence gates, and
explicit stop conditions.

The review concluded that Marathoner is a credible foundation-stage product,
not a finished or investment-proven application. The repository explains the
problem and intended experience well. It does not yet contain enough evidence
to treat the January founding-beta date, safety model, cross-client behavior,
or market case as confirmed.

The purpose of this sprint is to close that gap. A checklist item is complete
only when its evidence is linked from the responsible GitHub issue. Roadmap
prose, an implementation claim, or a passing happy-path demonstration is not
completion by itself.

This document records remediation requirements. When it identifies a conflict
with an existing product contract, milestone, or issue, the existing source
remains in force until a focused pull request or GitHub update resolves the
conflict. The conflict must stay visible in the backlog until then.

## Committee decision

The current investment and release posture is:

- Marathoner is suitable for continued thesis-stage development and
  milestone-based diligence.
- January 15, 2027 remains a conditional target, not a delivery promise.
- External invitations are blocked until the invitation gate in this document
  passes.
- Prescriptive plan generation, adaptation, pain escalation, fueling, and
  recovery guidance require qualified review for the exact supported beta
  slice before invitations open.
- The first beta should prove one narrow first-marathon workflow before adding
  more starting segments, broad adaptation, native depth, integrations, or
  acquisition scale.

## Working beta direction

Issue #81 must ratify the final contract. The committee recommends that the
first supported slice use these constraints:

- Start with five to eight allowlisted adults who already run consistently and
  are preparing for a first marathon.
- Support one reviewed plan family or a small set of deterministic variants.
- Limit early adaptation to reschedule, hold, or repeat actions.
- Do not provide autonomous intensity increases, injury diagnosis, finish-time
  promises, or broad feasibility coaching.
- Require a network connection for material writes. Unsupported offline writes
  must fail honestly instead of appearing saved.
- Use the web application for intake, plan review, configuration, and history.
- Use the iOS beta for today's workout, completion, effort, optional notes,
  shoes, bounded adjustment review, support, and deletion initiation.
- Defer Android external distribution, integrations, payments, AI, GPS, push
  notifications, and health-platform data.
- Begin with five to eight participants, review the first two weeks, and expand
  only when safety and support capacity remain acceptable.

If qualified methodology review is unavailable, the fallback is a
non-prescriptive research beta using a participant-supplied or individually
human-reviewed plan. Experimental labeling alone is not sufficient for
algorithmic training or pain recommendations.

## Definition of sprint completion

This remediation sprint is complete when:

1. Every item in the remediation register has a focused GitHub issue, owner,
   dependencies, acceptance criteria, and evidence link.
2. The README, product vision, zero-to-beta plan, cohort plan, milestone dates,
   and live issue hierarchy agree on the supported beta contract.
3. A capacity forecast supports the target date, or the target date has been
   changed explicitly.
4. The Wave 01 and invitation gates below have passed with recorded evidence.
5. The four-week and eight-week reviews are scheduled after invitations rather
   than represented as January 15 launch deliverables.
6. Market and participant evidence has replaced the most important demand,
   differentiation, and willingness-to-pay assumptions.

## Remediation register

Priority describes consequence, not the order in which code must be written.
Critical items can have prerequisites in earlier high-priority work.

| ID | Priority | Type | Required outcome | Existing home | Gate | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CR-01 | Critical | Safety | Name the qualified reviewer role and obtain dated approval for the supported rules, eligibility, escalation boundaries, and guidance. | #70, #107 | Invitations | Not started |
| CR-02 | Critical | Product | Ratify one narrow beta segment, participant count, adaptation boundary, client capability matrix, and explicit exclusions. | #81, #104 | Wave 00 | Not started |
| CR-03 | Critical | Investment | Record problem evidence, alternatives, differentiation, participant commitments, and willingness-to-pay signals. | #35, #110 | Cohort expansion | Not started |
| CR-04 | High | Governance | Repair contradictory platform, parent, milestone, design, audit, and current-state sources. | #54, #55, #104 | Wave 00 | In progress |
| CR-05 | High | Delivery | Decompose #105 through #110 into owner-sized child issues with dependencies and evidence-based exit criteria. | #104–#110 | Wave 00 | Not started |
| CR-06 | High | Delivery | Produce a capacity model and likely/conservative forecast using focused sessions, external wait time, and 60–70% planned utilization. | #54, #104 | Wave 00 | Not started |
| CR-07 | High | Quality | Run lint, tests, typecheck/build, and Firestore emulator checks on pull requests and make required checks visible before merge. | #56, #57 | Wave 00 | Not started |
| CR-08 | High | Mobile | Compare Capacitor, Expo with Firebase JS, and Expo with React Native Firebase on a physical-iPhone vertical slice; approve the ADR from evidence. | #33, #83–#89 | Wave 01 | Not started |
| CR-09 | High | Architecture | Make completion, plan approval, and adjustment writes atomic and idempotent; enforce one active plan and stale-write rejection. | #72, #105, #107 | Invitations | Not started |
| CR-10 | High | Security | Enforce allowlisted beta access, verified-email writes, supported schema/rules versions, bounded fields, immutable ownership, and negative rules tests. | #87, #107, #109 | Invitations | Not started |
| CR-11 | High | Operations | Separate development and beta Firebase environments and prevent local or spike commands from reaching participant data. | #22, #83, #109 | Wave 01 | Not started |
| CR-12 | High | Safety | Store versioned recommendation evidence and provide a rehearsed remote generation, guidance, and adaptation kill switch. | #105, #107 | Invitations | Not started |
| CR-13 | High | Privacy | Provide consent, limitations, password reset, support, withdrawal, deletion initiation, and a rehearsed complete deletion procedure. | #78, #79, #109 | Invitations | Not started |
| CR-14 | High | Recovery | Document and rehearse export/restore, incident response, participant support, recruitment pause, and critical-failure visibility. | #107, #109 | Invitations | Not started |
| CR-15 | High | Release | Establish Apple ownership and signing early; obtain an external-testable build and complete a non-owner journey before readiness week. | #108 | Invitations | Not started |
| CR-16 | High | Validation | Precommit activation, comprehension, trust, safety, engagement, support-burden, and pause thresholds before observing cohort results. | #35, #110 | Invitations | Not started |
| CR-17 | Medium | Trust | Make the public surface explain the product's current readiness and route prospective users to an honest waitlist or bounded beta path. | #23, #109 | Recruitment | Not started |
| CR-18 | Medium | Maintainability | Use additive schema compatibility, current/previous-version fixtures, and one documented migration pattern without building a generalized platform. | #69, #80, #83 | Invitations | Not started |
| CR-19 | Medium | Economics | Record support cost, acquisition assumptions, retention hypotheses, pricing tests, and bounded lifetime-value logic. | #35, #110 | Investment review | Not started |
| CR-20 | Medium | Governance | Add missing contribution, security, ownership, and repository metadata appropriate to a public investor-visible project. | #19, #58, #59 | Wave 00 | Not started |

Some existing issues do not yet cover the complete required outcome. The first
administrative task is to add focused child issues rather than silently expand
unrelated implementation issues.

## Sprint 01: restore truth and delivery control

- **Timebox:** September 22 through October 4, 2026
- **Parent:** #54 and #104
- **Objective:** Make the beta contract and execution system trustworthy before
  feature volume grows.

### Ordered backlog

1. **Publish this remediation register and repository navigation.**
   - Owner: Kevin Tulloch
   - Issue: #55
   - Evidence: merged document, working links, successful repository checks.
2. **Ratify the narrowed beta contract.**
   - Owner: Kevin Tulloch
   - Issue: #81
   - Evidence: README, product vision, zero-to-beta plan, cohort plan, #104, and
     milestones agree on segment, participant count, clients, adaptation, and
     exclusions.
3. **Repair live issue truth.**
   - Create a focused issue under #54.
   - Correct stale parent declarations, remove Android beta requirements from
     #23, update obsolete current-state descriptions, and close or supersede
     stale draft work explicitly.
4. **Make pull requests prove repository health.**
   - Issues: #56 and #57.
   - Evidence: pull requests run lint, unit tests, typecheck/build, and Firestore
     emulator tests; the template asks for the same checks as the working
     agreement.
5. **Finish the solo issue-to-merge workflow.**
   - Issues: #58 and #59.
   - Evidence: focused issue templates and a contribution guide explain branch,
     verification, review, merge, and evidence expectations.
6. **Add the capacity forecast.**
   - Create a focused issue under #54.
   - Estimate leaf issues in focused sessions with optimistic, likely, and
     conservative values; reserve 30–40% capacity; include Apple and reviewer
     wait time; publish likely and conservative gate dates.
7. **Create methodology-review work.**
   - Create focused child issues under #107 and prerequisites for #70.
   - Record reviewer qualifications, rule inventory, review scope, approval
     evidence, unsupported cases, and change-control process.
8. **Contain premature external use.**
   - Create a focused child issue under #109.
   - Decide whether to disable public signup or add prototype limitations,
     privacy, support, withdrawal, and deletion-request paths immediately.
9. **Decompose the critical outcome epics.**
   - Issues: #105 through #110.
   - Add child issues and dependencies for adaptation rules and audit, guidance
     content and triggers, safety controls, iOS delivery, beta operations, and
     post-invitation reviews.
10. **Record the first validation plan.**
    - Create a focused child issue under #110.
    - Choose one initial segment; define interview evidence, beta commitment,
      willingness-to-pay questions, metric thresholds, and private research
      storage.

### Sprint 01 exit evidence

- All canonical sources describe the same beta.
- Every CR-01 through CR-20 item has an issue home and dependency placement.
- #105 through #110 have executable child issues.
- Pull-request checks run before merge.
- A capacity-based forecast is recorded.
- The methodology reviewer and review scope are identified, or the product is
  explicitly reduced to the non-prescriptive fallback.
- The public signup posture has an explicit, implemented decision.

## Wave 01 gate: prove the client foundation

Wave 01 may close only when all of the following evidence exists:

- A scorecard compares Capacitor, Expo with the Firebase JS SDK, and Expo with
  React Native Firebase against the same vertical slice.
- A clean checkout produces the selected signed iOS build from documented
  commands.
- A physical iPhone passes sign-in, process-kill/relaunch recovery, logout, and
  account-switch/cache checks.
- One versioned record written on iOS can be read on web, and vice versa.
- Unsupported or offline material writes fail visibly and honestly.
- Development and beta Firebase projects are visibly distinct.
- The deployed web application remains unchanged by the spike.
- Issue #83 explains why the selected approach won and why the other two lost.
- If Expo with the Firebase JS SDK wins, Firebase is upgraded to the version
  required by the current Expo guidance and the upgrade is verified before
  shared extraction. If React Native Firebase wins, web and native adapters
  remain separate. If Capacitor wins, the existing web SDK is verified inside
  the iOS shell.
- Apple Developer membership, team ownership, bundle ID, App Store Connect,
  signing recovery, and export-compliance ownership are recorded.

If neither Capacitor nor Expo proves session recovery and shared-record
behavior on a physical iPhone, move the date or run a web-only research study.
Do not create a custom offline synchronization engine.

## Invitation gate: prove the beta is responsible

Invitations may open only when:

### Methodology and product boundary

- A named qualified role has provided dated approval for eligibility,
  progression, hold/repeat rules, race-date rejection, pain escalation, and the
  supported fueling and recovery content.
- Unsupported cases are rejected rather than improvised.
- The client capability matrix and participant promise match implemented
  behavior.

### Data integrity and security

- Planned completion has deterministic uniqueness.
- Run creation and workout completion are one atomic operation.
- Plan approval is idempotent and cannot expose a partial active plan.
- One-active-plan and plan-revision invariants are enforced.
- Adjustment evidence and the resulting plan revision are atomic.
- Two-client emulator tests prove the material workflows.
- Firestore rules enforce membership, ownership, shape, bounds, immutable
  metadata, and supported versions with negative tests.

### Safety and operations

- Recommendation records contain inputs, reason code, rules/content version,
  output, runner decision, recorded time, and resulting plan revision.
- An operator can disable generation, guidance, or adaptation without an iOS
  release, and the action has been rehearsed on a device.
- Privacy, consent, limitations, password reset, support, withdrawal, and
  deletion initiation are usable.
- Manual deletion has been rehearsed across Authentication and every owned data
  path with a stated service level.
- Export and restore have been rehearsed against development.
- Critical failures have an operator-visible route and a documented response.

### Release and validation

- External TestFlight review is approved with schedule buffer.
- A non-owner tester completes the supported web-to-iOS journey.
- Offline, expired-session, stale-revision, disabled-feature, and deletion
  states are exercised.
- Success and pause thresholds were committed before cohort data was observed.
- Support capacity is sufficient for the number of invitations.

If any critical recommendation, privacy, data-integrity, or safety failure is
unresolved, recruitment pauses.

## Post-invitation validation schedule

The cohort work must be separated from launch readiness:

| Review | Earliest target | Required decision |
| --- | --- | --- |
| Invitation readiness | January 15, 2027 | Open, delay, reduce scope, or use the research fallback. |
| Two-week operating review | January 29, 2027 | Hold at five to eight participants or permit bounded expansion. |
| Four-week review | February 12, 2027 | Proceed, refine, or pause based on activation, trust, safety, and support burden. |
| Eight-week review | March 12, 2027 | Confirm continued usefulness, adaptation trust, and the next product/market experiment. |

Issue #110 should remain the operating epic. Launch readiness and each review
need separate dated child issues or milestones so a future reader cannot
mistake recruitment for completed validation.

## Market and investment evidence track

Product delivery does not prove demand. Before cohort expansion, record:

- At least ten focused discovery conversations in the chosen segment.
- At least five examples of an existing, costly, confusing, or unsafe
  workaround for the problem.
- At least five credible commitments to test the supported beta when ready.
- At least three credible willingness-to-pay signals or explicit reasons the
  product would not be purchased.
- A comparison of Marathoner's wedge against the alternatives participants
  actually considered.
- Initial hypotheses for acquisition effort, support cost, retention, price,
  and bounded lifetime value.

These are directional learning thresholds, not statistical proof. Names,
contact information, health details, consent records, and raw interview notes
must remain in an approved private system rather than this public repository.

## Proportionate architecture boundary

The beta does not require a generalized application server, full event
sourcing, persistent offline mutation, native analytics, automatic recursive
deletion, three Firebase environments, or a generalized migration platform.

Those capabilities become candidates when secrets or webhooks, payments,
background recommendations, push notifications, multi-user administration,
tamper-resistant computation, automated deletion, larger cohort operations,
or meaningful client-version skew require them.

For the initial beta, prefer the smallest design that proves:

- reviewed and versioned deterministic rules;
- atomic and idempotent material writes;
- strict authorization and data-shape rules;
- simple revision-based concurrency;
- an immutable recommendation audit record;
- remote disable and minimum-version controls;
- development/beta isolation; and
- a rehearsed manual operating process for the small cohort.

## Status rules

- **Not started:** No accepted implementation or evidence exists.
- **Ready:** Scope, acceptance criteria, and dependencies are complete.
- **In progress:** One owner is actively working the issue.
- **Blocked:** A named external decision or dependency prevents progress.
- **Evidence ready:** Implementation is complete and the gate evidence is
  linked, but the gate decision has not been recorded.
- **Complete:** Acceptance evidence is linked and the responsible gate or pull
  request has accepted it.

Only one implementation issue and one externally blocked issue should normally
be active at a time. At every gate, record pass, conditional pass, or fail; the
evidence links; unresolved risks; the next approved scope; and any explicit
date or contract change.
