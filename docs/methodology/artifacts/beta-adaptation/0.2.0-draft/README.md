# Founding-beta adaptation rules: `0.2.0-draft`

> **Not approved. Not training advice. Not permitted in runtime code.** This is
> an exact product proposal for independent endurance-methodology review. A
> reviewer may approve, condition, reject, or replace every threshold and
> action.

## Packet contents

- [`beta-adaptation.json`](beta-adaptation.json) is the machine-readable rule
  proposal.
- [`fixtures.json`](fixtures.json) freezes representative positive, boundary,
  no-change, and refusal cases.
- [`SHA256SUMS`](SHA256SUMS) pins the three files in this draft artifact.
- The human-readable
  [reviewer workbook](../../../endurance-reviewer-workbook.md) presents these
  decisions without requiring the reviewer to navigate repository internals.

The packet covers `ADAPT-001` through `ADAPT-004`. It depends on the exact
`beta-rules@0.2.0-draft` plan family but does not modify that artifact. Safety
escalation remains a separate unapproved bundle. Any safety state other than
`none_reported` refuses adaptation and delegates to that separate process.

This revision changes only the pinned base-plan dependency from
`beta-rules@0.1.0-draft` to the mile-native `beta-rules@0.2.0-draft`. The
adaptation decisions and thresholds are otherwise unchanged. The prior packet
remains available for provenance of existing owner-dogfood plans.

## Proposed decision boundary

The draft combines plan completion, missed-workout evidence, and repeated
perceived effort. It never treats a single difficult run as enough evidence
for a material change. A hold proposal requires four recent associated effort
answers within 14 days, with at least two marked harder or much harder than
expected. A repeat proposal requires exactly two missed runs in an ordinary
four-run load week, another ordinary load week next, and at least 42 days
before the race, and no run in that plan week may still be pending.

One missed easy or recovery run can be proposed for rescheduling only when the
move stays in the same plan week, occurs within two days, uses an empty date
the runner confirms is available, preserves the workout exactly, creates no
more than two consecutive run dates, and occurs at least 21 days before the
race. A long run is never automatically made up.

The proposal refuses automatic adaptation for stale or incomplete evidence,
an unsupported artifact version, a non-clear safety state, seven days without
a completed planned run, three or more missed runs in a week, two missed runs
inside six weeks of the race, or overlapping repeated-hard and missed-workout
signals. It makes no change when evidence is insufficient, one run alone felt
hard, a cutback or taper already protects load, or a missed run cannot be moved
without stacking training. If two runs are already missed but another run in
that week is still pending, it waits for the week to finish before considering
a repeat.

Every actual reschedule, hold, or repeat requires the runner to accept it. A
decline records the decision and leaves the active plan revision unchanged.
Acceptance must eventually use the separate atomic material-command workflow;
this draft supplies no persistence implementation.

## Evidence and limitations

Saw et al. found subjective measures useful for monitoring response to
training, while the IOC load consensus recommends combining internal and
external information and cautions that no single marker consistently predicts
maladaptation or injury. Those findings support using repeated perceived
effort alongside completed training, not the exact four-run or two-hard
thresholds in this proposal.

Smyth et al. observed a performance cost associated with complete training
disruptions of at least seven days in a large recreational-marathon dataset,
especially later in training. That supports distinguishing a long disruption
from one missed workout, but it does not prescribe Marathoner's refusal or
repeat action. Coyne et al. describe continuing uncertainty around subjective
training-load windows and calculations. Toresdahl et al. support scrutiny of
load spikes but do not validate an individual catch-up rule.

Accordingly, the 14-day evidence window, two-hard threshold, seven-day refusal
boundary, two-miss repeat rule, race-proximity limits, reschedule spacing, and
every resulting action are conservative Marathoner product judgments. They
require explicit independent review; none is represented as proven safe or
optimal.

## Required reviewer decisions

The endurance reviewer must decide:

1. whether the proposed inputs are sufficient and understandable;
2. whether four recorded efforts in 14 days and two hard responses define a
   reasonable repeated signal;
3. whether one hard response always producing no material change is correct;
4. whether the reschedule, hold, and repeat conditions and exact mutations are
   appropriate;
5. whether the race-proximity, long-disruption, conflict, and refusal
   boundaries are conservative enough;
6. whether cutback, taper, and race-week no-change behavior is correct;
7. whether the proposal omits a case that must be refused or reviewed by a
   person; and
8. whether every fixture and reason code matches the intended behavior.

Any changed threshold, precedence rule, mutation, fixture, or reason code
creates a new draft artifact version before review. Closing the authoring issue
does not approve the rules or permit implementation.

## Known implementation gaps

- Runtime code has no adaptation input, result, or evaluator contract.
- The active plan needs revision-safe adjustment commands before an accepted
  change can be stored.
- Associated planned-run history must expose complete, same-plan evidence to
  every supported client.
- Participant-facing explanations remain owned by the guidance and approval
  issues.
- The combined base-plan and adaptation review packet still requires a final
  repository pin plus explicit candidate, timing, and compensation approval.

## External sources

- [Saw et al., 2016](https://pubmed.ncbi.nlm.nih.gov/26423706/)
- [Soligard et al., 2016 IOC consensus](https://bjsm.bmj.com/content/50/17/1030)
- [Smyth et al., 2023 training disruptions](https://pubmed.ncbi.nlm.nih.gov/36704260/)
- [Coyne et al., 2022](https://pubmed.ncbi.nlm.nih.gov/35426569/)
- [Toresdahl et al., 2023](https://pubmed.ncbi.nlm.nih.gov/36113976/)
