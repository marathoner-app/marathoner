import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  createCrossProviderDuplicateFingerprint,
  createProviderActivityId,
  type CompletedActivityUpsertV1,
} from '../../src/domain/activityImport/contract.js'
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
import { FirestoreLegacyImportedRunDuplicateReconciliation } from './firestoreLegacyImportedRunDuplicateReconciliation.js'

const projectId = 'demo-marathoner'
const ownerId = createUserId('legacy-duplicate-reconciliation-owner')
const app = initializeApp(
  { projectId },
  'legacy-duplicate-reconciliation-integration',
)
const database = getFirestore(app)

function appleEvent(
  suffix: string,
  startedAt: string,
  distanceMeters: number,
  includeHeartRate = true,
): CompletedActivityUpsertV1 {
  return {
    schemaVersion: 'completed-activity-import@1',
    operation: 'upsert',
    ownerId,
    provider: 'apple_health',
    providerActivityId: createProviderActivityId(`apple-${suffix}`),
    observedAt: createUtcDateTime('2026-11-14T17:10:00.000Z'),
    providerUpdatedAt: createUtcDateTime('2026-11-14T17:05:00.000Z'),
    activityType: 'running',
    startedAt: createUtcDateTime(startedAt),
    endedAt: null,
    durationSeconds: createDurationSeconds(3_600),
    timeZone: createIanaTimeZone('America/Los_Angeles'),
    distanceMeters: createDistanceMeters(distanceMeters),
    reportedOrigin: 'garmin',
    ...(includeHeartRate
      ? {
          averageHeartRateBpm: createHeartRateBpm(151),
          maximumHeartRateBpm: createHeartRateBpm(176),
        }
      : {}),
  }
}

function enrichedRun(
  suffix: string,
  event: CompletedActivityUpsertV1,
): CompletedRun {
  return {
    id: createCompletedRunId(`enriched-${suffix}`),
    userId: ownerId,
    startedAt: event.startedAt,
    timeZone: event.timeZone,
    distance: event.distanceMeters,
    duration: createDurationSeconds(3_600),
    averageHeartRateBpm: event.averageHeartRateBpm,
    maximumHeartRateBpm: event.maximumHeartRateBpm,
    importProvider: 'apple_health',
    reportedOrigin: 'garmin',
    createdAt: createUtcDateTime('2026-11-13T17:10:00.000Z'),
    updatedAt: createUtcDateTime('2026-11-13T17:10:00.000Z'),
  }
}

function legacyRun(
  suffix: string,
  event: CompletedActivityUpsertV1,
  changes: Partial<CompletedRun> = {},
): CompletedRun {
  return {
    id: createCompletedRunId(`legacy-${suffix}`),
    userId: ownerId,
    startedAt: event.startedAt,
    timeZone: event.timeZone,
    distance: event.distanceMeters,
    duration: createDurationSeconds(3_600),
    createdAt: createUtcDateTime('2026-11-04T17:10:00.000Z'),
    updatedAt: createUtcDateTime('2026-11-04T17:10:00.000Z'),
    ...changes,
  }
}

async function seedPair(
  suffix: string,
  startedAt: string,
  distanceMeters: number,
  legacyChanges: Partial<CompletedRun> = {},
  includeHeartRate = true,
) {
  const event = appleEvent(suffix, startedAt, distanceMeters, includeHeartRate)
  const imported = enrichedRun(suffix, event)
  const legacy = legacyRun(suffix, event, legacyChanges)
  await Promise.all([
    database.doc(`users/${ownerId}/activityImports/import-${suffix}`).set({
      schemaVersion: 1,
      trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
      userId: ownerId,
      canonicalCommandId: `legacy-reconciliation-command-${suffix}`,
      state: 'active',
      event,
      completedRunId: imported.id,
      candidateCompletedRunId: null,
      candidateKind: null,
      crossProviderFingerprint: createCrossProviderDuplicateFingerprint(event),
      startedAtEpochMilliseconds: Date.parse(event.startedAt),
      createdAt: '2026-11-13T17:10:00.000Z',
      updatedAt: '2026-11-13T17:10:00.000Z',
    }),
    database
      .doc(`users/${ownerId}/runs/${imported.id}`)
      .set(completedRunAdminDocument(imported)),
    database
      .doc(`users/${ownerId}/runs/${legacy.id}`)
      .set(completedRunAdminDocument(legacy)),
  ])
  return { imported, legacy }
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
    approvedBy: 'legacy-duplicate-reconciliation-emulator',
  })
}

