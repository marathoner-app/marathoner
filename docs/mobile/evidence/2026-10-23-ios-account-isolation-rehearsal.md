# 2026-10-23 iOS account-isolation rehearsal

- **Tracking issue:** [#428](https://github.com/marathoner-app/marathoner/issues/428)
- **Parent gate:** [#137](https://github.com/marathoner-app/marathoner/issues/137)
- **Source:** issue #428 candidate based on `264317a`
- **Firebase environment:** development (`marathoner-d9bf9`)
- **Build:** Personal Team Debug development build
- **Device:** iPhone 15
- **OS:** iOS 26.6.2
- **Xcode:** 27.0

## Safety and fixtures

The rehearsal used two randomly generated, email-verified fictional development
accounts. Each owned a distinct synthetic profile, shoe, and completed run. The
ordinary maintainer account, beta environment, and production environment were
not used.

Credentials and generated account identifiers existed only in the ignored,
mode-`0600` local manifest. No credential, user ID, token, device identifier, or
participant data is recorded here.

## Results

| Case | Result | Privacy-safe observation |
| --- | --- | --- |
| S01 approved restoration | Pass | Account A showed only its distinct 5 km synthetic run and restored it correctly across three force-quit launches. No signed-out or other-account content appeared. |
| S02 logout persistence | Pass | Logout removed account A state immediately. Two subsequent force-quit launches remained signed out and never showed account A data. |
| S03 account switch and memory isolation | Pass | A to B switching succeeded without terminating the process. Plan, Track, and Analyze showed only account B state; no account A record, draft, total, banner, or error appeared. Account B then restored correctly after force-quit. |
| S05 revoked session, first attempt | Corrective finding | Disabling account B removed all private state and prevented restoration, but Firebase delivered a signed-out event without an error, so the landing page did not explain why a new sign-in was required. |
| S05 revoked session, corrected build | Pass | A non-sensitive prior-session marker allowed the public entry to say “Your session has ended. Log in again.” No account B state appeared. A second force-quit launch remained signed out and the revoked session did not return. |
| Fixture cleanup | Pass | Both disposable Auth users, both profiles, shoes, runs, and the local credential manifest were removed by the reviewed cleanup command. |

## Corrective change

Online restored sessions now force Firebase token validation, while a device that
reports offline deliberately uses the cached token so the previously reviewed
offline cold-start path remains available. A successful session stores only a
boolean prior-session marker. Explicit logout clears it. If Firebase silently
returns signed out while the marker is present, Marathoner consumes the marker
and shows the existing actionable session-ended notice.

The marker contains no account ID, email, token, or training data. Storage
failure is non-blocking for both sign-in and logout.

## Cleanup confirmation

The cleanup action completed successfully after the final cold-start check. The
ignored credential manifest no longer exists locally, and `git status` contains
no fixture secrets or generated account identifiers.

## Remaining parent-gate work

This evidence completes S01, S02, S03, and S05. S04 is recorded separately in
the [2026-10-23 failure-state rehearsal](2026-10-23-ios-failure-state-rehearsal.md).
S06 remains pending, and S07 remains blocked on the active trusted-command
migration; therefore this rehearsal does not close #137.
