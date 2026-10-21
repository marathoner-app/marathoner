import { describe, expect, it, vi } from 'vitest'
import {
  createDateOnly,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type PlannedWorkout,
  type TrainingPlan,
} from '../../domain/training'
import type { TrainingLiveReadEventBatch } from '../../training/trainingSynchronization'
import {
  plannedWorkoutToDocument,
  trainingPlanToDocument,
} from './converters'
import {
  createFirestoreTrainingLiveReadSourceWithBackend,
  type FirestoreTrainingListenerBackend,
  type TrainingCollectionListenerSnapshot,
  type TrainingDocumentListenerSnapshot,
} from './firestoreTrainingLiveReadSource'
import {
  plansCollectionPath,
  profileDocumentPath,
  runsCollectionPath,
  shoesCollectionPath,
  workoutsCollectionPath,
} from './paths'

interface DocumentRegistration {
  readonly path: string
  readonly onSnapshot: (snapshot: TrainingDocumentListenerSnapshot) => void
  readonly onError: (error: unknown) => void
  readonly unsubscribe: ReturnType<typeof vi.fn>
}

interface CollectionRegistration {
  readonly path: string
  readonly onSnapshot: (snapshot: TrainingCollectionListenerSnapshot) => void
  readonly onError: (error: unknown) => void
  readonly unsubscribe: ReturnType<typeof vi.fn>
}

class FakeListenerBackend implements FirestoreTrainingListenerBackend {
  readonly documents: DocumentRegistration[] = []
  readonly collections: CollectionRegistration[] = []

  subscribeDocument(
    path: string,
    onSnapshot: (snapshot: TrainingDocumentListenerSnapshot) => void,
    onError: (error: unknown) => void,
  ) {
    const registration = {
      path,
      onSnapshot,
      onError,
      unsubscribe: vi.fn(),
    }
    this.documents.push(registration)
    return registration.unsubscribe
  }

  subscribeCollection(
    path: string,
    onSnapshot: (snapshot: TrainingCollectionListenerSnapshot) => void,
    onError: (error: unknown) => void,
  ) {
    const registration = {
      path,
      onSnapshot,
      onError,
      unsubscribe: vi.fn(),
    }
    this.collections.push(registration)
    return registration.unsubscribe
  }

  document(path: string): DocumentRegistration {
    const registration = this.documents.find((candidate) => candidate.path === path)
    if (registration === undefined) throw new Error(`No document listener for ${path}`)
    return registration
  }

  latestCollection(path: string): CollectionRegistration {
    for (let index = this.collections.length - 1; index >= 0; index -= 1) {
      const registration = this.collections[index]
      if (registration?.path === path) return registration
    }

    throw new Error(`No collection listener for ${path}`)
  }
}

const ownerId = createUserId('owner-1')
const sessionGeneration = 7
const observedAt = createUtcDateTime('2026-10-21T17:00:00Z')
const createdAt = createUtcDateTime('2026-10-01T12:00:00Z')
const updatedAt = createUtcDateTime('2026-10-02T12:00:00Z')
const serverMetadata = { fromCache: false, hasPendingWrites: false }

const planOne: TrainingPlan = {
  id: createTrainingPlanId('plan-1'),
  userId: ownerId,
  name: 'First plan',
  startDate: createDateOnly('2026-10-20'),
  targetRaceDate: createDateOnly('2027-04-18'),
  status: 'active',
  createdAt,
  updatedAt,
}

const planTwo: TrainingPlan = {
  ...planOne,
  id: createTrainingPlanId('plan-2'),
  name: 'Earlier plan',
  startDate: createDateOnly('2026-09-01'),
  status: 'archived',
}

const workout: PlannedWorkout = {
  id: createPlannedWorkoutId('workout-1'),
  userId: ownerId,
  planId: planOne.id,
  kind: 'rest',
  scheduledDate: createDateOnly('2026-10-21'),
  phase: 'base_building',
  status: 'planned',
  createdAt,
  updatedAt,
}

