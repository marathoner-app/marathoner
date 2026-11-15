import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  createCrossProviderDuplicateFingerprint,
  createProviderActivityId,
  type CompletedActivityUpsertV1,
} from '../../src/domain/activityImport/contract.js'
import { createActivityImportCommand } from '../../src/domain/materialCommands/contract.js'
import {
  createIanaTimeZone,
  createUtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createCompletedRunId,
  createUserId,
} from '../../src/domain/training/identifiers.js'
import type { CompletedRun } from '../../src/domain/training/types.js'
import {
  createDistanceMeters,
  createDurationSeconds,
  createHeartRateBpm,
} from '../../src/domain/training/units.js'
import { TRAINING_SCHEMA_VERSION } from '../../src/persistence/trainingSchema.js'
import { completedRunAdminDocument } from './firestoreCompletedRunDocuments.js'
import { FirestoreActivityImportDuplicateReconciliation } from './firestoreActivityImportDuplicateReconciliation.js'
import { FirestoreActivityImportStore } from './firestoreActivityImportStore.js'

const projectId = 'demo-marathoner'
const ownerId = createUserId('duplicate-reconciliation-owner')
const app = initializeApp({ projectId }, 'duplicate-reconciliation-integration')
const database = getFirestore(app)
const reconciliationTime = new Date('2026-11-14T18:00:00.000Z')

function garminEvent(
  providerActivityId: string,
  changes: Partial<CompletedActivityUpsertV1> = {},
): CompletedActivityUpsertV1 {
  return {
    schemaVersion: 'completed-activity-import@1',
    operation: 'upsert',
    ownerId,
    provider: 'garmin_connect',
    providerActivityId: createProviderActivityId(providerActivityId),
    observedAt: createUtcDateTime('2026-11-14T16:10:00.000Z'),
    providerUpdatedAt: createUtcDateTime('2026-11-14T16:05:00.000Z'),
    activityType: 'running',
    startedAt: createUtcDateTime('2026-11-14T15:00:00.000Z'),
    endedAt: null,
    durationSeconds: createDurationSeconds(3_600),
    timeZone: createIanaTimeZone('America/Los_Angeles'),
    distanceMeters: createDistanceMeters(10_000),
    reportedOrigin: 'garmin',
    ...changes,
  }
}

function appleEvent(
  providerActivityId: string,
  changes: Partial<CompletedActivityUpsertV1> = {},
): CompletedActivityUpsertV1 {
  return garminEvent(providerActivityId, {
    provider: 'apple_health',
    observedAt: createUtcDateTime('2026-11-14T17:10:00.000Z'),
    providerUpdatedAt: createUtcDateTime('2026-11-14T17:05:00.000Z'),
    timeZone: createIanaTimeZone('Etc/GMT+8'),
    averageHeartRateBpm: createHeartRateBpm(151),
    maximumHeartRateBpm: createHeartRateBpm(176),
    ...changes,
  })
}

function appleEventWithoutHeartRate(
  providerActivityId: string,
  changes: Partial<CompletedActivityUpsertV1> = {},
): CompletedActivityUpsertV1 {
  return garminEvent(providerActivityId, {
    provider: 'apple_health',
    observedAt: createUtcDateTime('2026-11-14T17:10:00.000Z'),
    providerUpdatedAt: createUtcDateTime('2026-11-14T17:05:00.000Z'),
    timeZone: createIanaTimeZone('Etc/GMT+8'),
    ...changes,
  })
}

function completedRun(
  id: string,
  event: CompletedActivityUpsertV1,
  createdAt: string,
  changes: Partial<CompletedRun> = {},
): CompletedRun {
  return {
    id: createCompletedRunId(id),
    userId: ownerId,
    startedAt: event.startedAt,
    timeZone: event.timeZone,
    distance: event.distanceMeters,
    duration: createDurationSeconds(3_600),
    ...(event.averageHeartRateBpm === undefined
      ? {}
      : { averageHeartRateBpm: event.averageHeartRateBpm }),
    ...(event.maximumHeartRateBpm === undefined
      ? {}
      : { maximumHeartRateBpm: event.maximumHeartRateBpm }),
    importProvider: event.provider,
    reportedOrigin: event.reportedOrigin,
    createdAt: createUtcDateTime(createdAt),
    updatedAt: createUtcDateTime(createdAt),
    ...changes,
  }
}

