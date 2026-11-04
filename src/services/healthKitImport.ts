import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core'

import {
  COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION,
  createProviderActivityId,
  type ReportedActivityOrigin,
} from '../domain/activityImport/contract'
import {
  createActivityImportCommand,
  type ActivityImportCommandEventV1,
  type MaterialCommandResult,
} from '../domain/materialCommands/contract'
import {
  createIanaTimeZone,
  createUtcDateTime,
} from '../domain/training/dates'
import {
  createDistanceMeters,
  createDurationSeconds,
} from '../domain/training/units'
import { materialCommandClient } from './firebaseMaterialCommandClient'

const DEFAULT_LOOKBACK_DAYS = 30

export interface NativeHealthKitStatus {
  available: boolean
  enabled: boolean
  monitoring: boolean
  authorizationRequestStatus?:
    | 'should_request'
    | 'unnecessary'
    | 'unknown'
    | 'unavailable'
}

export interface NativeHealthKitWorkout {
  providerActivityId: string
  startedAt: string
  endedAt: string
  durationSeconds: number
  distanceMeters: number
  timeZone: string
  sourceName: string
  sourceBundleIdentifier: string
  observedAt: string
}

export interface NativeHealthKitBatch extends NativeHealthKitStatus {
  observedAt: string
  workouts: NativeHealthKitWorkout[]
  deletedWorkoutIds: string[]
  skippedWorkoutCount: number
}

interface NativeHealthKitChangeError {
  error: string
  code: string
}

type NativeHealthKitChange = NativeHealthKitBatch | NativeHealthKitChangeError

interface NativeHealthKitPlugin {
  getStatus(options: { accountScope: string }): Promise<NativeHealthKitStatus>
  requestAuthorization(options: {
    accountScope: string
    lookbackDays: number
  }): Promise<NativeHealthKitBatch>
  synchronize(options: {
    accountScope: string
    lookbackDays: number
  }): Promise<NativeHealthKitBatch>
  startMonitoring(options: {
    accountScope: string
    lookbackDays: number
  }): Promise<NativeHealthKitStatus>
  disconnect(options: { accountScope: string }): Promise<NativeHealthKitStatus>
  addListener(
    eventName: 'workoutsChanged',
    listener: (change: NativeHealthKitChange) => void,
  ): Promise<PluginListenerHandle>
}

export type HealthKitAvailability =
  | 'web'
  | 'unavailable'
  | 'disconnected'
  | 'enabled'

export interface HealthKitConnectionState {
  availability: HealthKitAvailability
  monitoring: boolean
  authorizationRequestStatus: NativeHealthKitStatus['authorizationRequestStatus']
}

export interface HealthKitImportSummary {
  created: number
  updated: number
  unchanged: number
  deleted: number
  reviewRequired: number
  failed: number
  skipped: number
}

interface HealthKitImportDependencies {
  plugin: NativeHealthKitPlugin
  isNativeIos: () => boolean
  submit: (event: ActivityImportCommandEventV1) => Promise<MaterialCommandResult>
}

