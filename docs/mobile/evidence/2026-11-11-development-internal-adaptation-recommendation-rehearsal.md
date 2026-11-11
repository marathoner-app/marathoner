# 2026-11-11 development internal-adaptation rehearsal

- **Tracking issue:**
  [#678](https://github.com/marathoner-app/marathoner/issues/678)
- **Source:** issue #678 candidate based on `615b1f5`
- **Firebase environment:** development (`marathoner-d9bf9`)
- **Outcome:** Passed with a disposable fictional development fixture

## Boundary prepared

The operator reconciled the development-only deployment boundary, ran the
required local checks, and deployed only
`generateInternalAdaptationRecommendation` through the guarded scoped command.
The live inventory before and after the rehearsal contained these callable v2
exports in `us-central1` on Node.js 22:

- `generateInternalAdaptationRecommendation`;
- `resolveMaterialCommand`;
- `submitMaterialCommand`.

The beta project and its clients were not changed. No email address, UID,
command ID, App Check token, run details, recommendation payload, or private
plan details are retained here.

## Rehearsal result

1. The reviewed callable deployed with generation disabled.
2. The development-only generation parameter was enabled for a bounded proof
   window, and only the reviewed callable was redeployed.
3. The paired dogfood web client restored an authenticated approved owner, but
   its active plan was entirely future-scheduled relative to the rehearsal
   date. The client correctly reported that no completed planned run was
   eligible. No command was sent and no owner training data was changed.
4. A dedicated fail-closed manager then created one random, verified,
   development-only Auth fixture with an exact approved membership, synthetic
   active plan, eight planned workouts, and four associated completed runs.
   Credentials existed only in the ignored mode-`0600` local manifest.
5. With generation still disabled, the fixture received the typed disabled
   result. No recommendation evidence was created.
6. With generation enabled, an initial same-target fixture correctly refused a
   no-op hold. The fixture was corrected to the reviewed progression case:
   three 5 km easy runs plus one 8 km long run completed, followed by three 6
   km easy runs plus one 10 km long run planned.
7. The corrected request created exactly one pending hold recommendation. The
   signed-in listener displayed it after a full reload, identified the
   provisional rules and unreviewed explanation copy, and stated that neither
   the session-only choice nor the recommendation changed the plan.
8. A session-only apply rehearsal explicitly confirmed that no command was
   sent. Reload cleared that in-memory choice and restored the same one pending
   recommendation without offering another generation action.
9. A private read-only verifier confirmed one stored recommendation while the
   active revision, all eight workout records, and all four completed runs
   retained their seeded values.
10. The generation parameter was restored to `false`, and only
   `generateInternalAdaptationRecommendation` was redeployed. The scoped
   deployment succeeded and the three-export development inventory was read
   back afterward. A fresh reload continued to show the saved recommendation
   while generation remained disabled.

## Verification completed

| Check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm test` | Pass: 147 files, 1,388 tests |
| `npm run build` | Pass |
| `npm run build:dogfood` | Pass |
| `npm run check:ios` | Pass |
| `npm run test:material-commands` | Pass: 25 files, 300 tests |
| Scoped disabled deployment | Pass |
| Scoped proof-window deployment | Pass |
| Authenticated client restoration | Pass |
| Ordinary-owner safeguard | Pass: future-only plan produced no eligible trigger and no write |
| Disabled generation | Pass: typed disabled result before store execution |
| Synchronized eligible trigger | Pass with disposable fictional development fixture |
| Pending recommendation listener | Pass: exactly one review appeared after reload |
| Duplicate prevention | Pass: pending review suppressed another generation action |
| Plan and run immutability | Pass: private verifier matched the active revision, eight workouts, and four runs |
| Scoped rollback to disabled | Pass |
| Saved evidence after rollback | Pass: recommendation remained reviewable after reload |
| Post-rollback remote inventory | Pass |

## Cleanup and decision

The fixture manager removed the random Auth account, exact membership, seeded
profile, plan, workouts and runs, generated command receipts, recommendation
evidence, and local manifest. A reload then returned to public entry with the
expected ended-session notice. No fixture credentials or records remain.

The proof authorizes closing issue #678 after review; it does not authorize
applying the recommendation, enabling participant access, or treating the
provisional methodology as approved guidance.
