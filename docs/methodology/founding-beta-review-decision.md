# Founding-beta methodology-review initiation decision

- **Status:** Superseded for the first closed experience beta; retained as the
  professional-review path for later expansion
- **Effective:** October 23, 2026
- **Outreach sequencing updated:** October 26, 2026
- **Superseding decision:** November 7, 2026;
  [closed-beta delivery and methodology decision](../closed-beta-gate-decision.md)
- **Decision owner:** Kevin Tulloch
- **Decision issue:** [#431](https://github.com/marathoner-app/marathoner/issues/431)
- **Outreach authority:** [#231](https://github.com/marathoner-app/marathoner/issues/231)
- **Approval authority:** [#119](https://github.com/marathoner-app/marathoner/issues/119)
- **Prepared review packet:**
  [`endurance-review-outreach-packet.md`](endurance-review-outreach-packet.md)
- **Resource sequencing:**
  [Internal-first spending decision](../internal-first-resource-sequencing.md)

## Decision

The October 23 decision required independent endurance-methodology review
before participant-facing prescriptive plans. The November 7 decision
supersedes that requirement for the first five-to-eight-person, invite-only
experience beta.

That closed cohort may use pinned, deterministic, source-backed provisional
rules after a separate guarded beta implementation adds explicit disclosure,
consent, version identification, unsupported-result behavior, conservative
symptom handling, and a retirement path. The product must not call those rules
approved, professionally reviewed, individualized coaching, or medical advice.

Independent review remains required before public sign-up, open invitations, a
materially broader cohort or methodology, professional-review claims, or
another re-evaluation trigger in the superseding decision.

This decision ends the October 8 deferral of the yes-or-no review decision. It
does not require immediate purchase of that review. Under the October 26
resource-sequencing decision, the combined packet remains prepared while
candidate outreach and paid work are deferred until the prescriptive behavior
is stable and internally testable and reviewer availability is becoming a real
external-beta blocker.

Issue #231 retains the separate authorization boundary. Before any later
outreach, the product owner must approve the exact recipient, message, timing,
and compensation posture.

The prepared `beta-rules@0.3.0-draft` artifact remains unapproved and unchanged.
It is runtime-ineligible in current participant builds until the separate beta
enablement work is implemented and proved. Interest or beta use does not turn
the artifact into professional-review evidence.

## Release scope considered

The decision applies to the intended founding beta described by the canonical
product and cohort plans:

- five to eight initially allowlisted, English-speaking adults in the United
  States who already run consistently and are preparing for a first marathon;
- one deterministic completion-oriented first-marathon plan family, or a small
  deterministic set of variants, based on reviewed intake fields;
- responsive web for intake, plan review, configuration, and history, plus iOS
  for the daily workout and completion loop;
- bounded later adaptation limited to reschedule, hold, repeat, or no change,
  with informed runner approval before a material plan revision; and
- a free, closely supported cohort rather than a public or commercially proven
  release.

## Claims and personalization boundary

Inside the reviewed scope, Marathoner intends to say that it can produce a
structured, understandable first-marathon plan for an eligible runner and
explain the deterministic rules behind that plan. Personalization may use only
the reviewed inputs and boundaries, including recent training, availability,
and race horizon.

The founding beta will not claim or imply:

- a guaranteed finish, finish-time prediction, or performance outcome;
- injury prevention, diagnosis, treatment, rehabilitation, or medical care;
- suitability for a person outside the reviewed participant boundary;
- individualized nutrition therapy or supplement, calorie, fluid, sodium, or
  electrolyte prescriptions; or
- autonomous or improvised increases in training load or intensity.

A disclaimer cannot convert an unsupported case into a supported
recommendation.

## Required safeguards

For professionally reviewed use, approval remains one gate among several. The
closed experience beta temporarily substitutes the explicit provisional-
methodology controls in the superseding decision. Both paths require:

- exact versioned artifacts, fixtures, reason codes, and attributable status;
  professionally reviewed use additionally requires approval from a qualified
  independent reviewer;
- deterministic unsupported results for missing, conflicting, unsafe,
  infeasible, or out-of-scope inputs;
- a participant review and approval step before plan activation;
- owner-scoped, atomic, revision-safe material writes with honest online-only
  behavior;
- consistent web and iOS results for the same normalized inputs;
- safety escalation, guidance, privacy, consent, support, deletion, incident,
  and release controls with the provisional or reviewed status required by
  their respective gates; and
- an immediate retirement or kill-switch path when an active artifact or
  product behavior becomes unsafe or unreliable.

This record does not claim that those safeguards are all implemented or that
invitations are open.

## Excluded health-related behavior

The endurance-methodology review does not authorize clinical pain or unusual-
symptom decisions, diagnosis, treatment, return-to-running, pregnancy, youth,
rehabilitation, or individualized nutrition. The clinical-safety and sports-
nutrition roles defined by the qualified-review protocol remain separate where
their inventory rows are in scope. Missing approval produces an unsupported or
non-prescriptive result.

## Alternatives considered

1. **Use cited research and internal judgment in a tightly controlled,
   explicitly provisional experience beta.** Originally rejected; selected by
   the November 7 decision for five to eight known testers so the complete
   product can be evaluated before material review spending. This does not
   establish professional approval or authorize broader use.
2. **Run only the non-prescriptive fallback.** Retained as the responsible
   fallback if qualified approval cannot be obtained. Participants would supply
   a plan or use an individually human-reviewed plan; Marathoner would not
   generate algorithmic training recommendations.
3. **Require independent review for the bounded founding-beta plan.** Chosen on
   October 23; superseded for the first closed cohort and retained for later
   expansion.

## Operational effect

- Issue #191 and the prepared packet may remain ready but inactive while
  implementation and internal validation continue.
- Candidate outreach should activate only after the resource-sequencing test is
  satisfied: the relevant prescriptive journey is stable and internally
  testable, practical predecessor work is complete, the external wait is
  approaching the critical path, and the owner approves the exact commitment.
- No candidate is currently the Marathoner reviewer, and no contact, acceptance,
  schedule, engagement, compensation, or decision may be inferred from this
  record.
- Issue #119 remains open until dated professional approval exists for exact
  pinned non-draft artifacts; it no longer blocks only the first closed
  experience beta.
- Participant-facing plan generation for the closed beta requires the separate
  guarded provisional-artifact implementation. Broader participant use remains
  blocked until professional approval exists.
- Safety and guidance implementation retain their separate reviewer, artifact,
  implementation, and test gates.
- Founding-beta invitations remain blocked by every other methodology, safety,
  privacy, integrity, support, distribution, and readiness requirement.

## Change control

The November 7 record is the dated change required by this section and
reconciles the first closed cohort. Any further expansion must again restate
the release scope and reconcile #231, #119, the qualified-review protocol, the
product vision, and affected implementation and invitation dependencies.
Silence, beta feedback, or schedule pressure cannot make a provisional artifact
professionally approved.
