# 2026-11-04 owner-development completed-run command rehearsal

- **Tracking issue:**
  [#347](https://github.com/marathoner-app/marathoner/issues/347)
- **Provider migration:**
  [#346](https://github.com/marathoner-app/marathoner/issues/346)
- **Outcome:** Passed for the closed owner-development path

## Boundary exercised

The rehearsal used the physical iOS `ios-development` Debug build and the two
reviewed callable exports in `marathoner-d9bf9`. The deployed source was main
commit `d3557ed`, built with Xcode 27.0 (27A266a), and exercised on a physical
iPhone 15. The device's iOS version was not retained in the redacted operator
record.

The final remote inventory contained only these material-command exports:

- `submitMaterialCommand`, callable v2, `us-central1`, Node.js 22;
- `resolveMaterialCommand`, callable v2, `us-central1`, Node.js 22.

No email address, UID, device identifier, command ID, completed-run ID, App
Check debug token, raw request, receipt body, or raw log is retained here.

## Rehearsal result

1. A signed-in development account with accepted App Check but no approved
   membership received the typed membership-required rejection. No run appeared
   in the signed-in listener.
2. The operator added the exact approved owner-development membership record
   through the private administrative path. The reversible check then created
   one fictional unplanned 5 km run, observed it through the listener, deleted
   that exact run through the command boundary, and observed listener cleanup.
3. Both reviewed services were redeployed with completed-run commands disabled
   while provisional-plan dogfood remained enabled. The remote service
   configuration was read back before testing. The same command check was
   rejected, and no run appeared.
4. Both services were restored with completed-run commands enabled while the
   plan flag remained enabled. The final remote revisions were
   `submitmaterialcommand-00005-qux` and
   `resolvematerialcommand-00005-kec`.
5. The reversible check passed again after restoration, including listener
   convergence, command deletion, and listener-confirmed cleanup.

The retained development membership authorizes only the two closed internal
accounts. It is not evidence for participant access, production App Attest, or
an external beta.

## Negative controls

| Boundary | Evidence | Result |
| --- | --- | --- |
| Missing approved membership | Live iOS development command | Typed rejection; no listener-visible run |
| Runtime kill switch | Live scoped redeployment with the run flag false | Typed rejection; no listener-visible run |
| Missing authentication | Material-command emulator integration coverage | Authentication rejection before persistence |
| Invalid or missing App Check | Completed-run handler and emulator coverage | App Check rejection before the run store |
| Unsupported protocol or command version | Material-command handler and emulator coverage | Typed unsupported-version result without a write |
| Wrong or unreviewed project | Runtime activation and deployment-guard tests | Stores remain unavailable and deployment fails closed |

The final post-deploy verifier could not be rerun on this workstation because
the Google Cloud CLI is not installed. That is a tooling gap, not a claimed
pass. The stronger end-to-end callable, Firestore listener, deletion, rollback,
and restoration sequence above completed on the physical client. The exact
two-export Firebase inventory and both final runtime flags were also read back
after restoration.

## Decision

Issue #347's live activation gate may now permit an explicitly requested client
build. Every checked-in client environment continues to request
`VITE_COMPLETED_RUN_COMMANDS_ENABLED=false`, so this record does not migrate
Track. Issue #346 owns the later provider switch and its product-path
verification.
