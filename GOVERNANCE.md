# Marathoner governance

Marathoner is currently a founder-led project with one active technical
maintainer and an operating-partner role focused outside engineering. This
document records who makes decisions, how changes reach `main`, how the
operating partner participates, and what must change if another technical
maintainer becomes active.

## Current ownership

- **Project owner and active maintainer:** Kevin Tulloch
  ([@tulloch022](https://github.com/tulloch022))
- **Repository:**
  [`marathoner-app/marathoner`](https://github.com/marathoner-app/marathoner)
- **Decision scope:** product direction, beta scope, repository administration,
  releases, privacy posture, and final merge approval
- **Operating-partner scope:** in-person relationship development, participant
  discovery, recruitment-channel learning, interviews, feedback synthesis, and
  evidence-backed proposals about product, positioning, cohort, and roadmap

The operating-partner description records working responsibilities. It does
not by itself establish equity, legal co-ownership, company-officer authority,
or authority over merges, releases, credentials, production systems, or
participant records. The current entity plan remains single-member unless a
separate ownership decision and appropriate professional review change it.

Creator Radar is a separate internal operating tool. It is not part of this
product repository, its governance, or Marathoner's beta release path.

## Decision principles

The operating partner is expected to challenge assumptions and propose changes
across product, segment, positioning, recruitment, feedback, roadmap, and
operations. The owner makes the final decision when proposals conflict under
the current authority model. Decisions should prefer the smallest
evidence-backed change that preserves participant safety, privacy, data
integrity, and repository truth.

Product, methodology, privacy, security, architecture, or release decisions
that materially change the founding-beta promise require a focused GitHub issue
and explicit acceptance criteria before implementation. A passing automated
check does not substitute for required qualified methodology review, participant
evidence, or an owner decision.

The repository's sources of truth are:

1. merged code, tests, and documentation on `main`;
2. live GitHub issues, milestones, pull requests, and rulesets; and
3. dated decision or evidence records linked from those sources.

When those sources disagree, the conflict remains visible until a focused
change resolves it. Unmerged plans and informal conversation are not product
commitments.

## Change and merge authority

Every repository change follows the issue-to-pull-request process in
[`CONTRIBUTING.md`](CONTRIBUTING.md):

1. begin from an open, focused issue;
2. branch from current `main`;
3. make one coherent and reviewable change;
4. run and record the required verification;
5. open a pull request that closes the issue; and
6. merge only after required checks pass, review conversations are resolved,
   and the owner completes the final diff review.

Direct pushes to `main` are not part of the workflow. The active ruleset blocks
branch deletion and non-fast-forward updates, requires an issue-linked pull
request, requires the repository's automated checks, and requires review
conversations to be resolved. The owner has no ruleset bypass.

Required approving reviews remain at zero while Kevin is the only active
technical maintainer. Operating-partner repository access does not create an
independent code-review requirement or add engineering capacity. The zero-review
setting does not waive review: Kevin must inspect the complete diff, acceptance
criteria, check results, unresolved risks, and data exposure before performing
the merge.

## Operating partner participation

The operating partner may read the complete repository, comment on or open
issues, review plans and prototypes, propose changes, and summarize
privacy-safe field evidence. Strategic contribution does not require a code
change or pull request.

Identifiable participant or prospect information, raw interview notes, consent
records, health or training details, credentials, private contracts, and
sensitive budgets remain outside this public repository. Repository access does
not grant access to those private systems. Systematic research must follow the
approved consent, private-storage, retention, withdrawal, and deletion
boundaries before collection begins.

The current technical forecast still counts one owner-developer. Field work may
reduce recruitment uncertainty or reveal product changes, but dates and gates
change only through a recorded roadmap or forecast decision.

## Contributors and future maintainers

Contributions are welcome through the documented issue and pull-request
workflow. Contribution does not automatically grant merge, release, repository
administration, or product-decision authority.

If another person becomes an active technical maintainer, the owner must first
record the person's scope and permissions in a focused governance issue. After
that person can provide meaningful independent code review:

- raise the `main` ruleset to one required approving review;
- review CODEOWNERS and least-privilege team access;
- verify that the new maintainer cannot bypass required protections;
- document release and incident responsibilities; and
- retain final accountability with a named human rather than an unfilled role.

Access must be removed or reduced when it is no longer needed. No contributor
receives participant data, production credentials, or administrative access
merely because they can read or contribute to this public repository.

## Amendments

Change this document through a focused, issue-linked pull request. Any change to
decision authority, required reviews, security ownership, or release authority
must also update the corresponding live GitHub settings and evidence; changing
prose alone does not change access.
