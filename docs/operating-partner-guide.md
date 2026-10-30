# Operating partner start-here guide

- **Status:** Active orientation guide
- **Last reviewed:** October 30, 2026
- **Audience:** Marathoner's operating partner and other first-time strategic
  reviewers
- **Tracking issue:**
  [#422](https://github.com/marathoner-app/marathoner/issues/422)

## Purpose

This guide is the shortest path to understanding what Marathoner is, what has
already been built, which decisions are settled, which assumptions remain open,
and how to recommend changes without first reconstructing the full issue
history.

The operating-partner description in this repository records a working role,
not an equity, officer, or legal co-owner designation. The current entity plan
still assumes a single-member LLC. Any change to ownership or formal authority
requires its own private professional review and a separate governance update.

## How to read repository truth

Use these sources in order when they appear to disagree:

1. merged code, tests, and documentation on `main` describe the implemented
   product and accepted decisions;
2. live GitHub issues and milestones describe work that is open, blocked,
   deferred, or complete; and
3. dated forecasts, prototypes, spike records, and evidence documents explain
   why a decision was made, but may preserve historical facts rather than
   today's status.

An old issue, prototype, or forecast is not a current commitment merely because
it remains in the repository. Raise a focused issue when two current sources
conflict.

## Numbered review path

1. **Start with the repository front door.** Read the
   [README](../README.md), then open the
   [deployed web application](https://marathonerapp.com/). Learn what works
   today, what remains pre-beta, how the repository is structured, and which
   limitations are stated publicly.

2. **Understand the intended product.** Read the
   [product vision](product-vision.md). Challenge the primary user, the narrow
   founding-beta segment, the product promise, the sequencing, and the explicit
   non-goals. Separate the long-term destination from the first beta.

3. **Understand the product-first strategy.** Read the
   [product-first free-beta decision](product-first-beta-decision.md). The
   working product and its responsibility gates are the critical path. Field
   discovery may inform the product now, but formal pricing, reservation, and
   paid-concierge evidence are not release gates. The
   [internal-first resource-sequencing decision](internal-first-resource-sequencing.md)
   also defers material external spending until practical implementation and
   internal-validation predecessors are complete and the dependency is
   becoming a real blocker.

4. **Learn the exact beta promise.** Read the
   [zero-to-beta plan](zero-to-beta-plan.md), especially the supported
   participant, supported clients, exclusions, evidence gates, and working
   model. The founding beta is narrow by design: five to eight initially
   invited adults who already run consistently and are preparing for a first
   marathon.

5. **Read dates as forecasts, not promises.** Read the summary and gate table
   in the [capacity forecast](capacity-forecast.md). January 15, 2027 is an
   invitation floor and scope-or-date checkpoint. The October 8 model estimated
   February 21, 2027 as likely and August 22, 2027 as conservative, but it
   predates the automatic-import scope amendment. Issue
   [#625](https://github.com/marathoner-app/marathoner/issues/625) tracks the
   formal reforecast; live issues show work completed since that calibration.

6. **Understand how people will be found and supported.** Read the
   [founding cohort plan](founding-cohort-plan.md). Focus on personal
   introductions, local clubs and programs, independent running stores, race
   organizers, participant fit, recruitment pauses, and the two-, four-, and
   eight-week learning decisions. Then read the
   [founding-beta incident and support playbook](operations/founding-beta-incident-and-support.md)
   for the support route, operating roles, privacy boundary, pause triggers,
   and fictional incident walkthroughs. The playbook is prepared for internal
   use; it does not replace the later live-system rehearsal.

7. **Review the current execution view.** Open the
   [master tracker](https://github.com/marathoner-app/marathoner/issues/104),
   then review the open
   [milestones](https://github.com/marathoner-app/marathoner/milestones) and
   [issues](https://github.com/marathoner-app/marathoner/issues). Use milestones
   for sequencing and issues for current acceptance criteria. Do not infer
   current status from an old branch name.

8. **Understand why web and iOS lead Android.** Read the accepted
   [mobile client architecture](architecture/mobile-client-architecture.md).
   The responsive React application remains canonical, iOS uses a thin
   Capacitor shell, and Android external distribution is a deliberate
   post-founding-beta follow-on with no committed date.

9. **Understand the methodology and safety boundary.** Read the
   [methodology review protocol](methodology/README.md) and its
   [beta review inventory](methodology/beta-review-inventory.md). Marathoner
   cannot present unreviewed training, adaptation, pain, fueling, hydration, or
   recovery rules as approved guidance. Field feedback cannot replace qualified
   review.

10. **Understand privacy, security, and access.** Read
    [governance](../GOVERNANCE.md), [contribution](../CONTRIBUTING.md), and
    [security](../SECURITY.md). Repository access does not grant production
    credentials, participant records, private interview notes, release
    authority, or merge authority.

11. **Inspect historical evidence only when a question needs it.** The
    `spikes/`, `docs/design/`, architecture decisions, and dated evidence files
    explain earlier tradeoffs. They are useful for questions such as “why
    Capacitor?” or “why is registration closed?” but are not the best first
    source for current progress.

12. **Record proposed changes where they can be decided.** Open or comment on a
    focused GitHub issue with the observation, evidence, affected assumption,
    proposed outcome, urgency, and any privacy or safety concern. Strategic
    feedback does not need to include code. Keep participant identities, raw
    notes, private partner discussions, credentials, and contracts out of this
    public repository.

## Current snapshot

As of October 30, 2026:

- Marathoner is a deployed, responsive pre-beta web application with a
  production-shaped Capacitor iOS shell. It is not open for public signup or
  founding-beta invitations.
- Plan, Track, Analyze, runner setup, authentication, owner-scoped live reads,
  recommendation-evidence reads, account deletion, and trusted-command
  boundaries exist. Owner-only internal rehearsal now exercises saved-profile
  plan generation, unsupported results, start-date choice, session activation,
  live-history adaptation, recommendation decisions, authored draft guidance,
  and conservative draft safety outcomes. Draft methodology remains unapproved
  and excluded from participant production builds.
- The reviewed beta callable exports are deployed, but normal Track run
  mutations have not switched to them. Valid-client observation,
  organization-signed iPhone App Attest proof, command-provider migration,
  staged enforcement, external TestFlight distribution, and beta operations
  remain incomplete.
- Waves 00 and 01 are recorded as passed. Intake/initial-plan, adaptation,
  iOS-daily-companion, and trust/readiness work remain open in their live
  milestones.
- The initial cohort remains five to eight allowlisted participants. Automatic
  completed-run import is now on the beta critical path through
  [#617](https://github.com/marathoner-app/marathoner/issues/617); each intended
  tester's watch and recording ecosystem must have a verified path before an
  invitation. Android, payments, AI planning, live GPS recording, broad public
  signup, and large-scale paid acquisition remain outside that path.
- Important external or authority-dependent gates include qualified methodology
  review
  ([#191](https://github.com/marathoner-app/marathoner/issues/191)), entity and
  Apple organization enrollment
  ([#281](https://github.com/marathoner-app/marathoner/issues/281)), App Check
  observation and rollback
  ([#205](https://github.com/marathoner-app/marathoner/issues/205)), and an
  external-testable iOS build
  ([#122](https://github.com/marathoner-app/marathoner/issues/122)).
  Prepared methodology and entity paths remain inactive until the internal-
  first activation criteria pass; deferral changes timing, not those release
  requirements.

## Operating role

The operating partner's current lane is to:

- develop trusted in-person relationships with runners, clubs, training
  programs, stores, race organizers, and other local connectors;
- find potential users who fit, nearly fit, or clearly do not fit the proposed
  founding segment;
- record privacy-safe aggregate counts of the watches, recording apps, and
  phone ecosystems potential testers already use so import coverage can be
  verified without collecting their workout or health data;
- conduct face-to-face problem, expectation, prototype, and product-feedback
  conversations;
- test whether Marathoner's language and value proposition are understandable;
- surface recurring objections, unmet needs, unsafe expectations, and channel
  constraints; and
- summarize privacy-safe themes and propose roadmap, cohort, positioning, or
  operating changes through GitHub issues.

Kevin remains the active technical maintainer and current final authority for
repository administration, merges, releases, security and privacy posture, and
changes to the ratified beta contract. Both people should challenge product,
segment, roadmap, positioning, recruitment, and feedback assumptions. A later
governance decision may change authority, but repository access alone does not.

The delivery forecast continues to count one owner-developer. Field work may
reduce recruitment uncertainty or reveal product changes, but it does not add
engineering throughput or permit invitations before the recorded product and
responsibility gates pass.

## Field-work boundaries before beta

Relationship development and non-prescriptive discovery can begin before the
product is ready for participants. Those conversations may explore current
workarounds, language, expectations, prototype comprehension, channel fit, and
interest in future testing.

They must not:

- represent someone as an enrolled beta participant before the invitation gate;
- provide individualized training, medical, injury, fueling, hydration, or
  recovery recommendations on Marathoner's behalf;
- imply that an unimplemented feature or date is committed;
- treat a friendly conversation as demand, payment, safety, or methodology
  proof; or
- place names, contact details, health information, training records, consent
  records, or raw interview notes in GitHub.

Systematic research or collection of identifiable information must use the
approved private operating boundary and appropriate consent. Public issues may
contain only aggregate counts, anonymized themes, public materials, and the
resulting decisions.

## Useful questions for the first review

- Does the narrow founding participant match people who can actually be reached
  through trusted local relationships?
- Which promises or terms are confusing, unbelievable, or too broad?
- What do first-time marathoners currently combine to plan, track, and adjust
  training, and where is the most consequential friction?
- Which local organizations are credible early partners, and what value should
  Marathoner provide before asking for introductions?
- What would make someone trust or distrust an explained plan adjustment?
- Which feedback should be collected in person, in product, or through a
  private follow-up?
- Which current roadmap assumption should change before it consumes more
  engineering time?
- What evidence would justify keeping Android deferred or moving it into an
  active future milestone?

The useful first deliverable is not a complete replacement roadmap. It is a
short list of evidence-backed questions, contradictions, and proposed changes
that can be discussed and converted into focused issues.
