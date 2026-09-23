# Marathoner product vision

**Status:** Active direction

**Last updated:** September 22, 2026

**Product owner:** Kevin Tulloch

## Purpose

This document describes what Marathoner is intended to become, who it serves,
and the sequence for building it. It is a directional product guide rather than
a promise that every future feature or date is fixed.

The repository README explains what the application does today. GitHub issues
and milestones define committed work. This document explains the larger
destination and the principles used to make product decisions.

## Vision

Marathoner helps a first-time marathoner move from deciding to run a marathon
to arriving at the starting line feeling prepared, informed, and in control.

A new runner should not need to research and assemble a training plan,
terminology, equipment guidance, recovery practices, fueling advice, and race
preparation from unrelated sources. Marathoner should introduce the right
concept at the point when it becomes useful, explain why it matters, and turn
the runner's circumstances into an understandable plan.

Marathoner is a first-marathon operating system, not a general activity tracker,
social network, or permanent replacement for every running product.

## Origin

The product is informed by a system Kevin built for himself and friends while
preparing for a marathon:

1. Nine weeks focused on progressing from the couch to a 5K.
2. Ninety days of base building with easy mileage and a progressively longer
   Sunday run.
3. Twenty weeks of marathon-specific training.
4. Continued attention to effort, shoes, sleep, fueling, hydration, and pacing.

That experience provides the product insight and empathy for the intended user.
It does not replace professional coaching, sports-medicine, or nutrition
expertise. Public training rules and educational guidance must be reviewed by
qualified experts before they are treated as production-ready.

Marathoner will develop original, expert-reviewed methodology. It will not
depend on reproducing a proprietary plan or presenting the founder as a
professional coach.

## Primary user

The first user is an English-speaking adult in the United States preparing for
a first marathon.

That person may be:

- starting from little or no running;
- able to run but lacking a consistent base;
- already running regularly but unfamiliar with marathon preparation; or
- uncertain whether a desired race date is realistic.

The first version uses miles and United States-oriented race assumptions.
Internationalization, additional unit defaults, and broader regional guidance
can follow once the first experience is validated.

### Founding-beta user

The January 2027 founding beta intentionally serves a narrower first user: an
English-speaking adult in the United States who already runs consistently and
is preparing for a first marathon. The exact recent-running, race-horizon, and
progression thresholds require qualified approval before invitations.

Starting from no running, returning after an inconsistent period, and broader
base building remain part of the product destination. They are excluded from
the first cohort so one reviewed workflow can establish safety, trust, support,
and product evidence before the methodology expands.

## Core problem

First-time marathoners often do not know which questions they need to ask.
Important concepts are scattered across books, videos, training plans, device
platforms, and advice from other runners.

A schedule alone does not solve this problem. The runner also needs to
understand:

- why most running should feel easy;
- how mileage and long runs progress;
- when fueling and hydration become necessary;
- why sleep and recovery affect the ability to absorb training;
- how to monitor shoe use without relying on a universal expiration number;
- how to distinguish normal effort from a situation that needs attention;
- why a plan changes; and
- when a race date or goal no longer fits the available preparation.

## Product promise

Marathoner aims to help a first-time marathoner complete the journey feeling
prepared and in control.

The default goal is not a finish time. Marathoner should first collect enough
training history to understand the runner. When sufficient data exists, it may
offer an optional, explained finish-time exploration. A new user should not be
asked to research or invent a target time during onboarding.

## Product principles

### First-marathon focus

Marathoner serves the complete first-marathon journey. It does not need to
become an all-purpose platform for every race distance and every stage of an
athlete's life.

### Explain before expecting

The product introduces important concepts before the runner is expected to act
on them. Guidance should be timely and concise rather than a large curriculum
that must be studied in advance.

### Direct, calm accountability

Marathoner should not shame the runner or offer empty encouragement. When the
plan and current reality no longer match, the product should state that clearly
and focus on the most responsible next options.

### Informed control

The runner should understand meaningful plan changes and approve them.
Marathoner should not quietly transform the goal, mileage progression, or
training phase.

### Deterministic and expert-reviewed planning

