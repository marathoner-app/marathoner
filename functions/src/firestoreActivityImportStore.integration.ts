import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createProviderActivityId } from '../../src/domain/activityImport/contract.js'
import {
  createActivityImportCommand,
  createRunDeletionCommand,
  type ActivityImportCommandEventV1,
} from '../../src/domain/materialCommands/contract.js'
import {
  createIanaTimeZone,
  createUtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createDistanceMeters,
  createDurationSeconds,
  createHeartRateBpm,
} from '../../src/domain/training/units.js'
import { FirestoreActivityImportStore } from './firestoreActivityImportStore.js'
import { FirestoreMaterialCommandStore } from './firestoreMaterialCommandStore.js'
import { FirestoreRunDeletionStore } from './firestoreRunDeletionStore.js'

const projectId = 'demo-marathoner'
const ownerId = 'activity-import-owner'
const otherOwnerId = 'activity-import-other-owner'
const app = initializeApp({ projectId }, 'activity-import-store-integration')
const database = getFirestore(app)
let now = new Date('2026-11-04T18:00:00.000Z')
let runSequence = 0

function garminEvent(
  changes: Partial<ActivityImportCommandEventV1> = {},
): ActivityImportCommandEventV1 {
  return {
    schemaVersion: 'completed-activity-import@1',
    operation: 'upsert',
    provider: 'garmin_connect',
    providerActivityId: 'garmin-activity-001',
    observedAt: createUtcDateTime('2026-11-04T17:10:00.000Z'),
    providerUpdatedAt: createUtcDateTime('2026-11-04T17:05:00.000Z'),
    activityType: 'running',
    startedAt: createUtcDateTime('2026-11-04T16:00:00.000Z'),
    endedAt: null,
    durationSeconds: createDurationSeconds(3_600),
    timeZone: createIanaTimeZone('America/Los_Angeles'),
    distanceMeters: createDistanceMeters(10_000),
    averageHeartRateBpm: createHeartRateBpm(151),
    maximumHeartRateBpm: createHeartRateBpm(176),
    reportedOrigin: 'garmin',
    ...changes,
  } as ActivityImportCommandEventV1
}

