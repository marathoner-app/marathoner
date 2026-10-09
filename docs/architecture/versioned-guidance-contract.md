# Versioned guidance contract

## Decision

Marathoner defines guidance as a versioned, deterministic domain contract
before it authors or displays participant-facing content. The contract lives in
[`src/domain/guidance/`](../../src/domain/guidance/) and imports no React,
Firebase, browser, or persistence code. The responsive web app and selected
Capacitor iOS app compile the same module, so review state, disable behavior,
and suppression cannot drift between clients.

This boundary does not approve any training, safety, nutrition, hydration,
sleep, recovery, or adaptation guidance. The complete founding-beta manifest
uses `beta-guidance@0.1.0-draft`; every entry is disabled and explicitly says it
is a placeholder. Issue #135 owns real content and qualified review. Issue #133
owns product integration and presentation.

## Version 1 item

`GuidanceItemV1` uses `guidance-item@1` and contains:

- a stable item ID, named semantic content version, and required beta topic;
- participant-facing title, body, and explicit limitations;
- content, correction, and correction-channel ownership;
- every reviewer role required for that exact content;
- review state and exact-version review evidence when a decision exists;
- a separate publication state;
- one or more stable trigger codes and event families;
- deterministic cooldown, presentation-limit, dismissal, and optional expiry
  behavior; and
- optional replacement metadata for a corrected version.

The ten required topic values are easy effort, shoes, fueling, hydration,
sleep, recovery, pain escalation, plan-change explanations, product
limitations, and unsupported-case explanations. The disabled draft manifest
owns one placeholder entry for each topic so missing work is visible without
representing placeholder text as usable content.

## Review and publication are separate

Review state uses the methodology protocol's lifecycle:

- `draft`;
- `ready_for_review`;
- `approved`;
- `conditional`;
- `rejected`; and
- `retired`.

Publication state is independently `disabled` or `published`. A published item
is structurally invalid unless:

1. its review state is `approved`;
2. its review record names the exact content version;
3. the record includes every reviewer role required by the item; and
4. the artifact version is not a draft version.

Conditional, rejected, retired, unknown, malformed, or unreviewed content
therefore fails closed. Publication configuration cannot turn an unapproved
artifact into approved guidance.

## Deterministic presentation decision

`evaluateGuidancePresentation` returns one eligible decision or one stable
suppression reason. It evaluates the same order on every supported client:

1. contract validity;
2. retirement and exact-version approval;
3. publication state;
4. operator-controlled remote disable rules;
5. active trigger codes;
6. expiry;
7. dismissal for the current version;
8. presentation count for the current version; and
9. cooldown from the latest presentation.

Presentation history is keyed by both item ID and content version. A corrected,
separately approved replacement can therefore begin a new presentation
lifecycle without erasing the immutable history of the version it replaces.
Remote rules may disable one version or every version of an item. Issue #120
owns the protected remote configuration record and its rehearsal; this module
defines only the portable decision contract that consumes it.

Trigger codes are stable identifiers, not UI prose or hidden methodology.
Event families describe where a later integration may obtain a trigger, such
as an upcoming workout, completed-run pattern, recommendation, safety signal,
or unsupported result. Numeric thresholds and final trigger mappings remain
outside this issue. They may enter participant-facing behavior only through
their owning approved rules and issue #133.

## Correction and retirement

Every item names a content owner, correction owner, and correction channel. A
correction creates a new semantic content version and may identify the item and
version it replaces. It does not rewrite the prior version or its presentation
history. A retired item needs recorded decision evidence and is never eligible
for presentation. An operator can disable a current item immediately while a
correction or retirement decision is prepared.

## Fixtures and safety boundary

[`foundingBetaGuidanceManifest.ts`](../../src/domain/guidance/foundingBetaGuidanceManifest.ts)
is a completeness and schema fixture. Its trigger and suppression values are
not live beta configuration, and its text is not approved guidance. Tests also
construct synthetic approved items to prove the contract's positive path;
those objects are test-only and are not exported by the application module.

No participant-facing component imports the manifest. The existing public
notice remains truthful: Marathoner's training methodology and safety guidance
are not yet approved.

## Downstream ownership

- **#120:** store immutable recommendation evidence and protected remote
  generation, guidance, and adaptation disable controls.
- **#132:** emit approved adaptation reason codes that can map to guidance
  explanation keys.
- **#133:** connect approved content to product events, persist presentation and
  dismissal history, and render accessible guidance across clients.
- **#134:** define and review the pain and unusual-symptom escalation rules and
  exact language.
- **#135:** replace placeholders with versioned, reviewed founding-beta
  content.
- **#136:** present reviewed adaptation explanations and choices.

Run:

```bash
npm test
npm run lint
npm run build
```
