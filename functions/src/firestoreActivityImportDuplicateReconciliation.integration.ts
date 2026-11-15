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
      eligiblePairCount: 1,
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
