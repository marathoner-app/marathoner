# Product-first free-beta decision

- **Status:** Active product strategy
- **Effective:** October 8, 2026
- **Owner:** Kevin Tulloch
- **Tracking issue:** [#223](https://github.com/marathoner-app/marathoner/issues/223)
- **Founding-beta contract:** [#117](https://github.com/marathoner-app/marathoner/issues/117)

## Decision

Marathoner's critical path is to build and release a functional, responsibly
testable free beta. Formal prospect interviews, refundable reservations,
pre-launch payment evidence, and a paid concierge experiment are not required
to authorize product development or founding-beta invitations.

The founder's present success criterion is to take Marathoner from an idea to a
real product that people can use. This deliberately accepts more uncertainty
about market demand, willingness to pay, acquisition, and eventual business
performance. In exchange, it removes a substantial pre-product detour, reduces
schedule and motivation risk, and directs limited owner attention toward the
working application.

This is not evidence that demand exists. It is a choice about which uncertainty
to retire first.

## Required before the free beta

- a complete supported journey from account access and intake through plan
  approval, daily use, run logging, bounded adaptation, and account deletion;
- dated qualified review of the supported training methodology and safety
  content, or the documented non-prescriptive fallback;
- authorization, privacy, consent, deletion, recovery, data-integrity, and
  incident controls appropriate to the small cohort;
- reliable responsive-web and physical-iPhone behavior, including session,
  reconnect, stale-write, and critical-failure states;
- an externally testable iOS build and a non-owner rehearsal of the critical
  journey;
- support and recruitment-pause procedures; and
- precommitted product-quality, safety, comprehension, and support-burden
  thresholds for the live cohort.

These gates validate whether the product is functional and responsible enough
for real use. They do not claim product-market fit.

## Optional after a usable product exists

- formal problem or pricing interviews;
- refundable-reservation or other prepayment tests;
- paid concierge enrollment;
- acquisition-cost or conversion experiments;
- product payment implementation; and
- investor-grade commercial proof.

Issues [#211](https://github.com/marathoner-app/marathoner/issues/211) through
[#214](https://github.com/marathoner-app/marathoner/issues/214) produced useful
research operations, fictional concepts, and a frozen protocol. Those outputs
remain in the repository as reusable optional infrastructure. They are not
evidence from real participants and do not block the free beta.

Issues [#215](https://github.com/marathoner-app/marathoner/issues/215) through
[#218](https://github.com/marathoner-app/marathoner/issues/218) are retired from
the beta critical path. They may be reopened or replaced only through a later
recorded commercial-priority decision.

## Feedback without a pre-product interview program

The founding beta still requires human feedback. The distinction is that
participants respond to a functional product rather than being asked to prove
the product deserves to be built. The cohort should report defects, confusing
behavior, comprehension, usefulness, trust, safety signals, and support burden.
Optional feedback and privacy-respecting product telemetry may inform later
commercial research without turning payment proof into a release gate.

## Revisit triggers

Reconsider formal commercial validation when any of these becomes true:

- payment implementation enters the active roadmap;
- significant paid acquisition or outside capital is being considered;
- a major product or segment expansion depends on demand evidence;
- live-beta behavior contradicts the proposition; or
- the founder explicitly makes commercial proof a priority again.

Until then, the [zero-to-beta plan](zero-to-beta-plan.md),
[capacity forecast](capacity-forecast.md), and
[founding cohort plan](founding-cohort-plan.md) treat the functional free beta
as the delivery objective.
