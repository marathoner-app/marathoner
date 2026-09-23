# Methodology approval record: `[record-id]`

> Copy this template to `docs/methodology/approvals/[record-id].md`. Delete
> instructions and examples, but do not delete required fields. A blank or
> maintainer-completed template is not approval evidence.

## Record

| Field | Value |
| --- | --- |
| Record ID | `[methodology-approval-YYYY-MM-DD-NN]` |
| Decision date | `[YYYY-MM-DD]` |
| Overall decision | `[Approved / Conditional / Rejected / Partially reviewed]` |
| Repository commit | `[full commit SHA]` |
| Supersedes | `[record link or None]` |
| Superseded by | `[record link or Active]` |
| Parent issue | [#119](https://github.com/marathoner-app/marathoner/issues/119) |

## Submitted scope

- Supported participant: `[exact approved segment]`
- Plan family: `[exact plan family or variants]`
- Allowed adaptations: `[exact actions]`
- Rule bundle and hash: `[version, path, SHA-256]`
- Safety bundle and hash: `[version, path, SHA-256]`
- Guidance bundle and hash: `[version, path, SHA-256]`
- Inventory version and hash: `[version, path, SHA-256]`
- Review-packet link: `[stable evidence link]`
- Explicit exclusions: `[segments, behaviors, content, and claims not reviewed]`

## Reviewer evidence

Add one row for each reviewer. Do not publish private contact information,
contracts, license images, or unrelated personal data.

| Reviewer name | Role | Qualification and issuer | Current-status evidence | Relevant experience | Conflict and compensation disclosure | Attributable decision source |
| --- | --- | --- | --- | --- | --- | --- |
| `[Name]` | `[EMR / CSR / SNR]` | `[Credential or equivalent basis]` | `[Public verification link and checked date]` | `[Why this reviewer covers this scope]` | `[Disclosure; compensation not contingent on outcome]` | `[Reviewer-authored record or exact dated confirmation]` |

## Inventory decisions

Include every submitted inventory ID. `Conditional` and `Rejected` rows must
link blocking corrective issues. `Approved` rows must name the reviewer and
exact bundle version.

| Inventory ID | Bundle version | Decision | Reviewer | Conditions or rationale | Corrective issue |
| --- | --- | --- | --- | --- | --- |
| `ELIG-001` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `ELIG-002` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `FEAS-001` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `PLAN-001` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `PROG-001` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `ADAPT-001` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `ADAPT-002` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `ADAPT-003` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `ADAPT-004` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `SAFE-001` | `[beta-safety@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `SAFE-002` | `[beta-safety@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `SAFE-003` | `[beta-safety@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `UNSUP-001` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `UNSUP-002` | `[beta-rules@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `UNSUP-003` | `[beta-safety@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `UNSUP-004` | `[Applicable bundle@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `GUIDE-001` | `[beta-guidance@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `GUIDE-002` | `[beta-guidance@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `GUIDE-003` | `[beta-guidance@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `GUIDE-004` | `[beta-guidance@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `GUIDE-005` | `[beta-guidance@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `GUIDE-006` | `[beta-guidance@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `GUIDE-007` | `[beta-guidance@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `GUIDE-008` | `[beta-guidance@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |
| `CLAIM-001` | `[beta-guidance@x.y.z]` | `[Decision]` | `[Name]` | `[Rationale]` | `[Issue or None]` |

## Unsupported cases and claims check

- [ ] No-running, inconsistent-running, and return-to-running cases are
      rejected rather than given an improvised plan.
- [ ] Infeasible race dates and unsupported availability are rejected.
- [ ] Pain, unusual symptoms, ambiguity, and red flags follow the approved
      escalation or refusal path without diagnosis.
- [ ] Individual medical and nutrition needs are referred out.
- [ ] Draft, unknown, retired, conditional, and rejected versions cannot serve
      recommendations.
- [ ] The reviewed language contains no diagnosis, treatment,
      injury-prevention, guaranteed-outcome, or finish-time promise.
- [ ] The reviewer recorded any additional unsupported case below.

Additional unsupported cases: `[List or None]`

## Fixture and implementation trace

| Inventory ID | Supported fixture | Boundary fixture | Rejected or ambiguous fixture | Implementation issue or evidence |
| --- | --- | --- | --- | --- |
| `[ID]` | `[Link]` | `[Link]` | `[Link]` | `[Issue, test, or code link]` |

## Conditions and rejected items

For every condition or rejection, record:

- inventory ID and reviewed version;
- the reason use is unsafe, unsupported, misleading, or insufficiently
  evidenced;
- the required correction or product-scope removal;
- the blocking GitHub issue; and
- the reviewer and evidence required for re-review.

An overall decision cannot be `Approved` while this section has an unresolved
item.

## Reviewer attestations

Each named reviewer must author or explicitly confirm this statement in the
linked attributable decision source:

> I reviewed the exact artifacts and versions listed in this record for the
> stated role and founding-beta scope. My row-level decisions, limitations,
> conflicts, and conditions are represented accurately. I understand that this
> decision does not approve uses outside the stated scope.

| Reviewer | Decision | Confirmation date | Evidence link |
| --- | --- | --- | --- |
| `[Name]` | `[Approve / Conditional / Reject]` | `[YYYY-MM-DD]` | `[Link]` |

## Product-owner release check

- [ ] Every required inventory row has all required domain decisions.
- [ ] Every approved row points to a non-draft pinned version.
- [ ] No conditional or rejected item is enabled.
- [ ] Implementation and tests trace to the approved inventory IDs.
- [ ] Recommendation evidence records the approved rule and content versions.
- [ ] The remote retirement or disable path has been rehearsed.
- [ ] The active product scope matches this record's supported participant and
      exclusions.
- [ ] #70, #134, #135, and #119 link this record where applicable.

Product-owner decision: `[Release approved scope / Remain blocked]`

- Recorded by: `[Name]`
- Recorded on: `[YYYY-MM-DD]`
- Evidence: `[Pull request, issue, and invitation-gate trace]`
