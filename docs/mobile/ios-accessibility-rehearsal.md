# iOS accessibility and critical-failure rehearsal

- **Status:** Procedure approved; physical execution remains open
- **Procedure issue:** [#336](https://github.com/marathoner-app/marathoner/issues/336)
- **Acceptance issue:** [#140](https://github.com/marathoner-app/marathoner/issues/140)
- **Current signing blocker:** [#281](https://github.com/marathoner-app/marathoner/issues/281)
- **Companion setup:** [iOS development](ios-development.md)

## Purpose and evidence boundary

Use this checklist to evaluate the supported Marathoner journey on a physical
iPhone. It makes the device, settings, actions, observations, and defects
repeatable. It does not replace component tests, the launch-continuity proof,
or the separate account-deletion rehearsal.

The shared React interface has automated coverage for many names, roles,
alerts, status messages, focus returns, and reduced-motion choices. That
coverage is necessary but is not physical-device evidence. Issue #140 passes
only after this checklist is completed against an installable candidate and a
non-owner completes the supported journey.

The production App Attest entitlement intentionally prevents the current
Personal Team from provisioning the tracked iOS target. Until #281 supplies an
organization-signed, App Attest-capable build, record physical cases as
`Blocked`; do not remove the entitlement, weaken App Check, or substitute a
browser or simulator result and call it an iPhone pass.

## Result language

Use only these result values:

- `Pass`: the expected behavior was observed on the recorded physical build.
- `Fail`: the build was exercised and did not meet the expected behavior.
- `Blocked`: a named prerequisite prevented the observation. Link the blocker.
- `Not applicable`: the case is outside the candidate's declared supported
  journey. State why; do not use this for an inconvenient or unfinished case.

Never infer a `Pass` from source code, a desktop browser, a simulator, or an
automated test. Those results may be linked as supporting evidence.

## Entry gate

Before starting a physical session:

- [ ] #281 has supplied a valid organization signing profile with App Attest.
- [ ] The candidate commit is on the reviewed branch or `main`, with a clean
      working tree.
- [ ] `npm run check:ios` passes from a clean dependency installation.
- [ ] The [launch-continuity acceptance test](ios-development.md#launch-continuity-acceptance-test)
      passes on this candidate or has current evidence that remains applicable.
- [ ] The selected Firebase environment is `development` or an explicitly
      approved beta rehearsal environment, never an improvised project.
- [ ] The test account is approved, email-verified, and contains only fictional
      training and health-context data.
- [ ] A second, disposable account is available for empty-state and non-owner
      cases. Do not alter or delete the maintainer's ordinary development
      account.
- [ ] Every failure-state setup has a documented, reversible induction method.
      If it does not, record the case as `Blocked` and open a focused issue
      instead of changing live data or security controls during the session.
- [ ] Screenshots, screen recordings, logs, and issue comments are configured
      not to capture passwords, email-link codes, tokens, device identifiers,
      real health notes, or other personal data.

## Session record

Copy this header into the #140 evidence comment or a dated repository evidence
record. One header may cover multiple cases only when the context does not
change.

```md
### iOS accessibility rehearsal

- Date and time zone:
- Tester role: owner / non-owner
- Commit SHA:
- Distribution: Xcode development / internal / TestFlight
- Firebase environment:
- iPhone model:
- iOS version:
- Xcode version, when applicable:
- Account fixture: populated / empty / disposable
- Settings pass IDs:
- Network state:
- Result summary: Pass / Fail / Blocked
- Defects and evidence links:
```

Record the iPhone model, not its serial number, UDID, phone number, or device
name.

## Settings passes

Begin each pass from a force-quit app unless a case says otherwise. Record the
exact iOS setting values because labels may change between iOS releases.

| ID | Settings | Minimum scope |
| --- | --- | --- |
| S0 | Default display and text size; VoiceOver off | Every journey and failure case |
| S1 | VoiceOver on; default text size | J01 through J08 |
| S2 | Larger Text with Larger Accessibility Sizes enabled and the slider at its largest value | J01 through J08 |
| S3 | VoiceOver on plus the S2 largest text size | J01, J02, J05, J06, and J08 |
| S4 | Increase Contrast and Differentiate Without Color on | J01 through J08; inspect every status and destructive action |
| S5 | Reduce Motion on | Launch, section navigation, every dialog, and every pending-to-result transition |
| S6 | External keyboard connected, when available | Sign-in, runner setup, Track forms, dialogs, and account settings |

If an external keyboard is not available, record S6 as `Blocked` with the
reason. Complete touch-keyboard entry in S0, S1, and S2 regardless.

## Checks that apply everywhere

For every journey and settings pass in scope, confirm:

- VoiceOver exposes a concise name, correct role, current value or state, and
  available action for every interactive control.
- Swipe focus follows a useful reading and action order, stays inside an open
  modal dialog, and returns to the control that opened a closed panel, editor,
  or dialog.
- Headings, landmarks, field groups, help text, errors, and list boundaries are
  understandable without relying on visual position.
- Text remains readable without clipping, overlap, horizontal page scrolling,
  hidden actions, or meaning lost behind truncation at the largest text size.
- Zooming the WebView does not become the only way to reach an action.
- A control's touch target is at least 44 by 44 points, or its surrounding
  tappable area provides that target without colliding with another control.
- Focus indicators, text, controls, charts, selected states, errors, pending
  states, and destructive actions remain distinguishable with S4 enabled.
- Color is never the only carrier of status or meaning.
- S5 removes nonessential transition motion without hiding content or delaying
  a result.
- Keyboard focus remains visible, Tab and Shift-Tab order is coherent, Return
  activates the expected control, Escape closes a dismissible layer, and focus
  is not trapped outside a modal.
- Loading, pending, success, and error changes are announced once, at an
  appropriate priority, without repeating indefinitely or interrupting a more
  important message.
- A disabled action is visibly and audibly unavailable, and nearby copy tells
  the runner what prerequisite or recovery is needed.
- The software keyboard uses a sensible input mode and does not cover the
  focused field, its label, validation message, or primary action.

## Supported-journey cases

Use fictional values that are recognizable in the resulting UI. For example,
log a short test run with a note that says `Accessibility rehearsal`, then
remove it during cleanup.

### J01 — Launch and session restoration

- [ ] Launch from a clean installation and reach the expected signed-out state.
- [ ] Confirm the native launch screen, bridge overlay, React loading state,
      and final UI form one understandable sequence with no blank frame.
- [ ] Sign in, force-quit, relaunch, and reach the same signed-in account.
- [ ] Sign out, force-quit, relaunch, and reach the signed-out public entry.
- [ ] Confirm loading, recovery, and restored-session messages are announced
      without exposing the account email on a locked or public screen.

### J02 — Public entry and sign-in

- [ ] Read the public page in order and reach the support and access information.
- [ ] Open the sign-in dialog; confirm initial focus, dialog name, close action,
      and focus return.
- [ ] Trigger one safe client-side validation error and correct it.
- [ ] Sign in with the approved existing development account.
- [ ] Confirm submission becomes busy once, duplicate submission is prevented,
      and the final success or error is announced.

### J03 — Today/home and runner setup

- [ ] Confirm the signed-in identity, account settings, logout action, title,
      next-workout summary, and Plan/Track/Analyze navigation read in a useful order.
- [ ] Open runner setup, move through every field, trigger and correct one
      validation error, save, close, and resume editing.
- [ ] Confirm closing or saving returns focus to the initiating control.
- [ ] With an incomplete profile, confirm the UI explains why a plan cannot be
      evaluated and provides a reachable recovery action.

### J04 — Plan

- [ ] Open Plan and confirm focus begins at the panel close action, followed by
      its heading and content.
- [ ] Navigate the week and workout structure; confirm dates, workout names,
      statuses, and distances are understandable without the visual grid.
- [ ] Open and close a workout detail; confirm dialog containment and focus return.
- [ ] Confirm the no-plan and no-next-workout states explain what is missing.
- [ ] Close Plan and confirm focus returns to the Plan button.

### J05 — Track: add and log

- [ ] Open Track and confirm every run and shoe field has a persistent spoken and
      visible label plus associated help or error text.
- [ ] Attempt to log a run before an active shoe exists; confirm the prerequisite
      and disabled action are clear.
- [ ] Add a fictional shoe, including its starting-distance explanation.
- [ ] Log a fictional completed run with date, distance, elapsed time, shoe,
      planned-workout association when available, perceived effort, and notes.
- [ ] Confirm the operation-specific pending text and one polite success
      announcement, and confirm the new record is readable in Logged Runs.

### J06 — Track: edit and destructive actions

- [ ] Edit the fictional run; confirm every edit field remains labeled and the
      save result is announced.
- [ ] Cancel and then save an edit; each time, confirm focus returns to that
      run's Edit button.
- [ ] Open the run-deletion dialog; confirm initial focus, containment,
      consequence copy, Cancel, destructive action, and focus return or a useful
      fallback when the deleted run's trigger no longer exists.
- [ ] Delete the fictional run and confirm pending and success states are
      distinguishable and announced.
- [ ] Open the shoe-retirement dialog, cancel once, then retire the fictional
      shoe; confirm the same dialog, pending, result, and focus behavior.

### J07 — Analyze

- [ ] Open Analyze with no runs and confirm the empty state is explicit.
- [ ] Open it with representative fictional runs and reach every summary and
      trend explanation.
- [ ] Confirm the weekly distance chart has a useful accessible alternative;
      line position, color, and hover behavior may not be the only data source.
- [ ] At S2, confirm chart labels and surrounding explanations do not overlap or
      hide the panel close action.
- [ ] Close Analyze and confirm focus returns to the Analyze button.

### J08 — Account, support, and deletion entry

- [ ] Open Account settings and confirm dialog name, initial focus, containment,
      close action, and focus return.
- [ ] Reach the support address and verify that its purpose is understandable.
- [ ] Start the deletion flow with an intentionally incorrect confirmation value;
      confirm the error and recovery are announced.
- [ ] Review the irreversible-action copy and final destructive control.
- [ ] Do not submit a real deletion request unless this is the separately approved
      #124 rehearsal with a disposable fictional account. Otherwise stop before
      the final action and record the boundary.

## Critical-failure cases

Run failure cases only with the reversible setup approved by the issue that owns
the behavior. Record that setup and its cleanup. `Blocked` is the honest result
when the repository does not yet provide a safe induction path.

| ID | State and safe setup authority | Expected result |
| --- | --- | --- |
| F01 | Startup/bootstrap failure, using the approved #137 or native-startup test method | The branded recovery state replaces indefinite loading, is announced as an alert, and offers a working retry. |
| F02 | Empty approved account with no profile, plan, runs, or shoes | Each surface distinguishes empty from loading or failure and exposes the next valid action. |
| F03 | Put the device in Airplane Mode after a current training view has loaded | The last in-memory view is labeled potentially stale, material writes are disabled, and Retry connection is reachable. |
| F04 | Launch while offline using the approved account and existing session | The app reaches a bounded recovery or honest stale state; it never implies that a mutation was saved or queued. |
| F05 | Expired or revoked session, induced by the approved #137 procedure on a disposable account | Private data disappears, a new sign-in is required, and stale callbacks cannot restore the prior account. |
| F06 | Account switch between two approved fictional accounts under #137 | No data, pending result, form value, or announcement from the first account appears in the second. |
| F07 | Stale plan or run revision, induced by the approved #115/#138 procedure | The conflict is distinct from success and generic network failure, preserves safe data, and tells the runner how to refresh. |
| F08 | Disabled feature or unavailable approval/guidance path, using its owning issue's fixture | The unavailable action cannot be submitted and the explanation identifies the prerequisite or supported alternative. |
| F09 | Recoverable run mutation failure, using the approved #138 procedure | The error is announced, entered values remain available when safe, duplicate writes are prevented, and retry has one clear outcome. |
| F10 | Offline deletion entry under the approved #124 procedure and disposable account | The UI states that nothing was saved or queued, retains no false receipt, and offers a safe recovery path. |

After each failure case, restore connectivity or fixture state, relaunch, and
confirm the account and training data return to the expected state. Record
cleanup failure as a separate defect.

## Non-owner rehearsal

The non-owner must use the candidate without coaching on control location or
screen-reader order. The maintainer may provide credentials, fictional data,
the product's declared scope, and a reminder not to submit the final deletion.

Ask the tester to:

1. install and launch the candidate;
2. sign in and identify the next planned workout;
3. open Track, add a fictional shoe, and log a fictional run;
4. find that run in Analyze or the available progress summary;
5. edit and remove the run, retire the fictional shoe, and sign out; and
6. locate support and explain, in their own words, how account deletion starts.

Record where the tester hesitates, needs assistance, misinterprets status, or
cannot recover. Assistance means the step did not independently pass, even if
the tester finishes after prompting.

## Evidence table

Add one row per case and settings pass. Link artifacts; do not paste secrets or
personal data into the table.

| Case | Settings | Tester | Result | Observed behavior or blocker | Evidence/defect | Invitations blocked? |
| --- | --- | --- | --- | --- | --- | --- |
| J01 | S0 | Owner |  |  |  |  |

The #140 summary must also include:

- counts of passed, failed, blocked, and not-applicable rows;
- every corrective issue and its severity;
- the non-owner result and any assistance provided;
- the exact cases repeated after each fix; and
- an explicit `Ready` or `Not ready` invitation recommendation.

## Defect and invitation rules

Open a focused corrective issue for every failure. Include the case ID, settings
pass, candidate commit, expected behavior, actual behavior, reproducibility,
and privacy-safe evidence. Do not combine unrelated failures into a general
accessibility cleanup issue.

A failure blocks invitations when it can:

- prevent a screen-reader or large-text user from signing in, understanding the
  next workout, navigating, logging or correcting a run, reaching support,
  starting deletion, or safely signing out;
- hide, mislabel, or activate the wrong material or destructive action;
- imply that an offline, stale, rejected, or failed mutation succeeded;
- expose one account's data or status to another account;
- create an unrecoverable focus trap, loading state, blank screen, or session;
  or
- remove essential meaning when color, motion, vision, or touch precision is
  unavailable.

Cosmetic defects that do not alter access, meaning, safety, data integrity, or
recovery may be scheduled after the candidate only when #140 records the reason
and owner. A high-frequency cosmetic defect may still block invitations when it
makes the product materially difficult to use.

## Cleanup

- [ ] Remove fictional runs and shoes created for the session.
- [ ] Restore network and accessibility settings to the tester's preference.
- [ ] Confirm the expected account is signed out or remains signed in according
      to the session plan.
- [ ] Revoke any temporary test access through its documented owner procedure.
- [ ] File all failures and link them from #140.
- [ ] Store only privacy-safe evidence and delete local captures that contain
      account or device secrets.
