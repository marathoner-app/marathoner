import { describe, expect, it } from 'vitest'
import {
  createCompletedRunId,
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type CompletedRun,
  type TrainingPlan,
  type UserId,
} from '../domain/training'
import {
  createTrainingSynchronizationKernel,
  reduceTrainingSynchronization,
  type CreateTrainingSynchronizationKernelOptions,
  type TrainingSourceSnapshotEvent,
  type TrainingSynchronizationEvent,
  type TrainingSynchronizationKernel,
} from './trainingSynchronization'

const ownerId = createUserId('owner-1')
const replacementOwnerId = createUserId('owner-2')
const sessionGeneration = 4
const createdAt = createUtcDateTime('2026-10-08T10:00:00Z')
const updatedAt = createUtcDateTime('2026-10-08T10:30:00Z')

const plan: TrainingPlan = {
  id: createTrainingPlanId('plan-1'),
  userId: ownerId,
  name: 'First marathon',
  startDate: createDateOnly('2026-10-12'),
  targetRaceDate: createDateOnly('2027-04-18'),
  status: 'active',
  createdAt,
  updatedAt,
}

const replacementPlan: TrainingPlan = {
  ...plan,
  id: createTrainingPlanId('plan-2'),
  userId: replacementOwnerId,
  name: 'Replacement owner plan',
}

const run: CompletedRun = {
  id: createCompletedRunId('run-1'),
  userId: ownerId,
  startedAt: createUtcDateTime('2026-10-08T08:00:00Z'),
  timeZone: createIanaTimeZone('America/Los_Angeles'),
  distance: createDistanceMeters(5000),
  duration: createDurationSeconds(1800),
  createdAt,
  updatedAt,
}

const observedAt = {
  profile: createUtcDateTime('2026-10-08T12:00:01Z'),
  plans: createUtcDateTime('2026-10-08T12:00:02Z'),
  workouts: createUtcDateTime('2026-10-08T12:00:03Z'),
  runs: createUtcDateTime('2026-10-08T12:00:04Z'),
  shoes: createUtcDateTime('2026-10-08T12:00:05Z'),
} as const

type ProfileSourceEvent = Extract<
  TrainingSourceSnapshotEvent,
  { readonly source: 'profile' }
>
type PlansSourceEvent = Extract<
  TrainingSourceSnapshotEvent,
  { readonly source: 'plans' }
>
type WorkoutsSourceEvent = Extract<
  TrainingSourceSnapshotEvent,
  { readonly source: 'workouts' }
>
type RunsSourceEvent = Extract<
  TrainingSourceSnapshotEvent,
  { readonly source: 'runs' }
>
type ShoesSourceEvent = Extract<
  TrainingSourceSnapshotEvent,
  { readonly source: 'shoes' }
>

type SourceEventTuple = readonly [
  ProfileSourceEvent,
  PlansSourceEvent,
  WorkoutsSourceEvent,
  RunsSourceEvent,
  ShoesSourceEvent,
]

interface SourceEventsOptions {
  readonly eventOwnerId?: UserId
  readonly eventSessionGeneration?: number
  readonly origin?: 'cache' | 'server'
  readonly hasPendingWrites?: boolean
  readonly plans?: readonly TrainingPlan[]
  readonly runs?: readonly CompletedRun[]
}

function sourceEvents({
  eventOwnerId = ownerId,
  eventSessionGeneration = sessionGeneration,
  origin = 'server',
  hasPendingWrites = false,
  plans = [],
  runs = [],
}: SourceEventsOptions = {}): SourceEventTuple {
  const session = {
    ownerId: eventOwnerId,
    sessionGeneration: eventSessionGeneration,
  }
  const metadata = { origin, hasPendingWrites }

  return [
    {
      ...session,
      ...metadata,
      type: 'source_snapshot',
      source: 'profile',
      value: null,
      observedAt: observedAt.profile,
    },
    {
      ...session,
      ...metadata,
      type: 'source_snapshot',
      source: 'plans',
      value: plans,
      observedAt: observedAt.plans,
    },
    {
      ...session,
      ...metadata,
      type: 'source_snapshot',
      source: 'workouts',
      value: [],
      observedAt: observedAt.workouts,
    },
    {
      ...session,
      ...metadata,
      type: 'source_snapshot',
      source: 'runs',
      value: runs,
      observedAt: observedAt.runs,
    },
    {
      ...session,
      ...metadata,
      type: 'source_snapshot',
      source: 'shoes',
      value: [],
      observedAt: observedAt.shoes,
    },
  ]
}