function reconciliation() {
  return new FirestoreLegacyImportedRunDuplicateReconciliation(database, {
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

describe('Firestore legacy imported-run duplicate reconciliation', () => {
  it('deletes only four exact legacy copies and is idempotent', async () => {
    const pairs = await Promise.all([
      seedPair('oct-19', '2026-10-20T00:37:00.000Z', 3_821),
      seedPair('oct-28', '2026-10-28T12:05:25.000Z', 8_056),
      seedPair('oct-29', '2026-10-29T12:08:07.000Z', 9_663),
      seedPair('nov-03', '2026-11-03T13:04:13.000Z', 9_668),
    ])

    const inspection = await reconciliation().inspect(ownerId)
    expect(inspection).toMatchObject({
      blockedClusters: [],
      blockedClusterCount: 0,
      blockedReasonCounts: expect.objectContaining({
        ambiguous_cluster: 0,
        conflicting_heart_rate: 0,
        legacy_has_runner_fields: 0,
      }),
      candidateClusterCount: 4,
      confirmation: expect.stringMatching(
        /^RECONCILE-LEGACY-IMPORTED-RUN-DUPLICATES:[a-f0-9]{24}$/u,
      ),
      eligiblePairs: expect.arrayContaining([
        expect.objectContaining({
          enrichedRunId: 'enriched-oct-19',
          legacyRunId: 'legacy-oct-19',
          startedAt: '2026-10-20T00:37:00.000Z',
        }),
      ]),
      eligiblePairCount: 4,
      excludedClusters: [],
      excludedClusterCount: 0,
      excludedReasonCounts: { missing_heart_rate: 0 },
    })
    if (inspection.confirmation === null) {
      throw new Error('Expected a legacy reconciliation confirmation.')
    }

    await expect(
      reconciliation().reconcile({
        confirmation: inspection.confirmation,
        ownerId,
      }),
    ).resolves.toEqual({ status: 'reconciled', reconciledPairCount: 4 })

    const runs = await database.collection(`users/${ownerId}/runs`).get()
    expect(runs.docs.map(({ id }) => id).sort()).toEqual(
      pairs.map(({ imported }) => imported.id).sort(),
    )
    await expect(reconciliation().inspect(ownerId)).resolves.toMatchObject({
      blockedClusters: [],
      blockedClusterCount: 0,
      candidateClusterCount: 0,
      confirmation: null,
      eligiblePairs: [],
      eligiblePairCount: 0,
      excludedClusters: [],
      excludedClusterCount: 0,
    })
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

  it('refuses an ambiguous exact-match cluster without deleting anything', async () => {
    const { imported } = await seedPair(
      'ambiguous',
      '2026-10-28T12:05:25.000Z',
      8_056,
    )
    const event = appleEvent(
      'ambiguous',
      '2026-10-28T12:05:25.000Z',
      8_056,
    )
    const secondLegacy = legacyRun('ambiguous-second', event)
    await database
      .doc(`users/${ownerId}/runs/${secondLegacy.id}`)
      .set(completedRunAdminDocument(secondLegacy))

    await expect(reconciliation().inspect(ownerId)).resolves.toMatchObject({
      blockedClusterCount: 1,
      blockedClusters: [
        expect.objectContaining({ reason: 'ambiguous_cluster' }),
      ],
      blockedReasonCounts: { ambiguous_cluster: 1 },
      candidateClusterCount: 1,
      confirmation: null,
      eligiblePairs: [],
      eligiblePairCount: 0,
      excludedClusters: [],
      excludedClusterCount: 0,
    })
    await expect(
      reconciliation().reconcile({ confirmation: 'wrong', ownerId }),
    ).rejects.toThrow('blocked cluster')
    const runs = await database.collection(`users/${ownerId}/runs`).get()
    expect(runs.docs.map(({ id }) => id).sort()).toEqual(
      [imported.id, 'legacy-ambiguous', secondLegacy.id].sort(),
    )
  })

  it('refuses a legacy copy with runner-owned fields', async () => {
    await seedPair('runner-fields', '2026-10-28T12:05:25.000Z', 8_056, {
      notes: 'Preserve this note.',
    })

    await expect(reconciliation().inspect(ownerId)).resolves.toMatchObject({
      blockedClusterCount: 1,
      blockedClusters: [
        expect.objectContaining({ reason: 'legacy_has_runner_fields' }),
      ],
      blockedReasonCounts: { legacy_has_runner_fields: 1 },
      confirmation: null,
      eligiblePairs: [],
      eligiblePairCount: 0,
      excludedClusters: [],
      excludedClusterCount: 0,
    })
  })

  it('leaves an exact pair without heart rate excluded while reconciling an eligible pair', async () => {
    const eligible = await seedPair(
      'eligible-with-hr',
      '2026-10-28T12:05:25.000Z',
      8_056,
    )
    const excluded = await seedPair(
      'excluded-without-hr',
      '2026-10-15T12:02:55.000Z',
      9_663,
      {},
      false,
    )

    const inspection = await reconciliation().inspect(ownerId)
    expect(inspection).toMatchObject({
      blockedClusterCount: 0,
      eligiblePairCount: 1,
      excludedClusterCount: 1,
      excludedClusters: [
        expect.objectContaining({ reason: 'missing_heart_rate' }),
      ],
      excludedReasonCounts: { missing_heart_rate: 1 },
    })
    if (inspection.confirmation === null) {
      throw new Error('Expected a legacy reconciliation confirmation.')
    }
    await expect(
      reconciliation().reconcile({
        confirmation: inspection.confirmation,
        ownerId,
      }),
    ).resolves.toEqual({ status: 'reconciled', reconciledPairCount: 1 })

    const runs = await database.collection(`users/${ownerId}/runs`).get()
    expect(runs.docs.map(({ id }) => id).sort()).toEqual(
      [eligible.imported.id, excluded.imported.id, excluded.legacy.id].sort(),
    )
  })

  it('rejects a stale dry-run confirmation without deleting either run', async () => {
    const { imported, legacy } = await seedPair(
      'stale',
      '2026-10-28T12:05:25.000Z',
      8_056,
    )
    const inspection = await reconciliation().inspect(ownerId)
    if (inspection.confirmation === null) {
      throw new Error('Expected a legacy reconciliation confirmation.')
    }
    await database.doc(`users/${ownerId}/runs/${legacy.id}`).update({
      updatedAt: Timestamp.fromDate(new Date('2026-11-15T00:00:00.000Z')),
    })

    await expect(
      reconciliation().reconcile({
        confirmation: inspection.confirmation,
        ownerId,
      }),
    ).rejects.toThrow('exact current dry-run confirmation')
    const runs = await database.collection(`users/${ownerId}/runs`).get()
    expect(runs.docs.map(({ id }) => id).sort()).toEqual(
      [imported.id, legacy.id].sort(),
    )
  })
})
