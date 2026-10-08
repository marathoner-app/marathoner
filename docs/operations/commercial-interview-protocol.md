# Commercial interview protocol and evidence rubric

- **Status:** Dormant optional protocol; synthetic rehearsal passed and
  real-participant collection remains disabled
- **Moved off the beta critical path:** October 8, 2026 by
  [#223](https://github.com/marathoner-app/marathoner/issues/223)
- **Protocol version:** `commercial-interview-protocol@1.0.0`
- **Effective date:** October 6, 2026
- **Owner and evidence owner:** Kevin Tulloch
- **Tracking issue:** [#214](https://github.com/marathoner-app/marathoner/issues/214)
- **Commercial evidence epic:** [#126](https://github.com/marathoner-app/marathoner/issues/126)
- **Artifact version:** `commercial-research-artifacts@0.1.0`
- **Consent version:** `commercial-research-consent@1.0.0`

## Decision and boundary

The [product-first free-beta decision](../product-first-beta-decision.md)
keeps this protocol available for a later commercial-priority decision. It
does not block the functional free beta, and no real participant has been run
through it.

This protocol freezes the commercial screener, interview prompts, observation
fields, classifications, source attribution, evidence windows, and public
decision format before a real participant can influence them. It tests whether
the proposed problem and offer deserve another bounded experiment. It does not
validate training methodology, establish product-market fit, or determine who
may safely use a live beta.

The **commercial-discovery segment** is an English-speaking United States adult
preparing for a first marathon approximately two to twelve months away who has
registered for a race, selected a plan, or recently experienced a meaningful
plan disruption. This broad segment may review fictional artifacts because the
session gives no individualized plan or recommendation.

The **live-product segment** remains governed by the
[founding-beta contract](../founding-cohort-plan.md) and qualified methodology
review. Weekly distance, frequency, long-run, health, device, and product-access
criteria are not part of this screener. Commercial eligibility is never beta
eligibility, safety clearance, or evidence that a person should train for a
marathon.

No real screening, interview, reservation request, or payment may occur until:

1. the owner confirms the private operating boundary remains active and empty;
2. this protocol has passed review and issue #214 is closed;
3. issue #215 has approved the hosted reservation terms and passed a full-refund rehearsal; and
4. the consent Form is intentionally opened to the approved recruitment audience.

If a participant asks for personal training, medical, pain, fueling, hydration,
sleep, or recovery advice, stop that line of discussion, restate the fictional
research boundary, and do not improvise an answer.

## Fixed study window and order

- `study_started_at_utc` is the timestamp of the first live screener submitted
  after every activation gate passes.
- Enrollment closes at the earliest of the twentieth qualified interview,
  December 6, 2026 at 23:59:59 UTC, or a recorded stop condition.
- The problem and commitment cohort is the first fifteen qualified interviews,
  ordered by `interview_completed_at_utc`, then `participant_id` for a tie.
- The reservation cohort is the first ten qualified reservation prospects who
  receive the fixed request, ordered by `reservation_requested_at_utc`, then
  `participant_id` for a tie.
- A gate is **not evaluable** before its full denominator exists. A smaller
  sample cannot be extrapolated into a pass, and collection does not continue
  beyond a failed stop condition merely to improve the percentage.
- Blank, unknown, or unrecorded values never count as positive evidence. They
  remain visible as missing data and must be reported.

These small counts are directional management evidence. They are not a
statistical estimate of the first-marathon population, a powered price test, or
proof of product-market fit.

## Screener

Use the questions in order. Do not add product copy, beta criteria, safety
language, or coaching. `Prefer not to answer` is respected and does not qualify
the affected required field.

1. **Adult confirmation:** “Are you 18 or older?” (`Yes`, `No`, `Prefer not to answer`)
2. **Country:** “Do you currently live in the United States?” (`Yes`, `No`, `Prefer not to answer`)
3. **Language:** “Are you comfortable completing this research session in English?” (`Yes`, `No`)
4. **First marathon:** “Are you currently preparing for, or seriously considering, your first marathon?” (`Yes`, `No`, `Unsure`)
5. **Time horizon:** “Approximately how many months away is the marathon you are considering?” (whole months or `Unknown`)
6. **Current step:** “Which, if any, is true today?” (`Registered for a race`, `Selected a training plan`, `Experienced a meaningful plan disruption recently`, `None of these`)
7. **Source:** “How did you first hear about this Marathoner research?” (open response, coded under the frozen source rule)

The person is **commercial-discovery eligible** only when questions 1–4 are
`Yes`, the time horizon is 2–12 months inclusive, and at least one current-step
option other than `None` is true. Do not ask for date of birth, address, exact
location, diagnosis, medication, device export, GPS history, race proof, or
medical clearance.

An eligible screener is not yet a qualified interview. The person must also
provide valid research consent and complete the core problem and artifact tasks.

## Interview protocol

The facilitator reads quoted text exactly. Neutral probes may clarify what the
participant already said; they may not supply an example, defend the concept,
teach the intended answer, or turn uncertainty into agreement.

### 1. Open and boundary — two minutes

> Thank you for helping us evaluate an early idea. I am testing the problem and
> the way two fictional screens communicate—not you. Nothing today evaluates
> your readiness or gives you a training or medical recommendation. I will take
> notes, but this session is not recorded. There are no right answers, and
> criticism is useful. You may skip a question or stop at any time.

Confirm the consent record and ask: “Before we begin, what do you understand
this session to be—and not to be?” Correct only a misunderstanding of consent,
recording, or the non-prescriptive boundary.

### 2. Current alternative and last disruption — eight minutes

Ask in order:

1. “Tell me how you are currently deciding what to do for your first marathon.”
2. “What plan, person, app, community, or other approach are you using or most likely to use instead?”
3. “Tell me about the most recent time your intended schedule no longer fit what was happening.”
4. “What did you do next?”
5. “Had something like that happened before? If so, how many separate times?”
6. “How long did the most recent situation remain unresolved?”
7. “What consequence, if any, did it have for your time, money, confidence, or race decision?”
8. “What other options did you consider?”

Allowed neutral probes are: “What happened next?”, “Can you say more about
that?”, “What made that consequential or not consequential?”, and “What did
you use before deciding?” Do not ask whether the situation was frustrating,
painful, unsafe, or something Marathoner could have fixed.

### 3. Fictional artifact tasks — five minutes

Follow the exact path in the
[artifact README](../design/commercial-research-artifacts/README.md#five-minute-facilitator-path).
Do not explain the intended result.

After both tasks, record four independent, uncoached observations:

1. Did the participant state the next action?
2. Did the participant state why it was proposed?
3. Did the participant state what consequentially changes?
4. Did the participant state whether approval is still required?

Use `Yes`, `No`, or `Not observed` for each. “What on the screen led you to
that?” is the only comprehension probe. A coached correction does not change a
`No` or `Not observed` to `Yes`.

### 4. Value, objections, and disconfirmation — eight minutes

Ask in order:

1. “What, if anything, in these concepts would be useful to you?”
2. “What would be least useful?”
3. “What is confusing, concerning, or missing?”
4. “In what situation would you choose your current alternative instead?”
5. “What would make you decide not to use or pay for this approach?”
6. “What about this approach could fail to solve the situation you described?”
7. “If this did not exist, what would you do?”

Record objections and counterexamples even when the participant is otherwise
positive. Do not rebut, discount, or relabel them as feature requests.

### 5. Concrete eight-week commitment — three minutes

Read:

> We may later invite a small group to an eight-week research period with a
> defined start window, a weekly contact cadence, and one scheduled next step.
> This is separate from today's interview and does not promise a place or
> authorize training guidance. Would you want to define those details and let
> us schedule the next step, choose not to, or hear more before deciding?

If the participant chooses to define the details, record the start window,
contact cadence, follow-up action, and scheduling permission separately. Do not
count an email address, praise, wait-list interest, or `hear more` as a concrete
commitment.

### 6. Fixed reservation request — only after #215 activates it

First identify every **reservation candidate** using only qualified-interview
status, supported commercial geography, and ability to use the proposed
journey in the stated window. Do not select candidates based on enthusiasm,
relationship, objection, or expected conversion.

Show every candidate the approved `commercial-reservation-terms@1.0.0` and ask:
“In your own words, what would you pay now, what total would it count toward,
what happens if you cancel, and whether it renews?” Record the first uncoached
answer. A candidate becomes a qualified reservation prospect only when the
approved offer is understood and the identical terms were shown. Report
candidate-to-prospect comprehension failures as negative evidence; never hide
them by reporting only the later denominator.

Read the fixed request to every qualified reservation prospect:

> Marathoner is testing a First Marathon Journey at a total price of $99 with
> no automatic renewal. If the terms on this screen are acceptable, would you
> choose to place a $25 fully refundable reservation now? It would be credited
> toward the $99 total. Choosing no has no effect on today's research. I will
> not persuade you either way.

Show `Place the refundable reservation`, `No`, and `I need clarification` with
equal prominence. Clarify only the approved terms. The request counts when the
same terms, price, and choices are displayed and the exact request is read; it
does not require payment. A confirmed reservation/deposit counts only when the
hosted processor reports a successful $25 charge. Intent, an email address,
an opened or abandoned checkout, a waived charge, or a friend/family courtesy
does not count.

After the behavioral choice is complete, ask these qualitative prompts in the
same order: “How, if at all, would your reaction differ at a $79 total price?”
then “How, if at all, would it differ at a $129 total price?” These responses do
not alter the fixed $99/$25 gate and are not a powered price test.

### 7. Close — two minutes

Ask: “What have I not asked that could change how we interpret your answers?”
Then explain the withdrawal route and remind the participant that the interview,
reservation, and any future pilot are separate decisions.

## Frozen classifications

All positive classifications are computed from atomic ledger fields. The owner
may correct a source fact with a dated change-log entry but may not manually
override a formula to improve a result.

| Classification | Reproducible rule |
| --- | --- |
| Commercial-discovery eligible | Adult `Yes` AND US `Yes` AND English `Yes` AND first marathon `Yes` AND horizon 2–12 months AND at least one current-step signal. |
| Qualified interview | Commercial-discovery eligible AND valid consent AND core problem task complete AND both artifact tasks complete. |
| Recurring consequential workaround | Qualified interview AND (`separate_occurrences >= 2` OR `unresolved_days >= 7`) AND action is `changed`, `abandoned`, `guessed`, or `outside_help` AND at least one meaningful time, money, confidence, or race-decision consequence is present. |
| Concrete eight-week commitment | Qualified interview AND a defined start window AND defined contact cadence AND defined follow-up action AND explicit permission to schedule the next step. |
| Reservation candidate | Qualified interview AND supported commercial geography AND able to use the proposed journey in the stated window. Desire or expected payment is not part of routing. |
| Qualified reservation prospect | Reservation candidate AND approved offer understood AND identical approved terms shown. Desire or expected payment is not part of qualification. |
| Fixed reservation request | Qualified reservation prospect AND exact request read AND approved terms/version shown AND all three choices displayed AND request timestamp recorded. |
| Confirmed reservation/deposit | Fixed reservation request AND hosted processor status `confirmed` AND charged amount exactly `$25.00`. |
| Comprehension success | All four uncoached observations—next action, reason, consequential change, and approval requirement—are `Yes`. |

### Operating and financial definitions

- A **support minute** is one elapsed founder or qualified-reviewer minute spent
  on participant setup, clarification, troubleshooting, recommendation
  handling, or administration. Record date, participant ID, category, and
  whole minutes. Research interview time is excluded and onboarding is reported
  separately.
- **Cash acquisition cost** for a source is that source's recorded cash spend
  divided by confirmed reservations attributed to it. Report founder time next
  to the result, not as invented cash spend. A zero-conversion denominator is
  `not calculable`, not `$0`.
- **Net journey revenue before acquisition** is collected journey price minus
  refunds, processor fees, and directly attributable discounts. Reservation
  cash remains a liability-like refundable amount until the approved terms say
  it is earned; do not present it as journey revenue prematurely.

## Source attribution

Record the earliest documented source the person reports led them to enter this
study. This is an attribution rule, not proof that the channel caused the
response. Preserve a private detail such as campaign or partner name, but
publish only safe aggregate categories.

| Tag | Rule |
| --- | --- |
| `warm_network` | A direct or first-degree founder relationship led to the introduction. |
| `organic` | The person independently found unpaid Marathoner material or reports that an unaffiliated unpaid mention led to the response. |
| `partner` | The person reports that a named organization, coach, club, community, or formal referrer led to the response without paid media. |
| `paid` | A tracked paid-media, sponsorship, placement, or per-lead touch led to the response. |
| `unknown` | No source can be supported from the screener and recruitment record. It remains visible and is never recoded as organic by default. |

If multiple touches exist, use the earliest documented touch the person says
led to the response. Paid exposure is never relabeled organic; a founder relationship is
never relabeled partner solely to make the evidence appear less warm. A factual
correction requires the old value, new value, evidence, owner, timestamp, and
reason in the change log.

## Metrics and decision rules

| Metric | Numerator | Denominator and window | Owner | Interpretation |
| --- | --- | --- | --- | --- |
| Qualified interview yield | Qualified interviews | All completed interview sessions in the enrollment window | Evidence owner | Recruitment quality only; not demand. |
| Recurring consequential workaround | Qualified rows where classification is true | First 15 qualified interviews | Evidence owner | Pass at 5; otherwise reposition problem before more feature build. |
| Concrete eight-week commitment | Qualified rows where classification is true | First 15 qualified interviews | Evidence owner | Pass at 5; otherwise stop the current proposition. |
| Offer comprehension | Qualified reservation prospects | All reservation candidates shown the approved terms | Evidence owner | Directional funnel evidence; every failure remains visible. |
| Reservation request coverage | Fixed requests | First 10 qualified reservation prospects | Evidence owner | Must be 10 of 10; skipped negative prospects are protocol failures. |
| Behavioral payment | Confirmed $25 reservations | First 10 qualified prospects receiving the fixed request | Stripe reconciler and evidence owner | Pass at 3; otherwise product payments and full adaptation remain blocked. |
| Artifact comprehension | Comprehension successes | Qualified interviews with both artifact tasks complete | Evidence owner | Directional interview evidence; report missing observations. |
| Concierge comprehension | Comprehension successes | First 5 concierge participants | Evidence owner | Pass at 4; later #217 gate. |
| Weekly support burden | Total included support minutes | Active participant-weeks in each of the first two complete weeks | Evidence owner | Average must be at or below 30; onboarding shown separately. |
| Paid-source cash acquisition cost | Paid-source cash spend | Paid-source confirmed reservations | Evidence owner | Compare with one-third of net journey revenue only after at least 10 paid conversions. |
| Net journey revenue before acquisition | Collected journey price minus refunds, fees, and attributable discounts | Confirmed journeys in the stated cohort | Evidence owner | Not lifetime value; report reservation treatment and window. |

Any unresolved critical safety, privacy, consent, integrity, provenance, or
misleading-claim failure stops recruitment and reservation requests regardless
of counts. The final public decision must report numerator, denominator,
observation window, source mix, missing data, objections, counterexamples, and
the disposition required by every missed gate.

## Evidence records

- Use the [private interview-note template](templates/commercial-interview-note.md)
  for raw observations. Store completed copies only in `04 Raw notes`.
- Build the private workbook from the
  [evidence-ledger template](templates/commercial-evidence-ledger.md). Store the
  live workbook only in `05 Evidence ledger`.
- Publish only the
  [aggregate decision template](templates/commercial-aggregate-decision.md)
  after applying the suppression and re-identification review in the research
  operations runbook.
- The [synthetic protocol rehearsal](evidence/2026-10-06-commercial-interview-protocol-rehearsal.md)
  proves that enthusiastic, ambiguous, and negative responses reproduce their
  classifications without using sentiment as evidence.

The repository contains blank templates and synthetic verification only. Never
commit participant notes, ledger rows, identity mappings, consent records,
contact details, transaction references, or reconstructable row-level data.

## Change control

This version is immutable once the first real screener opens. A correction or
material change creates a new protocol version and a new dated change-log row
containing the prior version, new version, owner, date, exact change, reason,
affected field or prompt, and whether prior responses remain comparable.

Preserve the original file in Git history. Report materially different versions
as separate cohorts; do not pool them merely because the threshold was missed.
Fixing a typo that cannot change participant interpretation may retain the
major/minor version only when the change log explains why. Changes to segment,
question order, prompts, artifacts, price, terms, source rules, classifications,
thresholds, windows, or formulas always require a new version and rerun of the
synthetic rehearsal.
