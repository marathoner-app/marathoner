# Marathoner zero-to-beta plan

- **Status:** Active delivery plan
- **Last updated:** September 22, 2026
- **Product owner and current implementer:** Kevin Tulloch
- **Target:** Open the founding cohort on January 15, 2027
- **Master tracker:** [GitHub issue #104](https://github.com/marathoner-app/marathoner/issues/104)
- **Active remediation:** [Committee remediation sprint](committee-remediation-sprint.md)

## Outcome

By January 15, 2027, Marathoner can invite a small founding cohort to an iOS
beta that supports the complete first-marathon training loop: intake, an
understandable initial plan, daily use, completed-run feedback, deterministic
adaptation, timely educational guidance, and informed approval of material plan
changes.

The date is the target for opening the founding cohort. It is not a promise of
public launch, completed cohort validation, or an Android external release.

The September 2026 committee review found that the target remains conditional
on methodology authority, executable issue decomposition, client data
integrity, operational readiness, and participant evidence. The
[committee remediation sprint](committee-remediation-sprint.md) is the
canonical backlog for closing those gaps. Existing commitments remain active
until a focused product decision changes them; conflicts are tracked rather
than silently overridden.

## Product commitments

- iOS is required for the founding beta. The supported distribution path is an
  external TestFlight beta unless a later recorded decision changes it.
- The existing responsive web application remains part of Marathoner. It is the
  planning, history, configuration, and detailed-analysis surface and is not
  being replaced by the mobile work.
- Android should remain buildable when the approved shared-mobile architecture
  makes that practical, but an Android external release is not a beta gate and
  has no committed date.
- The beta serves runners starting from no running, runners without a
  consistent base, and runners who already run consistently. Intake and plan
  generation may choose different starting phases for each group.
- Ongoing adaptation and educational guidance are beta requirements. A static
  plan plus activity logging is not enough to test the product promise.
- Beta decisions may use deterministic, versioned rules and authored
  explanations. Generative AI is not required.
- The founding cohort remains free in exchange for structured feedback. The
  planning targets remain 25 accepted invitations, 18 completed onboardings,
  and 12 participants active at four weeks.
- No delivery commitment assumes that a contributor joins. Future contributors
  may take bounded work after they arrive, but the plan must remain executable
  and understandable by the owner working alone.

## Architecture decision boundary

The recommended direction is one Expo and React Native mobile application with
an iOS beta target and an Android-capable shared core, alongside the existing
Vite web application. Shared TypeScript packages should hold portable training
contracts, deterministic rules, validation, calculations, and persistence
boundaries; platform-specific interfaces should remain separate.

The proposed shape is:

```text
apps/
  web/                 existing React and Vite application
  mobile/              proposed Expo and React Native application
packages/
  training-domain/     portable entities, units, validation, and calculations
  training-contracts/  serialized cross-client contracts and fixtures
  training-rules/      versioned generation and adaptation rules
  training-data/       repository interfaces and platform adapters
```

This structure is a proposal until issue
[#83](https://github.com/marathoner-app/marathoner/issues/83) approves the
mobile architecture decision record. The spike may change package boundaries
when evidence warrants it. Android-only issues remain open in their holding
milestone until that decision is approved; they must not be closed as
superseded merely because Expo is the current recommendation.

## Delivery waves

Each wave ends in observable evidence, not only merged code. Work may overlap
when it does not weaken the preceding gate.

| Wave | Target | Tracker | Required outcome |
| --- | --- | --- | --- |
| 00 Solo Delivery and Beta Contract | October 4, 2026 | [#54](https://github.com/marathoner-app/marathoner/issues/54) | One canonical beta promise, solo delivery workflow, issue hierarchy, and approved scope boundaries. |
| 01 Shared Mobile Foundation | October 18, 2026 | [#33](https://github.com/marathoner-app/marathoner/issues/33) | A physical iPhone can authenticate and exchange one typed training record with the preserved web application through the proposed shared boundary. |
| 02 Intake and Initial Plan | November 15, 2026 | [#65](https://github.com/marathoner-app/marathoner/issues/65) | A representative runner from each starting group can complete intake, receive and approve a deterministic plan, and identify the next workout. |
| 03 Track, Learn, and Adapt | December 6, 2026 | [#105](https://github.com/marathoner-app/marathoner/issues/105), [#106](https://github.com/marathoner-app/marathoner/issues/106) | A runner can log what happened, receive an authored explanation and deterministic adjustment recommendation, and approve or decline a material change. |
| 04 iOS Daily Companion | December 20, 2026 | [#108](https://github.com/marathoner-app/marathoner/issues/108) | The complete daily loop is usable on a physical iPhone and an internal/TestFlight candidate can be installed and exercised. |
| 05 Trust and External-Beta Readiness | January 8, 2027 | [#107](https://github.com/marathoner-app/marathoner/issues/107), [#109](https://github.com/marathoner-app/marathoner/issues/109) | Safety boundaries, privacy and deletion, accessibility, reliability, support, consent, instrumentation, and TestFlight operations satisfy the beta checklist. |
| 06 Founding Cohort | January 15, 2027 | [#110](https://github.com/marathoner-app/marathoner/issues/110) | Invitations can open to the supported cohort with a measured onboarding, support, feedback, and pause process. |

## Evidence gates

### October: prove the delivery and client foundation

By October 18:

- the beta contract is consistent across the roadmap, product vision, and
  cohort plan;
- issue #83 records the mobile stack, repository boundary, ownership of shared
  rules, rejected alternatives, and migration sequence;
- a development build launches on a physical iPhone;
- the iOS client can authenticate against the Marathoner Firebase project;
- iOS and web can read and write the same typed sample training record without
  breaking ownership rules; and
- the owner can produce a repeatable local or hosted iOS development build.

If this evidence is missing, feature expansion pauses while the architecture or
schedule is corrected. Android external distribution is not substituted for
the iOS proof.

### November: prove the initial-plan journey

By November 15, test fixtures representing all three starting groups must each
complete this path:

1. create or load an owned runner profile;
2. provide race, current-running, availability, and schedule context;
3. receive a feasible, deterministic initial plan or an honest infeasibility
   result;
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
recoverable-error behavior. Failure of either December gate triggers scope or
date review before external invitations are promised.

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

- Complete the Expo and shared-architecture spike and approve issue #83.
- Preserve the deployed web experience during any workspace migration.
- Establish a single source of truth for portable training contracts and
  cross-client fixtures.
- Prove authentication, ownership, read/write synchronization, local build
  instructions, and repeatable verification on a physical iPhone.
- Decide the minimum reliable offline and conflict behavior needed by beta.

### Wave 02: Intake and Initial Plan

- Persist the minimum runner profile needed for plan generation.
- Support all three starting groups through one coherent intake.
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

- Invite no more participants than can be supported responsibly.
- Track 25 accepted invitations, 18 completed onboardings, and 12 participants
  active at four weeks as hypotheses, not guarantees.
- Review activation, comprehension, adaptation trust, safety, and support burden
  before expanding recruitment.
- Pause invitations for unresolved critical recommendation, privacy,
  data-integrity, or safety failures.

## Safety and expert review

Qualified review of the full training methodology is not a blocker for the
initial invite-only beta, but a disclaimer is not the safety system.

Before invitations open, the beta must:

- describe the rules and guidance as experimental and identify unreviewed
  areas plainly;
- avoid diagnosis, treatment claims, injury-prevention promises, and guaranteed
  outcomes;
- use conservative, authored escalation boundaries for pain, unusual symptoms,
  and race-date infeasibility;
- keep material recommendations versioned, testable, explainable, and subject
  to runner approval;
- make it possible to stop recruitment and disable unsafe guidance; and
- give participants a clear support and withdrawal path.

Qualified review of the training methodology, pain escalation, fueling,
hydration, and recovery guidance is required before broad public launch. Beta
evidence may help identify what needs review, but it does not convert unreviewed
guidance into approved guidance.

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
beta contract -> iOS/shared foundation -> intake and initial plan
              -> tracking and adaptation -> iOS daily companion
              -> trust/readiness -> founding cohort
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