const MarathonerHealthKit = registerPlugin<NativeHealthKitPlugin>(
  'MarathonerHealthKit',
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNativeHealthKitWorkout(value: unknown): value is NativeHealthKitWorkout {
  return (
    isRecord(value) &&
    typeof value.providerActivityId === 'string' &&
    typeof value.startedAt === 'string' &&
    typeof value.endedAt === 'string' &&
    typeof value.durationSeconds === 'number' &&
    typeof value.distanceMeters === 'number' &&
    typeof value.timeZone === 'string' &&
    typeof value.sourceName === 'string' &&
    typeof value.sourceBundleIdentifier === 'string' &&
    typeof value.observedAt === 'string'
  )
}

function reportedOriginFor(workout: NativeHealthKitWorkout): ReportedActivityOrigin {
  const source = `${workout.sourceName} ${workout.sourceBundleIdentifier}`.toLowerCase()
  if (source.includes('garmin')) return 'garmin'
  if (source.includes('apple') || source.includes('com.apple')) return 'apple'
  return source.trim().length > 0 ? 'other' : 'unknown'
}

function normalizedTimeZone(value: string) {
  try {
    return createIanaTimeZone(value)
  } catch {
    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return createIanaTimeZone(localTimeZone)
  }
}

export function normalizeHealthKitWorkout(
  value: unknown,
): ActivityImportCommandEventV1 | null {
  if (!isNativeHealthKitWorkout(value)) return null
  if (
    value.providerActivityId.trim().length === 0 ||
    !Number.isFinite(value.durationSeconds) ||
    !Number.isSafeInteger(value.durationSeconds) ||
    value.durationSeconds <= 0 ||
    !Number.isFinite(value.distanceMeters) ||
    !Number.isSafeInteger(value.distanceMeters) ||
    value.distanceMeters <= 0
  ) {
    return null
  }

  try {
    const startedAt = createUtcDateTime(value.startedAt)
    const endedAt = createUtcDateTime(value.endedAt)
    if (Date.parse(endedAt) < Date.parse(startedAt)) return null

    return {
      schemaVersion: COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION,
      operation: 'upsert',
      provider: 'apple_health',
      providerActivityId: createProviderActivityId(value.providerActivityId),
      observedAt: createUtcDateTime(value.observedAt),
      providerUpdatedAt: null,
      activityType: 'running',
      startedAt,
      endedAt,
      durationSeconds: createDurationSeconds(value.durationSeconds),
      timeZone: normalizedTimeZone(value.timeZone),
      distanceMeters: createDistanceMeters(value.distanceMeters),
      reportedOrigin: reportedOriginFor(value),
    }
  } catch {
    return null
  }
}

function normalizeHealthKitDeletion(
  providerActivityId: unknown,
  observedAt: unknown,
): ActivityImportCommandEventV1 | null {
  if (
    typeof providerActivityId !== 'string' ||
    providerActivityId.trim().length === 0 ||
    typeof observedAt !== 'string'
  ) {
    return null
  }

  try {
    return {
      schemaVersion: COMPLETED_ACTIVITY_IMPORT_SCHEMA_VERSION,
      operation: 'delete',
      provider: 'apple_health',
      providerActivityId: createProviderActivityId(providerActivityId),
      observedAt: createUtcDateTime(observedAt),
      providerUpdatedAt: null,
    }
  } catch {
    return null
  }
}

function emptySummary(skipped = 0): HealthKitImportSummary {
  return {
    created: 0,
    updated: 0,
    unchanged: 0,
    deleted: 0,
    reviewRequired: 0,
    failed: 0,
    skipped,
  }
}

function connectionState(status: NativeHealthKitStatus): HealthKitConnectionState {
  if (!status.available) {
    return {
      availability: 'unavailable',
      monitoring: false,
      authorizationRequestStatus: status.authorizationRequestStatus,
    }
  }
  return {
    availability: status.enabled ? 'enabled' : 'disconnected',
    monitoring: status.monitoring,
    authorizationRequestStatus: status.authorizationRequestStatus,
  }
}

function humanMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return 'Marathoner could not read Apple Health workouts right now.'
}

export class HealthKitImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HealthKitImportError'
  }
}

