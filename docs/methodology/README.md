# Qualified methodology review

- **Status:** Protocol ready; no founding-beta methodology is approved
- **Protocol version:** `methodology-review@0.1.0`
- **Artifact owner:** Kevin Tulloch
- **Parent issue:** [#119](https://github.com/marathoner-app/marathoner/issues/119)
- **Protocol issue:** [#148](https://github.com/marathoner-app/marathoner/issues/148)
- **Blocking implementations:** [#70](https://github.com/marathoner-app/marathoner/issues/70),
  [#134](https://github.com/marathoner-app/marathoner/issues/134), and
  [#135](https://github.com/marathoner-app/marathoner/issues/135)

## Decision

Marathoner does not yet have qualified approval for prescriptive plan
generation, adaptation, pain escalation, or training guidance. This protocol
makes the approval work executable; it is not approval evidence itself.

Issue #70 cannot complete, and prescriptive founding-beta invitations cannot
open, until every in-scope inventory item is approved for the exact artifact
version the product uses. If qualified approval cannot be obtained, the only
permitted external study is the non-prescriptive fallback defined in the
[zero-to-beta plan](../zero-to-beta-plan.md#methodology-fallback).

## Approval boundary

The founding-beta review covers only an English-speaking adult in the United
States who already runs consistently, is preparing for a first marathon, and
fits the approved recent-training, availability, and race-horizon boundaries.
It covers one first-marathon plan family or a small deterministic set of
variants and only these adaptation outcomes: reschedule, hold, repeat, or no
change.

The review does not authorize:

- a no-running, inconsistent-running, return-to-running, youth, pregnancy, or
  clinical rehabilitation plan;
- diagnosis, treatment, individualized medical care, or injury-prevention
  claims;
- individualized nutrition therapy or supplement, calorie, fluid, sodium, or
  electrolyte prescriptions;
- autonomous increases in intensity or training load, finish-time promises,
  or improvised recommendations outside an approved rule;
- a new plan family, participant segment, adaptation action, or content topic;
  or
- public release or removal of the other privacy, integrity, operational, and
  TestFlight invitation gates.

An input outside the approved boundary, an ambiguous high-risk input, or an
unavailable approved rule produces an unsupported result. A disclaimer cannot
turn an unsupported case into a supported recommendation.

## Reviewer roles

Approval is domain-specific. One person may fill more than one role only when
they independently meet each role's criteria. The product owner is accountable
for assembling the packet but cannot self-approve authored methodology or
content.

### Endurance-methodology reviewer (`EMR`)

Minimum evidence:

- a current credential from a recognized endurance-running coaching body, or
  an equivalent combination of formal education and independently verifiable
  professional standing;
- recent, documented experience designing or supervising marathon preparation
  for adult recreational runners, including first-marathon participants; and
- competence to evaluate eligibility, race feasibility, training load,
  workout sequencing, recovery placement, progression, cutbacks, tapering,
  and the bounded adaptation actions.

The approval record must name the credential or equivalent basis, its issuer,
current status, and a public verification source when one exists.

### Clinical-safety reviewer (`CSR`)

Minimum evidence:

- a current professional license in a jurisdiction relevant to the review;
- scope of practice that includes exercise-related pain, unusual symptoms, or
  musculoskeletal and exertional red-flag escalation; and
- experience communicating when someone should stop activity, seek qualified
  care, or seek emergency help without diagnosing through a software product.

Examples may include an appropriately experienced sports-medicine physician,
physical therapist, or athletic trainer. The title alone is insufficient; the
approval record must explain why the person's license and experience cover the
submitted safety language.

### Sports-nutrition reviewer (`SNR`)

Minimum evidence:

- current registered-dietitian status or an equivalent regulated nutrition
  credential applicable to the review jurisdiction; and
- documented experience with endurance-sport fueling and hydration.

A sports-dietetics specialization is preferred. This reviewer approves the
bounded educational content, not individualized nutrition therapy.

### Product and claims owner (`PCO`)

Kevin Tulloch owns inventory completeness, plain-language presentation,
versioning, implementation links, corrective issues, and retirement of stale
artifacts. `PCO` review does not substitute for `EMR`, `CSR`, or `SNR`
approval.

## Independence and conflicts

Each domain reviewer must:

- be different from the person who authored the submitted rule or content;
- be free to approve, condition, or reject any item;
- disclose employment, equity, referral, family, authorship, or other interests
  that a reasonable reader could consider material;
- disclose compensation, which must not depend on an approval outcome; and
- identify any portion outside their competence instead of approving it.

The product owner records and evaluates disclosed conflicts in the approval
record. A material conflict requires a second independent reviewer for the
affected domain or reassignment of the review. Reviewer contact information,
contracts, license copies, and private correspondence stay in controlled
storage; the repository records the minimum public evidence needed to audit
the decision.

## Review artifacts and versions

The [founding-beta inventory](beta-review-inventory.md) is the canonical list
of required decisions. Stable inventory IDs do not change when wording or code
changes. The current planned bundles are:

| Bundle | Planned version | Contents | Current state |
| --- | --- | --- | --- |
| `beta-rules` | `0.1.0-draft` | Eligibility, feasibility, plan construction, progression, and adaptation rules | Not authored or approved |
| `beta-safety` | `0.1.0-draft` | Pain and unusual-symptom decisions, escalation language, and safety fixtures | Not authored or approved |
| `beta-guidance` | `0.1.0-draft` | Easy effort, shoes, fueling, hydration, sleep, recovery, change explanations, and limitations | Not authored or approved |

`-draft` versions must never appear in a participant recommendation as an
approved version. The first approval removes the draft suffix and pins the
reviewed repository commit and artifact hashes in an approval record.

Inventory status uses these exact values:

- **Missing:** the requirement is known but the reviewable artifact is absent.
- **Draft:** an artifact exists but is still being authored.
- **Ready for review:** the packet is complete and frozen for review.
- **Approved:** a qualified reviewer approved the exact pinned version.
- **Conditional:** use is blocked until every condition has a corrective issue,
  is resolved, and is re-reviewed.
- **Rejected:** use is blocked; a corrective issue and new review are required.
- **Retired:** the artifact must no longer produce recommendations.

## High-risk disposition rules

| Area | Required review | Allowed founding-beta disposition |
| --- | --- | --- |
| Eligibility, plan construction, progression, taper, and race feasibility | `EMR` | Generate only inside approved numeric and categorical bounds; otherwise return unsupported |
| Reschedule, hold, repeat, or no-change adaptation | `EMR` | Use only approved inputs and reason codes; never increase load or intensity autonomously |
| Pain or unusual symptoms | `CSR` | Stop incompatible recommendations and show the approved stop, qualified-help, or emergency path; never diagnose |
| Fueling and hydration | `SNR` | Show approved general education inside its stated audience and conditions; refer individualized or clinical needs out |
| Sleep and recovery | `EMR`; `CSR` when health or symptom claims are present | Show approved training-context education; do not diagnose or treat a sleep or recovery condition |
| Shoes and easy-effort education | `EMR` | Show approved bounded education without universal injury-prevention or equipment-life promises |
| Missing, conflicting, or out-of-range inputs | Relevant domain reviewer | Return an explicit unsupported or seek-help result; never infer a high-risk answer |

## Review packet

The product owner freezes one packet per review round. It must contain:

1. the supported participant and explicit unsupported cases;
2. the inventory with every submitted row marked `Ready for review`;
3. the exact rule, content, fixture, and reason-code artifacts;
4. representative supported, boundary, ambiguity, and rejected-case examples;
5. every user-visible claim, limitation, and escalation message;
6. a trace from each inventory ID to its implementation issue and test or
   planned test;
7. the repository commit and cryptographic hashes for reviewed artifacts; and
8. an [approval record](approval-record-template.md) prepared without a
   decision entered on the reviewer's behalf.

The reviewer returns row-level decisions and an overall decision. A repository
approval record is valid only when the reviewer authored it or explicitly
confirmed its exact wording in a dated, attributable source linked from the
record.

## Decisions and corrective work

- **Approved:** all required reviewers approve every in-scope row for the exact
  pinned versions.
- **Conditional:** the product remains blocked. Each condition receives a
  blocking GitHub issue, the artifact version changes, and affected rows are
  resubmitted.
- **Rejected:** the product remains blocked. Each rejection receives a
  blocking GitHub issue or the feature is removed from the supported beta. A
  new approval record is required after correction.
- **Partially reviewed:** reviewed rows retain their evidence, but the bundle
  and beta remain unapproved until every required row passes.

Corrective issues must name the inventory IDs, rejected or conditional
version, required change, approving role, and evidence needed to unblock. They
must link both #119 and the applicable approval record.

## Change control

Approval never transfers silently to a different version.

| Change | Version effect | Re-review |
| --- | --- | --- |
| Spelling, formatting, or code movement with demonstrably identical meaning and behavior | Patch | `PCO` records the diff and unchanged tests; domain re-review is not required |
| Wording, threshold, fixture, reason code, schedule, or behavior change inside the existing supported boundary | Minor | Every affected domain reviewer re-approves affected inventory rows |
| New participant segment, plan family, recommendation type, broader claim, looser safety boundary, or new high-risk topic | Major | Full review of the affected bundle and all interacting rows |
| Emergency retirement or kill switch | Immediate retirement | No prior approval needed to make behavior safer; re-enabling requires approval of the active version |

An approval record may cover several bundles, but it must state the exact
version and decision for each. Superseded records remain in history and link to
their replacement.

## Implementation traceability gate

Before #70, #134, or #135 can close, implementation evidence must demonstrate:

1. every output maps to one or more inventory IDs and an approved reason code;
2. persisted recommendation evidence records the approved rules and content
   versions;
3. tests cover approved interior, boundary, rejected, missing, and ambiguous
   cases;
4. clients show the same approved result for the same normalized inputs; and
5. retired, conditional, rejected, unknown, and draft versions cannot serve a
   participant recommendation.

The invitation gate requires a final cross-check from every product output to
an approved inventory row and from every approved row to its implementation
and tests. Passing automated tests does not replace the external review.

## Completion evidence for #119

Issue #119 can close only when:

- named reviewers satisfy the role and independence criteria;
- every required inventory row is approved for a pinned non-draft version;
- approval records are dated, attributable, linked, and complete;
- every condition or rejection is resolved or its feature is removed;
- #70, #134, and #135 link their implementation evidence to the approved rows;
  and
- the product owner records the invitation-gate trace.
