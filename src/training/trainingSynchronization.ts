import type {
  CompletedRun,
  PlannedWorkout,
  Shoe,
  TrainingPlan,
  UserId,
  UserProfile,
  UtcDateTime,
} from '../domain/training'

export const trainingSnapshotSources = [
  'profile',
  'plans',
  'workouts',
  'runs',
  'shoes',
] as const

export type TrainingSnapshotSource = (typeof trainingSnapshotSources)[number]
export type TrainingSnapshotOrigin = 'cache' | 'server'

export interface SynchronizedTrainingSnapshot {
  readonly ownerId: UserId
  readonly profile: UserProfile | null
  readonly plans: readonly TrainingPlan[]
  readonly workouts: readonly PlannedWorkout[]
  readonly runs: readonly CompletedRun[]
  readonly shoes: readonly Shoe[]
}

export interface TrainingSnapshotFreshness {
  readonly connected: boolean
  readonly hasCacheOnlySources: boolean
  readonly hasPendingWrites: boolean
  readonly lastServerConfirmedAt: UtcDateTime | null
}

interface SessionBoundState {
  readonly ownerId: UserId
  readonly sessionGeneration: number
}

interface SnapshotState extends SessionBoundState {
  readonly snapshot: SynchronizedTrainingSnapshot
  readonly freshness: TrainingSnapshotFreshness
}

export interface TrainingSynchronizationLoadingState
  extends SessionBoundState {
  readonly status: 'loading'
}

export interface TrainingSynchronizationCurrentState extends SnapshotState {
  readonly status: 'current'
  readonly serverConfirmedAt: UtcDateTime
}

export type TrainingSynchronizationStaleReason =
  | 'cache_only'
  | 'disconnected'
  | 'feature_incomplete'
  | 'pending_writes'
  | 'reconnecting'

export interface TrainingSynchronizationStaleState extends SnapshotState {
  readonly status: 'stale'
  readonly reasons: readonly TrainingSynchronizationStaleReason[]
}

export interface TrainingSynchronizationSavingState extends SnapshotState {
  readonly status: 'saving'
  readonly commandId: string
}

export interface TrainingSynchronizationConflictState extends SnapshotState {
  readonly status: 'conflict'
  readonly commandId: string
  readonly message: string
}

export interface TrainingSynchronizationErrorState extends SessionBoundState {
  readonly status: 'error'
  readonly snapshot: SynchronizedTrainingSnapshot | null
  readonly freshness: TrainingSnapshotFreshness
  readonly message: string
  readonly recoverable: boolean
}

export type TrainingSynchronizationState =
  | TrainingSynchronizationLoadingState
  | TrainingSynchronizationCurrentState
  | TrainingSynchronizationStaleState
  | TrainingSynchronizationSavingState
  | TrainingSynchronizationConflictState
  | TrainingSynchronizationErrorState

export interface TrainingFeatureCompletenessContext {
  readonly ownerId: UserId
  readonly sessionGeneration: number
  readonly activeCommandId: string | null
}

export type TrainingFeatureCompletenessPredicate = (
  snapshot: SynchronizedTrainingSnapshot,
  context: TrainingFeatureCompletenessContext,
) => boolean

interface TrainingSourceSlot<Value> {
  readonly received: boolean
  readonly value: Value
  readonly origin: TrainingSnapshotOrigin
  readonly hasPendingWrites: boolean
  readonly confirmedInConnection: boolean
  readonly observedAt: UtcDateTime | null
}

interface TrainingSourceSlots {
  readonly profile: TrainingSourceSlot<UserProfile | null>
  readonly plans: TrainingSourceSlot<readonly TrainingPlan[]>
  readonly workouts: TrainingSourceSlot<readonly PlannedWorkout[]>
  readonly runs: TrainingSourceSlot<readonly CompletedRun[]>
  readonly shoes: TrainingSourceSlot<readonly Shoe[]>
}

type TrainingSynchronizationActivity =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving'; readonly commandId: string }
  | {
      readonly kind: 'conflict'
      readonly commandId: string
      readonly message: string
    }
  | {
      readonly kind: 'error'
      readonly message: string
      readonly recoverable: boolean
    }

