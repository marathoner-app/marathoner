# Commercial research artifacts

- **Status:** Ready for synthetic artifact interviews; not product guidance
- **Artifact version:** `commercial-research-artifacts@0.1.0`
- **Decision date:** October 6, 2026
- **Owner:** Kevin Tulloch
- **Tracking issue:**
  [#213](https://github.com/marathoner-app/marathoner/issues/213)
- **Commercial protocol dependency:**
  [#214](https://github.com/marathoner-app/marathoner/issues/214)

## Purpose

These two static concepts let prospective first-time marathoners react to
Marathoner's proposed readiness and adaptation experience without receiving a
real plan, feasibility result, or training recommendation.

- [`readiness-result.html`](readiness-result.html) shows which fictional inputs
  were considered, what remains unknown, and the next decision.
- [`adaptation-decision.html`](adaptation-decision.html) shows a fictional
  schedule conflict, bounded options, the reason for one proposed change,
  uncertainty, and an explicit approval choice.

The artifacts use only synthetic names, dates, schedules, and training data.
Their controls update the current browser view only. They do not use analytics,
network requests, storage, authentication, or application data.

## Claim boundary

Every screen identifies itself as a fictional research concept and says that
it is not a training plan, recommendation, or medical guidance. The examples
do not:

- decide whether a real person is ready for a race;
- prescribe mileage, intensity, pain, fueling, hydration, sleep, or recovery
  actions;
- diagnose a condition or promise injury prevention, safety, or an outcome;
- represent the draft methodology as approved; or
- apply a change without an explicit fictional approval choice.

The proposed commercial wedge remains a hypothesis. These concepts test
whether the evidence, uncertainty, consequence, and approval model are
understandable—not whether the underlying training decision is correct.

## Five-minute facilitator path

Read the quoted boundary exactly before showing either artifact:

> These are fictional research concepts. They are not evaluating you and will
> not provide a plan or recommendation. Please react to what each screen
> communicates. There are no right answers.

Use this sequence without explaining the intended answer:

1. **0:00–0:30 — Boundary:** read the statement above and confirm that the
   participant understands that the examples are fictional.
2. **0:30–2:00 — Readiness:** open `readiness-result.html`, allow silent review,
   and ask, “Please describe what this screen says in your own words.”
3. **2:00–2:30 — Readiness follow-up:** ask, “What, if anything, would you
   expect to happen next?” Do not explain the missing-evidence state.
4. **2:30–4:00 — Adaptation:** open `adaptation-decision.html`, allow silent
   review, and ask, “What would change here, why, and when would it take
   effect?”
5. **4:00–4:30 — Control check:** ask, “What choices remain with the fictional
   runner?”
6. **4:30–5:00 — Open response:** ask, “What is confusing, concerning, or
   missing?”

The facilitator may ask “What on the screen led you to that?” but must not teach
the participant the intended interpretation. Issue #214 freezes the complete
interview protocol and scoring rubric before any real response is collected.

If a participant asks what they personally should do, stop the artifact task,
repeat that the concepts do not provide personal guidance, and do not improvise
a recommendation.

## Expected comprehension

The later #214 rubric should be able to score these observations without
changing the artifacts:

| Concept | Participant should be able to identify |
| --- | --- |
| Readiness | No real readiness result was produced; the screen separates considered evidence from missing evidence and asks for a next decision. |
| Adaptation | The work conflict is the stated reason; the proposed fictional action and schedule consequence are visible; uncertainty remains; no change occurs without approval. |
| Both | The concepts are fictional, non-prescriptive, and do not establish medical safety or guarantee a race outcome. |

## Accessibility and responsive contract

Both pages:

- use one `main` landmark and a logical heading order;
- provide a skip link, semantic lists, fieldsets, legends, and associated labels;
- remain fully operable with the keyboard and show a visible focus indicator;
- announce local form feedback through a polite status region;
- use text and shape rather than color alone to communicate state;
- maintain at least 44-pixel control targets;
- avoid motion and honor reduced-motion preferences; and
- collapse to one readable column below 720 pixels without horizontal
  scrolling.

The intended review sizes are 1440 × 900 desktop and 390 × 844 mobile. The
artifacts must also remain usable at 200% browser zoom.

### Verification record

On October 6, 2026, both artifacts were rendered through the local Vite server
at 1440 × 900 and 390 × 844. The browser reported no horizontal overflow at
either size; the desktop composition used two columns and the phone composition
collapsed to one. The browser accessibility tree exposed the landmarks,
headings, boundary note, fieldset legends, radio labels, buttons, and polite
status regions. A local choice produced the expected status message without a
navigation or network request. Automated checks cover native form semantics,
the focus indicator, minimum target size, responsive breakpoint,
reduced-motion rule, local-only script, and prohibited claims.

## Source map

| File | Role |
| --- | --- |
| [`readiness-result.html`](readiness-result.html) | Fictional readiness-result concept |
| [`adaptation-decision.html`](adaptation-decision.html) | Fictional disruption and approval concept |
| [`artifact.css`](artifact.css) | Shared visual, responsive, focus, and reduced-motion behavior |
| [`artifact.js`](artifact.js) | Local-only form feedback; no persistence or network access |
| [`../../../scripts/commercial-research-artifacts.test.mjs`](../../../scripts/commercial-research-artifacts.test.mjs) | Claim-boundary, structure, and accessibility regression checks |

## Change control

Any change to wording, synthetic inputs, proposed actions, uncertainty,
consequences, or choices creates a new artifact version. Preserve the prior
version or its Git commit, record the reason in the pull request, rerun the
claim and accessibility checks, and keep materially different interview results
separate. Production UI must not import these files or present this draft
version as approved methodology.