function applyEvents(
  kernel: TrainingSynchronizationKernel,
  events: readonly TrainingSynchronizationEvent[],
): TrainingSynchronizationKernel {
  return events.reduce(reduceTrainingSynchronization, kernel)
}

function currentKernel(
  options: Partial<CreateTrainingSynchronizationKernelOptions> = {},
): TrainingSynchronizationKernel {
  return applyEvents(
    createTrainingSynchronizationKernel({
      ownerId,
      sessionGeneration,
      ...options,
    }),
    sourceEvents(),
  )
}

function sessionEvent<Event extends object>(event: Event) {
  return { ownerId, sessionGeneration, ...event }
}

describe('training synchronization kernel', () => {
  it('waits for every required source before publishing a current snapshot', () => {
    const events = sourceEvents()
    const incomplete = applyEvents(
      createTrainingSynchronizationKernel({ ownerId, sessionGeneration }),
      events.slice(0, -1),
    )

    expect(incomplete.state).toEqual({
      status: 'loading',
      ownerId,
      sessionGeneration,
    })

    const complete = reduceTrainingSynchronization(incomplete, events[4])

    expect(complete.state.status).toBe('current')
    if (complete.state.status !== 'current') return
    expect(complete.state.snapshot).toMatchObject({
      ownerId,
      profile: null,
      plans: [],
      workouts: [],
      runs: [],
      shoes: [],
    })
    expect(complete.state.freshness).toEqual({
      connected: true,
      hasCacheOnlySources: false,
      hasPendingWrites: false,
      lastServerConfirmedAt: observedAt.shoes,
    })
    expect(complete.state.serverConfirmedAt).toBe(observedAt.shoes)
  })

  it('publishes complete cache data as stale until every source is server-confirmed', () => {
    const cached = applyEvents(
      createTrainingSynchronizationKernel({ ownerId, sessionGeneration }),
      sourceEvents({ origin: 'cache', plans: [plan] }),
    )

    expect(cached.state.status).toBe('stale')
    if (cached.state.status !== 'stale') return
    expect(cached.state.reasons).toContain('cache_only')
    expect(cached.state.snapshot.plans).toEqual([plan])
    expect(cached.state.freshness.lastServerConfirmedAt).toBeNull()

    const current = applyEvents(cached, sourceEvents({ plans: [plan] }))

    expect(current.state.status).toBe('current')
    if (current.state.status !== 'current') return
    expect(current.state.freshness.hasCacheOnlySources).toBe(false)
    expect(current.state.serverConfirmedAt).toBe(observedAt.shoes)
  })

  it('does not replace the last safe snapshot with pending local writes', () => {
    const initial = currentKernel()
    const pending = reduceTrainingSynchronization(initial, {
      ...sessionEvent({}),
      type: 'source_snapshot',
      source: 'runs',
      value: [run],
      origin: 'cache',
      hasPendingWrites: true,
      observedAt: createUtcDateTime('2026-10-08T12:01:00Z'),
    })

    expect(pending.state.status).toBe('stale')
    if (pending.state.status !== 'stale') return
    expect(pending.state.reasons).toContain('pending_writes')
    expect(pending.state.snapshot.runs).toEqual([])
    expect(pending.state.freshness.hasPendingWrites).toBe(true)

    const confirmed = reduceTrainingSynchronization(pending, {
      ...sessionEvent({}),
      type: 'source_snapshot',
      source: 'runs',
      value: [run],
      origin: 'server',
      hasPendingWrites: false,
      observedAt: createUtcDateTime('2026-10-08T12:02:00Z'),
    })

    expect(confirmed.state.status).toBe('current')
    if (confirmed.state.status !== 'current') return
    expect(confirmed.state.snapshot.runs).toEqual([run])
  })

  it('requires fresh server evidence from every source after reconnecting', () => {
    const disconnected = reduceTrainingSynchronization(currentKernel(), {
      ...sessionEvent({}),
      type: 'connection_changed',
      connected: false,
    })

    expect(disconnected.state.status).toBe('stale')
    if (disconnected.state.status !== 'stale') return
    expect(disconnected.state.reasons).toContain('disconnected')

    const reconnecting = reduceTrainingSynchronization(disconnected, {
      ...sessionEvent({}),
      type: 'connection_changed',
      connected: true,
    })

    expect(reconnecting.state.status).toBe('stale')
    if (reconnecting.state.status !== 'stale') return
    expect(reconnecting.state.reasons).toContain('reconnecting')

    const refreshedExceptShoes = applyEvents(
      reconnecting,
      sourceEvents().slice(0, -1),
    )
    expect(refreshedExceptShoes.state.status).toBe('stale')

    const refreshed = reduceTrainingSynchronization(
      refreshedExceptShoes,
      sourceEvents()[4],
    )
    expect(refreshed.state.status).toBe('current')
  })

  it('preserves the snapshot through a source error and a deterministic retry', () => {
    const failed = reduceTrainingSynchronization(currentKernel(), {
      ...sessionEvent({}),
      type: 'source_error',
      source: 'runs',
      message: 'Runs are temporarily unavailable.',
      recoverable: true,
    })

    expect(failed.state.status).toBe('error')
    if (failed.state.status !== 'error') return
    expect(failed.state.snapshot?.runs).toEqual([])
    expect(failed.state.recoverable).toBe(true)

    const retrying = reduceTrainingSynchronization(failed, {
      ...sessionEvent({}),
      type: 'retry',
    })

    expect(retrying.state.status).toBe('stale')
    if (retrying.state.status !== 'stale') return
    expect(retrying.state.reasons).toContain('reconnecting')

    const recovered = applyEvents(retrying, sourceEvents())
    expect(recovered.state.status).toBe('current')
  })

  it('settles saving only after the command-specific predicate converges', () => {
    const initial = currentKernel({
      isFeatureComplete: (snapshot, context) =>
        context.activeCommandId === null || snapshot.runs.length === 1,
    })
    const saving = reduceTrainingSynchronization(initial, {
      ...sessionEvent({}),
      type: 'saving_started',
      commandId: 'save-run-1',
    })

    expect(saving.state.status).toBe('saving')

    const unrelatedUpdate = reduceTrainingSynchronization(saving, {
      ...sourceEvents()[1],
      value: [plan],
      observedAt: createUtcDateTime('2026-10-08T12:01:00Z'),
    })
    expect(unrelatedUpdate.state.status).toBe('saving')

    const converged = reduceTrainingSynchronization(unrelatedUpdate, {
      ...sourceEvents()[3],
      value: [run],
      observedAt: createUtcDateTime('2026-10-08T12:02:00Z'),
    })

    expect(converged.state.status).toBe('current')
    if (converged.state.status !== 'current') return
    expect(converged.state.snapshot.runs).toEqual([run])
  })

  it('keeps default saving fail-closed when an unrelated update arrives', () => {
    const saving = reduceTrainingSynchronization(currentKernel(), {
      ...sessionEvent({}),
      type: 'saving_started',
      commandId: 'save-without-convergence-predicate',
    })

    const unrelatedUpdate = reduceTrainingSynchronization(saving, {
      ...sourceEvents()[1],
      value: [plan],
      observedAt: createUtcDateTime('2026-10-08T12:01:00Z'),
    })

    expect(unrelatedUpdate.state.status).toBe('saving')
    if (unrelatedUpdate.state.status !== 'saving') return
    expect(unrelatedUpdate.state.commandId).toBe(
      'save-without-convergence-predicate',
    )
    expect(unrelatedUpdate.state.snapshot.plans).toEqual([])
  })

  it('uses the pluggable predicate before publishing an initial snapshot', () => {
    const incomplete = applyEvents(
      createTrainingSynchronizationKernel({
        ownerId,
        sessionGeneration,
        isFeatureComplete: (snapshot) => snapshot.plans.length === 1,
      }),
      sourceEvents(),
    )

    expect(incomplete.state.status).toBe('loading')

    const complete = reduceTrainingSynchronization(incomplete, {
      ...sourceEvents()[1],
      value: [plan],
    })
    expect(complete.state.status).toBe('current')
  })

  it('preserves the last complete snapshot when a later candidate is incomplete', () => {
    let featureReady = true
    const initial = currentKernel({
      isFeatureComplete: () => featureReady,
    })
    featureReady = false

    const incomplete = reduceTrainingSynchronization(initial, {
      ...sourceEvents()[1],
      value: [plan],
      observedAt: createUtcDateTime('2026-10-08T12:01:00Z'),
    })

    expect(incomplete.state.status).toBe('stale')
    if (incomplete.state.status !== 'stale') return
    expect(incomplete.state.reasons).toContain('feature_incomplete')
    expect(incomplete.state.snapshot.plans).toEqual([])
  })

  it('represents a conflict without discarding the visible snapshot', () => {
    const conflicted = reduceTrainingSynchronization(currentKernel(), {
      ...sessionEvent({}),
      type: 'conflict',
      commandId: 'save-plan-1',
      message: 'The training plan changed on another device.',
    })

    expect(conflicted.state.status).toBe('conflict')
    if (conflicted.state.status !== 'conflict') return
    expect(conflicted.state.snapshot.ownerId).toBe(ownerId)
    expect(conflicted.state.commandId).toBe('save-plan-1')

    const retrying = reduceTrainingSynchronization(conflicted, {
      ...sessionEvent({}),
      type: 'retry',
    })
    expect(retrying.state.status).toBe('stale')
    if (retrying.state.status !== 'stale') return
    expect(retrying.state.reasons).toContain('reconnecting')
  })

  it('ignores callbacks from the ended owner and from an older generation', () => {
    const oldSession = applyEvents(
      createTrainingSynchronizationKernel({ ownerId, sessionGeneration }),
      sourceEvents({ plans: [plan] }),
    )
    expect(oldSession.state.status).toBe('current')

    const replacementSession = createTrainingSynchronizationKernel({
      ownerId: replacementOwnerId,
      sessionGeneration: sessionGeneration + 1,
    })
    const endedOwnerCallback = sourceEvents({ plans: [plan] })[1]
    const ignoredOwner = reduceTrainingSynchronization(
      replacementSession,
      endedOwnerCallback,
    )
    expect(ignoredOwner).toBe(replacementSession)

    const olderGenerationCallback: PlansSourceEvent = {
      ...sourceEvents({
        eventOwnerId: replacementOwnerId,
        eventSessionGeneration: sessionGeneration,
        plans: [replacementPlan],
      })[1],
    }
    const ignoredGeneration = reduceTrainingSynchronization(
      replacementSession,
      olderGenerationCallback,
    )
    expect(ignoredGeneration).toBe(replacementSession)

    const replacementCache = applyEvents(
      replacementSession,
      sourceEvents({
        eventOwnerId: replacementOwnerId,
        eventSessionGeneration: sessionGeneration + 1,
        origin: 'cache',
      }),
    )

    expect(replacementCache.state.status).toBe('stale')
    if (replacementCache.state.status !== 'stale') return
    expect(replacementCache.state.snapshot.ownerId).toBe(replacementOwnerId)
    expect(replacementCache.state.snapshot.plans).toEqual([])
  })

  it('rejects invalid session generations', () => {
    expect(() =>
      createTrainingSynchronizationKernel({
        ownerId,
        sessionGeneration: -1,
      }),
    ).toThrow(/non-negative integer/)
  })
})
