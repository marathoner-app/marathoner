# Founding-beta endurance rules: `0.1.0-draft`

> **Not approved. Not training advice. Not permitted in runtime code.** This is
> an exact proposal for independent endurance-methodology review. A reviewer
> may approve, condition, reject, or replace every value.

## Packet contents

- [`beta-rules.json`](beta-rules.json) is the machine-readable proposed rule
  bundle.
- [`fixtures.json`](fixtures.json) freezes supported and rejected boundary
  cases.
- [`SHA256SUMS`](SHA256SUMS) pins the files submitted for review.
- The repository's
  [approval-record template](../../../approval-record-template.md) records the
  independent decision; this folder contains no approval evidence.

The packet covers only `ELIG-001`, `ELIG-002`, `FEAS-001`, `PLAN-001`,
`PROG-001`, `UNSUP-001`, and `UNSUP-002`. Safety escalation wording, general
guidance, and ongoing adaptation remain separate unapproved bundles. This
packet may be evaluated only after an approved `beta-safety` gate produces the
`none_reported` state; it deliberately makes no decision for any other safety
state.

## Proposed beta slice

The draft supports a deliberately narrow adult, English-language, US founding
cohort member preparing for a first marathon with a completion-only goal. The
runner must have eight consecutive weeks of consistent running, currently
average 40–45 km across four or five days per week, have a 14–20 km recent long
run, and offer the exact four-day pattern the frozen plan uses. The race must
be an exact date 18–22 whole weeks after plan start. Free-text scheduling
constraints are rejected for manual review rather than interpreted.

The proposed family adds zero to four 40 km lead-in weeks, then an original
18-week distance schedule with four conversational-effort runs per week. It
peaks at 54 km and a 28 km long run, uses cutbacks in core weeks 4, 8, and 12,
and reduces pre-race running over core weeks 15–17. Race week contains no pace
or finish-time target. The plan ends with seven rest assignments after the
race and no post-race running prescription.

These exact numbers are product proposals, not conclusions proved by the
sources. Comparable official plans and observational studies help bound the
review, but they differ in audience and do not establish universal safety.

## Evidence and limitations

The B.A.A. Level One plan describes a four-day novice plan beginning around 25
miles per week, peaking around 40 miles, and using 16–18 mile long runs. The
NYRR conservative plan is 18 weeks and is intended for someone already running
four or five days per week with a longest run around 40 minutes. Marathoner
does not reproduce either schedule.

Kok et al. observed that marathoners below 40 km per week or below a 25 km
longest run were slower, but did not find the measured volume or longest-run
categories associated with new running injuries. Toresdahl et al. observed an
association between more days at an acute-to-chronic distance ratio of at least
1.5 and injury. Nielsen et al. found an exploratory association between
greater two-week distance progression and distance-related injury in novice
runners, while Buist et al. found that a 10-percent-rule program did not reduce
injuries. The packet therefore does not claim that a percentage rule prevents
injury. Its two-kilometer new-high increments and cutback rebounds are explicit
product judgments for review. Smyth and Lawlor's large observational analysis
supports reviewing a disciplined three-week taper, but not these exact taper
distances.

Source URLs and the precise way each source was used are recorded in
`beta-rules.json`. No source is represented as proving the plan safe or
appropriate for every runner.

## Required reviewer decisions

The endurance-methodology reviewer must explicitly decide:

1. whether eight consistent weeks and the 40–45 km, four-to-five-day, and
   14–20 km recent-long-run boundaries are sufficient and appropriately
   narrow;
2. whether the 18–22-week horizon and exact-date requirement are acceptable;
3. whether four conversational runs, the weekly distribution, cutbacks,
   28 km peak long run, 54 km peak week, and three-week taper are appropriate;
4. whether returning to the previous high after a cutback and limiting new
   highs to two-kilometer increments are acceptable;
5. whether race week and seven post-race rest days are represented correctly;
6. whether the deterministic unsupported cases omit any unsafe or ambiguous
   condition; and
7. whether each reason code accurately traces to the stated inventory item.

Any changed threshold, schedule, fixture, or reason code creates a new draft
artifact version and new hashes before review. Approval cannot be applied to a
different commit or file set.

## Known implementation gaps

- `PlanGenerationInputV1` does not yet contain consistent-running duration.
  The field must not be added to runtime input until the reviewer approves or
  changes the proposed boundary.
- Adult, language, country, and first-marathon status belong to a versioned
  allowlisted cohort record checked by the authenticated server caller. The
  pure generator must not infer those facts from identity or device locale.
- The present profile's weekly distance, frequency, and longest run are
  self-reported snapshots. The reviewer must decide whether that evidence is
  sufficient for the founding beta or whether a recorded 28-day history is
  required.
- Pain, unusual symptoms, and unanswered safety input remain owned by #134 and
  the clinical-safety reviewer. They are not generic unsupported-input cases
  and this endurance packet defines neither their reason codes nor their
  runner-facing outcome.
- Issue #70 must fail closed for draft, unknown, conditional, rejected,
  retired, or scope-mismatched artifacts. It may implement only a separately
  pinned, non-draft version with dated approval evidence.

## External sources

- [NYRR conservative 18-week marathon plan](https://webassets.nyrr.org/nyrrsitecoreblob/nyrr/pdf/training-guides/2024/nyrr-marathon-conservative-training-plan_rd5.pdf)
- [B.A.A. Level One marathon training plan](https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/)
- [Kok et al., 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7496388/)
- [Toresdahl et al., 2023](https://pubmed.ncbi.nlm.nih.gov/36113976/)
- [Nielsen et al., 2014](https://pubmed.ncbi.nlm.nih.gov/25155475/)
- [Buist et al., 2008](https://pubmed.ncbi.nlm.nih.gov/17940147/)
- [Smyth and Lawlor, 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8506252/)
