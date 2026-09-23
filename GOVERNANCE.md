# Marathoner governance

Marathoner is currently a founder-led, solo-maintained project. This document
records who makes decisions, how changes reach `main`, and what must change if
another maintainer becomes active. It does not promise a role, product area, or
delivery date to a hypothetical future contributor.

## Current ownership

- **Project owner and active maintainer:** Kevin Tulloch
  ([@tulloch022](https://github.com/tulloch022))
- **Repository:**
  [`marathoner-app/marathoner`](https://github.com/marathoner-app/marathoner)
- **Decision scope:** product direction, beta scope, repository administration,
  releases, privacy posture, and final merge approval

Creator Radar is a separate internal operating tool. It is not part of this
product repository, its governance, or Marathoner's beta release path.

## Decision principles

The owner makes the final decision when proposals conflict. Decisions should
prefer the smallest evidence-backed change that preserves participant safety,
privacy, data integrity, and repository truth.

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
maintainer. That setting avoids making delivery depend on a person who has not
joined, but it does not waive review. Kevin must inspect the complete diff,
acceptance criteria, check results, unresolved risks, and data exposure before
performing the merge.

## Contributors and future maintainers

Contributions are welcome through the documented issue and pull-request
workflow. Contribution does not automatically grant merge, release, repository
administration, or product-decision authority.

If another person becomes an active maintainer, the owner must first record the
person's scope and permissions in a focused governance issue. After that person
can provide meaningful independent review:

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