Training progression is produced by versioned, testable, approved rules.
Artificial intelligence may help explain a recommendation, but it must operate
inside those rules and must not independently decide training load or
intensity.

### Private and focused

Social feeds, followers, clubs, public leaderboards, and comparison-driven
engagement are non-goals. Users may eventually export or share an individual
achievement, but Marathoner will not build a social graph.

### Device independence

A runner can use Marathoner without owning a particular watch. Manual activity
logging remains a supported baseline even after integrations exist.

### Mobile usability from the beginning

The responsive web application remains a first-class experience rather than a
disposable prototype. An installable iOS daily companion is required for the
founding beta. Issue #83 will select a Capacitor shell, Expo with the Firebase
JavaScript SDK, or Expo with React Native Firebase from comparable
physical-device evidence. Android external release is valuable but does not
block that beta.

### Graduation is success

The first version may end with the runner completing a first marathon,
preserving the journey, and moving to another product or goal. Graduation is a
successful product outcome rather than a failed retention event.

## The runner journey

### 1. Assessment and feasibility

Marathoner learns the runner's race date, current weekly mileage, longest recent
run, recent performance when available, available training days, preferred
long-run day, running frequency, and schedule constraints.

If the requested race date does not allow a responsible progression, Marathoner
must say so and recommend a later race or a different immediate goal.

### 2. Learn to run

A runner starting from zero follows a walk-run or Couch to 5K-style progression
that builds consistency and confidence before marathon training begins.

### 3. Build the base

The runner develops consistent easy mileage and a gradually longer weekly run.
The duration of this phase depends on the starting point and target race date.

### 4. Train for the marathon

The runner enters an expert-reviewed marathon-specific progression with long
runs, easy running, appropriate quality work, recovery, cutback periods, and a
taper.

### 5. Prepare for race day

Guidance expands to include race-week scheduling, pacing, fueling, equipment,
logistics, and realistic expectations. This information should arrive near the
point when it becomes actionable.

### 6. Recover and graduate

Marathoner helps the runner review the journey, preserve and export history,
understand immediate recovery, and decide what comes next. Supporting a second
marathon is a possible future version rather than a requirement for the initial
product.

## Plan generation

The initial onboarding inputs are expected to include:

- target race date;
- current weekly mileage;
- current running frequency;
- longest recent run;
- recent race or representative run performance when available;
- days available to train;
- preferred long-run day;
- relevant schedule constraints; and
- current completion goal.

Sensitive or unnecessary personal information should not be collected merely
because it might be available. Expert review will determine which additional
inputs are genuinely required.

Plan generation selects and configures approved phases rather than asking a
generative model to invent workouts.

## Feedback and adaptation

After each run, Marathoner asks how the workout felt compared with its intended
effort:

- much easier than expected;
- easier than expected;
- about right;
- harder than expected; or
- much harder than expected.

A secondary optional check asks whether the runner experienced unusual pain or
discomfort. Marathoner does not diagnose injuries. It provides reviewed
escalation guidance when a response indicates that the runner may need to stop,
rest, or consult a qualified professional.

One difficult workout should not rewrite the plan. Patterns should inform
recommendations. For example, several easy runs reported as hard may trigger a
recommendation to hold mileage steady.

Minor schedule tuning may occur frequently when it does not materially change
training load or purpose. Meaningful changes become explicit adjustment events
that require approval. These include changes to:

- mileage progression;
- workout intensity;
- training phase;
- race feasibility;
- finish-time exploration; or
- the overall goal.

A significant recommendation follows four steps:

1. State the observation.
2. Explain what it may mean.
3. Recommend the next adjustment.
4. Give the runner an informed choice.

Confidence is measured less frequently, such as during a weekly review or phase
transition. It is an outcome and coaching signal, not a direct instruction to
increase or decrease training.

## First-version guidance

The first useful version treats these topics as essential:

- easy-run effort and pacing;
- shoes and mileage;
- fueling and hydration;
- sleep and recovery;
- basic pain and discomfort escalation; and
- explanations for plan changes.

Guidance is introduced when relevant. A short early run should not produce a
wall of marathon-fueling information. Shoe mileage should prompt inspection and
consideration rather than declare that every shoe expires at the same number.

