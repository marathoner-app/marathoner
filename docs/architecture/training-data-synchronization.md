# Training data synchronization

- **Status:** Accepted target architecture; completed-run command lane and two-client behavior proved against local emulators; deployment, provider migration, rules closure, live synchronization, and adaptation commands remain open
- **Decision date:** 2026-09-30
- **Decision owner:** Marathoner maintainer
- **Tracking issue:** [#80](https://github.com/marathoner-app/marathoner/issues/80)

## Decision

Marathoner will use a server-confirmed, online-only command model for material
writes and Firestore real-time listeners for authenticated training-data reads.
It will not build a custom offline mutation queue or store participant training
records in a persistent local cache for the founding beta.

This is one product contract across responsive web, the selected iOS client,
and a future Android client:

- a cached record can be useful for reading, but is never represented as current
  until the client has received a server snapshot;
- a material change is not saved until the server command succeeds;
- a disconnected material change is rejected visibly with a reconnect-to-save
  state instead of being queued;
- a stale client cannot silently overwrite a newer revision; and
- logout immediately removes participant data from the visible and application
  state, detaches its listeners, and prevents callbacks from the old session
  from repopulating the next session.

"Material write" includes plan approval or revision, completed-run creation or
deletion, a workout-status change, an adjustment decision, consent changes, and
an account-deletion request. A temporary form draft may remain in component
memory while the same authenticated screen is open, but it is unsaved, is not
synchronized, and must be discarded on logout or account change.

## Why this boundary

Firestore's client SDKs deliberately support latency-compensated writes and can
hold writes until connectivity returns. That is valuable for offline-first
products, but it does not satisfy Marathoner's promise that safety-relevant and
multi-record changes require a live server decision. Network indicators alone
are also insufficient: a device can appear online while the server is
unreachable, the session is revoked, or a request times out.

An authenticated HTTPS or callable command endpoint provides an unambiguous
online acknowledgement. The endpoint can validate ownership, supported app and
schema versions, reviewed-methodology boundaries, idempotency, and expected
record revisions before committing all affected Firestore documents in a
transaction. Firestore remains a good read model because listeners can then
deliver the committed result to every signed-in client without a second
synchronization system.

The server command boundary is intentionally logical rather than framework
specific. The accepted mobile ADR selects Capacitor with the Firebase
JavaScript SDK, but its rejected alternatives or a future native adapter can
still implement this contract if a recorded reopen trigger changes the client.

## Current implementation snapshot

The protected completed-run command lane is implemented and retained in local
emulator tests, but it is not the production application path yet:

- `TrainingDataProvider` performs one repository load when an authenticated
  experience starts and again only when the user explicitly retries.
- Plan, workout, run, and shoe changes are sent directly from the client through
  `FirestoreDocumentStore` using `setDoc`, `deleteDoc`, or a delete-only batch.
- Run creation plus workout completion and run deletion plus workout reopening
  are two separate writes with best-effort compensation. They are not atomic.
- Separately, the emulator-only Functions lane commits those same completion and
  deletion invariants atomically and idempotently. Two independent Firebase app
  instances prove uniqueness, stale-write rejection, owner isolation, offline
  non-submission, ambiguous-response resolution, and exact replay. Deployed
  environments do not install these stores, and the current provider does not
  call this client adapter.
- Repositories read before writing but do not send a revision precondition, so a
  stale client can overwrite a newer value.
- The application does not subscribe with `onSnapshot`, expose snapshot
  freshness metadata, or distinguish a server snapshot from a cached one.
- The web client uses Firestore's default in-memory cache because no persistent
  cache is configured. It does not intentionally write training records to
  IndexedDB, `localStorage`, or another durable client store.
- Signing out eventually unmounts `TrainingDataProvider` and clears its React
  state, but listener teardown, stale-callback suppression, and immediate
  logout clearing do not exist because listeners do not exist yet.

The present UI can therefore appear synchronized inside one browser session,
but it does not provide live cross-client convergence or the write guarantees
defined by this decision. The implementation issues below close those gaps.

## Read synchronization

After authentication resolves, a client subscribes only to paths owned by the
authenticated Firebase user. For the founding cohort, the data volume is small
enough to subscribe to the user's plans, the workouts for relevant plans,
completed runs, and shoes. Historical pagination and aggregate documents can be
introduced later when measured data volume warrants them; they are not a reason
to create a second beta read model.

All clients expose the same read-state contract to their UI:

| State | Meaning | Required UI behavior |
| --- | --- | --- |
| `loading` | No usable snapshot has been assembled for this session. | Show a loading state; do not show sample or prior-account data. |
| `current` | Every required subscription has delivered a server snapshot for the active user. | Normal read and eligible write controls may be shown. |
| `stale` | A current-session memory snapshot exists, but the client is offline or has only cache-originated data. | Keep it visibly readable, label it as potentially out of date, and disable material writes. |
| `saving` | A material command is awaiting server acknowledgement and listener convergence. | Prevent duplicate submission and say that saving is in progress. |
| `conflict` | The server rejected an expected revision or invariant. | Preserve the user's input when safe, refresh committed state, and explain that newer data won. |
| `error` | The session cannot establish or recover its subscriptions. | Show a recoverable error and a retry or reauthentication action. |

The shared synchronization state includes the authenticated `userId`, the time
of the most recent server-confirmed snapshot, whether any required subscription
is cache-only, and the active command ID when a save is in progress. Firebase
snapshot metadata such as `fromCache` and `hasPendingWrites` is translated at
the adapter boundary rather than exposed directly to product components.

Because material writes do not use the client Firestore write path,
`hasPendingWrites` should be false for training records. If it is ever true, the
client treats the affected state as uncommitted and reports the condition; it
must not label the change saved.

The UI publishes a newly active plan or completed workout only when its
feature-specific completeness guard is satisfied. For example, plan activation
must not render an active plan whose transactionally created workout set has
not yet been assembled by the client. The atomic-write work in issues #72 and
#115 must define the expected record IDs or counts, and issue #159 must implement
the corresponding listener-convergence checks.

## Material command contract

Every material command carries:

- the authenticated session; user ownership is derived from it, not accepted
  from a request body;
- a client-generated `commandId` used as an idempotency key;
- the command kind and a versioned, validated payload;
- the expected revision of every mutable aggregate it can replace; and
- the app version and data-contract version required by the compatibility gate.

The trusted command handler validates the request, runs one Firestore
transaction, records or recognizes the idempotency result, and returns a typed
outcome. Server time is authoritative for audit and update timestamps. A retry
with the same command ID returns the original committed outcome and cannot
create a second completion. A request based on an old revision returns a typed
conflict and never overwrites current data.

The command response is proof that the server committed or rejected the change;
it is not a replacement read model. After success, the client remains in
`saving` until its listeners observe the affected committed revisions. A timeout
becomes an honest recoverable state: the client refreshes by command ID before
offering a retry, so an ambiguous response cannot duplicate a write.

Direct client writes to material training collections are removed once the
command migration completes. Firestore Security Rules then deny those material
client writes while continuing to authorize the owner's required reads. Small
non-material preference writes may use a separately documented path only if
their offline and conflict behavior cannot alter training, consent, safety, or
account state.

## Connectivity and offline behavior

The save decision is based on a successful server request, not solely on browser
or operating-system connectivity signals. A known-offline signal may disable a
button early, but a failed or timed-out command must still resolve to a visible
not-saved or outcome-unknown state.

There is no background replay of material commands. Reconnecting refreshes the
server state first, after which the participant can review and submit again.
Temporary form input may be retained only in current-session memory and must be
clearly labeled unsaved.

## Cache, logout, and account isolation

The founding-beta cache policy is memory-only for participant training data:

- the web Firestore adapter explicitly configures a memory cache rather than
  relying on a changing SDK default;
- a Capacitor client uses the same web policy;
- an Expo client using the Firebase JavaScript SDK uses its supported
  memory-only behavior; and
- if a native Firebase adapter is selected, its platform-default persistent
  Firestore cache is disabled before participant data is loaded.

Marathoner does not copy training snapshots into IndexedDB, `localStorage`,
AsyncStorage, SQLite, files, or another durable device cache during the founding
beta. Firebase Authentication's credential persistence is a separate session
decision and does not authorize persistent training-data caching.

When logout or account switching begins, the client must, in order:

1. enter a session-ending state that obscures personal data and blocks actions;
2. detach every training listener and invalidate the session generation so late
   callbacks are ignored;
3. clear training records, derived analytics, drafts, errors, command state, and
   repository references from application memory; and
4. end the Firebase Authentication session.

A new session creates new user-keyed adapters and subscriptions. No snapshot is
rendered unless its owner and session generation match the current session.
Automated tests must deliberately deliver an old listener callback after an
account switch and prove that it cannot repopulate the UI.

Memory-only caching reduces, but does not eliminate, local exposure: process
memory, screenshots, operating-system backups, logs, and crash reports remain
part of the security review. Sensitive record bodies and command payloads must
not be written to application logs or analytics.

## Cross-client guarantees

Web, the selected iOS client, and a future Android client must share these
observable guarantees even when their SDK adapters differ:

1. The same versioned record and command schemas are used.
2. Only server-confirmed records are called saved or current.
3. Material offline writes are not queued and fail visibly.
4. Command IDs make retries idempotent.
5. Revision preconditions turn stale writes into conflicts.
6. Multi-record invariants commit atomically.
7. Snapshot freshness is visible and translated into the same state meanings.
8. Logout and account switching clear or isolate all participant state.
9. Unsupported app or schema versions cannot perform material writes.

The shared fixture set proves serialization and calculation parity. Emulator
and endpoint tests prove command, rule, and concurrency behavior. Each selected
client must additionally prove the critical online, offline, timeout, stale,
retry, logout, and account-switch scenarios on its real runtime.

## Rejected alternatives

### Snapshot reloads only

Keeping the current load-on-start model is simple but leaves concurrent clients
stale and makes conflict discovery too late. It is acceptable only as the
documented current state, not as the beta target.

### Direct Firestore writes with an online check

This cannot reliably prove server reachability or prevent SDK-level pending
writes. It also puts safety and cross-record invariants in every client. A
browser or operating-system network flag is advisory, not a commit boundary.

### Persistent offline writes with last-write-wins

Firestore resolves multiple offline changes to one document with
last-write-wins behavior. That is unacceptable for plan approval, completion,
consent, and adjustment history because a stale device could silently replace a
newer decision.

### A custom synchronization engine

An outbox, background replay worker, merge policy, encrypted cache, and recovery
UI would create a second distributed system before the beta has validated its
core product. The roadmap explicitly excludes this scope.

### Persistent read cache without persistent writes

This could improve cold-start reading, but it leaves participant data on shared
or lost devices and requires trusted-device, encryption, migration, eviction,
and verified logout-erasure policies. The founding beta does not need that risk
or complexity. It may be reconsidered with a separate privacy and threat-model
decision after the beta.

### Polling instead of listeners

Polling avoids listener lifecycle work but increases staleness and network use,
and still requires conflict and session-isolation handling. It does not improve
the write boundary.

## Migration sequence and gates

1. The portable material-command envelope and typed outcomes now exist without
   importing Firebase or React. Shared synchronization-state work remains in
   #159.
2. Issue #158 established the authenticated command boundary, transactional
   receipt, offline behavior, ambiguous-response resolution, and emulator
   proof. Sprint #256 completed the atomic, idempotent, revision-safe
   completed-run creation/deletion lane and retained its two-client emulator
   evidence. The runtime remains deliberately undeployed; #72 still owns plan
   workflow migration and #115 still owns adaptation commands.
3. Tighten Firestore Security Rules so clients can read their owned records but
   cannot directly write material collections after the endpoints are ready.
4. Add listener adapters, completeness guards, freshness translation, teardown,
   and stale-callback suppression; configure memory-only caching explicitly.
5. Migrate the web provider from snapshot reads and direct writes to listeners
   and commands. Exercise two browser clients, offline requests, timeouts,
   retries, conflicts, logout, and account switching.
6. Implement the same contract in the selected iOS adapter and prove it on a
   physical iPhone before enabling the mobile completion flow.
7. Apply the same contract and tests to Android when Android returns to scope.

No mobile material-write flow may ship until steps 1 through 5 pass in the
emulator and web client, its adapter uses memory-only training-data caching, and
the mobile runtime has passed offline, retry, conflict, logout, and
account-switch tests. Issue #138 therefore remains blocked by the atomic command
work and the live-read/cache-isolation implementation named by this decision.

## Follow-up ownership

- [#158](https://github.com/marathoner-app/marathoner/issues/158) established the
  shared authenticated command envelope, local server endpoint foundation,
  idempotency receipt, typed outcomes, and offline/ambiguous-response proof.
- [#72](https://github.com/marathoner-app/marathoner/issues/72) owns atomic and
  idempotent initial-plan activation through that command boundary.
- [#115](https://github.com/marathoner-app/marathoner/issues/115) owns atomic,
  idempotent, revision-safe completion and adaptation commands plus two-client
  emulator evidence.
- [#159](https://github.com/marathoner-app/marathoner/issues/159) owns live
  listeners, shared freshness states, explicit memory caching,
  session-generation guards, and web evidence.
- [#137](https://github.com/marathoner-app/marathoner/issues/137) owns physical
  iPhone session recovery, logout, and account-cache isolation.
- [#138](https://github.com/marathoner-app/marathoner/issues/138) owns the mobile
  daily loop and may use material commands only after the preceding work passes.
- [#88](https://github.com/marathoner-app/marathoner/issues/88) records the
  selected mobile runtime's actual offline and build findings.

## References

- [Firebase: Access data offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firebase: Transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firebase: Get realtime updates](https://firebase.google.com/docs/firestore/query-data/listen)
- [Firebase JavaScript Firestore reference](https://firebase.google.com/docs/reference/js/firestore)
- [Firebase JavaScript SDK supported environments](https://firebase.google.com/docs/web/environments-js-sdk)
