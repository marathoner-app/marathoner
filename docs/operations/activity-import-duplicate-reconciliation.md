# Activity-import duplicate reconciliation

Use this closed-beta runbook only for already-created direct-Garmin and Apple
Health copies of the same Garmin-origin workout. Prevention for new imports is
handled separately by the cross-provider candidate boundary.

## Safety boundary

- Keep Apple Health importing off while investigating or reconciling.
- Do not manually delete either visible run.
- Use the dedicated beta operator Firebase CLI login.
- Target only `marathonerapp-beta` and one explicitly verified owner account.
- Start with `inspect`. It is read-only and emits aggregate counts, refusal
  reasons, and an opaque confirmation value. It does not emit activity facts or
  identifiers.
- Stop if any pair is blocked. Do not loosen a refusal boundary during a live
  recovery.

The tool accepts only one-to-one pairs where the direct Garmin run is the
canonical record, the Apple Health copy reports Garmin origin, the provider
facts fit the conservative duplicate tolerances, and only the Apple copy has
heart-rate summaries. The Apple copy must contain no runner-entered fields.

## Inspect

```sh
npm run reconcile:activity-import-duplicates -- inspect \
  --project marathonerapp-beta \
  --owner-email OWNER_EMAIL \
  --owner-uid OWNER_UID
```

The result is safe to act on only when `blockedPairCount` is zero and
`eligiblePairCount` matches the number the owner expects. Preserve no raw
activity facts in issue or pull-request evidence.

## Apply

Copy the exact opaque confirmation returned by the immediately preceding
inspection:

```sh
npm run reconcile:activity-import-duplicates -- apply \
  --project marathonerapp-beta \
  --owner-email OWNER_EMAIL \
  --owner-uid OWNER_UID \
  --confirm RECONCILE-ACTIVITY-IMPORT-DUPLICATES:CURRENT_DIGEST
```

Apply re-reads all records inside one Firestore transaction. If anything has
changed, the confirmation no longer matches and the transaction makes no
changes. For each eligible pair it:

1. preserves the Garmin run and all Marathoner-owned fields;
2. copies the missing Apple Health heart-rate summary to that run;
3. removes only the redundant Apple completed-run document; and
4. moves the Apple import record to duplicate review, referencing the canonical
   run so provider replay cannot recreate the visible duplicate.

Repeating apply after success is an idempotent no-op. Record only aggregate
counts and pass/fail in operational evidence.
