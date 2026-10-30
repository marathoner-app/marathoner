# Automatic completed-run import

- **Status:** Accepted product and architecture direction; provider delivery remains open
- **Decision date:** 2026-10-30
- **Decision issue:** [#616](https://github.com/marathoner-app/marathoner/issues/616)
- **Delivery epic:** [#617](https://github.com/marathoner-app/marathoner/issues/617)
- **Parent roadmap:** [#104](https://github.com/marathoner-app/marathoner/issues/104)

## Decision

Manual run entry remains a supported fallback and internal-testing tool, but it
is not the intended daily workflow for outside beta participants. Every invited
participant must have a verified automatic completed-run import path for the
device ecosystem they will use.

Marathoner will deliver that outcome in this order:

1. define one provider-neutral completed-activity contract and duplicate
   boundary;
2. persist normalized imports through the trusted completed-run command path;
3. read running workouts from HealthKit in the iOS daily companion;
4. let runners add perceived effort, optional notes, shoes, and an appropriate
   planned-workout association without re-entering provider facts;
5. request Garmin Connect Starter Activity API access in parallel; and
6. add direct Garmin Activity API ingestion behind the same normalized
   boundary.

Manual logging remains available for corrections, missing activities,
unsupported devices, treadmill runs that do not reach a connected source, and
internal diagnosis. Marathoner does not remove or degrade that path.

## Provider boundaries

### Apple

Marathoner integrates with **HealthKit**, the permission-controlled store that
contains workouts shown through Apple's Health and Fitness experiences. There
is no separate participant-facing "Apple Fitness API" in this design.

The iOS shell requests only the workout and metric access required to import
completed runs. It uses a bounded historical query after connection and
supported observer/background-delivery behavior for later changes. Permission
denial must leave manual entry usable and explain how to reconnect without
pressuring the runner to grant access.

Official references:

- [HealthKit](https://developer.apple.com/documentation/healthkit)
- [Authorizing access to health data](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Configuring HealthKit access](https://developer.apple.com/documentation/xcode/configuring-healthkit-access)

### Garmin

Marathoner requests Garmin Connect **Starter business access** for the Activity
API, not the separately scoped all-day Health API. The target integration uses
OAuth 2.0 and Garmin push delivery for completed activities. Provider
credentials and user tokens stay in trusted server infrastructure and never in
the browser bundle, native WebView, repository, logs, or issue evidence.

Official references:

- [Garmin Connect Developer Program overview](https://developer.garmin.com/gc-developer-program/overview/)
- [Garmin Activity API](https://developer.garmin.com/gc-developer-program/activity-api/)
- [Garmin program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/)

Garmin Connect can also share workout summaries with Apple Health. That path
may support a bounded early iPhone test only after Marathoner verifies the
available identity, date, distance, and duration fields. Garmin documents that
this bridge omits the GPS track, provides limited activity heart-rate detail,
and completes sharing after Garmin Connect synchronizes. It is not represented
as equivalent to direct Garmin data and does not cancel the direct Activity API
work.

- [Garmin: sharing Connect data with Apple Health](https://support.garmin.com/en-US/?faq=lK5FPB9iPF5PXFkIpFlFPA)

## Provider-neutral data boundary

Provider adapters normalize into one versioned imported-activity contract. The
portable contract contains only the minimum facts needed to create or reconcile
a completed run:

- source provider and opaque provider activity identity;
- source creation/update state and import timestamps;
- supported running-activity type;
- start/end time or duration plus the relevant time zone;
- distance in canonical units; and
- the minimum source metadata needed for duplicate handling and support.

Perceived effort, Marathoner notes, shoe association, and plan-workout matching
remain Marathoner-owned fields. They are never inferred from a provider merely
because the provider supplies other activity details.

Provider SDK types, OAuth tokens, FIT payloads, GPS routes, and raw all-day
health data do not enter the portable training contract. A later requirement
may add a narrowly reviewed detail, but data availability by itself is not a
reason to collect or retain it.

## Idempotency and duplicate handling

Automatic delivery is at-least-once in practice. The import boundary therefore
must assume retries, delayed events, updates, and the same Garmin activity
arriving once through HealthKit and again through direct Garmin.

1. The owner plus provider plus provider activity ID forms the same-provider
   idempotency boundary.
2. A conservative cross-provider fingerprint may identify a duplicate
   candidate from start time, duration, distance, activity type, and source
   metadata.
3. A strong match reconciles according to the reviewed contract.
4. An ambiguous match remains visible for human review. Marathoner must not
   silently merge two uncertain runs or present both as ordinary confirmed
   runs.
5. A delayed import must not silently replace or duplicate a run the runner
   already entered manually.

Visible Track and Analyze state remains listener confirmed. Imported activities
use the trusted material-command boundary rather than direct provider-to-client
or client-to-Firestore writes.

## Participant experience

The normal daily loop is:

1. the watch or recording app completes and synchronizes a run;
2. Marathoner imports the provider facts automatically;
3. the run appears without asking for date, distance, or time again;
4. the runner may add effort, notes, shoes, or resolve a plan match; and
5. feedback and bounded adaptation use the same owned completed-run record.

Pending, delayed, disconnected, denied, duplicate, and failed states use calm
product language. They must not expose command IDs, provider IDs, token status,
listener terminology, or synchronization internals.

## Invitation gate

The founding cohort may include only runners whose actual device ecosystem has
a verified automatic path. HealthKit and direct Garmin are the intended paths.
A Garmin-to-Apple-Health summary bridge may support a specifically verified
early iPhone case while direct access is pending.

External-provider delay never silently converts the beta back into a
manual-logging study. If an intended tester lacks a verified path, the owner
must explicitly narrow the cohort, move the invitation date, or change this
product commitment.

The final proof is tracked by
[#624](https://github.com/marathoner-app/marathoner/issues/624). Privacy,
consent, disconnection, deletion, token custody, support, cost, and incident
behavior must match the implemented providers before invitations open.

## Dependency-ordered delivery

| Order | Issue | Milestone | Starts when |
| --- | --- | --- | --- |
| 1 | [#618 Provider-neutral import contract](https://github.com/marathoner-app/marathoner/issues/618) | 03 Track, Learn, and Adapt | Now |
| 2 | [#619 Trusted imported-run persistence](https://github.com/marathoner-app/marathoner/issues/619) | 03 Track, Learn, and Adapt | #618 and #346 complete |
| 3 | [#620 HealthKit running-workout import](https://github.com/marathoner-app/marathoner/issues/620) | 04 iOS Daily Companion | #618 and #619 complete |
| 4 | [#621 Imported-run enrichment](https://github.com/marathoner-app/marathoner/issues/621) | 04 iOS Daily Companion | #618 and #619 complete |
| 5 | [#622 Garmin Starter application](https://github.com/marathoner-app/marathoner/issues/622) | 03 Track, Learn, and Adapt | Now |
| 6 | [#623 Direct Garmin ingestion](https://github.com/marathoner-app/marathoner/issues/623) | 05 Trust and External-Beta Readiness | #618, #619, and usable #622 approval |
| 7 | [#624 Cross-provider beta proof](https://github.com/marathoner-app/marathoner/issues/624) | 05 Trust and External-Beta Readiness | #620, #621, and #623 complete |

## Non-goals

- live GPS recording by Marathoner;
- an Apple Watch or Garmin watch application;
- all-day health, sleep, stress, or body-composition ingestion;
- Android Health Connect in the founding cohort;
- writing plans or structured workouts back to a device in this epic; and
- removing manual run entry.