async function seedImport(
  importId: string,
  event: CompletedActivityUpsertV1,
  runId: string,
  createdAt: string,
) {
  await database.doc(`users/${ownerId}/activityImports/${importId}`).set({
    schemaVersion: 1,
    trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
    userId: ownerId,
    canonicalCommandId: `reconciliation-command-${importId}-0001`,
    state: 'active',
    event,
    completedRunId: runId,
    candidateCompletedRunId: null,
    candidateKind: null,
    crossProviderFingerprint: createCrossProviderDuplicateFingerprint(event),
    startedAtEpochMilliseconds: Date.parse(event.startedAt),
    createdAt,
    updatedAt: createdAt,
  })
}

async function seedPair(options: {
  appleRunChanges?: Partial<CompletedRun>
  garminRunChanges?: Partial<CompletedRun>
} = {}) {
  const directEvent = garminEvent('garmin-direct-001')
  const enrichedEvent = appleEvent('apple-copy-001')
  const garminRun = completedRun(
    'garmin-run-001',
    directEvent,
    '2026-11-14T16:10:00.000Z',
    {
      notes: 'Preserve the runner note.',
      perceivedEffort: 'about_right',
      ...options.garminRunChanges,
    },
  )
  const appleRun = completedRun(
    'apple-run-001',
    enrichedEvent,
    '2026-11-14T17:10:00.000Z',
    options.appleRunChanges,
  )
  await Promise.all([
    seedImport(
      'garmin-import-001',
      directEvent,
      garminRun.id,
      '2026-11-14T16:10:00.000Z',
    ),
    seedImport(
      'apple-import-001',
      enrichedEvent,
      appleRun.id,
      '2026-11-14T17:10:00.000Z',
    ),
    database
      .doc(`users/${ownerId}/runs/${garminRun.id}`)
      .set(completedRunAdminDocument(garminRun)),
    database
      .doc(`users/${ownerId}/runs/${appleRun.id}`)
      .set(completedRunAdminDocument(appleRun)),
  ])
  return { directEvent, enrichedEvent, garminRun, appleRun }
}

async function seedSameProviderEnrichmentPair(options: {
  heartRateRunChanges?: Partial<CompletedRun>
  noHeartRateRunChanges?: Partial<CompletedRun>
} = {}) {
  const noHeartRateEvent = appleEventWithoutHeartRate('apple-no-hr-001')
  const heartRateEvent = appleEvent('apple-with-hr-001')
  const noHeartRateRun = completedRun(
    'apple-no-hr-run-001',
    noHeartRateEvent,
    '2026-11-14T16:10:00.000Z',
    options.noHeartRateRunChanges,
  )
  const heartRateRun = completedRun(
    'apple-with-hr-run-001',
    heartRateEvent,
    '2026-11-14T17:10:00.000Z',
    {
      notes: 'Preserve the enriched run note.',
      perceivedEffort: 'about_right',
      ...options.heartRateRunChanges,
    },
  )
  await Promise.all([
    seedImport(
      'apple-no-hr-import-001',
      noHeartRateEvent,
      noHeartRateRun.id,
      '2026-11-14T16:10:00.000Z',
    ),
    seedImport(
      'apple-with-hr-import-001',
      heartRateEvent,
      heartRateRun.id,
      '2026-11-14T17:10:00.000Z',
    ),
    database
      .doc(`users/${ownerId}/runs/${noHeartRateRun.id}`)
      .set(completedRunAdminDocument(noHeartRateRun)),
    database
      .doc(`users/${ownerId}/runs/${heartRateRun.id}`)
      .set(completedRunAdminDocument(heartRateRun)),
  ])
  return { heartRateEvent, heartRateRun, noHeartRateEvent, noHeartRateRun }
}

async function clearFirestoreEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required.')
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  if (!response.ok) {
    throw new Error(`Could not clear Firestore emulator: ${response.status}`)
  }
}

async function seedMembership() {
  await database.doc(`betaMemberships/${ownerId}`).set({
    schemaVersion: 1,
    userId: ownerId,
    status: 'approved',
    approvedAt: Timestamp.fromDate(new Date('2026-11-01T00:00:00.000Z')),
    approvedBy: 'duplicate-reconciliation-emulator',
  })
}

function reconciliation() {
  return new FirestoreActivityImportDuplicateReconciliation(database, {
    now: () => reconciliationTime,
    projectId,
  })
}

beforeAll(clearFirestoreEmulator)

beforeEach(async () => {
  await clearFirestoreEmulator()
  await seedMembership()
})

