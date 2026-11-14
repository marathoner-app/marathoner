import { describe, expect, it, vi } from 'vitest'

import type { MaterialCommandResult } from '../domain/materialCommands/contract'
import { createUtcDateTime } from '../domain/training/dates'
import { createCompletedRunId } from '../domain/training/identifiers'
import {
  createHealthKitAccountScope,
  createHealthKitImportCoordinator,
  normalizeHealthKitWorkout,
  type NativeHealthKitBatch,
} from './healthKitImport'

const observedAt = '2026-11-04T16:00:00.000Z'

function accountScope(userId = 'owner-a', projectId = 'beta-project') {
  return createHealthKitAccountScope(projectId, userId)
}

function workout(overrides: Record<string, unknown> = {}) {
  return {
    providerActivityId: 'healthkit-workout-1001',
    startedAt: '2026-11-04T15:00:00.000Z',
    endedAt: '2026-11-04T15:45:00.000Z',
    durationSeconds: 2700,
    distanceMeters: 8000,
    timeZone: 'America/Los_Angeles',
    sourceName: 'Garmin Connect',
    sourceBundleIdentifier: 'com.garmin.connect.mobile',
    averageHeartRateBpm: 151,
    maximumHeartRateBpm: 176,
    observedAt,
    ...overrides,
  }
}

function batch(overrides: Partial<NativeHealthKitBatch> = {}): NativeHealthKitBatch {
  return {
    available: true,
    enabled: true,
    monitoring: true,
    observedAt,
    workouts: [workout()],
    deletedWorkoutIds: [],
    skippedWorkoutCount: 0,
    ...overrides,
  }
}

function receipt(
  operation: 'created' | 'updated' | 'unchanged' | 'deleted' = 'created',
): MaterialCommandResult {
  return {
    status: 'activity_imported',
    commandId: 'healthkit-command-0001',
    canonicalCommandId: 'healthkit-command-0001',
    operation,
    completedRunId:
      operation === 'deleted' ? null : createCompletedRunId('completed-run-0001'),
    completedRunUpdatedAt:
      operation === 'deleted'
        ? null
        : createUtcDateTime('2026-11-04T16:00:01.000Z'),
    processedAt: createUtcDateTime('2026-11-04T16:00:01.000Z'),
  }
}

function plugin(overrides: Record<string, unknown> = {}) {
  return {
    getStatus: vi.fn().mockResolvedValue({
      available: true,
      enabled: true,
      monitoring: false,
      authorizationRequestStatus: 'unnecessary',
    }),
    requestAuthorization: vi.fn().mockResolvedValue(batch()),
    synchronize: vi.fn().mockResolvedValue(batch()),
    startMonitoring: vi.fn().mockResolvedValue({
      available: true,
      enabled: true,
      monitoring: true,
    }),
    disconnect: vi.fn().mockResolvedValue({
      available: true,
      enabled: false,
      monitoring: false,
    }),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    ...overrides,
  }
}