These areas may be added later or introduced closer to race day:

- detailed strength programming;
- advanced mobility work;
- deep mental-performance training;
- advanced race strategy;
- comprehensive race logistics;
- advanced weather adaptation; and
- performance optimization beyond completing a first marathon.

## Product voice

The voice is direct, calm, truthful, and focused on what can happen next.

It should describe a mismatch between the plan and the current situation rather
than treating the runner as the problem.

Example:

> Three easy runs felt harder than intended this week. That may indicate that
> the current load is outpacing your recovery. Marathoner recommends repeating
> this week's mileage before progressing. You can apply the adjustment or
> review the recommendation first.

When a race date is no longer supported, Marathoner must say that explicitly
without using alarmist presentation or shame.

## Platform strategy

Marathoner is one product with multiple clients that share accounts, training
data, and approved domain rules.

### Public website

The public website explains the product, shows examples, supports a waitlist or
purchase flow, and links to the web and native applications.

### Responsive web application

The web application supports the complete product. Desktop emphasizes planning,
history, configuration, and detailed analysis. Mobile web emphasizes today's
workout, quick logging, effort feedback, shoes, guidance, and adjustment
approvals.

The January 2027 web experience should remain comfortable to use on a phone. A
Progressive Web App may be useful, but it is not a substitute for the required
iOS beta and is not a beta gate.

### iOS daily companion

An iOS application is required for the founding beta and becomes the daily
companion for today's workout, logging, feedback, guidance, and adjustment
approval. The architecture decision must prefer the least duplicated candidate
that proves session recovery, shared records, accessibility, online-write
boundaries, clean builds, signing, and an external TestFlight path. Android
external distribution has no committed beta date and cannot delay the iOS
cohort.

### Shared backend

Web and mobile clients communicate with the same backend. They are not wired
directly to one another. Authentication, persistence, plan rules,
synchronization, and integrations remain shared services.

### Integrations

Manual logging is the reliable baseline. Garmin is the first intended major
integration for receiving completed activities and eventually delivering
structured workouts. Apple Health and Android Health Connect are later
priorities.

No beta or release date should depend on approval from an external integration
provider.

## Directional roadmap

Dates after Foundation are targets and may change as the product is validated.

### Foundation: July 22 to July 31, 2026

Establish the development workflow, connect the initial training-data
foundation, and complete the GitHub organization migration.

Foundation scope does not expand to include the plan engine, native
applications, or integrations.

### Solo delivery and mobile foundation: October 2026

- one canonical beta contract and solo delivery workflow;
- an approved mobile architecture decision;
- preservation of the responsive web application; and
- authentication plus a shared-record round trip on a physical iPhone.

### Intake and initial plan: November 2026

- persistent runner profiles and first-marathon intake;
- eligibility and race feasibility for the consistent-runner beta segment;
- honest rejection of deferred or unsupported starting points;
- one reviewed, deterministic, versioned first-marathon plan family;
- plan review, approval, and persistence; and
- the next workout visible through supported clients.

### Adaptation and iOS daily companion: December 2026

- completed-run and perceived-effort feedback;
- pattern-based deterministic adaptation;
- authored explanations and adjustment approval;
- timely first-version educational guidance;
- an end-to-end daily loop on a physical iPhone; and
- an installable internal or TestFlight candidate.

The exact wave contract and evidence gates are maintained in the
[zero-to-beta plan](zero-to-beta-plan.md). The
[capacity forecast](capacity-forecast.md) is the scheduling source of truth;
it concludes that the current scope and solo-owner capacity do not support the
original January 2027 invitation target.

### Invite-only external beta: after the invitation gates pass

The first invitation batch contains five to eight allowlisted,
English-speaking adults in the United States who already run consistently and
are preparing for a first marathon. No more than eight may be active before the
two-week operating review. A passing review may permit expansion to at most
twelve concurrently active participants and fifteen accepted invitations
through the eight-week review.

January 15, 2027 remains a scope-or-date decision checkpoint, not a
capacity-backed invitation date. Current optimistic, likely, and conservative
dates live in the capacity forecast and must not override an unmet safety,
integrity, privacy, methodology, or release gate.