export interface TrainingSynchronizationKernel {
  readonly ownerId: UserId
  readonly sessionGeneration: number
  readonly state: TrainingSynchronizationState
  readonly isFeatureComplete: TrainingFeatureCompletenessPredicate
  readonly connected: boolean
  readonly sources: TrainingSourceSlots
  readonly lastCompleteSnapshot: SynchronizedTrainingSnapshot | null
  readonly lastServerConfirmedAt: UtcDateTime | null
  readonly activity: TrainingSynchronizationActivity
}

interface SessionEvent {
  readonly ownerId: UserId
  readonly sessionGeneration: number
}

interface SourceSnapshotEventBase extends SessionEvent {
  readonly type: 'source_snapshot'
  readonly origin: TrainingSnapshotOrigin
  readonly hasPendingWrites: boolean
  readonly observedAt: UtcDateTime
}

export type TrainingSourceSnapshotEvent =
  | (SourceSnapshotEventBase & {
      readonly source: 'profile'
      readonly value: UserProfile | null
    })
  | (SourceSnapshotEventBase & {
      readonly source: 'plans'
      readonly value: readonly TrainingPlan[]
    })
  | (SourceSnapshotEventBase & {
      readonly source: 'workouts'
      readonly value: readonly PlannedWorkout[]
    })
  | (SourceSnapshotEventBase & {
      readonly source: 'runs'
      readonly value: readonly CompletedRun[]
    })
  | (SourceSnapshotEventBase & {
      readonly source: 'shoes'
      readonly value: readonly Shoe[]
    })

export type TrainingSynchronizationEvent =
  | TrainingSourceSnapshotEvent
  | (SessionEvent & {
      readonly type: 'connection_changed'
      readonly connected: boolean
    })
  | (SessionEvent & {
      readonly type: 'source_error'
      readonly source: TrainingSnapshotSource
      readonly message: string
      readonly recoverable: boolean
    })
  | (SessionEvent & { readonly type: 'retry' })
  | (SessionEvent & {
      readonly type: 'saving_started'
      readonly commandId: string
    })
  | (SessionEvent & { readonly type: 'saving_cancelled' })
  | (SessionEvent & {
      readonly type: 'conflict'
      readonly commandId: string
      readonly message: string
    })

export interface CreateTrainingSynchronizationKernelOptions {
  readonly ownerId: UserId
  readonly sessionGeneration: number
  readonly isFeatureComplete?: TrainingFeatureCompletenessPredicate
}

function emptySlot<Value>(value: Value): TrainingSourceSlot<Value> {
  return {
    received: false,
    value,
    origin: 'cache',
    hasPendingWrites: false,
    confirmedInConnection: false,
    observedAt: null,
  }
}

function emptySources(): TrainingSourceSlots {
  return {
    profile: emptySlot<UserProfile | null>(null),
    plans: emptySlot<readonly TrainingPlan[]>([]),
    workouts: emptySlot<readonly PlannedWorkout[]>([]),
    runs: emptySlot<readonly CompletedRun[]>([]),
    shoes: emptySlot<readonly Shoe[]>([]),
  }
}

function loadingState(
  ownerId: UserId,
  sessionGeneration: number,
): TrainingSynchronizationLoadingState {
  return { status: 'loading', ownerId, sessionGeneration }
}

export function createTrainingSynchronizationKernel({
  ownerId,
  sessionGeneration,
  isFeatureComplete = (_snapshot, context) => context.activeCommandId === null,
}: CreateTrainingSynchronizationKernelOptions): TrainingSynchronizationKernel {
  if (!Number.isSafeInteger(sessionGeneration) || sessionGeneration < 0) {
    throw new Error(
      'The synchronization session generation must be a non-negative integer.',
    )
  }

  return {
    ownerId,
    sessionGeneration,
    state: loadingState(ownerId, sessionGeneration),
    isFeatureComplete,
    connected: true,
    sources: emptySources(),
    lastCompleteSnapshot: null,
    lastServerConfirmedAt: null,
    activity: { kind: 'idle' },
  }
}

function isCurrentSession(
  kernel: TrainingSynchronizationKernel,
  event: SessionEvent,
): boolean {
  return (
    event.ownerId === kernel.ownerId &&
    event.sessionGeneration === kernel.sessionGeneration
  )
}

function sourceSlots(sources: TrainingSourceSlots) {
  return trainingSnapshotSources.map((source) => sources[source])
}