function collectionSnapshot(
  documents: TrainingCollectionListenerSnapshot['documents'] = [],
  metadata: TrainingCollectionListenerSnapshot['metadata'] = serverMetadata,
): TrainingCollectionListenerSnapshot {
  return { documents, metadata }
}

function planDocument(plan: TrainingPlan) {
  return { id: plan.id, data: trainingPlanToDocument(plan) }
}

function createHarness() {
  const backend = new FakeListenerBackend()
  const batches: TrainingLiveReadEventBatch[] = []
  const source = createFirestoreTrainingLiveReadSourceWithBackend({
    backend,
    ownerId,
    sessionGeneration,
    clock: () => observedAt,
  })
  const unsubscribe = source.subscribe((batch) => batches.push(batch))

  return { backend, batches, unsubscribe }
}

describe('Firestore training live-read source', () => {
  it('subscribes only to owner paths and translates root snapshot metadata', () => {
    const { backend, batches } = createHarness()

    expect(backend.documents.map(({ path }) => path)).toEqual([
      profileDocumentPath(ownerId),
    ])
    expect(backend.collections.map(({ path }) => path)).toEqual([
      plansCollectionPath(ownerId),
      runsCollectionPath(ownerId),
      shoesCollectionPath(ownerId),
    ])

    backend.document(profileDocumentPath(ownerId)).onSnapshot({
      document: null,
      metadata: { fromCache: true, hasPendingWrites: false },
    })
    backend.latestCollection(runsCollectionPath(ownerId)).onSnapshot(
      collectionSnapshot([], { fromCache: false, hasPendingWrites: true }),
    )
    backend.latestCollection(shoesCollectionPath(ownerId)).onSnapshot(
      collectionSnapshot(),
    )

    expect(batches).toEqual([
      [
        {
          type: 'source_snapshot',
          source: 'profile',
          value: null,
          ownerId,
          sessionGeneration,
          origin: 'cache',
          hasPendingWrites: false,
          observedAt,
        },
      ],
      [
        expect.objectContaining({
          type: 'source_snapshot',
          source: 'runs',
          value: [],
          origin: 'server',
          hasPendingWrites: true,
        }),
      ],
      [
        expect.objectContaining({
          type: 'source_snapshot',
          source: 'shoes',
          value: [],
          origin: 'server',
          hasPendingWrites: false,
        }),
      ],
    ])
  })

  it('publishes a plan set and its workouts as one complete batch', () => {
    const { backend, batches } = createHarness()

    backend.latestCollection(plansCollectionPath(ownerId)).onSnapshot(
      collectionSnapshot([planDocument(planTwo), planDocument(planOne)]),
    )

    const planOneWorkouts = backend.latestCollection(
      workoutsCollectionPath(ownerId, planOne.id),
    )
    const planTwoWorkouts = backend.latestCollection(
      workoutsCollectionPath(ownerId, planTwo.id),
    )
    expect(batches).toEqual([])

    planTwoWorkouts.onSnapshot(collectionSnapshot())
    expect(batches).toEqual([])

    planOneWorkouts.onSnapshot(
      collectionSnapshot(
        [{ id: workout.id, data: plannedWorkoutToDocument(workout) }],
        { fromCache: true, hasPendingWrites: true },
      ),
    )

    expect(batches).toHaveLength(1)
    expect(batches[0]).toEqual([
      expect.objectContaining({
        source: 'plans',
        value: [planOne, planTwo],
        origin: 'server',
        hasPendingWrites: false,
      }),
      expect.objectContaining({
        source: 'workouts',
        value: [workout],
        origin: 'cache',
        hasPendingWrites: true,
      }),
    ])

    planOneWorkouts.onSnapshot(
      collectionSnapshot([
        { id: workout.id, data: plannedWorkoutToDocument(workout) },
      ]),
    )
    expect(batches[1]).toEqual([
      expect.objectContaining({
        source: 'workouts',
        value: [workout],
        origin: 'server',
        hasPendingWrites: false,
      }),
    ])
  })

  it('publishes an empty initial plan and workout set without waiting', () => {
    const { backend, batches } = createHarness()

    backend
      .latestCollection(plansCollectionPath(ownerId))
      .onSnapshot(collectionSnapshot())

    expect(batches).toEqual([
      [
        expect.objectContaining({ source: 'plans', value: [] }),
        expect.objectContaining({ source: 'workouts', value: [] }),
      ],
    ])
  })

  it('rebuilds changed workout listeners and ignores callbacks from the old set', () => {
    const { backend, batches } = createHarness()
    const plansListener = backend.latestCollection(plansCollectionPath(ownerId))

    plansListener.onSnapshot(
      collectionSnapshot([planDocument(planOne), planDocument(planTwo)]),
    )
    const oldPlanOneListener = backend.latestCollection(
      workoutsCollectionPath(ownerId, planOne.id),
    )
    const oldPlanTwoListener = backend.latestCollection(
      workoutsCollectionPath(ownerId, planTwo.id),
    )
    oldPlanOneListener.onSnapshot(collectionSnapshot())
    oldPlanTwoListener.onSnapshot(collectionSnapshot())
    batches.length = 0

    plansListener.onSnapshot(collectionSnapshot([planDocument(planOne)]))
    expect(oldPlanOneListener.unsubscribe).toHaveBeenCalledOnce()
    expect(oldPlanTwoListener.unsubscribe).toHaveBeenCalledOnce()
    expect(batches).toEqual([])

    oldPlanTwoListener.onSnapshot(collectionSnapshot())
    expect(batches).toEqual([])

    backend
      .latestCollection(workoutsCollectionPath(ownerId, planOne.id))
      .onSnapshot(collectionSnapshot())
    expect(batches).toHaveLength(1)
    expect(batches[0]?.map((event) => event.source)).toEqual([
      'plans',
      'workouts',
    ])
  })

  it('turns listener and conversion failures into recoverable source errors', () => {
    const { backend, batches } = createHarness()

    backend
      .latestCollection(runsCollectionPath(ownerId))
      .onError(new Error('listener unavailable'))
    backend.document(profileDocumentPath(ownerId)).onSnapshot({
      document: { id: ownerId, data: {} },
      metadata: serverMetadata,
    })

    expect(batches).toEqual([
      [
        expect.objectContaining({
          type: 'source_error',
          source: 'runs',
          message: 'listener unavailable',
          recoverable: true,
        }),
      ],
      [
        expect.objectContaining({
          type: 'source_error',
          source: 'profile',
          message: 'Unsupported training schema version: undefined.',
          recoverable: true,
        }),
      ],
    ])
  })

  it('detaches every listener and suppresses deliberately late callbacks', () => {
    const { backend, batches, unsubscribe } = createHarness()
    const plansListener = backend.latestCollection(plansCollectionPath(ownerId))
    plansListener.onSnapshot(collectionSnapshot([planDocument(planOne)]))
    const workoutListener = backend.latestCollection(
      workoutsCollectionPath(ownerId, planOne.id),
    )

    unsubscribe()

    for (const registration of backend.documents) {
      expect(registration.unsubscribe).toHaveBeenCalledOnce()
    }
    for (const registration of backend.collections) {
      expect(registration.unsubscribe).toHaveBeenCalledOnce()
    }

    backend.document(profileDocumentPath(ownerId)).onSnapshot({
      document: null,
      metadata: serverMetadata,
    })
    plansListener.onError(new Error('late root error'))
    workoutListener.onSnapshot(collectionSnapshot())
    workoutListener.onError(new Error('late workout error'))

    expect(batches).toEqual([])
  })
})
