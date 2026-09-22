# Marathoner zero-to-beta plan

- **Status:** Active delivery plan
- **Last updated:** September 22, 2026
- **Product owner and current implementer:** Kevin Tulloch
- **Target:** Open the founding cohort on January 15, 2027
- **Master tracker:** [GitHub issue #104](https://github.com/marathoner-app/marathoner/issues/104)
- **Active remediation:** [Committee remediation sprint](committee-remediation-sprint.md)
- **Founding-beta contract:** [GitHub issue #117](https://github.com/marathoner-app/marathoner/issues/117)

## Outcome

By January 15, 2027, Marathoner can invite a small, allowlisted founding cohort
of adults who already run consistently and are preparing for a first marathon.
The beta supports a bounded first-marathon loop: intake, a reviewed plan family,
daily use, completed-run feedback, deterministic hold/repeat/reschedule
recommendations, timely reviewed guidance, and informed approval of material
plan changes.

The date is the target for opening the founding cohort. It is not a promise of
public launch, completed cohort validation, or an Android external release.

The September 2026 committee review found that the target remains conditional
on methodology authority, executable issue decomposition, client data
integrity, operational readiness, and participant evidence. The
[committee remediation sprint](committee-remediation-sprint.md) is the
canonical backlog for closing those gaps.

## Founding-beta contract

### Supported participant

The founding beta supports an English-speaking adult in the United States who:

- is preparing for a first marathon;
- already runs consistently under the eligibility boundary approved in #119;
- has a race horizon, recent training, and availability supported by the
  approved beta rules;
- is willing to log training and complete brief feedback check-ins; and
- understands that Marathoner is experimental training support, not medical
  care or an individual professional coach.

The founding beta does not support someone starting from no running, returning
after an inconsistent period, presenting a pain or unusual-symptom escalation,
or requesting a race timeline outside the approved rule boundary. Those people
receive an honest unsupported result rather than an improvised plan. Numeric
mileage, frequency, duration, and progression thresholds are methodology and
must be approved through #119 before invitations open.

The broader product vision still includes couch-to-5K and base-building paths.
They are deferred until the first narrow workflow produces trustworthy safety,
support, and product evidence.

### Cohort size and sequence

- The first invitation batch contains five to eight allowlisted participants.
- No more than eight participants may be active before the two-week operating
  review.
- After a passing two-week review, the owner may expand to no more than twelve
  concurrently active participants and fifteen accepted invitations through
  the eight-week review.
- Expansion pauses when support capacity, safety, privacy, recommendation, or
  data-integrity evidence fails its threshold.
- The beta remains free in exchange for structured feedback.

### Plan and adaptation boundary

- Use one qualified-review-approved first-marathon plan family or a small set
  of deterministic variants for the supported runner segment.
- Generate recommendations from explicit, versioned, tested rules and authored
  explanations. Generative AI is not required.
- Limit beta adaptation to rescheduling an approved workout, holding
  progression, repeating an approved period, or making no change.
- Require informed runner approval before a material plan revision.
- Do not autonomously increase intensity or training load, change the race or
  goal, predict a finish time, diagnose injury, or improvise outside the
  approved rule set.

### Supported clients

| Capability | Responsive web | iOS through TestFlight |
| --- | --- | --- |
| Account creation, recovery, consent, and intake | Primary | Sign-in and session recovery |
| Plan generation result, review, and approval | Primary | Read approved plan and next workout |
| Configuration, history, and detailed analysis | Primary | Compact daily context |
| Today's workout and manual completion | Supported | Primary |
| Effort, optional notes, and shoe capture | Supported | Primary |
| Reviewed guidance and bounded adjustment decision | Supported | Primary |
| Support, withdrawal, and deletion initiation | Supported | Required in app |

Both clients use the same owned, versioned records. The web application remains
a first-class product surface and is not replaced by the iOS work.

### Network and platform boundary

- Material writes require a network connection. Plan approval, run completion,
  adjustment decisions, consent changes, and deletion requests must not enter a
  custom offline mutation queue.
- A client may show its last safe in-memory or platform-provided cached view,
  but it must say when reconnecting is required to save or change data.
- iOS is required for the founding beta. External TestFlight is the intended
  distribution path unless a later recorded decision changes it.
- Android external distribution, integrations, payments, AI planning, GPS,
  push notifications, and health-platform data are excluded.
- No delivery commitment assumes another contributor joins.

### Methodology fallback

If qualified approval for the supported beta slice is unavailable, Marathoner
may run only a non-prescriptive research beta using a participant-supplied or
individually human-reviewed plan. That fallback may test planning interfaces,
logging, comprehension, and feedback, but it may not generate algorithmic
training, adaptation, pain, fueling, hydration, or recovery recommendations.

## Architecture decision boundary

The mobile implementation remains undecided until issue
[#83](https://github.com/marathoner-app/marathoner/issues/83) compares a
Capacitor iOS shell, Expo with the Firebase JavaScript SDK, and Expo with React
Native Firebase against the same physical-device evidence. Prefer the least
duplicated option that passes session recovery, shared-record, accessibility,
network-boundary, clean-build, signing, and external-TestFlight-path checks.

Do not relocate the existing web application or build a generalized shared
workspace before the winning spike is proven. Extract only the minimum pure
TypeScript contract or rule package needed by the selected client. Android-only
issues remain in their holding milestone until the ADR records whether they are
reused, rewritten, deferred, or superseded.

## Delivery waves

Each wave ends in observable evidence, not only merged code. Work may overlap
when it does not weaken the preceding gate.

| Wave | Target | Tracker | Required outcome |
| --- | --- | --- | --- |
| 00 Solo Delivery and Beta Contract | October 4, 2026 | [#54](https://github.com/marathoner-app/marathoner/issues/54) | One canonical beta promise, solo delivery workflow, issue hierarchy, and approved scope boundaries. |
| 01 Shared Mobile Foundation | October 18, 2026 | [#33](https://github.com/marathoner-app/marathoner/issues/33) | A physical iPhone can authenticate and exchange one typed training record with the preserved web application through the approved least-duplicated client boundary. |
| 02 Intake and Initial Plan | November 15, 2026 | [#65](https://github.com/marathoner-app/marathoner/issues/65) | A representative supported runner can complete intake, receive an approved deterministic plan or honest unsupported result, approve the plan, and identify the next workout. |
| 03 Track, Learn, and Adapt | December 6, 2026 | [#105](https://github.com/marathoner-app/marathoner/issues/105), [#106](https://github.com/marathoner-app/marathoner/issues/106) | A runner can log what happened, receive an authored explanation and deterministic adjustment recommendation, and approve or decline a material change. |
| 04 iOS Daily Companion | December 20, 2026 | [#108](https://github.com/marathoner-app/marathoner/issues/108) | The complete daily loop is usable on a physical iPhone and an internal/TestFlight candidate can be installed and exercised. |
| 05 Trust and External-Beta Readiness | January 8, 2027 | [#107](https://github.com/marathoner-app/marathoner/issues/107), [#109](https://github.com/marathoner-app/marathoner/issues/109) | Safety boundaries, privacy and deletion, accessibility, reliability, support, consent, instrumentation, and TestFlight operations satisfy the beta checklist. |
| 06A Founding Cohort Invitations | January 15, 2027 | [#129](https://github.com/marathoner-app/marathoner/issues/129) | Five to eight allowlisted invitations may open only when every invitation blocker passes. |
| 06B Four-Week Review | February 12, 2027 | [#131](https://github.com/marathoner-app/marathoner/issues/131) | Activation, comprehension, trust, safety, usefulness, and support burden produce a proceed, refine, or pause decision. |
| 06C Eight-Week Review | March 12, 2027 | [#128](https://github.com/marathoner-app/marathoner/issues/128) | Continued usefulness, adaptation trust, willingness to pay, and the next experiment receive a recorded decision. |

## Evidence gates

### October: prove the delivery and client foundation

By October 18:

- the beta contract is consistent across the roadmap, product vision, and
  cohort plan;
- issue #83 compares Capacitor, Expo with the Firebase JavaScript SDK, and Expo
  with React Native Firebase and records the selected stack, rejected
  alternatives, minimal repository boundary, and migration sequence;
- a development build launches on a physical iPhone;
- the iOS client can authenticate against the Marathoner Firebase project;
- iOS and web can read and write the same typed sample training record without
  breaking ownership rules; and
- the owner can produce a repeatable local or hosted iOS development build.

If this evidence is missing, feature expansion pauses while the architecture or
schedule is corrected. Android external distribution is not substituted for
the iOS proof.

### November: prove the initial-plan journey

By November 15, supported, unsupported-base, unsafe-escalation, and infeasible
race-date fixtures must complete the appropriate path:

1. create or load an owned runner profile;
2. provide race, current-running, availability, and schedule context;
3. receive a feasible plan from the reviewed deterministic family or an honest
   unsupported result;
4. understand and approve the proposed plan; and
5. find the next scheduled workout.

The gate requires versioned contracts, rule tests, persistence, and an
explainable result. It does not require generative AI.

### December: prove the differentiating daily loop

By December 6, at least one representative scenario must work end to end on a
device:

1. view the intended workout;
2. log completion and perceived effort;
3. accumulate a pattern rather than overreact to one difficult run;
4. receive an authored explanation and deterministic recommendation;
5. approve or decline a material adjustment; and
6. see the resulting plan state consistently on iOS and web.

By December 20, that loop must run on a physical iPhone from an installable
internal or TestFlight candidate with honest loading, empty, offline, and
recoverable-error behavior. Offline material actions must show that a network
connection is required rather than appearing saved. Failure of either December
gate triggers scope or date review before external invitations are promised.

## Wave exit conditions

### Wave 00: Solo Delivery and Beta Contract

- Publish this plan and make the GitHub master tracker its execution view.
- Replace roadmap language that assumes a particular contributor or two-person
  capacity.
- Preserve zero required approving reviews while the repository has one active
  maintainer; the owner still performs the final diff review.
- Define the beta-supported clients and explicitly hold Android external release
  outside the critical path.
- Ensure CI, issue templates, and the issue-to-PR guide support small,
  owner-readable work slices.

### Wave 01: Shared Mobile Foundation

- Compare the candidate Capacitor and Expo paths on a physical iPhone and
  approve issue #83 from evidence.
- Preserve the deployed web experience during any workspace migration.
- Establish a single source of truth for portable training contracts and
  cross-client fixtures.
- Prove authentication, ownership, read/write synchronization, local build
  instructions, and repeatable verification on a physical iPhone.
- Prove online-required material writes, honest reconnect behavior, and the
  minimum revision-based conflict policy.

### Wave 02: Intake and Initial Plan

- Persist the minimum runner profile needed for plan generation.
- Support the ratified consistent-runner segment and reject deferred starting
  groups honestly.
- Report when a requested race date cannot support a responsible progression.
- Generate plans only from explicit, versioned, tested rules.
- Let the runner understand and approve a plan before activation.
- Persist the plan and expose the next workout to both supported clients.

### Wave 03: Track, Learn, and Adapt

- Capture completion, perceived effort, pain/discomfort signal, optional notes,
  date, and shoes at the level required by the rules.
- Detect meaningful patterns without allowing one hard run to rewrite a plan.
- Produce deterministic recommendations with authored explanations.
- Require informed approval for material load, intensity, phase, feasibility,
  or goal changes.
- Introduce essential guidance when it becomes useful: easy effort, shoes,
  fueling, hydration, sleep, recovery, safety escalation, and why a plan
  changed.

### Wave 04: iOS Daily Companion

- Deliver the today, logging, feedback, guidance, and adjustment-approval loop
  on iOS.
- Meet core VoiceOver, Dynamic Type, contrast, touch-target, keyboard-entry, and
  reduced-motion expectations applicable to the interface.
- Exercise authentication, synchronization, offline boundaries, session
  recovery, and representative device states on a physical iPhone.
- Produce an installable candidate without requiring an Android external build.

### Wave 05: Trust and External-Beta Readiness

- Complete account recovery and account/training-data deletion paths.
- Publish truthful beta consent, privacy, data-use, limitations, and support
  language.
- Provide incident triage, rollback or feature-disable, participant support,
  and recruitment-pause procedures.
- Instrument activation and cohort measures without placing participant records
  or private research notes in the public repository.
- Complete the TestFlight metadata, review, tester, feedback, and release
  checklist with schedule buffer.
- Run accessibility, reliability, security-rules, and critical-flow checks.

### Wave 06: Founding Cohort

- Invite five to eight allowlisted participants initially.
- Keep no more than eight participants active before the two-week review and no
  more than twelve concurrently active or fifteen accepted through the
  eight-week review.
- Review activation, comprehension, adaptation trust, safety, and support burden
  before expanding recruitment.
- Pause invitations for unresolved critical recommendation, privacy,
  data-integrity, or safety failures.

## Safety and expert review

Qualified review of the full future methodology is not required for the first
cohort. Dated qualified approval of the exact rules and guidance supported by
that cohort is required before invitations. A disclaimer is not the safety
system.

Before invitations open, the beta must:

- identify the reviewed ruleset and content versions and describe the bounded
  beta as experimental;
- avoid diagnosis, treatment claims, injury-prevention promises, and guaranteed
  outcomes;
- use conservative, authored escalation boundaries for pain, unusual symptoms,
  and race-date infeasibility;
- keep material recommendations versioned, testable, explainable, and subject
  to runner approval;
- make it possible to stop recruitment and disable unsafe guidance; and
- give participants a clear support and withdrawal path.

Additional starting segments, rules, and guidance require additional qualified
approval before they are exposed. Beta evidence may identify what needs review,
but it does not convert unreviewed guidance into approved guidance.

## Creator Radar boundary

Creator Radar may help identify and research potential founding participants,
communities, or trusted connectors. It is an optional recruitment input, not a
runtime dependency or a gate for opening the Marathoner beta.

The existing inert Creator Radar event publisher remains outside the browser
graph and outside the critical path. Production attribution deployment,
creator outreach automation, and acquisition-scale integrations are deferred
until they have their own approvals. Participant consent, outreach records, and
private research data must not be placed in this public repository.

## Critical path and scope control

The critical path is:

```text
beta contract -> iOS/shared foundation -> bounded intake and initial plan
              -> tracking and adaptation -> iOS daily companion
              -> trust/readiness -> invitations -> four/eight-week reviews
```

Android external distribution, generative AI, Garmin, payments, social
features, GPS recording, advanced analytics, multiple race distances, and a
broad public launch are outside that path. They may not displace work required
by an evidence gate without a recorded product decision.

When a gate is missed, choose explicitly among reducing nonessential scope,
moving the cohort date, or changing the product commitment. Do not silently
weaken the evidence gate or rename unfinished work as beta-ready.

## Working model

The repository is currently planned for one owner-developer working around a
full-time job, marathon training, and personal commitments. Issues should
therefore fit a focused 60-to-90-minute slice when practical, make dependencies
visible, and leave every line understandable to the owner.

The plan does not reserve Android or any other area for a hypothetical future
contributor. If someone joins, ownership follows demonstrated capacity and an
explicit issue assignment; dates and gates remain unchanged until the roadmap
is deliberately revised.