function completeCandidate(
  ownerId: UserId,
  sources: TrainingSourceSlots,
): SynchronizedTrainingSnapshot | null {
  if (sourceSlots(sources).some((source) => !source.received)) return null

  return {
    ownerId,
    profile: sources.profile.value,
    plans: sources.plans.value,
    workouts: sources.workouts.value,
    runs: sources.runs.value,
    shoes: sources.shoes.value,
  }
}

function latestObservedAt(sources: TrainingSourceSlots): UtcDateTime {
  const observedTimes = sourceSlots(sources)
    .map((source) => source.observedAt)
    .filter((value): value is UtcDateTime => value !== null)
    .sort()
  const latest = observedTimes.at(-1)

  if (latest === undefined) {
    throw new Error(
      'A complete synchronization snapshot requires observation times.',
    )
  }
  return latest
}

function freshnessFor(
  kernel: TrainingSynchronizationKernel,
): TrainingSnapshotFreshness {
  const sources = sourceSlots(kernel.sources)
  return {
    connected: kernel.connected,
    hasCacheOnlySources: sources.some(
      (source) => source.received && source.origin === 'cache',
    ),
    hasPendingWrites: sources.some((source) => source.hasPendingWrites),
    lastServerConfirmedAt: kernel.lastServerConfirmedAt,
  }
}

function staleReasons(
  kernel: TrainingSynchronizationKernel,
  featureComplete: boolean,
): TrainingSynchronizationStaleReason[] {
  const sources = sourceSlots(kernel.sources)
  const reasons = new Set<TrainingSynchronizationStaleReason>()

  if (!kernel.connected) reasons.add('disconnected')
  if (sources.some((source) => source.hasPendingWrites)) {
    reasons.add('pending_writes')
  }
  if (sources.some((source) => source.received && source.origin === 'cache')) {
    reasons.add('cache_only')
  }
  if (
    kernel.connected &&
    sources.some(
      (source) =>
        source.received &&
        source.origin === 'server' &&
        !source.hasPendingWrites &&
        !source.confirmedInConnection,
    )
  ) {
    reasons.add('reconnecting')
  }
  if (!featureComplete) reasons.add('feature_incomplete')

  return [...reasons]
}

function withDerivedState(
  kernel: TrainingSynchronizationKernel,
): TrainingSynchronizationKernel {
  const candidate = completeCandidate(kernel.ownerId, kernel.sources)
  const hasPendingWrites = sourceSlots(kernel.sources).some(
    (source) => source.hasPendingWrites,
  )
  const activeCommandId =
    kernel.activity.kind === 'saving' ? kernel.activity.commandId : null
  const featureComplete =
    candidate !== null &&
    kernel.isFeatureComplete(candidate, {
      ownerId: kernel.ownerId,
      sessionGeneration: kernel.sessionGeneration,
      activeCommandId,
    })
  const safeCandidate =
    candidate !== null && !hasPendingWrites && featureComplete
      ? candidate
      : null
  const allSourcesServerConfirmed = sourceSlots(kernel.sources).every(
    (source) => source.received && source.confirmedInConnection,
  )
  const serverCurrent =
    kernel.connected && safeCandidate !== null && allSourcesServerConfirmed
  const lastCompleteSnapshot = safeCandidate ?? kernel.lastCompleteSnapshot
  const lastServerConfirmedAt = serverCurrent
    ? latestObservedAt(kernel.sources)
    : kernel.lastServerConfirmedAt
  const settledActivity =
    kernel.activity.kind === 'saving' && serverCurrent
      ? ({ kind: 'idle' } as const)
      : kernel.activity
  const settledKernel = {
    ...kernel,
    activity: settledActivity,
    lastCompleteSnapshot,
    lastServerConfirmedAt,
  }
  const freshness = freshnessFor(settledKernel)
  const session = {
    ownerId: kernel.ownerId,
    sessionGeneration: kernel.sessionGeneration,
  }

  let state: TrainingSynchronizationState
  if (settledActivity.kind === 'error') {
    state = {
      ...session,
      status: 'error',
      snapshot: lastCompleteSnapshot,
      freshness,
      message: settledActivity.message,
      recoverable: settledActivity.recoverable,
    }
  } else if (lastCompleteSnapshot === null) {
    state = loadingState(kernel.ownerId, kernel.sessionGeneration)
  } else if (settledActivity.kind === 'saving') {
    state = {
      ...session,
      status: 'saving',
      snapshot: lastCompleteSnapshot,
      freshness,
      commandId: settledActivity.commandId,
    }
  } else if (settledActivity.kind === 'conflict') {
    state = {
      ...session,
      status: 'conflict',
      snapshot: lastCompleteSnapshot,
      freshness,
      commandId: settledActivity.commandId,
      message: settledActivity.message,
    }
  } else if (serverCurrent) {
    state = {
      ...session,
      status: 'current',
      snapshot: lastCompleteSnapshot,
      freshness,
      serverConfirmedAt: lastServerConfirmedAt as UtcDateTime,
    }
  } else {
    state = {
      ...session,
      status: 'stale',
      snapshot: lastCompleteSnapshot,
      freshness,
      reasons: staleReasons(settledKernel, featureComplete),
    }
  }

  return { ...settledKernel, state }
}