The proposed recruitment sequence, participant offer, and early learning gates
are described in the
[founding cohort recruitment and validation plan](founding-cohort-plan.md).

The beta requires iOS and preserves the responsive web application. Material
writes require a network connection, and adaptation is limited to reviewed
reschedule, hold, repeat, or no-change outcomes. The beta does not promise
Android external distribution, Garmin integration, advanced analytics, or
broad public availability.

The New Year period may be used for targeted recruitment and learning. Major
paid acquisition should wait until onboarding, comprehension, retention, and
safety behavior have been validated.

### Beta validation: early 2027

Improve the plan model, guidance, onboarding, reliability, and mobile workflows
using evidence from real participants.

### Multi-platform expansion: after beta validation

Evaluate Android external distribution, pursue Garmin and health-platform
integrations, expand analytics, and prepare the public marketing experience
when the core journey is dependable.

### Public launch: evidence-driven

A broad launch occurs when Marathoner can demonstrate that users understand
their plans, return consistently, report increasing preparedness, and receive
responsible recommendations.

## January beta scope

The initial external beta includes:

- an iOS application distributed through TestFlight;
- the preserved responsive web experience;
- account creation and persistent data;
- intake for adults already running consistently;
- eligibility and race-date feasibility with honest unsupported results;
- one reviewed deterministic plan family or a small set of approved variants;
- manual run logging;
- perceived-effort feedback;
- reschedule, hold, repeat, or no-change recommendations and approvals;
- shoe-mileage tracking;
- essential reviewed educational guidance;
- reviewed safety escalation; and
- structured feedback.

The beta does not require:

- an Android external release or public App Store release;
- couch-to-5K, return-to-running, or inconsistent-base plans;
- Garmin or health-platform integrations;
- a generative planning system;
- autonomous load or intensity increases, injury diagnosis, or finish-time
  prediction;
- offline material writes or a custom synchronization queue;
- multiple race distances;
- social features;
- advanced analytics;
- a complete coaching marketplace; or
- large-scale paid marketing.

## Success measures

Early success is demonstrated by more than downloads or registrations.

Useful measures include:

- onboarding completion;
- plan comprehension and acceptance;
- weekly return and activity logging;
- consistency between intended and reported workout effort;
- confidence that upcoming training is manageable;
- understanding of major plan adjustments;
- retention through training phases;
- absence and correction of critical recommendation failures;
- qualitative beta feedback; and
- eventual arrival at race week feeling prepared and in control.

Metrics will be refined before the external beta.

## Business-model hypothesis

The first external beta is free in exchange for structured feedback.

A possible long-term model is:

1. a free readiness and timeline experience;
2. a fixed-duration First Marathon Journey purchase;
3. access for a generous period, potentially up to twelve months;
4. personalized planning, adaptation, education, and graduation; and
5. no indefinite automatic renewal.

Pricing is unresolved and should be tested with beta users. The model is a
hypothesis, not a launch commitment.

## Risks and dependencies

- The exact founding-beta methodology and guidance require qualified approval
  before invitations; new segments require additional review.
- Health, privacy, accessibility, and consumer-protection requirements require
  deliberate review before public launch.
- Garmin and other integrations depend on external approval and platform terms.
- The January beta target is aggressive for one owner-developer working around
  a full-time job and personal commitments.
- Training guidance must remain understandable and testable as personalization
  grows.
- The product must avoid copying proprietary plans or educational material.
- Marketing must not outrun the product's ability to support users responsibly.

## Explicit non-goals

For the initial product, Marathoner is not:

- a social network;
- a live GPS recording replacement;
- an elite performance platform;
- a substitute for medical care;
- a marketplace for coaches;
- a general-purpose app for every race distance;
- a guarantee of race completion or injury avoidance; or
- an Android external release before the iOS beta is validated.

## Open questions

- Which qualified experts will review the methodology and guidance?
- What evidence is sufficient before finish-time goals are introduced?
- What price and access period fit the First Marathon Journey?
- What evidence should trigger an Android external-release plan?
- Which integrations follow Garmin?
- Which beta measures should block or permit a broader launch?
- What evidence should permit couch-to-5K and inconsistent-base participants?
