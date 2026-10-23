# iOS session and account-isolation rehearsal

- **Status:** Automated session boundaries are implemented; physical execution and the unsupported-version command proof remain open
- **Tracking issue:** [#137](https://github.com/marathoner-app/marathoner/issues/137)
- **Selected client:** Capacitor with the Firebase JavaScript SDK

## Purpose

This rehearsal proves that the iOS client restores only a valid Firebase Auth
session and never carries participant training state from one account into
another. It is the physical-device evidence companion to the automated Auth,
listener-teardown, session-generation, and memory-cache tests.

This procedure does not approve a new authentication provider, enable signup,
or change beta access. Use only fictional development or beta fixtures created
for the selected environment. Never put credentials, Firebase user IDs, device
identifiers, App Check tokens, or API keys in an issue or pull request.

## What automation already proves

The repository must keep all of these checks green before recording device
evidence:

- a restored Firebase user is not published to React until its token validates;
- expired, invalid, missing-user, and disabled-account tokens resolve to a safe
  signed-out state without participant UI;
- a slow validation result cannot replace a newer user or sign-out event;
- pressing **Log out** first hides and unmounts training state, which invalidates
  the session generation and detaches listeners, and only then calls Firebase
  sign-out;
- a replacement account receives new owner-keyed repositories and listeners;
- a deliberately late callback from the prior owner cannot repopulate the UI;
  and
- Firestore training data uses `memoryLocalCache()` while native Auth uses the
  reviewed durable IndexedDB-first persistence required for cold-start recovery.

These tests prove deterministic application behavior, but they do not replace
the WebView lifecycle, storage, network, or credential-revocation checks below.

## Preconditions

1. Use a clean reviewed commit and run `npm run check:ios`.
2. Confirm the copied bundle reports the development Firebase boundary.
3. Build and run the Debug application on the physical test iPhone using the
   documented local signing and App Check debug configuration.
4. Prepare two fictional approved accounts, **A** and **B**, with visibly
   different fictional training data. Prepare one fictional unapproved account
   only when its environment and membership procedure are already approved.
5. Confirm every fixture can be removed after the rehearsal. Do not use a real
   participant account to test revocation or disablement.

The Personal Team Debug build is suitable for owner-device defect discovery and
the development checks in this procedure. It does not substitute for the
organization-signed App Attest candidate required by the release gates.

## Device cases

Record pass or fail, the date, iOS and Xcode versions, reviewed commit, selected
Firebase environment, and a short non-sensitive observation for each case.

### S01 — Approved sign-in and cold-start restoration

1. Start signed out and sign in as fictional account A.
2. Open **Plan** and **Track** and identify account A's fictional state.
3. Force-quit the application and launch it from the Home Screen three times.
4. Confirm every launch restores account A, reaches current training data, and
   never flashes signed-out, sample, or another account's content.

### S02 — Logout survives process termination

1. Press **Log out** while account A's training state is visible.
2. Confirm participant content disappears immediately and the public entry page
   appears when Firebase finishes signing out.
3. Force-quit and reopen twice. Confirm the application stays signed out and no
   account A data appears during startup.

### S03 — Account switch and memory isolation

1. Sign in as account A and open a surface containing its distinct fixture.
2. Log out, then sign in as account B without terminating the application.
3. Open **Plan**, **Track**, and **Analyze**.
4. Confirm no record, total, form draft, error, save state, or announcement from
   account A appears. Force-quit and confirm account B restores correctly.

The automated late-callback regression is required evidence for this case. A
physical tester cannot reliably force a detached Firebase callback at the exact
race boundary.

### S04 — Offline restoration is bounded and honest

1. With account B restored once online, force-quit the application.
2. Disable network connectivity and relaunch.
3. Confirm the application either reaches its bounded recovery state or shows
   only clearly stale current-account data with material changes disabled. It
   must not show another account, claim a save succeeded, or load indefinitely.
4. Restore connectivity and use the offered retry or relaunch. Confirm the
   current account returns to server-confirmed state.

### S05 — Expired or revoked account

1. Sign in using a disposable fictional account and leave its training state
   visible.
2. Revoke or disable that fixture using the approved Firebase operator path.
3. Trigger a fresh token check by force-quitting and reopening the application.
4. Confirm participant state disappears and the application requires a new
   sign-in. Retry and cold-start once more to confirm the old session cannot
   reappear.

Remove the disposable fixture after the result is recorded. Re-enable it only
when that is part of the approved cleanup plan.

### S06 — Authenticated but unapproved account

1. Sign in with the fictional verified account that has no active beta
   membership.
2. Confirm authentication may succeed but training data remains denied.
3. Confirm retry, navigation, logout, and cold start never reveal an approved
   account's training state.

Link the existing development/beta environment proof when this case reuses the
fixtures and procedure from #125 instead of creating new evidence.

### S07 — Unsupported-version material-write gate

Run this only after the active iOS material-write path uses the trusted command
boundary and exposes the approved compatibility test method. Confirm a client
below the supported version can still reach the safe read or upgrade state but
cannot perform a material write.

This case remains an explicit blocker for closing #137; do not infer it from a
local build check or from a command handler that the iOS product path does not
yet call.

## Evidence summary

Use this table in the issue or pull request without fixture identifiers:

| Case | Result | Evidence note |
| --- | --- | --- |
| S01 approved restoration | Pending | |
| S02 logout persistence | Pending | |
| S03 account isolation | Pending | |
| S04 offline restoration | Pending | |
| S05 revoked session | Pending | |
| S06 unapproved account | Pending | |
| S07 unsupported version | Blocked on active command migration | |

After the session, remove disposable fixtures, restore the normal development
bundle with `npm run check:ios`, and confirm `git status --short` contains no
credentials or generated signing files.