describe('HealthKit workout normalization', () => {
  it('preserves opaque identity and reports Garmin-origin HealthKit workouts', () => {
    expect(normalizeHealthKitWorkout(workout())).toEqual(
      expect.objectContaining({
        operation: 'upsert',
        provider: 'apple_health',
        providerActivityId: 'healthkit-workout-1001',
        distanceMeters: 8000,
        durationSeconds: 2700,
        averageHeartRateBpm: 151,
        maximumHeartRateBpm: 176,
        reportedOrigin: 'garmin',
      }),
    )
  })

  it('rejects partial workouts that cannot become trustworthy completed runs', () => {
    expect(normalizeHealthKitWorkout(workout({ distanceMeters: 0 }))).toBeNull()
    expect(normalizeHealthKitWorkout(workout({ durationSeconds: null }))).toBeNull()
    expect(
      normalizeHealthKitWorkout(workout({ averageHeartRateBpm: 301 })),
    ).toBeNull()
    expect(
      normalizeHealthKitWorkout(
        workout({ averageHeartRateBpm: 180, maximumHeartRateBpm: 170 }),
      ),
    ).toBeNull()
    expect(
      normalizeHealthKitWorkout(
        workout({ endedAt: '2026-11-04T14:00:00.000Z' }),
      ),
    ).toBeNull()
  })

  it('falls back to the device time zone when provider metadata is invalid', () => {
    expect(
      normalizeHealthKitWorkout(workout({ timeZone: 'not/a-time-zone' })),
    ).toEqual(
      expect.objectContaining({
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    )
  })
})

describe('HealthKit import coordinator', () => {
  it('isolates the native account key by Firebase project and user', () => {
    expect(accountScope()).toEqual({
      current: 'firebase-project:beta-project:user:owner-a',
      legacy: 'owner-a',
    })
    expect(accountScope('owner-a', 'development-project').current).not.toBe(
      accountScope('owner-a', 'beta-project').current,
    )
  })

  it('does not invoke the native bridge in a browser', async () => {
    const nativePlugin = plugin()
    const coordinator = createHealthKitImportCoordinator({
      plugin: nativePlugin,
      isNativeIos: () => false,
      submit: vi.fn(),
    })

    await expect(coordinator.getState(accountScope())).resolves.toEqual({
      availability: 'web',
      monitoring: false,
      authorizationRequestStatus: 'unavailable',
    })
    expect(nativePlugin.getStatus).not.toHaveBeenCalled()
  })

  it('requests permission before importing the bounded historical batch', async () => {
    const nativePlugin = plugin()
    const submit = vi.fn().mockResolvedValue(receipt())
    const coordinator = createHealthKitImportCoordinator({
      plugin: nativePlugin,
      isNativeIos: () => true,
      submit,
    })

    await expect(coordinator.connect(accountScope())).resolves.toEqual({
      created: 1,
      updated: 0,
      unchanged: 0,
      deleted: 0,
      reviewRequired: 0,
      failed: 0,
      skipped: 0,
    })
    expect(nativePlugin.requestAuthorization).toHaveBeenCalledWith({
      accountScope: 'firebase-project:beta-project:user:owner-a',
      legacyAccountScope: 'owner-a',
      lookbackDays: 30,
    })
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'apple_health',
        providerActivityId: 'healthkit-workout-1001',
      }),
    )
    expect(nativePlugin.startMonitoring).toHaveBeenCalledOnce()
  })

  it('submits tracked HealthKit deletions through the same import boundary', async () => {
    const nativePlugin = plugin({
      synchronize: vi.fn().mockResolvedValue(
        batch({ workouts: [], deletedWorkoutIds: ['healthkit-workout-1001'] }),
      ),
    })
    const submit = vi.fn().mockResolvedValue(receipt('deleted'))
    const coordinator = createHealthKitImportCoordinator({
      plugin: nativePlugin,
      isNativeIos: () => true,
      submit,
    })

    await expect(coordinator.synchronize(accountScope())).resolves.toEqual(
      expect.objectContaining({ deleted: 1, failed: 0 }),
    )
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'delete',
        providerActivityId: 'healthkit-workout-1001',
      }),
    )
  })

  it('keeps ambiguous cross-provider candidates out of the confirmed count', async () => {
    const coordinator = createHealthKitImportCoordinator({
      plugin: plugin(),
      isNativeIos: () => true,
      submit: vi.fn().mockResolvedValue({
        status: 'activity_import_review_required',
        commandId: 'healthkit-command-0001',
        code: 'cross-provider-duplicate-candidate',
        message: 'Review this possible duplicate.',
        canonicalCommandId: 'healthkit-command-0001',
        candidateCompletedRunId: 'completed-run-0001',
        recordedAt: '2026-11-04T16:00:01.000Z',
      }),
    })

    await expect(coordinator.synchronize(accountScope())).resolves.toEqual(
      expect.objectContaining({ created: 0, reviewRequired: 1 }),
    )
  })

  it('isolates native anchors and listeners by signed-in account scope', async () => {
    const nativePlugin = plugin()
    const remove = vi.fn()
    nativePlugin.addListener
      .mockResolvedValueOnce({ remove })
      .mockResolvedValueOnce({ remove: vi.fn() })
    const coordinator = createHealthKitImportCoordinator({
      plugin: nativePlugin,
      isNativeIos: () => true,
      submit: vi.fn().mockResolvedValue(receipt()),
    })

    await coordinator.resume(accountScope('owner-a'))
    await coordinator.resume(accountScope('owner-b'))

    expect(remove).toHaveBeenCalledOnce()
    expect(nativePlugin.startMonitoring).toHaveBeenNthCalledWith(1, {
      accountScope: 'firebase-project:beta-project:user:owner-a',
      legacyAccountScope: 'owner-a',
      lookbackDays: 30,
    })
    expect(nativePlugin.startMonitoring).toHaveBeenNthCalledWith(2, {
      accountScope: 'firebase-project:beta-project:user:owner-b',
      legacyAccountScope: 'owner-b',
      lookbackDays: 30,
    })
  })
})
