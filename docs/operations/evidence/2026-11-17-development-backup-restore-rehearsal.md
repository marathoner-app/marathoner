# Development backup and restore rehearsal

- **Date:** November 17, 2026
- **Tracking issue:**
  [#124](https://github.com/marathoner-app/marathoner/issues/124)
- **Implementation pull request:**
  [#809](https://github.com/marathoner-app/marathoner/pull/809)
- **Owner and operator:** Kevin Tulloch using the dedicated development
  operator account
- **Project boundary:** Development project `marathoner-d9bf9` only
- **Source type:** Owner-controlled development account
- **Destination type:** Verified fictional development account
- **Data-layer result:** Pass
- **Runbook:**
  [Development backup and restore rehearsal](../development-backup-and-restore.md)

## Purpose and privacy boundary

This rehearsal tested the reviewed owner-scoped training-data recovery path in
the development project. No beta or production project was read or changed.
The public record contains no email address, Authentication UID, document path,
document value, provider credential, or participant identity.

The source was an owner-controlled development account. The destination was a
new, verified fictional Authentication account with no beta membership,
provider connection, or pre-existing Firestore owner tree.

## Result

| Check | Result | Privacy-safe evidence observed |
| --- | --- | --- |
| Project and identity guards | Pass | The operator accepted the exact development project, the dedicated operator login, the owner-controlled source, and the distinct verified fictional destination. |
| Inventory | Pass | Inspection found 151 allowlisted owner-scoped documents and no unknown collections. Provider credentials, methodology consent, command receipts, and retired proof records remained excluded by design. |
| Local snapshot controls | Pass | The operator created a new ignored `*.local` snapshot with owner-only file permissions. Its SHA-256 digest was `678a80ce53b2aacd4720d56bcd9eaabd7556e869ef114cfd1620d91c53716f30`. |
| Unsupported embedded identity | Pass by safe refusal | The first restore attempt stopped before any destination write when an allowlisted activity-import fingerprint contained the source owner identifier in a known compound string. |
| Narrow corrective handling | Pass | Pull request #809 adds a schema-checked rewrite for only `cross-provider-duplicate-fingerprint@1`: the owner segment must decode to the exact source identifier, and malformed or future schemas still fail closed. |
| Restore | Pass | The second attempt created 151 documents in the empty fictional owner tree and verified their normalized fields against the snapshot. |
| Independent read-back | Pass | A separate `verify` invocation read and matched all 151 restored documents. |
| Version-guarded cleanup | Pass | Cleanup removed all 151 restored documents using their exact recorded Firestore update versions. A final independent read confirmed that the fictional owner tree was absent and exposed no remaining collection IDs. |
| Authentication cleanup | Pass | The fictional Authentication account was deleted and a subsequent lookup confirmed that it no longer existed. |
| Local artifact cleanup | Pass | The local snapshot and restore manifest were deleted after the privacy-safe record was prepared. |
| Development UI visual check | Not exercised | The supported localhost App Check debug credential was not present on this workstation. App Check was not weakened and a second debug credential was not created solely for the rehearsal. |

## Conclusion and limits

The rehearsal demonstrates that the reviewed operator can export the current
allowlisted owner-scoped training history, restore it into an isolated fictional
development account, verify the exact normalized result, and remove the test
copy without leaving a Firestore or Authentication account behind.

The absent visual UI check does not change the passing data-layer recovery
result: the same restored tree was independently read through the operator
after the write. It does mean this record does not claim that a localhost app
session rendered the restored data. No security control was weakened to create
that additional evidence.

This rehearsal does not prove beta-project recovery, provider-token recovery,
Authentication credential recovery, account-deletion rollback, or whole-
database disaster recovery. Those remain separate claims and require their own
reviewed procedures and authorization.