function sourceSnapshot(
  kernel: TrainingSynchronizationKernel,
  event: TrainingSourceSnapshotEvent,
): TrainingSourceSlots {
  const slot = <Value>(value: Value): TrainingSourceSlot<Value> => ({
    received: true,
    value,
    origin: event.origin,
    hasPendingWrites: event.hasPendingWrites,
    confirmedInConnection:
      kernel.connected && event.origin === 'server' && !event.hasPendingWrites,
    observedAt: event.observedAt,
  })

  switch (event.source) {
    case 'profile':
      return { ...kernel.sources, profile: slot(event.value) }
    case 'plans':
      return { ...kernel.sources, plans: slot(event.value) }
    case 'workouts':
      return { ...kernel.sources, workouts: slot(event.value) }
    case 'runs':
      return { ...kernel.sources, runs: slot(event.value) }
    case 'shoes':
      return { ...kernel.sources, shoes: slot(event.value) }
  }
}

function invalidateServerConfirmation(
  sources: TrainingSourceSlots,
): TrainingSourceSlots {
  return {
    profile: { ...sources.profile, confirmedInConnection: false },
    plans: { ...sources.plans, confirmedInConnection: false },
    workouts: { ...sources.workouts, confirmedInConnection: false },
    runs: { ...sources.runs, confirmedInConnection: false },
    shoes: { ...sources.shoes, confirmedInConnection: false },
  }
}

export function reduceTrainingSynchronization(
  kernel: TrainingSynchronizationKernel,
  event: TrainingSynchronizationEvent,
): TrainingSynchronizationKernel {
  if (!isCurrentSession(kernel, event)) return kernel

  switch (event.type) {
    case 'source_snapshot':
      return withDerivedState({
        ...kernel,
        sources: sourceSnapshot(kernel, event),
      })
    case 'connection_changed':
      if (event.connected === kernel.connected) return kernel
      return withDerivedState({
        ...kernel,
        connected: event.connected,
        sources: invalidateServerConfirmation(kernel.sources),
      })
    case 'source_error':
      return withDerivedState({
        ...kernel,
        activity: {
          kind: 'error',
          message: event.message,
          recoverable: event.recoverable,
        },
      })
    case 'retry':
      return withDerivedState({
        ...kernel,
        connected: true,
        sources: invalidateServerConfirmation(kernel.sources),
        activity: { kind: 'idle' },
      })
    case 'saving_started':
      if (kernel.state.status !== 'current') return kernel
      return {
        ...kernel,
        activity: { kind: 'saving', commandId: event.commandId },
        state: {
          status: 'saving',
          ownerId: kernel.ownerId,
          sessionGeneration: kernel.sessionGeneration,
          snapshot: kernel.state.snapshot,
          freshness: kernel.state.freshness,
          commandId: event.commandId,
        },
      }
    case 'saving_cancelled':
      if (kernel.activity.kind !== 'saving') return kernel
      return withDerivedState({ ...kernel, activity: { kind: 'idle' } })
    case 'conflict':
      if (kernel.lastCompleteSnapshot === null) return kernel
      return withDerivedState({
        ...kernel,
        activity: {
          kind: 'conflict',
          commandId: event.commandId,
          message: event.message,
        },
      })
  }
}
