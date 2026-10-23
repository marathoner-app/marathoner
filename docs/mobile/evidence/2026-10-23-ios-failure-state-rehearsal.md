# 2026-10-23 iOS owner failure-state rehearsal

- **Tracking issue:** [#426](https://github.com/marathoner-app/marathoner/issues/426)
- **Parent acceptance issue:** [#140](https://github.com/marathoner-app/marathoner/issues/140)
- **Tester role:** Owner
- **Distribution:** Xcode development Debug build
- **Firebase environment:** Development
- **Device:** Physical iPhone 15
- **iOS version:** 26.6.2
- **Xcode version:** 27.0 (27A266a)
- **Candidate boundary:** Internal development evidence only

## Evidence boundary

This record separates observed physical-iPhone behavior from automated support
and from cases that do not yet have a safe, reversible fixture. A component or
integration test is supporting evidence, not a physical `Pass`.

The owner Debug build cannot satisfy the external candidate or non-owner gates
in #140. Those remain blocked on organization signing and App Attest under
[#281](https://github.com/marathoner-app/marathoner/issues/281), followed by a
reviewed distribution build and an approved non-owner account.

## Physical matrix

| Case | Build and starting condition | Expected behavior | Observed behavior and recovery | Result |
| --- | --- | --- | --- | --- |
| F01 startup/bootstrap failure | No approved reversible native-startup induction method is available for the current owner build. | A branded, bounded error replaces indefinite loading and offers a working retry. | Automated startup-gate coverage confirms the intended alert and retry behavior, but no physical failure was induced. | **Blocked** — safe physical induction method remains required. |
| F02 completely empty approved account | The ordinary owner account contains training state; no approved disposable empty account is available. | Plan, Track, and Analyze distinguish empty from loading or failure and expose the next valid action. | Empty-state component coverage passes, but substituting the populated owner account would not exercise this case. | **Blocked** — approved empty account required. |
| F03 connectivity loss after current data loads | Commit `a485f0f`; owner account loaded online on the current development Debug build; saved run visible in Track; iPhone then entered Airplane Mode. | After the reconnect grace period, current-account data remains reviewable, writes become unavailable, and writing resumes automatically after server freshness returns. | The saved run remained visible. Marathoner announced that it was reconnecting, permitted review, and would resume editing automatically. Edit and Log Run were unavailable. After Airplane Mode was disabled, the notice cleared and Edit opened normally without a relaunch. With VoiceOver enabled, the reconnecting message was announced once, did not repeat, and was not announced again after recovery. | **Pass** — physical owner-development evidence. |
| F04 offline cold start and recovery | Commit `fd7db19`; development Debug build; existing signed-in owner session; no active plan; app cold-started offline. | The app reaches a bounded, honest state and never implies a write was saved or queued. | On 2026-10-22 the app opened without an active plan. After connectivity returned, the existing sample run returned, the reconnecting notice cleared automatically in about three seconds, and Edit opened normally without relaunching. | **Pass** — physical owner-development evidence from #417. |
| F05 expired or revoked session | No disposable fictional account and approved reversible revocation procedure are available. | Participant data disappears, the public entry explains that a new sign-in is needed, and stale callbacks cannot restore prior data. | Automation proves participant state is removed. Issue #426 corrects the missing user-facing signed-out explanation, but intentionally does not disable the owner's account to create physical evidence. | **Blocked** — disposable account and approved #137 procedure required. |
| F06 account switch and isolation | A second approved fictional account with distinct training data is not available. | No data, draft, result, or announcement from the first account appears in the second. | Automated owner-keying, listener teardown, generation, and late-callback tests pass. A one-account repetition is not treated as physical account-isolation evidence. | **Blocked** — two approved fictional accounts required under #137. |
| F07 stale run or plan revision | The active completed-run product path does not yet use the trusted revisioned command boundary. | A conflict is distinct from success and generic network failure, preserves safe input, and explains how to refresh. | The domain contract is tested, but the Track UI cannot honestly induce this outcome until the command migration is active. | **Blocked** — [#405](https://github.com/marathoner-app/marathoner/issues/405) and [#346](https://github.com/marathoner-app/marathoner/issues/346). |
| F08 disabled or unavailable feature | No owning feature currently supplies an approved reversible unavailable-backend fixture for this build. | Submission is unavailable and nearby guidance identifies the prerequisite or supported alternative. | No-plan guidance is covered and has been exercised, but it is not a substitute for an unavailable-backend failure. | **Blocked** — an owning feature must provide a safe fixture before physical execution. |
| F09 recoverable completed-run mutation failure | The active Track path does not yet expose the trusted command failure fixture. | The error is announced, safe input remains available, duplicate writes are prevented, and one retry has one clear outcome. | Command-client tests cover offline, typed failure, unknown-outcome, and duplicate-prevention behavior. The current product path cannot provide physical evidence yet. | **Blocked** — [#405](https://github.com/marathoner-app/marathoner/issues/405) and [#346](https://github.com/marathoner-app/marathoner/issues/346). |
| F10 offline account-deletion entry | The rehearsal requires a disposable fictional account and the separately approved destructive procedure. | The UI says nothing was saved or queued, retains no false receipt, and offers safe recovery. | Automated deletion coverage confirms the copy and command behavior. The owner's ordinary account was not placed at risk. | **Blocked** — [#124](https://github.com/marathoner-app/marathoner/issues/124). |

## F03 physical procedure and observation

Use the current owner development build with the signed-in training view already
confirmed current.

1. Open **Track** and confirm the expected saved run is visible.
2. Enable Airplane Mode without force-quitting the app.
3. Confirm existing training remains readable.
4. After the brief grace period, confirm Marathoner explains that it is
   reconnecting and that editing will resume automatically.
5. Confirm material edit and add actions are unavailable while the view is not
   server-current. Do not expect a manual Retry button for this automatically
   recovering state.
6. Disable Airplane Mode.
7. Confirm the notice clears and editing becomes available without a relaunch.
8. Record the observation below without account, device, App Check, or Firebase
   identifiers.

| Date/time zone | Commit | Settings | Network transition | Observation | Result |
| --- | --- | --- | --- | --- | --- |
| 2026-10-23 America/Los_Angeles | `a485f0f` | S0 and S1 | Online → Airplane Mode → online | The saved run remained visible. The reconnecting notice explained the review-only state and automatic recovery. Edit and Log Run were unavailable. Restoring connectivity cleared the notice and restored Edit without a relaunch. VoiceOver announced the reconnecting state once, did not repeat it, and stopped announcing it after recovery. | **Pass** |

## Supporting automated evidence

The following coverage is required but does not convert a blocked physical row
into a pass:

- `src/components/FirebaseBootstrapGate.test.tsx` covers bounded startup
  failure, an alert, support guidance, and retry.
- `src/App.test.tsx` covers delayed reconnect guidance, readable cached data,
  disabled writes, automatic recovery, authentication-failure isolation, and
  the signed-out recovery notice.
- `src/training/trainingSynchronization.test.ts` covers stale-to-current
  recovery only after every required source returns server-confirmed evidence.
- `src/services/authService.test.ts` covers expired, missing-user, invalid-token,
  and disabled-account mapping without publishing participant state.
- `src/services/completedRunCommandClient.test.ts` and
  `src/services/materialCommandClient.test.ts` cover offline rejection,
  duplicate prevention, retry, typed failures, and unknown outcomes at the
  command boundary.
- `src/components/AccountDeletion.test.tsx` covers offline deletion and
  reauthentication failures without a false queued or accepted result.

## Readiness conclusion

The owner development build has direct physical evidence for offline cold-start
recovery and for an in-session disconnect with automatic recovery. The remaining
blocked rows identify missing fixtures or product-boundary work rather than
silently claiming coverage.

This record does **not** make #140 invitation-ready. Organization signing,
external-candidate execution, the non-owner journey, disposable account
fixtures, and the trusted completed-run command migration remain required.
