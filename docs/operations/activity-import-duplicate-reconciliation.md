# Activity-import duplicate reconciliation

Use this closed-beta runbook only for already-created duplicates in either of
these proven Garmin-origin patterns:

- a direct Garmin run plus an Apple Health copy; or
- two exact Apple Health copies with distinct workout identities where only one
  copy contains heart-rate summaries.

Prevention for new imports is handled separately by the cross-provider and
same-provider candidate boundaries.

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

The tool accepts only one-to-one pairs with matching import and run facts. For a
direct Garmin and Apple Health pair, the Garmin run remains canonical and only
the Apple copy may contain heart-rate summaries. For an Apple Health enrichment
pair, both records must report Garmin origin, have distinct provider identities
and the exact same normalized activity fingerprint, and exactly one must
contain heart-rate summaries. The heart-rate-bearing Apple run remains
canonical. In either pattern, the redundant run must contain no runner-entered
or planned-workout fields.

## Normalize one orphaned import first

If the ordinary inspection reports three overlapping same-provider edges for
one activity, inspect the orphan boundary before attempting reconciliation:

```sh
npm run reconcile:activity-import-duplicates -- inspect-orphan \
  --project marathonerapp-beta \
  --owner-email OWNER_EMAIL \
  --owner-uid OWNER_UID
```

This narrower inspection is eligible only for one exact cluster containing:

- three distinct Apple Health workout identities that all report Garmin origin;
- exactly two existing completed runs: one with heart-rate summaries and one
  without them;
- exactly one active no-heart-rate import whose referenced run is missing;
- matching import and run facts for both existing runs; and
- no runner-entered or planned-workout fields on the visible no-heart-rate run.

It refuses malformed clusters, conflicting heart-rate evidence, multiple orphan
clusters, changed run facts, or any ambiguity. When `blockedClusterCount` is
zero and `eligibleClusterCount` is one, copy the exact opaque confirmation from
that inspection:

```sh
npm run reconcile:activity-import-duplicates -- apply-orphan \
  --project marathonerapp-beta \
  --owner-email OWNER_EMAIL \
  --owner-uid OWNER_UID \
  --confirm NORMALIZE-ORPHAN-ACTIVITY-IMPORT:CURRENT_DIGEST
```

The orphan apply re-reads all evidence in one Firestore transaction. It changes
only the orphaned import to duplicate review and links it to the existing
heart-rate-bearing run. It does not create, update, or remove a completed run.
Repeating it after success is an idempotent no-op.

After normalization, rerun the ordinary `inspect`. Do not run the ordinary
apply unless it now reports the expected eligible pairs with zero blocked
pairs. For the recovery that introduced this path, the expected result is six
eligible pairs and zero blocked pairs.

## Inspect

```sh
npm run reconcile:activity-import-duplicates -- inspect \
  --project marathonerapp-beta \
  --owner-email OWNER_EMAIL \
  --owner-uid OWNER_UID
```

The result is safe to act on only when `blockedPairCount` is zero,
`eligiblePairCount` matches the number the owner expects, and the split between
`crossProviderCandidatePairCount` and `sameProviderCandidatePairCount` matches
the intended recovery. Preserve no raw activity facts in issue or pull-request
evidence.

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

1. preserves the canonical run and all Marathoner-owned fields;
2. for a direct-Garmin pair, copies the missing Apple Health heart-rate summary
   to the Garmin run;
3. for an Apple enrichment pair, keeps the existing heart-rate-bearing Apple
   run unchanged;
4. removes only the redundant completed-run document; and
5. moves the redundant import record to duplicate review, referencing the
   canonical run so provider replay cannot recreate the visible duplicate.

Repeating apply after success is an idempotent no-op. Record only aggregate
counts and pass/fail in operational evidence.