afterAll(async () => {
  await deleteApp(app)
})

describe('Firestore activity-import duplicate reconciliation', () => {
  it('preserves the Garmin run, copies HR, removes the Apple copy, and holds replay', async () => {
    const { enrichedEvent, garminRun, appleRun } = await seedPair()
    const inspection = await reconciliation().inspect(ownerId)

    expect(inspection).toEqual({
      blockedPairCount: 0,
      blockedReasonCounts: expect.objectContaining({
        conflicting_heart_rate: 0,
        duplicate_has_runner_fields: 0,
        multiple_candidates: 0,
      }),
      candidatePairCount: 1,
      confirmation: expect.stringMatching(
        /^RECONCILE-ACTIVITY-IMPORT-DUPLICATES:[a-f0-9]{24}$/u,
      ),
      crossProviderCandidatePairCount: 1,
      eligiblePairCount: 1,
      sameProviderCandidatePairCount: 0,
    })
    if (inspection.confirmation === null) {
      throw new Error('Expected a reconciliation confirmation.')
    }

    await expect(
      reconciliation().reconcile({
        confirmation: inspection.confirmation,
        ownerId,
      }),
    ).resolves.toEqual({ status: 'reconciled', reconciledPairCount: 1 })

    const [canonicalSnapshot, duplicateSnapshot, appleImportSnapshot] =
      await Promise.all([
        database.doc(`users/${ownerId}/runs/${garminRun.id}`).get(),
        database.doc(`users/${ownerId}/runs/${appleRun.id}`).get(),
        database.doc(`users/${ownerId}/activityImports/apple-import-001`).get(),
      ])
    expect(canonicalSnapshot.data()).toMatchObject({
      notes: 'Preserve the runner note.',
      perceivedEffort: 'about_right',
      averageHeartRateBpm: 151,
      maximumHeartRateBpm: 176,
      importProvider: 'garmin_connect',
    })
    expect(duplicateSnapshot.exists).toBe(false)
    expect(appleImportSnapshot.data()).toMatchObject({
      state: 'review_required',
      completedRunId: null,
      candidateCompletedRunId: garminRun.id,
      candidateKind: 'ambiguous_candidate',
    })

    const { ownerId: _ownerId, ...replayEvent } = enrichedEvent
    void _ownerId
    const replay = await new FirestoreActivityImportStore(database, {
      createRunId: () => 'must-not-be-created',
      now: () => new Date('2026-11-14T18:10:00.000Z'),
    }).commit({
      envelope: createActivityImportCommand(
        'reconciliation-replay-command-0001',
        replayEvent,
      ),
      ownerId,
    })
    expect(replay).toEqual({
      kind: 'review-required',
      result: expect.objectContaining({
        status: 'activity_import_review_required',
        candidateCompletedRunId: garminRun.id,
      }),
    })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
    await expect(
      reconciliation().reconcile({
        confirmation: inspection.confirmation,
        ownerId,
      }),
    ).resolves.toEqual({
      status: 'already_reconciled',
      reconciledPairCount: 0,
    })
  })

  it('keeps the exact Apple Health run with HR and holds the redundant identity on replay', async () => {
    const { heartRateRun, noHeartRateEvent, noHeartRateRun } =
      await seedSameProviderEnrichmentPair()
    const inspection = await reconciliation().inspect(ownerId)

    expect(inspection).toEqual({
      blockedPairCount: 0,
      blockedReasonCounts: expect.objectContaining({
        conflicting_heart_rate: 0,
        duplicate_has_runner_fields: 0,
        multiple_candidates: 0,
      }),
      candidatePairCount: 1,
      confirmation: expect.stringMatching(
        /^RECONCILE-ACTIVITY-IMPORT-DUPLICATES:[a-f0-9]{24}$/u,
      ),
      crossProviderCandidatePairCount: 0,
      eligiblePairCount: 1,
      sameProviderCandidatePairCount: 1,
    })
    if (inspection.confirmation === null) {
      throw new Error('Expected a reconciliation confirmation.')
    }

    await expect(
      reconciliation().reconcile({
        confirmation: inspection.confirmation,
        ownerId,
      }),
    ).resolves.toEqual({ status: 'reconciled', reconciledPairCount: 1 })

    const [canonicalSnapshot, duplicateSnapshot, duplicateImportSnapshot] =
      await Promise.all([
        database.doc(`users/${ownerId}/runs/${heartRateRun.id}`).get(),
        database.doc(`users/${ownerId}/runs/${noHeartRateRun.id}`).get(),
        database
          .doc(
            `users/${ownerId}/activityImports/apple-no-hr-import-001`,
          )
          .get(),
      ])
    expect(canonicalSnapshot.data()).toMatchObject({
      averageHeartRateBpm: 151,
      maximumHeartRateBpm: 176,
      notes: 'Preserve the enriched run note.',
      perceivedEffort: 'about_right',
      importProvider: 'apple_health',
    })
    expect(duplicateSnapshot.exists).toBe(false)
    expect(duplicateImportSnapshot.data()).toMatchObject({
      state: 'review_required',
      completedRunId: null,
      candidateCompletedRunId: heartRateRun.id,
      candidateKind: 'duplicate_candidate',
    })

    const { ownerId: _ownerId, ...replayEvent } = noHeartRateEvent
    void _ownerId
    const replay = await new FirestoreActivityImportStore(database, {
      createRunId: () => 'must-not-be-created',
      now: () => new Date('2026-11-14T18:10:00.000Z'),
    }).commit({
      envelope: createActivityImportCommand(
        'same-provider-reconciliation-replay-command-0001',
        replayEvent,
      ),
      ownerId,
    })
    expect(replay).toEqual({
      kind: 'review-required',
      result: expect.objectContaining({
        status: 'activity_import_review_required',
        code: 'same-provider-duplicate-candidate',
        candidateCompletedRunId: heartRateRun.id,
      }),
    })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
    await expect(
      reconciliation().reconcile({
        confirmation: inspection.confirmation,
        ownerId,
      }),
    ).resolves.toEqual({
      status: 'already_reconciled',
      reconciledPairCount: 0,
    })
  })

  it('refuses a linked no-HR Apple Health copy without changing either run', async () => {
    await seedSameProviderEnrichmentPair({
      noHeartRateRunChanges: {
        plannedWorkoutId: 'linked-workout-id',
        plannedWorkoutPlanId: 'linked-plan-id',
      },
    })

    const inspection = await reconciliation().inspect(ownerId)
    expect(inspection).toMatchObject({
      blockedPairCount: 1,
      blockedReasonCounts: { duplicate_has_runner_fields: 1 },
      candidatePairCount: 1,
      eligiblePairCount: 0,
      sameProviderCandidatePairCount: 1,
    })
    await expect(
      reconciliation().reconcile({ confirmation: 'wrong', ownerId }),
    ).rejects.toThrow('blocked candidate')
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 2 }))
  })

  it('refuses conflicting Apple Health HR copies instead of choosing one', async () => {
    const { noHeartRateEvent, noHeartRateRun } =
      await seedSameProviderEnrichmentPair()
    const changedEvent: CompletedActivityUpsertV1 = {
      ...noHeartRateEvent,
      averageHeartRateBpm: createHeartRateBpm(145),
      maximumHeartRateBpm: createHeartRateBpm(170),
    }
    await Promise.all([
      database
        .doc(`users/${ownerId}/activityImports/apple-no-hr-import-001`)
        .update({ event: changedEvent }),
      database
        .doc(`users/${ownerId}/runs/${noHeartRateRun.id}`)
        .set(
          completedRunAdminDocument(
            completedRun(
              noHeartRateRun.id,
              changedEvent,
              '2026-11-14T16:10:00.000Z',
            ),
          ),
        ),
    ])

    const inspection = await reconciliation().inspect(ownerId)
    expect(inspection).toMatchObject({
      blockedPairCount: 1,
      blockedReasonCounts: { conflicting_heart_rate: 1 },
      eligiblePairCount: 0,
      sameProviderCandidatePairCount: 1,
    })
  })

  it('ignores a non-exact Apple Health pair', async () => {
    const noHeartRateEvent = appleEventWithoutHeartRate('apple-no-hr-001')
    const differentEvent = appleEvent('apple-with-hr-001', {
      distanceMeters: createDistanceMeters(10_100),
    })
    const noHeartRateRun = completedRun(
      'apple-no-hr-run-001',
      noHeartRateEvent,
      '2026-11-14T16:10:00.000Z',
    )
    const differentRun = completedRun(
      'apple-with-hr-run-001',
      differentEvent,
      '2026-11-14T17:10:00.000Z',
    )
    await Promise.all([
      seedImport(
        'apple-no-hr-import-001',
        noHeartRateEvent,
        noHeartRateRun.id,
        '2026-11-14T16:10:00.000Z',
      ),
      seedImport(
        'apple-with-hr-import-001',
        differentEvent,
        differentRun.id,
        '2026-11-14T17:10:00.000Z',
      ),
      database
        .doc(`users/${ownerId}/runs/${noHeartRateRun.id}`)
        .set(completedRunAdminDocument(noHeartRateRun)),
      database
        .doc(`users/${ownerId}/runs/${differentRun.id}`)
        .set(completedRunAdminDocument(differentRun)),
    ])

    await expect(reconciliation().inspect(ownerId)).resolves.toMatchObject({
      blockedPairCount: 0,
      candidatePairCount: 0,
      confirmation: null,
      eligiblePairCount: 0,
      sameProviderCandidatePairCount: 0,
    })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 2 }))
  })

  it('refuses overlapping exact Apple Health candidates', async () => {
    await seedSameProviderEnrichmentPair()
    const secondHeartRateEvent = appleEvent('apple-with-hr-002')
    const secondHeartRateRun = completedRun(
      'apple-with-hr-run-002',
      secondHeartRateEvent,
      '2026-11-14T17:20:00.000Z',
    )
    await Promise.all([
      seedImport(
        'apple-with-hr-import-002',
        secondHeartRateEvent,
        secondHeartRateRun.id,
        '2026-11-14T17:20:00.000Z',
      ),
      database
        .doc(`users/${ownerId}/runs/${secondHeartRateRun.id}`)
        .set(completedRunAdminDocument(secondHeartRateRun)),
    ])

    const inspection = await reconciliation().inspect(ownerId)
    expect(inspection).toMatchObject({
      blockedPairCount: 3,
      blockedReasonCounts: { multiple_candidates: 3 },
      candidatePairCount: 3,
      eligiblePairCount: 0,
      sameProviderCandidatePairCount: 3,
    })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 3 }))
  })

  it('refuses malformed import evidence before planning any change', async () => {
    await seedSameProviderEnrichmentPair()
    await database
      .doc(`users/${ownerId}/activityImports/apple-no-hr-import-001`)
      .update({ crossProviderFingerprint: 'malformed-fingerprint' })

    await expect(reconciliation().inspect(ownerId)).rejects.toThrow(
      'activity-import record is invalid',
    )
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 2 }))
  })

  it('refuses a duplicate copy that contains runner-owned fields', async () => {
    await seedPair({ appleRunChanges: { notes: 'Do not discard this.' } })
    const inspection = await reconciliation().inspect(ownerId)

    expect(inspection).toMatchObject({
      blockedPairCount: 1,
      blockedReasonCounts: { duplicate_has_runner_fields: 1 },
      eligiblePairCount: 0,
    })
    await expect(
      reconciliation().reconcile({ confirmation: 'wrong', ownerId }),
    ).rejects.toThrow('blocked candidate')
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 2 }))
  })

  it('refuses conflicting HR instead of overwriting the canonical run', async () => {
    await seedPair({
      garminRunChanges: {
        averageHeartRateBpm: createHeartRateBpm(149),
        maximumHeartRateBpm: createHeartRateBpm(174),
      },
    })
    const inspection = await reconciliation().inspect(ownerId)

    expect(inspection).toMatchObject({
      blockedPairCount: 1,
      blockedReasonCounts: { conflicting_heart_rate: 1 },
      eligiblePairCount: 0,
    })
  })

  it('refuses overlapping candidates instead of guessing a pair', async () => {
    await seedPair()
    const secondAppleEvent = appleEvent('apple-copy-002', {
      startedAt: createUtcDateTime('2026-11-14T15:00:20.000Z'),
    })
    const secondAppleRun = completedRun(
      'apple-run-002',
      secondAppleEvent,
      '2026-11-14T17:11:00.000Z',
    )
    await Promise.all([
      seedImport(
        'apple-import-002',
        secondAppleEvent,
        secondAppleRun.id,
        '2026-11-14T17:11:00.000Z',
      ),
      database
        .doc(`users/${ownerId}/runs/${secondAppleRun.id}`)
        .set(completedRunAdminDocument(secondAppleRun)),
    ])

    const inspection = await reconciliation().inspect(ownerId)
    expect(inspection).toMatchObject({
      blockedPairCount: 2,
      blockedReasonCounts: { multiple_candidates: 2 },
      candidatePairCount: 2,
      eligiblePairCount: 0,
    })
  })
})
