# 2026-11-12 paid-team signing and Release proof

- **Tracking issue:** [#700](https://github.com/marathoner-app/marathoner/issues/700)
- **Parent TestFlight issue:** [#122](https://github.com/marathoner-app/marathoner/issues/122)
- **Outcome:** Paid-team signing, the production App Attest entitlement,
  physical-device installation, and launch passed. Live token acceptance and
  TestFlight remain open.

## Boundary exercised

The individual Apple Developer Program membership was active under the account
holder's legal name. The proof used a clean worktree at main commit `f902f18`,
Xcode 27.0, and a physical iPhone running iOS 26.6.2.

The Apple team selection stayed in ignored `ios/local.xcconfig`; the tracked
Xcode project remains team-neutral. No Apple credentials, recovery material,
API keys, certificate fingerprints, provisioning-profile identifiers, device
identifiers, or App Check tokens were retained in the repository or this
evidence record.

## Results

1. `npm ci` completed.
2. `npm run check:ios` passed for the development boundary.
3. `npm run check:ios:beta` passed with the explicit provisional-methodology
   opt-in required by the closed-beta decision.
4. Xcode created a valid Apple Development signing identity and an automatic
   provisioning profile for the canonical bundle identifier.
5. A signed Debug device build completed.
6. A signed Release beta device build completed.
7. The signed Release app contained the production App Attest entitlement,
   HealthKit, and HealthKit background delivery.
8. The signed Release app installed on and launched from the physical iPhone.
9. `git status --short` remained clean because local environment, signing,
   generated Firebase, and build outputs are ignored.

## Remaining boundary

This proof does not claim live Firebase App Attest token acceptance, completion
of the signed-in beta journey, archive or upload success, TestFlight review, or
a non-owner tester pass.

Issue #122 remains open for the App Store Connect record, archive and upload,
export-compliance and listing metadata, TestFlight review, replacement or pause
rehearsal, and a non-owner journey. Issue #205 and its successors own live App
Attest token acceptance, observation, rollback, and any staged enforcement.
