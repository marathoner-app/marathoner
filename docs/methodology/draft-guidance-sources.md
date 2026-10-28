# Draft guidance source trace

- **Artifact:** `beta-guidance@0.1.0-draft`
- **Issue:** [#544](https://github.com/marathoner-app/marathoner/issues/544)
- **State:** Internal draft; disabled and not approved for runner use

This trace records the authoritative inputs used to prepare Marathoner's first
complete guidance draft. A credible source supports authoring, but it does not
replace the qualified review required by the
[methodology protocol](README.md). The exact draft stays disabled until the
required reviewer approves a pinned non-draft version.

## Source map

| Topic | Draft boundary | Authoritative inputs |
| --- | --- | --- |
| Easy effort | Uses the talk test only as a rough relative-effort cue; it does not prescribe pace or diagnose why effort changed. | [CDC: Measuring Physical Activity Intensity](https://www.cdc.gov/physicalactivity/basics/measuring/index.html) |
| Shoes | Encourages tracking fit, comfort, visible wear, and a gradual transition. It avoids a universal replacement threshold and injury-prevention promise. | [American College of Sports Medicine: Selecting Running Shoes](https://www.acsm.org/docs/default-source/files-for-resource-library/running-shoes.pdf) |
| Fueling | Encourages practicing a familiar approach during training and refers individualized needs to a qualified sports dietitian. It gives no calorie, carbohydrate, supplement, or meal prescription. | [NCAA Sport Science Institute: Nutrition, Hydration & Sleep](https://www.ncaa.org/what-we-do/health-safety-and-performance/nutrition-hydration-sleep/); [U.S. Anti-Doping Agency: Sports Nutrition Guide](https://www.usada.org/substances/nutrition/) |
| Hydration | Encourages planning access to fluids and practicing in the expected conditions. It gives no universal fluid, sodium, or electrolyte amount. | [CDC: Heat and Athletes](https://www.cdc.gov/heat-health/risk-factors/heat-and-athletes.html); [USADA: Hydration 101](https://www.usada.org/spirit-of-sport/hydration-101-need-know/) |
| Sleep | States the general adult minimum and recommends a consistent sleep window while avoiding diagnosis or treatment. | [CDC: About Sleep](https://www.cdc.gov/sleep/about/); [NIH: Healthy Sleep](https://health.nih.gov/health-topics-a-z/healthy-sleep) |
| Recovery | Treats repeated changes as a reason to review the week, not as proof of a cause or condition. It does not diagnose overtraining, illness, or injury. | [Physical Activity Guidelines for Americans, second edition](https://health.gov/paguidelines/second-edition/pdf/Physical_Activity_Guidelines_2nd_edition.pdf) |
| Pain and unusual symptoms | Directs emergency warning signs to 911, tells the runner not to wait for the app, and routes other concerning or persistent symptoms to qualified care. It does not diagnose or claim to provide a complete symptom checklist. | [American Heart Association: Heart Attack, Stroke and Cardiac Arrest Symptoms](https://www.heart.org/en/about-us/heart-attack-and-stroke-symptoms); [CDC: Heat and Athletes](https://www.cdc.gov/heat-health/risk-factors/heat-and-athletes.html) |
| Plan changes | Explains Marathoner's existing explicit-review contract: observation, proposed change, unchanged parts, and the runner's decision. | [Recommendation evidence and activation](../architecture/recommendation-evidence-and-activation.md); [Adaptation evaluation contract](../architecture/adaptation-evaluation-contract.md) |
| Product limitations | Restates the product boundary and prohibited claims without turning a disclaimer into permission to serve unsupported guidance. | [Qualified methodology review](README.md); [Versioned guidance contract](../architecture/versioned-guidance-contract.md) |
| Unsupported cases | Preserves the current plan and refuses to invent or widen a rule when evidence is missing or outside scope. | [Qualified methodology review](README.md); [Versioned guidance contract](../architecture/versioned-guidance-contract.md) |

## Review handoff

The source map is a drafting aid, not the future review record. Before any item
can be published, the review packet must pin the exact content version and the
required reviewer must approve or reject the exact title, body, limitations,
audience, trigger, and refer-out boundary. Any wording change after that
decision creates a new version under the protocol's change-control rules.
