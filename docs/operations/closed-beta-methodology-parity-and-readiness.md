# Closed-beta methodology parity and invitation-readiness rehearsal

- **Status:** Required before the first participant invitation; no passing
  record exists yet
- **Owner:** Kevin Tulloch
- **Tracking issue:** [#691](https://github.com/marathoner-app/marathoner/issues/691)
- **Pinned manifest:** `closed-beta-provisional-methodology@0.2.0`
- **Applies to:** the responsive web candidate and the same release candidate
  on a physical iPhone

## What this gate proves

This rehearsal proves that the closed-beta build serves the same normalized
plan, guidance, safety, and adaptation outcomes on responsive web and physical
iOS, and that server-owned controls can stop and restore the provisional path
without a new client release. It does not approve the methodology or open
invitations by itself.

Use fictional or owner-controlled training data only. Do not place participant
names, email addresses, account identifiers, run histories, device
identifiers, tokens, or unredacted screenshots in this repository.

## Candidate lock

Record one source release identifier (normally the Git commit) before starting.
Both client rows must repeat it, while their separate `candidate` fields name
the hosted web deployment and iOS build. The web deployment and iOS candidate
must contain this exact set:

| Kind | Required version |
| --- | --- |
| Manifest | `closed-beta-provisional-methodology@0.2.0` |
| Plan | `beta-rules@0.3.0-draft` |
| Adaptation | `beta-adaptation@0.3.0-draft` |
| Guidance | `beta-guidance@0.1.0-draft` |
| Safety | `beta-safety@0.1.0-draft` |

Build the candidate with `npm run build:closed-beta` and
`npm run check:ios:beta`. Record the hosted web revision and the iOS build
number. A later runtime-code change creates a new candidate and invalidates the
old client evidence. Documentation-only evidence recording may reference the
already tested candidate.

## Cross-client state matrix

Exercise every row first on responsive web and then on the physical iPhone.
Use the same fictional account state, plan revision, manifest, and fixture
inputs. A row passes only when both clients display the same disposition and
the stored normalized reason, action, artifact versions, and revision outcome
match.

| State | Setup | Required result |
| --- | --- | --- |
| Allowed | Approved membership, current consent, enabled exact control, supported input | Exact pinned result is shown; material changes require approval. |
| Denied | Remove approved membership or current consent | Provisional output is not served and no material record changes. |
| Stale version | Exercise a client fixture with an older manifest or artifact version | Typed update/stale response; active plan remains unchanged. |
| Unavailable artifact | Point the operator-control fixture at an artifact not bundled by the server | Typed unavailable response; no fallback or improvised output. |
| Unsupported | Submit a profile or request outside the pinned plan boundary | Honest unsupported result; no plan is invented. |
| Symptom escalation | Record pain or unusual symptoms in the supported fixture | Ordinary progression/adaptation is suppressed and conservative safety guidance appears. |
| Disabled | Disable `operatorControls/closedBetaMethodology` | New plan, guidance, and adaptation output is stopped without a client release. |
| Recovery | Restore the exact reviewed control revision | The unchanged clients recover; the exact pinned path works again without duplicate writes. |

The stale-version and unavailable-artifact cases may use a guarded fixture or
emulator where changing a live control would create unnecessary risk. The
disabled and recovery rows must exercise the real beta control. Preserve the
before and after control documents privately, record only versions and pass or
fail here, and never leave the control in a test state.

## Kill switch, retirement, rollback, and recovery

Use the reviewed operator command rather than editing live documents in the
Firebase console. It is pinned to `marathonerapp-beta`, requires the dedicated
beta operator account, validates both documents against the bundled manifest,
uses Firestore update-time preconditions, and commits multi-document changes
atomically. It never prints an access token.

Inspect the current state:

```bash
npm run manage:closed-beta-methodology-controls -- \
  status --project marathonerapp-beta
```

If both controls are missing, create them disabled. This is safe preparation,
not activation:

```bash
npm run manage:closed-beta-methodology-controls -- \
  prepare --project marathonerapp-beta \
  --confirm CREATE-DISABLED-CLOSED-BETA-METHODOLOGY-CONTROLS
```

After the merged backend is deployed and the locked web/iOS candidate is ready,
enable both controls atomically:

```bash
npm run manage:closed-beta-methodology-controls -- \
  enable --project marathonerapp-beta \
  --confirm ENABLE-CLOSED-BETA-METHODOLOGY
```

For the live rehearsal:

1. Record the current methodology and guidance control revisions privately.
2. Disable the shared control with `disable` and exact confirmation
   `DISABLE-CLOSED-BETA-METHODOLOGY`.
3. Confirm both clients stop new provisional output while existing owned data
   remains readable.
4. Restore the exact prior manifest and artifact versions with `restore` and
   confirmation `RESTORE-CLOSED-BETA-METHODOLOGY`. Confirm both unchanged
   clients recover.
5. Use `retire-guidance --guidance-id <exact-id>` with confirmation
   `RETIRE-CLOSED-BETA-GUIDANCE-ITEM`, then prove that only the retired item
   disappears.
6. Use `restore-guidance --guidance-id <same-id>` with confirmation
   `RESTORE-CLOSED-BETA-GUIDANCE-ITEM`, then prove recovery.
7. Confirm the active plan revision changed only when the tester explicitly
   approved a supported material recommendation; decline and every failed state
   must leave it unchanged.

Run `status` immediately after every mutation. A missing, malformed, stale, or
version-mismatched control blocks the next operation instead of being repaired
implicitly.

Any unexplained output, partial material write, cross-account result, duplicate
recommendation, unsafe guidance, or inability to restore the exact prior state
is a Critical incident under the
[founding-beta playbook](founding-beta-incident-and-support.md). Stop the
rehearsal and keep invitations blocked.

## Participant-facing limitations to verify

The candidate must make all of these facts understandable without repeating a
large warning on every screen:

- this is an invite-only experience beta for five to eight known adults;
- the pinned training rules are provisional and have not received independent
  professional review;
- Marathoner is not medical care or individualized professional coaching;
- out-of-scope inputs receive no invented plan or recommendation;
- pain or unusual symptoms suppress ordinary progression guidance;
- material changes require the runner's approval and a network connection;
- public signup, Android distribution, finish-time prediction, live GPS,
  payments, and guaranteed outcomes are not included; and
- support, withdrawal, and deletion initiation are reachable from the product.

## Evidence record and blocking command

Copy
[`closed-beta-methodology-readiness.template.json`](templates/closed-beta-methodology-readiness.template.json)
to a dated file under `docs/mobile/evidence/`. Replace every pending value with
a privacy-safe evidence reference and a `pass` only after observing it. The
record must name the candidate, date, tester role, and physical-device status.

Run:

```bash
npm run verify:closed-beta-methodology-readiness -- \
  --record docs/mobile/evidence/YYYY-MM-DD-closed-beta-methodology-readiness.json
```

The command fails when a client row, control proof, operational reference,
physical-iPhone confirmation, exact version, or explicit owner decision is
missing. A template, partial run, simulator-only run, or version mismatch is
therefore `Not ready`, not a soft warning.

## Invitation decision

Invitations remain blocked until all of the following are true:

- the validator passes against one dated record;
- every failure has a focused issue and all invitation-blocking failures are
  resolved and repeated;
- the support route and private incident register are operational;
- App Check, account isolation, deletion, automatic import, accessibility,
  session recovery, and TestFlight gates retain their own passing evidence;
- the owner records `ready`; and
- no unresolved Critical or invitation-blocking High incident exists.

The first passing record closes the methodology portion of #691. It does not
silently close unrelated release gates or authorize more than the bounded
cohort in the [closed-beta decision](../closed-beta-gate-decision.md).