export function createHealthKitImportCoordinator(
  dependencies: HealthKitImportDependencies,
) {
  let listenerHandle: PluginListenerHandle | null = null
  let monitoredScope: string | null = null
  let changeListener: ((summary: HealthKitImportSummary) => void) | null = null

  const importBatch = async (
    batch: NativeHealthKitBatch,
  ): Promise<HealthKitImportSummary> => {
    const events: ActivityImportCommandEventV1[] = []
    let skipped = Number.isSafeInteger(batch.skippedWorkoutCount)
      ? Math.max(0, batch.skippedWorkoutCount)
      : 0

    for (const workout of Array.isArray(batch.workouts) ? batch.workouts : []) {
      const event = normalizeHealthKitWorkout(workout)
      if (event) events.push(event)
      else skipped += 1
    }
    for (const providerActivityId of Array.isArray(batch.deletedWorkoutIds)
      ? batch.deletedWorkoutIds
      : []) {
      const event = normalizeHealthKitDeletion(
        providerActivityId,
        batch.observedAt,
      )
      if (event) events.push(event)
      else skipped += 1
    }

    const summary = emptySummary(skipped)
    for (const event of events) {
      try {
        const result = await dependencies.submit(event)
        if (result.status === 'activity_imported') {
          summary[result.operation] += 1
        } else if (result.status === 'activity_import_review_required') {
          summary.reviewRequired += 1
        } else if (
          result.status === 'stale_revision' &&
          result.code === 'provider-activity-version-changed'
        ) {
          summary.unchanged += 1
        } else {
          summary.failed += 1
        }
      } catch {
        summary.failed += 1
      }
    }
    return summary
  }

  const stopMonitoring = async (accountScope?: string) => {
    if (accountScope && monitoredScope !== accountScope) return
    const handle = listenerHandle
    listenerHandle = null
    monitoredScope = null
    changeListener = null
    await handle?.remove()
  }

  const ensureMonitoring = async (
    accountScope: string,
    onChange?: (summary: HealthKitImportSummary) => void,
  ) => {
    if (monitoredScope === accountScope && listenerHandle !== null) {
      changeListener = onChange ?? changeListener
      return
    }
    await stopMonitoring()
    changeListener = onChange ?? null
    listenerHandle = await dependencies.plugin.addListener(
      'workoutsChanged',
      (change) => {
        if ('error' in change) return
        void importBatch(change).then((summary) => changeListener?.(summary))
      },
    )
    monitoredScope = accountScope
    await dependencies.plugin.startMonitoring({
      accountScope,
      lookbackDays: DEFAULT_LOOKBACK_DAYS,
    })
  }

  return {
    async getState(accountScope: string): Promise<HealthKitConnectionState> {
      if (!dependencies.isNativeIos()) {
        return {
          availability: 'web',
          monitoring: false,
          authorizationRequestStatus: 'unavailable',
        }
      }
      return connectionState(
        await dependencies.plugin.getStatus({ accountScope }),
      )
    },

    async connect(accountScope: string): Promise<HealthKitImportSummary> {
      if (!dependencies.isNativeIos()) {
        throw new HealthKitImportError(
          'Apple Health connection is available in Marathoner on iPhone.',
        )
      }
      const batch = await dependencies.plugin.requestAuthorization({
        accountScope,
        lookbackDays: DEFAULT_LOOKBACK_DAYS,
      })
      const summary = await importBatch(batch)
      await ensureMonitoring(accountScope)
      return summary
    },

    async synchronize(accountScope: string): Promise<HealthKitImportSummary> {
      if (!dependencies.isNativeIos()) {
        throw new HealthKitImportError(
          'Apple Health synchronization is available in Marathoner on iPhone.',
        )
      }
      try {
        return await importBatch(
          await dependencies.plugin.synchronize({
            accountScope,
            lookbackDays: DEFAULT_LOOKBACK_DAYS,
          }),
        )
      } catch (error) {
        throw new HealthKitImportError(humanMessage(error))
      }
    },

    async resume(
      accountScope: string,
      onChange?: (summary: HealthKitImportSummary) => void,
    ): Promise<HealthKitImportSummary | null> {
      if (!dependencies.isNativeIos()) return null
      const status = await dependencies.plugin.getStatus({ accountScope })
      if (!status.available || !status.enabled) return null
      await ensureMonitoring(accountScope, onChange)
      return importBatch(
        await dependencies.plugin.synchronize({
          accountScope,
          lookbackDays: DEFAULT_LOOKBACK_DAYS,
        }),
      )
    },

    async disconnect(accountScope: string): Promise<void> {
      await stopMonitoring(accountScope)
      if (dependencies.isNativeIos()) {
        await dependencies.plugin.disconnect({ accountScope })
      }
    },

    stopMonitoring,
  }
}

const coordinator = createHealthKitImportCoordinator({
  plugin: MarathonerHealthKit,
  isNativeIos: () =>
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios',
  async submit(event) {
    const commandId = `healthkit-${globalThis.crypto.randomUUID()}`
    let result = await materialCommandClient.submit(
      createActivityImportCommand(commandId, event),
    )
    if (result.status === 'outcome_unknown') {
      result = await materialCommandClient.resolve(commandId)
    }
    return result
  },
})

export const getHealthKitConnectionState = coordinator.getState
export const connectHealthKit = coordinator.connect
export const synchronizeHealthKit = coordinator.synchronize
export const resumeHealthKitImportMonitoring = coordinator.resume
export const disconnectHealthKit = coordinator.disconnect
export const stopHealthKitImportMonitoring = coordinator.stopMonitoring
