# Founding-beta endurance-methodology review control manifest

- **Status:** Prepared, not sent; no reviewer is contacted, scheduled, engaged,
  or represented as having approved Marathoner
- **Prepared:** 2026-10-08
- **Review role:** Endurance-methodology reviewer (`EMR`)
- **Parent issues:** [#229](https://github.com/marathoner-app/marathoner/issues/229),
  [#191](https://github.com/marathoner-app/marathoner/issues/191), and
  [#119](https://github.com/marathoner-app/marathoner/issues/119)
- **Machine-readable manifest:**
  [`endurance-review-outreach-packet.json`](endurance-review-outreach-packet.json)
- **Reviewer invitation:**
  [`endurance-review-invitation.md`](endurance-review-invitation.md)
- **Reviewer workbook:**
  [`endurance-reviewer-workbook.md`](endurance-reviewer-workbook.md)

> **Not approved. Not training advice. Not permitted in runtime code.** This
> internal manifest pins the exact draft under review. Do not use this document
> as the candidate's initial introduction to Marathoner. Preparing, sending,
> accepting, or reviewing material is not approval evidence.

## Review delivery model

The reviewer experience and Marathoner's internal evidence trail are separate:

1. The candidate first receives the short, professional
   [invitation](endurance-review-invitation.md). It contains no source-code,
   commit, or checksum language.
2. An interested candidate receives the same human-readable
   [reviewer workbook](endurance-reviewer-workbook.md) in a convenient document
   format. The workbook explains the proposed runner, plan, limits, questions,
   and response fields without requiring GitHub knowledge.
3. Marathoner privately retains the candidate-specific correspondence and uses
   this control manifest to prove which underlying artifacts the workbook
   represented. The product owner translates the returned plain-language
   decisions into the repository approval record and obtains the reviewer's
   explicit confirmation that the record is accurate.

Every candidate receives materially identical methodology, questions, decision
choices, evidence requirements, and compensation independence. Candidate
contact details, correspondence, contracts, and screening notes stay in
controlled private storage.

Changing a threshold, schedule, fixture, reason code, question, or reviewed
file requires a new packet manifest, new hashes, and a new review round. A
review decision does not transfer to another commit or artifact version.

## Pinned review target

- Repository commit:
  [`1ef241ac5b6bdbe52d819e7107b25d9ba9347b23`](https://github.com/marathoner-app/marathoner/tree/1ef241ac5b6bdbe52d819e7107b25d9ba9347b23)
- Review protocol: `methodology-review@0.1.0`
- Rule bundle: `beta-rules@0.1.0-draft`
- Bundle state: draft, unapproved, and runtime-ineligible
- Submitted inventory IDs: `ELIG-001`, `ELIG-002`, `FEAS-001`, `PLAN-001`,
  `PROG-001`, `UNSUP-001`, and `UNSUP-002`

The exact files and SHA-256 values are:

| File | Version | SHA-256 |
| --- | --- | --- |
| `docs/methodology/README.md` | `methodology-review@0.1.0` | `2e644e24f009bdb4f5573ea3fdc7ee9172b5de1b54f95dfcdddd10eabaffd1b4` |
| `docs/methodology/beta-review-inventory.md` | `founding-beta-inventory@2026-10-08` | `332c3e7fd03ec47abf2f6ba07cf408d4a26268aaced6cd384659cefe45d05bfa` |
| `docs/methodology/approval-record-template.md` | `methodology-approval-record@2026-10-08` | `8ecc59f8f881ef6fc0bc7d29a693ae00860bd60927b85021d7c23ae28a1fa3b6` |
| `docs/methodology/artifacts/beta-rules/0.1.0-draft/README.md` | `beta-rules@0.1.0-draft` | `477fd2474d3a6eab06b4a75f32119d1027ab43715b571bb726abe8396f26bb5f` |
| `docs/methodology/artifacts/beta-rules/0.1.0-draft/beta-rules.json` | `beta-rules@0.1.0-draft` | `dd5f7a00a9bcfae7c833a6ebd869e43c96dee91c2884603286bf3f14512b2657` |
| `docs/methodology/artifacts/beta-rules/0.1.0-draft/fixtures.json` | `beta-rules@0.1.0-draft` | `c54c5ca4a06fdcf8f675da93c368186645c39005739815bcaf9dffb116a64f49` |
| `docs/methodology/artifacts/beta-rules/0.1.0-draft/SHA256SUMS` | `beta-rules@0.1.0-draft-manifest` | `26c48038d075febe24045f5fea39ad4816c7f97fa33132284c82d9ae5a040b69` |

The machine-readable manifest is the source of truth for these values.
Automated tests recalculate every listed file hash so later edits fail closed
until the packet is deliberately repinned.

## Submitted scope

The draft concerns one narrow founding-beta segment:

- an adult, English-language participant in the United States;
- already running consistently for the proposed minimum history;
- preparing for a first marathon with a completion-only goal;
- inside the proposed recent weekly distance, running-frequency, recent long
  run, availability, safety-state, and exact race-horizon bounds; and
- receiving one deterministic four-run-per-week plan family with no pace or
  finish-time target.

The submitted rule bundle covers:

- cohort eligibility and complete-input thresholds;
- supported race feasibility and explicit infeasible-date rejection;
- plan duration, weekly structure, phase sequencing, cutbacks, taper, race
  week, and post-race rest assignments;
- weekly and long-run progression limits; and
- deterministic unsupported results for out-of-scope, incomplete, conflicting,
  or infeasible inputs represented in the packet.

## Explicit exclusions

This review does not authorize:

- no-running, inconsistent-running, return-to-running, youth, pregnancy,
  clinical rehabilitation, or non-US/non-English cohorts;
- diagnosis, treatment, injury-prevention claims, or clinical pain and unusual
  symptom decisions;
- fueling, hydration, supplements, individualized nutrition, sleep, shoes, or
  general recovery guidance;
- reschedule, hold, repeat, no-change, or any other ongoing adaptation;
- pace targets, finish-time promises, autonomous increases in load or
  intensity, or recommendations outside an approved deterministic rule;
- implementation, deployment, beta invitations, or removal of any privacy,
  security, safety, integrity, operational, or TestFlight gate; or
- any artifact other than the exact pinned files and submitted inventory IDs.

Clinical safety remains owned by the separate `CSR` review and #134. Nutrition
and hydration remain owned by the separate `SNR` review and #135. The draft
rules may operate only after an approved safety gate yields `none_reported`;
this packet neither defines nor approves that safety gate.

## Reviewer qualification and independence confirmation

Before work begins, the candidate must provide enough attributable evidence to
record all of the following:

1. the current endurance-coaching credential and issuer, or the formal
   education and professional standing offered as an equivalent basis;
2. recent experience designing or supervising adult recreational marathon
   preparation, including first-marathon participants;
3. competence to assess eligibility, race feasibility, training load, workout
   sequencing, recovery placement, progression, cutbacks, tapering, and
   explicit unsupported cases;
4. any portion outside the candidate's competence;
5. every employment, equity, referral, family, authorship, sponsorship,
   competing-product, or other interest a reasonable reader could consider
   material; and
6. freedom to approve, condition, reject, or decline any row without effect on
   compensation.

The product owner authored the submitted draft and cannot approve it. A
material reviewer conflict requires reassignment or a second independent
reviewer for the affected scope.

## Compensation rule

If compensation is offered, it pays only for the candidate's review time at a
fixed fee or agreed hourly rate. Payment cannot depend on approving an item,
the overall decision, producing a favorable statement, or permitting product
release. The amount, invoicing, and private terms stay outside the repository;
the public approval record discloses that compensation occurred and that it
was not outcome-contingent.

## Required review questions

The reviewer must answer every question or mark it outside their competence.

1. Are eight consecutive consistent-running weeks and the proposed 40–45 km
   weekly distance, four-to-five-day frequency, and 14–20 km recent-long-run
   boundaries sufficient and appropriately narrow for this exact segment?
2. Is an exact race date 18–22 whole weeks after plan start an acceptable
   supported horizon, and are earlier, later, windowed, or missing dates
   rejected correctly?
3. Are four conversational-effort runs per week, their distribution, the
   cutback placement, the 28 km peak long run, the 54 km peak week, and the
   three-week taper appropriate for the supported segment?
4. Is returning to the previous high after a cutback and limiting new weekly
   highs to two-kilometer increments acceptable? If not, what deterministic
   replacement and evidence should be reviewed?
5. Are race week and seven post-race rest assignments represented correctly
   without creating an unsupported recovery prescription?
6. Do the deterministic unsupported cases omit any unsafe, ambiguous, or
   insufficiently evidenced input? List every additional refusal condition.
7. Does every submitted reason code accurately trace to the stated inventory
   item and product behavior?
8. Must consistent-running history be added to normalized runtime input before
   eligibility can be decided, and is self-reported history sufficient for the
   founding beta or must a recorded history window be required?
9. Are the sources used appropriately—as context for independent judgment
   rather than proof that Marathoner's exact thresholds are universally safe?
10. For each submitted inventory row, what is the decision, concise rationale,
    limitation, required correction, and additional evidence, if any?
11. What overall decision applies to this exact draft, and what must happen
    before a non-draft candidate can be explicitly confirmed?

## Decision options

Use only these row-level options:

- **Approve for non-draft finalization:** the exact draft content is acceptable
  for conversion to a pinned non-draft candidate. This is not final approval;
  the reviewer must separately confirm the exact final version and hashes.
- **Conditional:** use remains blocked. State every condition and the evidence
  required for re-review.
- **Reject:** use remains blocked. State why the row is unacceptable or should
  be removed from the supported beta.
- **Outside competence:** make no decision; identify the qualification needed
  for a replacement reviewer.

Use only these overall options:

- **Approve for non-draft finalization**
- **Conditional**
- **Reject**
- **Partially reviewed**

Any condition or rejection creates a blocking corrective issue. No draft,
conditional, rejected, partially reviewed, unknown, retired, or scope-mismatched
version may serve a participant recommendation.

## Evidence expected from the reviewer

The returned evidence must include:

- reviewer name, role, qualification basis, issuer, current status, and public
  verification source when one exists;
- relevant first-marathon/adult recreational coaching experience;
- conflicts and whether compensation was offered, explicitly stating that it
  was not contingent on outcome;
- one decision and rationale for every submitted inventory ID;
- answers to all required questions, additional unsupported cases, and any
  limits on the reviewer's competence;
- an overall decision; and
- a dated, attributable confirmation of the exact response record and
  attestation below.

A call, invoice, informal comment, or maintainer-authored summary is not enough.
The reviewer must author the record or explicitly confirm its exact wording in
a dated source that can be linked from the repository approval record.

## Blank approval record

Marathoner maintains the canonical blank
[`approval-record-template.md`](approval-record-template.md), pinned above as
`methodology-approval-record@2026-10-08` with SHA-256
`8ecc59f8f881ef6fc0bc7d29a693ae00860bd60927b85021d7c23ae28a1fa3b6`.
It is internal traceability structure, is not sent as the reviewer workbook,
and contains no maintainer-entered decision. After an exact non-draft candidate
exists, reviewer-authored or explicitly confirmed evidence is transferred into
a dated copy without changing its meaning.

## Internal blank reviewer response and approval input

This record is Marathoner's traceability representation of the response fields
in the human-readable workbook. Do not ask the candidate to navigate this
manifest. Do not pre-fill a decision on the reviewer's behalf. After the review,
the candidate must explicitly confirm that the mapped record accurately
represents their written decisions.

### Reviewer and scope

| Field | Reviewer response |
| --- | --- |
| Reviewer name | `[Blank]` |
| Review role | `EMR` |
| Qualification, issuer, and current status | `[Blank]` |
| Public verification source and checked date | `[Blank]` |
| Relevant adult recreational and first-marathon experience | `[Blank]` |
| Scope accepted | `[Blank: exact scope / exceptions / outside competence]` |
| Conflicts | `[Blank: disclosure or None]` |
| Compensation | `[Blank: unpaid / paid for time, never contingent on outcome]` |
| Review completed | `[Blank: YYYY-MM-DD]` |
| Repository commit | `1ef241ac5b6bdbe52d819e7107b25d9ba9347b23` |
| Bundle | `beta-rules@0.1.0-draft` |

### Inventory decisions

| Inventory ID | Decision | Rationale and limitations | Required correction or evidence |
| --- | --- | --- | --- |
| `ELIG-001` | `[Blank]` | `[Blank]` | `[Blank]` |
| `ELIG-002` | `[Blank]` | `[Blank]` | `[Blank]` |
| `FEAS-001` | `[Blank]` | `[Blank]` | `[Blank]` |
| `PLAN-001` | `[Blank]` | `[Blank]` | `[Blank]` |
| `PROG-001` | `[Blank]` | `[Blank]` | `[Blank]` |
| `UNSUP-001` | `[Blank]` | `[Blank]` | `[Blank]` |
| `UNSUP-002` | `[Blank]` | `[Blank]` | `[Blank]` |

### Required answers and additional unsupported cases

Reviewer answers to questions 1–11: `[Blank]`

Additional unsupported or ambiguous cases: `[Blank or None]`

Additional evidence or replacement rules proposed: `[Blank or None]`

Overall decision: `[Blank: one allowed overall option]`

### Attestation

The reviewer must author or explicitly confirm this plain-language statement.
Marathoner's product owner records the technical version and integrity evidence
separately:

> I independently reviewed the intended runner, race-timing rules, proposed
> plan, progression limits, and unsupported cases described in the workbook
> provided to me. My decisions, reasoning, limitations, conflicts, and required
> changes are represented accurately. I was free to accept, revise, reject, or
> decline any part of the review, and any compensation was for my time rather
> than a particular outcome. I understand that my review applies only to the
> proposal described in that workbook and does not endorse Marathoner or uses
> outside that scope.

Reviewer confirmation date: `[Blank: YYYY-MM-DD]`

Attributable confirmation source: `[Blank]`

## Standard outreach for #231

Use the [reviewer invitation](endurance-review-invitation.md) for first contact.
Only the candidate-specific fields approved in #231 may vary. Do not send this
control manifest or ask the candidate to interpret repository commits,
artifact identifiers, inventory codes, or checksums.

If the candidate expresses interest, provide the
[reviewer workbook](endurance-reviewer-workbook.md) in an accessible document
format. Work begins only after both parties agree in writing on the scope,
schedule, deliverable, compensation, conflicts, and permitted public evidence.

## Screening and engagement status

A controlled private register contains three screened candidate identities,
public verification links, contact routes, experience evidence, conflict notes,
open verification questions, and outreach priority. It is excluded from Git.

| Evidence | Count | Meaning |
| --- | ---: | --- |
| Plausible candidate profiles screened | 3 | Public information suggests the EMR minimum may be met; direct confirmation is still required |
| Contacted | 0 | No outreach has been sent |
| Scope accepted | 0 | No candidate has accepted this scope |
| Scheduled | 0 | No review date is agreed |
| Engaged | 0 | No candidate may be called the Marathoner reviewer |
| Decision evidence | 0 | No methodology is approved |

The three profiles include a high-priority graduate exercise-physiology coach
with a current recognized directory listing and advertised consulting; a
graduate applied-exercise-science coach with extensive current marathon work
whose credential standing requires direct confirmation; and a highly
experienced reserve whose ownership of an adjacent commercial training-plan
platform creates a potentially material conflict. These are screening findings,
not claims that any person is available, conflict-free, qualified after direct
verification, or willing to perform the review.

## What happens next

Issue #231 owns outreach and may record a candidate as accepted only after the
candidate explicitly agrees in writing to the workbook scope and deliverable,
independence/conflict terms, schedule, and any non-contingent compensation.
The candidate need not interact with the repository. Marathoner's product owner
owns the internal mapping from the workbook response to the exact pinned
artifacts and must obtain the candidate's dated confirmation of that mapping.

After a draft is acceptable in substance:

1. create a non-draft candidate with a new version and hashes;
2. submit that exact candidate for explicit reviewer confirmation;
3. record the dated attributable decision using
   [`approval-record-template.md`](approval-record-template.md);
4. create blocking issues for every condition or rejection; and
5. keep #70 and participant-facing generation blocked until #119 contains
   complete approval evidence for the exact active non-draft artifacts.
