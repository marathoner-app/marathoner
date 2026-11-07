# Closed-beta delivery and methodology decision

- **Status:** Active product and release decision
- **Effective:** November 7, 2026
- **Decision owner:** Kevin Tulloch
- **Tracking issue:** [#679](https://github.com/marathoner-app/marathoner/issues/679)
- **Implementation follow-up:** [#680](https://github.com/marathoner-app/marathoner/issues/680)
- **Applies to:** the first five-to-eight-person, invite-only experience beta

This record supersedes the parts of the October 21 Apple-organization decision
and the October 23 methodology-review decision that made California entity
formation, Apple organization enrollment, and independent methodology review
prerequisites for the first closed beta. It does not erase those records or
remove those future gates.

## Decision

Marathoner will pursue an **individual Apple Developer Program membership**
under Kevin's legal name for the first closed TestFlight beta. The account
holder pays Apple directly; any private cost sharing with the operating partner
happens separately from Apple and is not recorded as public payment evidence.
California entity formation and migration to an Apple organization account are
deferred until a re-evaluation trigger makes the recurring cost and migration
work proportionate.

The first beta remains limited to **five to eight known, allowlisted adults**.
It is an experience beta intended to test whether the complete plan, daily-use,
automatic-import, adaptation, explanation, support, and deletion journeys are
understandable and useful. Public registration and open invitations remain
disabled.

Independent professional review of the training methodology is deferred for
this closed cohort. The beta may use pinned, deterministic, source-backed
provisional rules so the actual product behavior can be tested. Those rules are
not professionally reviewed, individualized coaching, or medical advice.
Review remains a gate before the broader uses listed below.

This is a release-scope decision, not permission to bypass current code guards.
The repository still restricts draft artifacts to internal development paths.
A separate implementation issue, #680, must deliberately enable a pinned
provisional artifact in the beta environment, add the required disclosure and
consent, and prove the resulting behavior before an invitation.

## Required disclosure and safety behavior

The beta experience must make the provisional status difficult to miss without
turning every screen into a warning:

- onboarding or beta consent states that training rules are experimental and
  have not received independent professional review;
- every proposed plan and material adaptation identifies its provisional rule
  version and repeats a concise status note before approval;
- educational guidance uses a persistent beta-status treatment or nearby
  context rather than repeating a long disclaimer on every ordinary tip;
- unsupported inputs return an honest unsupported result instead of an
  invented plan or recommendation; and
- pain or unusual symptoms suppress ordinary progression advice and use the
  conservative stop-or-seek-help path. No beta label turns a clinical case
  into supported training guidance.

## Gates that remain unchanged

Deferring two spend-heavy dependencies does not make the product beta-ready.
Before invitations open, Marathoner still requires:

- a paid Apple Developer Program membership, distribution signing, a clean
  archive, and the first external TestFlight App Review;
- allowlisted access and no public account creation;
- privacy, consent, deletion, account isolation, and incident-response proof;
- reliable manual logging and automatic import for each invited runner's
  actual device ecosystem;
- safe retry, reconnect, duplicate, stale-data, and partial-failure behavior;
- App Check, Firebase authorization, staged enforcement, and rollback evidence;
- physical-iPhone accessibility, lifecycle, and critical-journey rehearsal;
- a support route, recruitment-pause authority, withdrawal path, and bounded
  feedback process; and
- versioned provisional artifacts, deterministic fixtures, change control, and
  a kill switch or retirement path.

## Re-evaluation triggers

Revisit entity formation, Apple organization enrollment, and independent
professional methodology review before any of these occurs:

- public sign-up, open invitations, or distribution beyond the small known
  cohort;
- a public App Store release intended to show Marathoner as the seller;
- claims that Marathoner's methodology is professionally reviewed,
  individualized coaching, or medical guidance;
- a materially broader participant segment, plan family, adaptation action, or
  content scope;
- meaningful revenue, a material contract, shared legal ownership, equity, or
  institutional fundraising; or
- beta evidence shows that professional review or a different legal structure
  is needed sooner for safety or responsible operation.

## Apple facts used by this decision

Apple currently lists the Developer Program at **$99 per membership year**.
For an individual enrollment, the person's legal name is shown as the seller.
Apple directs an individual enrollee to use their own card to complete the
purchase. TestFlight supports external testers, but the first build added to an
external group must pass TestFlight App Review.

Authoritative references:

- [Apple Developer Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
- [Invite external TestFlight testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)
- [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)

## Later migration

The prepared California LLC and Apple organization path remains useful future
work. When a trigger is reached, reassess entity structure, ownership,
addresses, tax obligations, intellectual-property assignment, D-U-N-S data,
App Store Connect transfer constraints, and Apple account migration using
current professional and platform guidance. Do not assume today's prepared
sequence or costs will still be correct.
