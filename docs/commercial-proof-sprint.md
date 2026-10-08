# Commercial proof sprint

- **Status:** Dormant optional plan; no participant evidence collected
- **Ratified:** October 6, 2026
- **Moved off the beta critical path:** October 8, 2026 by
  [#223](https://github.com/marathoner-app/marathoner/issues/223)
- **Owner:** Kevin Tulloch
- **Commercial evidence epic:** [#126](https://github.com/marathoner-app/marathoner/issues/126)
- **Plan issue:** [#211](https://github.com/marathoner-app/marathoner/issues/211)
- **Milestone:** [Commercial Proof 01 — Proposition and Reservation](https://github.com/marathoner-app/marathoner/milestone/12)
- **Safety authority:** [#119](https://github.com/marathoner-app/marathoner/issues/119)
- **Founding-beta contract:** [#117](https://github.com/marathoner-app/marathoner/issues/117)

## Current decision

The [product-first free-beta decision](product-first-beta-decision.md)
supersedes this sprint's priority and gating effect. Marathoner will build and
release a functional free beta before requiring formal interviews,
reservations, or paid concierge evidence. Issues #211–#214 and the artifacts in
this document remain reusable preparation, but they do not prove demand and do
not block product delivery or founding-beta invitations. Issues #215–#218 are
retired from the active beta plan unless a later recorded decision reactivates
commercial validation.

The remainder of this document preserves the frozen research design so it can
be used without retroactively changing its rules if the optional track resumes.

## Original October 6 decision

Marathoner remains a conditional go, but feature completeness is not the next
business uncertainty to retire.

The category shows that runners use free training plans, buy adaptive training
products, and sometimes pay substantially more for human coaching. That is
evidence that a market exists. It is not evidence that someone will pay for
Marathoner, that the proposed price is right, or that Marathoner can acquire and
support customers economically.

The October 6 plan proposed testing this
working proposition:

> Your first marathon, responsibly adjusted when real life happens—with every
> consequential change explained and approved by you.

The target moment is after a first-time marathoner chooses a race or plan and
then discovers that illness, pain signals, missed training, work, family, or
another disruption has made the original schedule uncertain.

Under the original plan, this sprint did not pause work necessary to conduct responsible
research or protect future participants. Qualified-review engagement, security,
privacy, deletion, evidence integrity, and the active App Check slice may
continue. The October 8 decision removes its hold on the full bounded adaptation
engine and other beta functionality. Product payments and acquisition-scale
work remain outside beta scope for product and operational reasons, not because
this optional study must run first.

## What the research supports

Current public evidence supports five bounded observations:

1. A generic personalized plan is not a defensible proposition by itself.
   Nike publishes an 18-week marathon plan in Nike Run Club, and Garmin offers
   personalized plans that change with performance and recovery.
2. Runners do pay for adaptive training. Runna currently advertises
   $19.99 monthly and $119.99 annually.
3. Strategic buyers value training products. Strava announced its agreement to
   acquire Runna in April 2025.
4. Disruption is credible. A BMJ Open Sport & Exercise Medicine paper reports
   pre-marathon or half-marathon running-related-injury prevalence of
   29.2–43.5% in the cited literature and notes that injuries can prevent
   runners from reaching the start. This supports researching uncertainty and
   disruption; it does not support an injury-prevention claim.
5. Distribution is a first-order risk. RevenueCat's 2026 subscription report
   describes a crowded market, long time-to-revenue even in Health & Fitness,
   and highly unequal outcomes.

These observations justify a focused test. They do not establish:

- that 150,000–250,000 US first-marathon registrations occur annually;
- the percentage who experience the proposed problem;
- demand for Marathoner's exact approach;
- a $79, $99, $129, $199, $249, or $299 acceptable price;
- an economically repeatable channel;
- a support burden below 30 minutes per runner per week; or
- a path to venture-scale or founder-wealth outcomes.

The market denominator and financial scenarios remain order-of-magnitude
hypotheses until a reproducible source and bottom-up model replace them.
Acquisitions of other fitness products show strategic possibility, not a
valuation comparable for Marathoner.

## The differentiation hypothesis

Marathoner should not compete on plan generation alone. Its proposed wedge is
the combination of:

- an honest readiness and race-timeline decision;
- an explicit response when reality no longer matches the schedule;
- a small bounded set of hold, repeat, reschedule, reconsider, or no-change
  outcomes;
- an explanation of the evidence, uncertainty, and consequence;
- runner approval before a material change; and
- an auditable record of the decision.

The phrase above is research copy, not an approved medical, safety, or outcome
claim. Interviews must test whether participants understand and value it in
their own words.

## Two segments that must not be confused

### Commercial-discovery segment

Artifact research may include English-speaking US adults who are preparing for
a first marathon within approximately two to twelve months and who have
registered for a race, selected a plan, or recently experienced a meaningful
plan disruption.

This segment is intentionally broader than the live beta. It may include
people starting from a lower base or returning after inconsistency because
they are reacting to fictional concepts, not receiving a plan or
recommendation. The private evidence ledger must tag starting point,
race-registration status, existing plan, disruption, alternative, and source
so one subgroup cannot silently stand in for the whole market.

### Live-product segment

Live product use remains constrained by the founding-beta contract and
qualified methodology approval. The draft 40–45 km weekly-distance,
four-to-five-day frequency, and 14–20 km long-run boundaries are unapproved
methodology proposals. They are neither a market definition nor evidence that
the broader first-time-marathon customer is safe to serve.

Commercial evidence may show that the draft segment is too advanced to test
the intended problem. It may justify asking the qualified reviewer to evaluate
a different future segment. It cannot itself change a threshold or authorize
live advice.

## Offer hypotheses

The sprint tests three connected offers without committing to any of them:

| Offer | Initial hypothesis | What this sprint may test |
| --- | --- | --- |
| Readiness assessment | Free acquisition experience | A fictional result and whether the questions and explanation feel useful. It cannot make a real feasibility recommendation before the methodology is approved. |
| Self-serve First Marathon Journey | $99 fixed duration, no automatic renewal | A $25 fully refundable reservation credited toward the stated $99 total. The $79 and $129 values are qualitative sensitivity prompts, not a powered price test. |
| Human-reviewed concierge journey | $249 initial hypothesis | Five paid or deposited commitments, the provenance of every live decision, comprehension, and support time. The broader $199–$299 range remains a later pricing question. |

One price and one reservation request must be used for the behavioral test.
Rotating three prices across 15–20 interviews would create small cells and
false precision. A different price requires a new protocol version and
rationale.

The reservation is a research operation, not product payment functionality.
It uses a hosted processor, has no recurring billing, and must be fully
refundable through a rehearsed path.

## Gates before evidence collection

No interview, payment request, or pilot enrollment begins merely because this
plan is merged.

### Research-operations gate

Issue [#212](https://github.com/marathoner-app/marathoner/issues/212) must:

- select a private system for contact details, consent, scheduling, raw notes,
  optional recordings, reservations, and refunds;
- define access, minimum collection, retention, withdrawal, deletion, and
  incident response;
- prohibit recording for this sprint; any later recording proposal must add
  separate optional consent and preserve an equivalent no-recording path; and
- rehearse withdrawal and deletion using synthetic data.

The selected, owner-only Workspace design is recorded in the
[commercial research operations runbook](operations/commercial-research-operations.md),
and its
[dated synthetic withdrawal rehearsal](operations/evidence/2026-10-06-commercial-research-withdrawal-rehearsal.md)
passed. That result proves the small-study operating path; it does not by
itself authorize real recruitment, payment, or a product pilot.

### Artifact and claim gate

Issue [#213](https://github.com/marathoner-app/marathoner/issues/213) must
create two accessible, synthetic artifacts:

1. a fictional readiness result that shows the inputs considered,
   uncertainty, explanation, and next decision; and
2. a fictional disruption example that shows bounded options, the reason for a
   consequential change, and an approval choice.

Each artifact must say that it is a research concept, not an individualized
plan. It may not diagnose, prescribe, promise injury prevention, guarantee an
outcome, or imply that the draft methodology has been approved.

The versioned
[readiness and adaptation research artifacts](design/commercial-research-artifacts/README.md)
include the facilitator path, claim boundary, accessibility contract, and
local-only source files. They passed #213 review. Real interviews remain
blocked until the #214 protocol is merged, #215 approves and rehearses the
reservation path, and the research collection boundary is intentionally
activated.

### Protocol and metric gate

Issue [#214](https://github.com/marathoner-app/marathoner/issues/214) must
freeze the screener, non-leading questions, artifact tasks, follow-ups,
definitions, source tags, evidence ledger, and public summary template before
the first participant response.

Protocol revisions retain the original version, the date, and the reason.
Results from materially different protocols are reported separately.

The frozen
[commercial interview protocol and evidence rubric](operations/commercial-interview-protocol.md)
defines the exact screener, non-leading prompts, source attribution, atomic
ledger fields, classifications, observation windows, decision metrics, private
note templates, and public aggregate format. Its
[synthetic rehearsal](operations/evidence/2026-10-06-commercial-interview-protocol-rehearsal.md)
reproduces enthusiastic, ambiguous, and negative classifications without
treating sentiment as evidence. Real collection remains blocked by the
activation and reservation gates.

### Reservation gate

Issue [#215](https://github.com/marathoner-app/marathoner/issues/215) must
confirm the seller identity, payout destination, support route, hosted
processor, price, credit, expiration, cancellation, and refund terms. It must
complete one end-to-end checkout and full-refund rehearsal without adding
card handling or payment secrets to Marathoner.

The owner should obtain appropriate tax and legal advice for the seller's
jurisdiction before accepting public payments. This repository records the
operating controls; it does not supply legal or tax approval.

### Concierge gate

Issue [#217](https://github.com/marathoner-app/marathoner/issues/217) may open
only after the interview and reservation gate passes.

Before applicable methodology is approved, the concierge experience may:

- display a participant-supplied plan;
- record planned and completed work;
- collect structured reflection;
- use fictional decision tasks; and
- explain a live decision supplied by a qualified reviewer.

It may not let the founder or software originate a participant's live hold,
repeat, reschedule, pain, fueling, hydration, sleep, or recovery
recommendation. If no qualified person owns a live decision, that part of the
pilot remains a fictional comprehension test.

## Evidence sequence

| Order | Issue | Evidence produced | O / L / C units |
| ---: | --- | --- | ---: |
| 1 | [#211](https://github.com/marathoner-app/marathoner/issues/211) | Ratified plan, repository priority, and issue graph | 4 / 6 / 9 |
| 2 | [#212](https://github.com/marathoner-app/marathoner/issues/212) | Private operations and synthetic withdrawal/deletion rehearsal | 3 / 5 / 8 |
| 3 | [#213](https://github.com/marathoner-app/marathoner/issues/213) | Readiness and disruption artifacts | 4 / 7 / 10 |
| 4 | [#214](https://github.com/marathoner-app/marathoner/issues/214) | Frozen protocol, screener, ledger, and rubric | 3 / 5 / 7 |
| 5 | [#215](https://github.com/marathoner-app/marathoner/issues/215) | Hosted checkout and full-refund proof | 4 / 6 / 9 |
| 6 | [#216](https://github.com/marathoner-app/marathoner/issues/216) | 15–20 interviews and at least ten reservation requests | 14 / 20 / 30 |
| 7 | [#217](https://github.com/marathoner-app/marathoner/issues/217) | Five commitments and first two pilot weeks | 7 / 11 / 17 |
| 8 | [#218](https://github.com/marathoner-app/marathoner/issues/218) | Anonymized decision and roadmap reforecast | 2 / 3 / 5 |
| **Total** |  |  | **41 / 63 / 95** |

Issues #212, #213, and #214 may proceed in parallel after this plan merges.
Reservation operations may overlap artifact work after the privacy boundary is
ready. Interviews require all four preparation gates. The concierge pilot
requires the interview and reservation result. The decision requires both
evidence paths or a recorded stop gate.

## Precommitted definitions

- **Qualified interview:** one unique person meeting the frozen commercial
  screener who completes the core problem and artifact tasks.
- **Recurring, consequential workaround:** a behavior used on at least two
  occasions, or one unresolved episode lasting at least seven days, in which
  the person changed, abandoned, guessed at, or sought outside help for the
  plan and can describe a meaningful time, money, confidence, or race
  consequence.
- **Concrete eight-week commitment:** the person agrees to a defined start
  window, contact cadence, and follow-up action and permits scheduling the
  next step. General enthusiasm and an email address do not count.
- **Qualified reservation prospect:** a qualified interviewee who understands
  the offer, is in the supported commercial geography, can use the proposed
  journey during the stated window, and is shown the same terms.
- **Reservation:** the hosted processor confirms the $25 charge. A stated
  intention, abandoned checkout, waived payment, or friend/family courtesy
  does not count.
- **Comprehension success:** without facilitator coaching, the participant can
  state the next action, why it was proposed, what consequentially changes, and
  whether approval is still required.
- **Support time:** scheduled and unscheduled founder or reviewer minutes spent
  on setup, clarification, troubleshooting, recommendation handling, and
  participant administration. Research interviews are tracked separately.
- **Cash acquisition cost:** channel spend divided by confirmed reservations
  attributed under the frozen source rule. Founder time is reported alongside
  it, not assigned an invented cash value.
- **Net journey revenue before acquisition:** collected journey price less
  refunds, payment fees, and directly attributable discounts. Acquisition and
  support costs are reported separately. This is not lifetime value.

## Decision rules

| Evidence | Gate | Required disposition when missed |
| --- | --- | --- |
| Recurring consequential workaround | At least 5 of the first 15 qualified interviews | Reposition the problem and rerun the protocol before more feature build. |
| Eight-week commitment | At least 5 of the first 15 qualified interviews | Stop the current proposition; do not substitute a larger top-of-funnel count. |
| Behavioral payment | At least 3 of 10 qualified prospects place the reservation | Do not build product payments or the full adaptation engine. Revisit offer, segment, or problem. |
| Explanation trust | At least 4 of 5 concierge participants pass the comprehension task | Redesign the explanation and approval experience before expansion. |
| Human support | Average at or below 30 minutes per runner per week for each of the first two complete weeks | Redesign the operating model; report onboarding separately so it cannot be hidden. |
| Paid-channel economics | Observed cash acquisition cost at or below one-third of net journey revenue | Pause that channel. Do not call a channel viable from fewer than ten paid conversions. |
| Safety, privacy, consent, integrity, provenance, or misleading claim | No unresolved critical failure | Stop recruitment and payment requests regardless of commercial counts. |

These are management thresholds for a small directional study. They do not
estimate population conversion, establish product-market fit, or produce a
defensible lifetime-value model. The final decision must include denominators,
source mix, uncertainty, and negative evidence.

## Public and private evidence

The public repository may contain:

- versioned protocols and fictional artifacts;
- definitions and precommitted thresholds;
- aggregate counts and source categories;
- anonymized themes, objections, and counterexamples; and
- proceed, reposition, stop, or redesign decisions.

The public repository must not contain:

- names, contact details, account or transaction identifiers;
- individual health or training history;
- consent records, raw notes, or recordings;
- quotes whose context can reasonably identify the speaker;
- private partner discussions, payment credentials, or transaction records; or
- a row-level dataset from which participants can be reconstructed.

## Capacity and roadmap effect

The October 6 capacity forecast assigned 41 optimistic, 63 likely, and 95
conservative units to this sprint, replacing a smaller #126 placeholder. The
October 8 product-first decision removes all 41 / 63 / 95 units from the beta
critical path. They remain a reference estimate only if this optional track is
reactivated.

Recruitment and scheduling would still control elapsed time if the track
resumes. They no longer control the free-beta invitation forecast, and issue
#218 is not the next beta reforecast gate.

The sprint remains a valid way to reduce commercial risk. The owner has chosen
to accept that risk for now in order to prioritize product realization and
motivation.

## Sources and limits

- [Nike running training plans](https://www.nike.com/running/training-plans/)
  — current first-party evidence of an 18-week Nike Run Club marathon plan.
- [Garmin Coach running](https://www.garmin.com/en-GB/garmin-coach/running/)
  — current first-party evidence of personalized workouts that change with
  performance and health metrics.
- [Runna pricing](https://www.runna.com/en-gb/pricing)
  — current first-party advertised monthly and annual prices.
- [Strava announcement of the Runna acquisition](https://press.strava.com/en-gb/articles/strava-to-acquire-runna-a-leading-running-training-app)
  — evidence of the announced April 2025 transaction, not Marathoner value.
- [BMJ Open Sport & Exercise Medicine injury-pattern study](https://bmjopensem.bmj.com/content/10/1/e001766)
  — supports researching disruption; does not validate an injury-prevention or
  individualized training claim.
- [RevenueCat State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps)
  — broad subscription-app context, not a Marathoner conversion forecast.

Each source observation is narrower than the proposition being tested. The
sprint must learn from Marathoner prospects rather than treating competitor
success or category data as proof by analogy.

## Completion

If this optional track is reactivated, issue #126 completes only when a later
decision issue publishes an anonymized result that applies the frozen rules
and reconciles the roadmap. The allowed outcomes remain:

- **Proceed:** the problem, commitment, reservation, trust, and operating
  signals justify the next bounded product experiment.
- **Reposition:** the problem is real but the segment, moment, language, or
  offer is wrong.
- **Stop:** the current proposition fails the problem, commitment, or payment
  gate.
- **Redesign the operating model:** people value the result, but human effort,
  decision provenance, or support economics cannot support the proposed
  product.

No outcome authorizes unreviewed methodology or removes the founding beta's
safety, privacy, integrity, deletion, and support gates.