function appleHealthGarminEvent(
  providerActivityId: string,
  options: {
    changes?: Partial<ActivityImportCommandEventV1>
    withHeartRate?: boolean
  } = {},
): ActivityImportCommandEventV1 {
  const {
    averageHeartRateBpm,
    maximumHeartRateBpm,
    ...eventWithoutHeartRate
  } = garminEvent(options.changes)
  return {
    ...eventWithoutHeartRate,
    provider: 'apple_health',
    providerActivityId: createProviderActivityId(providerActivityId),
    providerUpdatedAt: null,
    ...(options.withHeartRate === false
      ? {}
      : { averageHeartRateBpm, maximumHeartRateBpm }),
  } as ActivityImportCommandEventV1
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

async function seedMembership(userId: string) {
  await database.doc(`betaMemberships/${userId}`).set({
    schemaVersion: 1,
    userId,
    status: 'approved',
    approvedAt: Timestamp.fromDate(new Date('2026-11-01T00:00:00.000Z')),
    approvedBy: 'activity-import-emulator',
  })
}

function store() {
  return new FirestoreActivityImportStore(database, {
    createRunId: () => `imported-run-${++runSequence}`,
    now: () => now,
  })
}

beforeAll(async () => {
  await clearFirestoreEmulator()
})

beforeEach(async () => {
  await clearFirestoreEmulator()
  runSequence = 0
  now = new Date('2026-11-04T18:00:00.000Z')
  await Promise.all([seedMembership(ownerId), seedMembership(otherOwnerId)])
})

afterAll(async () => {
  await deleteApp(app)
})

describe('Firestore activity-import persistence', () => {
  it('makes no run, provenance, or receipt write without approved membership', async () => {
    await database.doc(`betaMemberships/${ownerId}`).delete()
    const command = createActivityImportCommand(
      'import-membership-command-0001',
      garminEvent(),
    )

    await expect(
      store().commit({ envelope: command, ownerId }),
    ).resolves.toEqual({ kind: 'membership-required' })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ empty: true }))
    await expect(
      database.collection(`users/${ownerId}/activityImports`).get(),
    ).resolves.toEqual(expect.objectContaining({ empty: true }))
    await expect(
      database
        .doc(
          `materialCommandReceipts/${ownerId}/commands/${command.commandId}`,
        )
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
  })

  it('creates one visible run and returns stable identity across command and provider replay', async () => {
    const persistence = store()
    const firstCommand = createActivityImportCommand(
      'import-garmin-command-0001',
      garminEvent(),
    )
    const replayCommand = createActivityImportCommand(
      'import-garmin-command-0002',
      garminEvent({
        observedAt: createUtcDateTime('2026-11-04T17:20:00.000Z'),
      }),
    )

    const first = await persistence.commit({
      envelope: firstCommand,
      ownerId,
    })
    const sameCommand = await persistence.commit({
      envelope: firstCommand,
      ownerId,
    })
    const providerReplay = await persistence.commit({
      envelope: replayCommand,
      ownerId,
    })

    expect(first).toEqual({
      kind: 'applied',
      result: expect.objectContaining({
        status: 'activity_imported',
        commandId: firstCommand.commandId,
        canonicalCommandId: firstCommand.commandId,
        operation: 'created',
        completedRunId: 'imported-run-1',
      }),
    })
    expect(sameCommand).toEqual(first)
    expect(providerReplay).toEqual({
      kind: 'applied',
      result: expect.objectContaining({
        commandId: replayCommand.commandId,
        canonicalCommandId: firstCommand.commandId,
        operation: 'unchanged',
        completedRunId: 'imported-run-1',
      }),
    })
    const runs = await database.collection(`users/${ownerId}/runs`).get()
    expect(runs.docs).toHaveLength(1)
    expect(runs.docs[0]?.data()).toMatchObject({
      userId: ownerId,
      distanceMeters: 10_000,
      durationSeconds: 3_600,
      importProvider: 'garmin_connect',
      reportedOrigin: 'garmin',
      averageHeartRateBpm: 151,
      maximumHeartRateBpm: 176,
    })
  })

  it('backfills sanitized provenance when a legacy imported run is replayed', async () => {
    const persistence = store()
    const firstCommand = createActivityImportCommand(
      'import-backfill-command-0001',
      garminEvent(),
    )
    await persistence.commit({ envelope: firstCommand, ownerId })
    await database.doc(`users/${ownerId}/runs/imported-run-1`).update({
      importProvider: null,
      reportedOrigin: null,
    })
    const runReference = database.doc(
      `users/${ownerId}/runs/imported-run-1`,
    )
    const legacyRun = (await runReference.get()).data()
    if (legacyRun === undefined) throw new Error('Expected an imported run.')
    delete legacyRun.importProvider
    delete legacyRun.reportedOrigin
    await runReference.set(legacyRun)

    const replay = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-backfill-command-0002',
        garminEvent({
          observedAt: createUtcDateTime('2026-11-04T17:20:00.000Z'),
        }),
      ),
      ownerId,
    })

    expect(replay).toEqual({
      kind: 'applied',
      result: expect.objectContaining({
        status: 'activity_imported',
        operation: 'updated',
        completedRunId: 'imported-run-1',
      }),
    })
    await expect(runReference.get()).resolves.toEqual(
      expect.objectContaining({
        exists: true,
      }),
    )
    expect((await runReference.get()).data()).toMatchObject({
      importProvider: 'garmin_connect',
      reportedOrigin: 'garmin',
    })
  })

  it('enriches the same imported run with heart rate while preserving Marathoner-owned fields', async () => {
    const persistence = store()
    const first = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-update-command-0001',
        garminEvent({
          averageHeartRateBpm: undefined,
          maximumHeartRateBpm: undefined,
        }),
      ),
      ownerId,
    })
    if (first.kind !== 'applied' || first.result.completedRunId === null) {
      throw new Error('Expected an imported run.')
    }
    const runReference = database.doc(
      `users/${ownerId}/runs/${first.result.completedRunId}`,
    )
    await runReference.update({
      notes: 'Runner-owned note',
      unusualPain: false,
      plannedWorkoutPlanId: 'runner-selected-plan-0001',
      plannedWorkoutId: 'runner-selected-workout-0001',
      updatedAt: Timestamp.fromDate(new Date('2026-11-04T18:01:00.000Z')),
    })
    now = new Date('2026-11-04T18:10:00.000Z')

    const update = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-update-command-0002',
        garminEvent({
          observedAt: createUtcDateTime('2026-11-04T18:05:00.000Z'),
          providerUpdatedAt: createUtcDateTime('2026-11-04T18:04:00.000Z'),
          durationSeconds: createDurationSeconds(3_720),
          distanceMeters: createDistanceMeters(10_500),
          averageHeartRateBpm: createHeartRateBpm(154),
          maximumHeartRateBpm: createHeartRateBpm(181),
        }),
      ),
      ownerId,
    })

    expect(update).toEqual({
      kind: 'applied',
      result: expect.objectContaining({
        operation: 'updated',
        completedRunId: first.result.completedRunId,
      }),
    })
    await expect(runReference.get()).resolves.toEqual(
      expect.objectContaining({
        exists: true,
      }),
    )
    expect((await runReference.get()).data()).toMatchObject({
      distanceMeters: 10_500,
      durationSeconds: 3_720,
      notes: 'Runner-owned note',
      unusualPain: false,
      plannedWorkoutPlanId: 'runner-selected-plan-0001',
      plannedWorkoutId: 'runner-selected-workout-0001',
      averageHeartRateBpm: 154,
      maximumHeartRateBpm: 181,
    })
  })

  it('rejects stale provider changes without mutating the visible run', async () => {
    const persistence = store()
    const first = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-stale-command-0001',
        garminEvent(),
      ),
      ownerId,
    })
    if (first.kind !== 'applied' || first.result.completedRunId === null) {
      throw new Error('Expected an imported run.')
    }

    const stale = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-stale-command-0002',
        garminEvent({
          observedAt: createUtcDateTime('2026-11-04T16:30:00.000Z'),
          providerUpdatedAt: createUtcDateTime('2026-11-04T16:25:00.000Z'),
          distanceMeters: createDistanceMeters(12_000),
        }),
      ),
      ownerId,
    })

    expect(stale).toEqual({
      kind: 'stale',
      result: expect.objectContaining({
        status: 'stale_revision',
        code: 'provider-activity-version-changed',
      }),
    })
    expect(
      (
        await database
          .doc(`users/${ownerId}/runs/${first.result.completedRunId}`)
          .get()
      ).data()?.distanceMeters,
    ).toBe(10_000)

    const staleDeletion = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-stale-command-0003',
        {
          schemaVersion: 'completed-activity-import@1',
          operation: 'delete',
          provider: 'garmin_connect',
          providerActivityId: 'garmin-activity-001',
          observedAt: createUtcDateTime('2026-11-04T16:35:00.000Z'),
          providerUpdatedAt: createUtcDateTime('2026-11-04T16:30:00.000Z'),
        },
      ),
      ownerId,
    })
    expect(staleDeletion).toEqual({
      kind: 'stale',
      result: expect.objectContaining({
        code: 'provider-activity-version-changed',
      }),
    })
    await expect(
      database
        .doc(`users/${ownerId}/runs/${first.result.completedRunId}`)
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: true }))
  })

  it('resolves an ambiguous same-provider delivery to the original canonical command', async () => {
    const persistence = store()
    const original = createActivityImportCommand(
      'import-ambiguous-command-0001',
      garminEvent(),
    )
    await persistence.commit({ envelope: original, ownerId })
    const ambiguousCommand = createActivityImportCommand(
      'import-ambiguous-command-0002',
      garminEvent({ distanceMeters: createDistanceMeters(10_100) }),
    )

    const ambiguous = await persistence.commit({
      envelope: ambiguousCommand,
      ownerId,
    })
    const resolved = await new FirestoreMaterialCommandStore(database).resolve({
      commandId: ambiguousCommand.commandId,
      ownerId,
    })

    expect(ambiguous).toEqual({
      kind: 'review-required',
      result: expect.objectContaining({
        code: 'provider-update-ambiguous',
        commandId: ambiguousCommand.commandId,
        canonicalCommandId: original.commandId,
        candidateCompletedRunId: 'imported-run-1',
      }),
    })
    expect(resolved).toEqual(
      ambiguous.kind === 'review-required' ? ambiguous.result : null,
    )
    expect(
      (
        await database.doc(`users/${ownerId}/runs/imported-run-1`).get()
      ).data()?.distanceMeters,
    ).toBe(10_000)
  })

  it('holds a cross-provider duplicate for review without creating a second run', async () => {
    const persistence = store()
    const first = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-duplicate-command-0001',
        garminEvent(),
      ),
      ownerId,
    })
    if (first.kind !== 'applied') throw new Error('Expected an imported run.')

    const duplicate = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-duplicate-command-0002',
        {
          ...garminEvent(),
          provider: 'apple_health',
          providerActivityId: 'health-activity-001',
          providerUpdatedAt: null,
        },
      ),
      ownerId,
    })

    expect(duplicate).toEqual({
      kind: 'review-required',
      result: expect.objectContaining({
        status: 'activity_import_review_required',
        code: 'cross-provider-duplicate-candidate',
        candidateCompletedRunId: first.result.completedRunId,
      }),
    })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
  })

  it('holds a cross-provider timezone mismatch without creating a second run', async () => {
    const persistence = store()
    const first = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-timezone-duplicate-command-0001',
        garminEvent(),
      ),
      ownerId,
    })
    if (first.kind !== 'applied') throw new Error('Expected an imported run.')

    const duplicate = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-timezone-duplicate-command-0002',
        {
          ...garminEvent(),
          provider: 'apple_health',
          providerActivityId: 'health-timezone-activity-001',
          providerUpdatedAt: null,
          timeZone: createIanaTimeZone('Etc/GMT+8'),
        },
      ),
      ownerId,
    })

    expect(duplicate).toEqual({
      kind: 'review-required',
      result: expect.objectContaining({
        status: 'activity_import_review_required',
        code: 'cross-provider-duplicate-candidate',
        candidateCompletedRunId: first.result.completedRunId,
      }),
    })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
  })

  it('enriches the first Apple Health run and holds a second exact identity for review', async () => {
    const persistence = store()
    const first = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-apple-enrichment-command-0001',
        appleHealthGarminEvent('health-no-heart-rate-001', {
          withHeartRate: false,
        }),
      ),
      ownerId,
    })
    if (first.kind !== 'applied' || first.result.completedRunId === null) {
      throw new Error('Expected the first Apple Health run.')
    }
    await database
      .doc(`users/${ownerId}/runs/${first.result.completedRunId}`)
      .update({
        notes: 'Keep this runner note.',
        perceivedEffort: 'about_right',
        shoeId: 'shoe-001',
      })

    const secondCommand = createActivityImportCommand(
      'import-apple-enrichment-command-0002',
      appleHealthGarminEvent('health-with-heart-rate-002'),
    )
    const second = await persistence.commit({
      envelope: secondCommand,
      ownerId,
    })
    const replay = await persistence.commit({
      envelope: secondCommand,
      ownerId,
    })

    expect(second).toEqual({
      kind: 'review-required',
      result: expect.objectContaining({
        status: 'activity_import_review_required',
        code: 'same-provider-duplicate-candidate',
        candidateCompletedRunId: first.result.completedRunId,
      }),
    })
    expect(replay).toEqual(second)
    const runs = await database.collection(`users/${ownerId}/runs`).get()
    expect(runs.docs).toHaveLength(1)
    expect(runs.docs[0]?.data()).toMatchObject({
      averageHeartRateBpm: 151,
      maximumHeartRateBpm: 176,
      notes: 'Keep this runner note.',
      perceivedEffort: 'about_right',
      shoeId: 'shoe-001',
    })
    const imports = await database
      .collection(`users/${ownerId}/activityImports`)
      .get()
    expect(imports.docs.map((document) => document.data().state).sort()).toEqual([
      'active',
      'review_required',
    ])
  })

  it('keeps heart rate when the richer Apple Health identity arrives first', async () => {
    const persistence = store()
    const first = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-apple-reverse-command-0001',
        appleHealthGarminEvent('health-with-heart-rate-001'),
      ),
      ownerId,
    })
    if (first.kind !== 'applied') throw new Error('Expected an imported run.')

    const second = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-apple-reverse-command-0002',
        appleHealthGarminEvent('health-no-heart-rate-002', {
          withHeartRate: false,
        }),
      ),
      ownerId,
    })

    expect(second).toEqual({
      kind: 'review-required',
      result: expect.objectContaining({
        code: 'same-provider-duplicate-candidate',
        candidateCompletedRunId: first.result.completedRunId,
      }),
    })
    const runs = await database.collection(`users/${ownerId}/runs`).get()
    expect(runs.docs).toHaveLength(1)
    expect(runs.docs[0]?.data()).toMatchObject({
      averageHeartRateBpm: 151,
      maximumHeartRateBpm: 176,
    })
  })

  it('holds conflicting exact Apple Health identities without merging heart rate', async () => {
    const persistence = store()
    const first = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-apple-conflict-command-0001',
        appleHealthGarminEvent('health-conflict-001'),
      ),
      ownerId,
    })
    if (first.kind !== 'applied') throw new Error('Expected an imported run.')

    const conflicting = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-apple-conflict-command-0002',
        appleHealthGarminEvent('health-conflict-002', {
          changes: {
            averageHeartRateBpm: createHeartRateBpm(145),
            maximumHeartRateBpm: createHeartRateBpm(170),
          },
        }),
      ),
      ownerId,
    })
    const unrelated = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-apple-unrelated-command-0003',
        appleHealthGarminEvent('health-unrelated-003', {
          changes: { distanceMeters: createDistanceMeters(10_500) },
        }),
      ),
      ownerId,
    })

    expect(conflicting).toEqual({
      kind: 'review-required',
      result: expect.objectContaining({
        code: 'same-provider-duplicate-candidate',
        candidateCompletedRunId: first.result.completedRunId,
      }),
    })
    expect(unrelated).toEqual({
      kind: 'applied',
      result: expect.objectContaining({ operation: 'created' }),
    })
    const runs = await database.collection(`users/${ownerId}/runs`).get()
    expect(runs.docs).toHaveLength(2)
    expect(
      (
        await database
          .doc(`users/${ownerId}/runs/${first.result.completedRunId}`)
          .get()
      ).data(),
    ).toMatchObject({
      averageHeartRateBpm: 151,
      maximumHeartRateBpm: 176,
    })
  })

  it('recovers a legacy active import whose visible run is missing', async () => {
    const persistence = store()
    const first = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-orphan-recovery-command-0001',
        garminEvent(),
      ),
      ownerId,
    })
    if (first.kind !== 'applied' || first.result.completedRunId === null) {
      throw new Error('Expected an imported run.')
    }
    const runReference = database.doc(
      `users/${ownerId}/runs/${first.result.completedRunId}`,
    )
    await runReference.delete()
    now = new Date('2026-11-04T18:10:00.000Z')

    const replay = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-orphan-recovery-command-0002',
        garminEvent({
          observedAt: createUtcDateTime('2026-11-04T18:05:00.000Z'),
        }),
      ),
      ownerId,
    })

    expect(replay).toEqual({
      kind: 'applied',
      result: expect.objectContaining({
        operation: 'created',
        completedRunId: first.result.completedRunId,
      }),
    })
    await expect(runReference.get()).resolves.toEqual(
      expect.objectContaining({ exists: true }),
    )
    expect((await runReference.get()).data()).toMatchObject({
      importProvider: 'garmin_connect',
      distanceMeters: 10_000,
      durationSeconds: 3_600,
    })
  })

  it('keeps a user-deleted import and its duplicate candidate suppressed across replay', async () => {
    const persistence = store()
    const garminCommand = createActivityImportCommand(
      'import-user-delete-command-0001',
      garminEvent(),
    )
    const first = await persistence.commit({
      envelope: garminCommand,
      ownerId,
    })
    if (
      first.kind !== 'applied' ||
      first.result.completedRunId === null ||
      first.result.completedRunUpdatedAt === null
    ) {
      throw new Error('Expected an imported run.')
    }
    const appleEvent: ActivityImportCommandEventV1 = {
      ...garminEvent(),
      provider: 'apple_health',
      providerActivityId: createProviderActivityId(
        'health-user-delete-activity-001',
      ),
      providerUpdatedAt: null,
    }
    const appleCommand = createActivityImportCommand(
      'import-user-delete-command-0002',
      appleEvent,
    )
    await expect(
      persistence.commit({ envelope: appleCommand, ownerId }),
    ).resolves.toEqual({
      kind: 'review-required',
      result: expect.objectContaining({
        candidateCompletedRunId: first.result.completedRunId,
      }),
    })

    now = new Date('2026-11-04T18:05:00.000Z')
    const deletion = await new FirestoreRunDeletionStore(database, {
      now: () => now,
    }).commit({
      envelope: createRunDeletionCommand(
        'delete-imported-run-command-0001',
        {
          completedRunId: first.result.completedRunId,
          expectedCompletedRunUpdatedAt:
            first.result.completedRunUpdatedAt,
          plannedWorkout: null,
        },
      ),
      ownerId,
    })

    expect(deletion).toEqual({
      kind: 'deleted',
      result: expect.objectContaining({
        completedRunId: first.result.completedRunId,
      }),
    })
    await expect(
      database
        .doc(`users/${ownerId}/runs/${first.result.completedRunId}`)
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))
    const importsAfterDeletion = await database
      .collection(`users/${ownerId}/activityImports`)
      .get()
    expect(importsAfterDeletion.docs).toHaveLength(2)
    for (const document of importsAfterDeletion.docs) {
      expect(document.data()).toMatchObject({
        state: 'user_deleted',
        completedRunId: null,
        candidateCompletedRunId: null,
        candidateKind: null,
      })
    }

    now = new Date('2026-11-04T18:10:00.000Z')
    const garminReplay = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-user-delete-command-0003',
        garminEvent({
          observedAt: createUtcDateTime('2026-11-04T18:06:00.000Z'),
        }),
      ),
      ownerId,
    })
    const appleReplay = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-user-delete-command-0004',
        {
          ...appleEvent,
          observedAt: createUtcDateTime('2026-11-04T18:07:00.000Z'),
        },
      ),
      ownerId,
    })

    expect(garminReplay).toEqual({
      kind: 'applied',
      result: expect.objectContaining({
        operation: 'deleted',
        completedRunId: null,
      }),
    })
    expect(appleReplay).toEqual({
      kind: 'applied',
      result: expect.objectContaining({
        operation: 'deleted',
        completedRunId: null,
      }),
    })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ empty: true }))
  })

  it('deletes the exact imported run and keeps a tombstone that rejects an older resurrection', async () => {
    const persistence = store()
    const first = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-delete-command-0001',
        garminEvent(),
      ),
      ownerId,
    })
    if (first.kind !== 'applied' || first.result.completedRunId === null) {
      throw new Error('Expected an imported run.')
    }
    now = new Date('2026-11-04T18:10:00.000Z')
    const deleted = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-delete-command-0002',
        {
          schemaVersion: 'completed-activity-import@1',
          operation: 'delete',
          provider: 'garmin_connect',
          providerActivityId: 'garmin-activity-001',
          observedAt: createUtcDateTime('2026-11-04T18:05:00.000Z'),
          providerUpdatedAt: createUtcDateTime('2026-11-04T18:04:00.000Z'),
        },
      ),
      ownerId,
    })

    expect(deleted).toEqual({
      kind: 'applied',
      result: expect.objectContaining({
        operation: 'deleted',
        completedRunId: null,
      }),
    })
    await expect(
      database
        .doc(`users/${ownerId}/runs/${first.result.completedRunId}`)
        .get(),
    ).resolves.toEqual(expect.objectContaining({ exists: false }))

    const staleResurrection = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-delete-command-0003',
        garminEvent(),
      ),
      ownerId,
    })
    expect(staleResurrection).toEqual({
      kind: 'stale',
      result: expect.objectContaining({
        code: 'provider-activity-version-changed',
      }),
    })
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ empty: true }))
  })

  it('reopens only the exact guarded workout when an associated import is deleted', async () => {
    const persistence = store()
    const first = await persistence.commit({
      envelope: createActivityImportCommand(
        'import-associated-command-0001',
        garminEvent(),
      ),
      ownerId,
    })
    if (first.kind !== 'applied' || first.result.completedRunId === null) {
      throw new Error('Expected an imported run.')
    }
    const runId = first.result.completedRunId
    const planId = 'associated-plan-0001'
    const workoutId = 'associated-workout-0001'
    const workoutPath = `users/${ownerId}/plans/${planId}/workouts/${workoutId}`
    const guardPath = `${workoutPath}/completionState/current`
    await Promise.all([
      database.doc(`users/${ownerId}/runs/${runId}`).update({
        plannedWorkoutPlanId: planId,
        plannedWorkoutId: workoutId,
      }),
      database.doc(workoutPath).set({
        schemaVersion: 1,
        userId: ownerId,
        planId,
        scheduledDate: '2026-11-04',
        phase: 'base_building',
        status: 'completed',
        kind: 'run',
        purpose: 'easy',
        targetDistanceMeters: 10_000,
        createdAt: Timestamp.fromDate(new Date('2026-11-01T00:00:00.000Z')),
        updatedAt: Timestamp.fromDate(new Date('2026-11-04T18:01:00.000Z')),
      }),
      database.doc(guardPath).set({
        schemaVersion: 1,
        trainingSchemaVersion: 1,
        userId: ownerId,
        planId,
        plannedWorkoutId: workoutId,
        completedRunId: runId,
        commandId: 'associate-imported-run-0001',
        createdAt: Timestamp.fromDate(new Date('2026-11-04T18:01:00.000Z')),
      }),
    ])
    now = new Date('2026-11-04T18:10:00.000Z')

    await persistence.commit({
      envelope: createActivityImportCommand(
        'import-associated-command-0002',
        {
          schemaVersion: 'completed-activity-import@1',
          operation: 'delete',
          provider: 'garmin_connect',
          providerActivityId: 'garmin-activity-001',
          observedAt: createUtcDateTime('2026-11-04T18:05:00.000Z'),
          providerUpdatedAt: createUtcDateTime('2026-11-04T18:04:00.000Z'),
        },
      ),
      ownerId,
    })

    expect((await database.doc(workoutPath).get()).data()?.status).toBe('planned')
    await expect(database.doc(guardPath).get()).resolves.toEqual(
      expect.objectContaining({ exists: false }),
    )
  })

  it('scopes identical provider IDs independently to authenticated owners', async () => {
    const persistence = store()
    const command = createActivityImportCommand(
      'import-owner-scope-command-0001',
      garminEvent(),
    )

    const first = await persistence.commit({ envelope: command, ownerId })
    const second = await persistence.commit({
      envelope: command,
      ownerId: otherOwnerId,
    })

    expect(first.kind).toBe('applied')
    expect(second.kind).toBe('applied')
    await expect(
      database.collection(`users/${ownerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
    await expect(
      database.collection(`users/${otherOwnerId}/runs`).get(),
    ).resolves.toEqual(expect.objectContaining({ size: 1 }))
  })
})
