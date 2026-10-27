# Founding-beta incident and support playbook

- **Status:** Prepared for internal tabletop use; live-system rehearsal remains
  blocked by [#161](https://github.com/marathoner-app/marathoner/issues/161)
- **Owner and incident commander:** Kevin Tulloch
- **Field-support role:** Marathoner operating partner
- **Participant support:** `kevin@marathonerapp.com`
- **Tracking issue:**
  [#498](https://github.com/marathoner-app/marathoner/issues/498)
- **Last reviewed:** October 27, 2026

## Purpose and limits

This playbook gives Marathoner's small founding beta one practical path from a
support report to triage, containment, communication, recovery, and closure.
It also defines when new invitations, one affected feature, or the whole cohort
must pause.

Preparing this playbook does not mean the production controls have been
rehearsed. Account deletion, export and restore, App Check enforcement,
remote feature controls, and live rollback retain their own implementation and
evidence gates. Until those controls exist, the safe fallback is to stop new
invitations, tell affected participants not to use the affected workflow, and
return to a previously verified build when that rollback is available.

Marathoner support is not medical care or an emergency service. A participant
who reports an emergency or symptoms that may require urgent help should stop
using Marathoner for guidance and contact local emergency services or a
qualified clinician. The operator records the product incident without trying
to diagnose the participant.

## Private system of record

Before the first invitation, Kevin creates the private incident and support
register in the owner-controlled `kevin-admin@marathonerapp.com` Google
Workspace. Access is limited to Kevin and an explicitly authorized operating
partner. The register is the system of record; email, text messages, GitHub,
and memory are not.

Each private record contains only what is needed to resolve and audit the
event:

- a neutral incident ID, opened and closed times, category, and severity;
- the private reporter and affected-account references;
- the application surface, build or rules version, and affected workflow;
- the observation, reproduction evidence, and known scope;
- acknowledgement, decision, containment, and communication times;
- named incident commander and assigned actions;
- invitation, feature, build, or cohort pause status;
- corrective issue or release references; and
- resumption checks, decision, and closure summary.

Do not copy passwords, authentication links, tokens, unnecessary health
details, full run histories, or unrelated correspondence into the register.
Use a restricted evidence folder when a screenshot or export is necessary.

GitHub may receive the neutral incident ID, dates, category, severity,
affected release, privacy-safe aggregate scope, containment decision,
corrective issue, and final result. GitHub must not receive names, contact
details, account identifiers, health information, run records, consent data,
private messages, or unredacted screenshots.

## Intake and ownership

Participants use `kevin@marathonerapp.com` for support, withdrawal, privacy,
and product-integrity reports. The operating partner may receive a report in
person or through an existing relationship, but should acknowledge it without
diagnosing the problem, ask the person not to send sensitive detail through an
unapproved channel, and route it privately to Kevin.

Kevin is the incident commander and owns severity, technical containment,
participant communication, corrective releases, and the decision to resume.
The operating partner owns relationship-aware acknowledgement, stops outreach
when a recruitment pause is declared, and helps confirm that communication was
understood. The operating partner may pause new introductions immediately when
Kevin cannot be reached, but may not resume invitations or an affected
workflow. Only Kevin, or a formally documented replacement incident commander,
may do that.

During an active cohort, Kevin checks the support route at least once each
calendar day. This is not a promise of continuous monitoring. Invitations must
state that urgent medical help must not be requested through Marathoner.

## Severity and mandatory action

| Severity | Examples | Immediate action | Recruitment status |
| --- | --- | --- | --- |
| **Critical** | Cross-account exposure; unsafe or unreviewed recommendation reaching a participant; missed required safety escalation; silent loss, duplication, or corruption of material plan or run state; compromised credentials; deletion affecting the wrong account; a failure that cannot be bounded | Stop the affected workflow, preserve minimum private evidence, notify Kevin, assess every potentially affected account, and use the applicable security or rollback procedure. Pause the whole cohort when account isolation, recommendation safety, or material integrity is uncertain. | Pause immediately. No invitation or expansion resumes until the critical resumption checks pass. |
| **High** | One-account material state is wrong but contained; repeated inability to sign in or complete the daily loop; deletion service level is at risk; a persistent outage; a recommendation is confusing enough to change behavior but no unsafe outcome is known | Acknowledge, bound the scope, stop the affected workflow when continued use could worsen the result, open a corrective issue, and decide within one calendar day whether the event must be raised to Critical. | Pause when the problem is repeated, scope is unknown, support capacity is threatened, or the cohort threshold would fail. |
| **Standard** | Isolated usability defect, non-material display error, ordinary question, or recoverable failure with no safety, privacy, integrity, or access consequence | Record, answer or work around it honestly, and route product work to a focused issue. | Continue only while aggregate support burden and every higher-severity threshold remain within bounds. |

Classification follows impact and uncertainty, not how calmly the report is
worded. When severity is unclear, use the higher level until the scope is
bounded. Any unresolved critical safety, privacy, cross-account, or material-
integrity event overrides engagement and growth evidence.

## Response sequence

1. **Acknowledge and protect the channel.** Confirm receipt without promising
   a cause or fix. Move identifying or sensitive detail into the private
   register.
2. **Classify.** Record category, initial severity, affected build and
   workflow, known accounts, and what remains unknown.
3. **Contain.** Choose the smallest control that safely bounds the event:
   participant stop-use instruction, affected-feature stop, recruitment pause,
   known-good build rollback, or full-cohort pause. Use a broader pause when
   scope is uncertain.
4. **Investigate.** Preserve minimum evidence, reproduce only with fictional or
   owner-controlled data, identify the responsible code or operating boundary,
   and create a privacy-safe corrective issue.
5. **Communicate.** Tell affected participants what happened at the level that
   is known, what they should do now, what Marathoner has stopped, and when the
   next update will arrive. Do not speculate or minimize.
6. **Correct and verify.** Exercise the fix and the relevant negative case in
   the appropriate automated, emulator, browser, and physical-device layers.
7. **Resume or remain paused.** Kevin records the resumption decision against
   the checks below. Silence, a passing happy path, or elapsed time does not
   resume a paused workflow.
8. **Close and learn.** Record the result, affected versions, communication,
   corrective evidence, and any change required in tests, release procedure,
   invitation language, or cohort capacity.

## Containment controls and honest availability

The following controls are available before a complete remote-control system:

- stop all new invitations and have the operating partner stop outreach;
- tell the bounded cohort not to use an affected workflow or build;
- close or narrow allowlisted access using the approved membership procedure;
- deploy a verified corrective web release or follow the documented Pages
  recovery path; and
- follow the scoped Functions rollback procedure after callable Functions have
  been deployed.

Independent generation, guidance, and adaptation kill switches plus minimum-
client-version enforcement remain owned by
[#120](https://github.com/marathoner-app/marathoner/issues/120). App Check
rollback and enforcement remain owned by
[#205](https://github.com/marathoner-app/marathoner/issues/205) and
[#206](https://github.com/marathoner-app/marathoner/issues/206). Do not claim
those controls are available or rehearsed until their evidence passes.

Relevant technical procedures:

- [GitHub Pages custom-domain recovery](github-pages-custom-domain.md)
- [Beta Functions deployment and rollback](beta-functions-deployment.md)
- [Account-deletion operator runbook](account-deletion-runbook.md)
- [Firebase beta membership boundary](../security/firebase-beta-membership.md)

## Participant communication patterns

### Receipt

> We received your report and are checking the affected Marathoner workflow.
> Please do not send passwords, sign-in links, or extra health details. We will
> tell you whether you should stop using part of the app and when to expect the
> next update.

### Pause

> We have paused [workflow or build] while we investigate [plain-language
> symptom]. Please do not use that part of Marathoner until we explicitly say
> it is available again. Your report is not a request for medical advice; seek
> qualified or emergency help outside Marathoner when needed. We will update
> you by [time or date].

### Resolution

> We corrected [bounded problem] in [release or control]. We verified [plain-
> language checks], and [workflow] may be used again. [Any action the
> participant must take.] Please reply if the original behavior returns.

Adapt the wording to known facts. Never include another participant's
information or imply that a technical fix validates training methodology.

## Resumption checks

Kevin may resume a paused workflow or invitations only when all applicable
checks are recorded:

- scope and severity are known, with every affected account privately traced;
- the unsafe, exposed, corrupting, or unavailable behavior is contained;
- the correction and relevant negative case pass in representative clients;
- no unresolved critical recommendation, safety, privacy, cross-account, or
  material-integrity event remains;
- participant communication is complete or scheduled with a named owner;
- support capacity is within the precommitted threshold;
- any changed methodology or safety content has the required qualified
  approval; and
- Kevin records a dated resume decision in the private register plus a
  privacy-safe public result when a GitHub release gate is affected.

A Critical event requires an explicit resume decision. A High event may remain
open while unaffected workflows continue only when its scope is bounded and
the register records why continued use is safe.

## Fictional tabletop scenarios

These walkthroughs prepare decisions without using participant data or
claiming a production rehearsal.

### 1. Another runner's record appears

- **Classify:** Critical privacy and cross-account integrity incident.
- **Contain:** Tell the reporter to stop using the affected view, pause the
  whole cohort and recruitment, preserve restricted evidence, and follow the
  security-reporting and membership procedures.
- **Correct:** Prove owner isolation with negative Security Rules tests and
  representative web and iOS accounts. Trace the privately identified scope.
- **Resume:** Only after no cross-account path remains, affected communication
  is complete, and Kevin records the explicit resume decision.

### 2. A run takes 30 seconds to save

- **Classify:** Standard when the operation completes once with no duplication
  or wrong state; raise to High if it repeats, produces ambiguous outcomes, or
  threatens support capacity.
- **Contain:** Prevent duplicate submission, collect privacy-safe phase timing,
  and give honest nontechnical progress. Pause expansion if scope or integrity
  becomes uncertain.
- **Correct:** Identify the measured slow boundary rather than guessing. Verify
  the record once in Track and Analyze and protect retry behavior.
- **Resume:** Normal use can continue while bounded; recruitment resumes only
  if any declared pause trigger and support-capacity concern are cleared.

### 3. A recommendation is unsafe or misunderstood

- **Classify:** Critical when unreviewed or unsafe guidance reached a
  participant, a required escalation was missed, or meaning could reasonably
  cause unsafe behavior.
- **Contain:** Stop the recommendation or broader guidance workflow, pause
  recruitment, tell affected participants not to rely on it, and avoid giving
  replacement coaching through support.
- **Correct:** Trace rule, content, evidence, and client versions. Require the
  applicable qualified review before re-enabling changed guidance.
- **Resume:** Only after deterministic fixtures, displayed language, approval
  evidence, device behavior, and participant communication pass.

### 4. Support demand exceeds owner capacity

- **Classify:** High; Critical if a required safety or privacy response is
  missed.
- **Contain:** Stop new invitations. The operating partner stops outreach and
  helps acknowledge nontechnical reports without receiving new authority over
  releases or sensitive records.
- **Correct:** Remove the repeated product cause, narrow the cohort, or add
  support capacity before expansion.
- **Resume:** Apply the precommitted support-burden thresholds: more than four
  owner hours for one week requires Refine; two consecutive weeks above four
  hours, or two weeks above 60 minutes per active participant-week, requires a
  Pause until capacity or product behavior changes.

## Change control and live rehearsal

This playbook is changed through a focused issue and pull request. A change to
pause thresholds must also version the
[founding-cohort decision thresholds](../founding-cohort-decision-thresholds.md)
and explain whether it applies prospectively.

Issue [#124](https://github.com/marathoner-app/marathoner/issues/124) remains
open after this document merges. Its dated development evidence must exercise
deletion, export and restore, critical visibility, production containment, and
at least one complete live-system tabletop after #161 supplies the required
App Check boundary. This internal tabletop is preparation, not that evidence.
