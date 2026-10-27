import {
  collection,
  doc,
  onSnapshot,
  type DocumentData,
  type Firestore,
  type SnapshotMetadata,
} from 'firebase/firestore'
import {
  createUtcDateTime,
  type ActivePlanState,
  type CompletedRun,
  type PlannedWorkout,
  type Shoe,
  type TrainingPlan,
  type TrainingPlanId,
  type UserId,
  type UserProfile,
  type UtcDateTime,
} from '../../domain/training'
import { getFirebaseFirestore } from '../../services/firebaseClient'
import type {
  TrainingLiveReadEvent,
  TrainingLiveReadEventBatch,
  TrainingLiveReadSource,
  TrainingSnapshotOrigin,
} from '../../training/trainingSynchronization'
import {
  activePlanStateFromDocument,
  completedRunFromDocument,
  plannedWorkoutFromDocument,
  shoeFromDocument,
  trainingPlanFromDocument,
  userProfileFromDocument,
} from './converters'
import {
  activePlanStateDocumentPath,
  plansCollectionPath,
  profileDocumentPath,
  runsCollectionPath,
  shoesCollectionPath,
  workoutsCollectionPath,
} from './paths'

export interface TrainingListenerMetadata {
  readonly fromCache: boolean
  readonly hasPendingWrites: boolean
}

export interface TrainingListenerDocument {
  readonly id: string
  readonly data: Record<string, unknown>
}

export interface TrainingDocumentListenerSnapshot {
  readonly document: TrainingListenerDocument | null
  readonly metadata: TrainingListenerMetadata
}

export interface TrainingCollectionListenerSnapshot {
  readonly documents: readonly TrainingListenerDocument[]
  readonly metadata: TrainingListenerMetadata
}

type Unsubscribe = () => void
type ListenerError = (error: unknown) => void

export interface FirestoreTrainingListenerBackend {
  subscribeDocument(
    path: string,
    onSnapshot: (snapshot: TrainingDocumentListenerSnapshot) => void,
    onError: ListenerError,
  ): Unsubscribe
  subscribeCollection(
    path: string,
    onSnapshot: (snapshot: TrainingCollectionListenerSnapshot) => void,
    onError: ListenerError,
  ): Unsubscribe
}

export interface CreateFirestoreTrainingLiveReadSourceOptions {
  readonly backend: FirestoreTrainingListenerBackend
  readonly ownerId: UserId
  readonly sessionGeneration: number
  readonly clock?: () => UtcDateTime
}

interface WorkoutSnapshot {
  readonly workouts: readonly PlannedWorkout[]
  readonly metadata: TrainingListenerMetadata
}

interface LiveCollectionValues {
  readonly runs: CompletedRun
  readonly shoes: Shoe
}

type SnapshotValue =
  | UserProfile
  | null
  | ActivePlanState
  | readonly TrainingPlan[]
  | readonly PlannedWorkout[]
  | readonly CompletedRun[]
  | readonly Shoe[]

function listenerMetadata(metadata: SnapshotMetadata): TrainingListenerMetadata {
  return {
    fromCache: metadata.fromCache,
    hasPendingWrites: metadata.hasPendingWrites,
  }
}

export function createFirebaseTrainingListenerBackend(
  database: Firestore,
): FirestoreTrainingListenerBackend {
  return {
    subscribeDocument(path, receiveSnapshot, receiveError) {
      return onSnapshot(
        doc(database, path),
        { includeMetadataChanges: true },
        (snapshot) => {
          receiveSnapshot({
            document: snapshot.exists()
              ? {
                  id: snapshot.id,
                  data: snapshot.data() as DocumentData,
                }
              : null,
            metadata: listenerMetadata(snapshot.metadata),
          })
        },
        receiveError,
      )
    },
    subscribeCollection(path, receiveSnapshot, receiveError) {
      return onSnapshot(
        collection(database, path),
        { includeMetadataChanges: true },
        (snapshot) => {
          receiveSnapshot({
            documents: snapshot.docs.map((documentSnapshot) => ({
              id: documentSnapshot.id,
              data: documentSnapshot.data() as DocumentData,
            })),
            metadata: listenerMetadata(snapshot.metadata),
          })
        },
        receiveError,
      )
    },
  }
}

function originFor(metadata: TrainingListenerMetadata): TrainingSnapshotOrigin {
  return metadata.fromCache ? 'cache' : 'server'
}

function messageFor(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Training data could not be synchronized.'
}

function samePlanIds(
  left: readonly TrainingPlanId[],
  right: readonly TrainingPlanId[],
): boolean {
  return (
    left.length === right.length &&
    left.every((planId, index) => planId === right[index])
  )
}

function combinedWorkoutMetadata(
  snapshots: Iterable<WorkoutSnapshot>,
): TrainingListenerMetadata {
  const values = [...snapshots]

  return {
    fromCache: values.some((snapshot) => snapshot.metadata.fromCache),
    hasPendingWrites: values.some(
      (snapshot) => snapshot.metadata.hasPendingWrites,
    ),
  }
}

export function createFirestoreTrainingLiveReadSourceWithBackend({
  backend,
  ownerId,
  sessionGeneration,
  clock = () => createUtcDateTime(new Date().toISOString()),
}: CreateFirestoreTrainingLiveReadSourceOptions): TrainingLiveReadSource {
  return {
    subscribe(onEvents) {
      let active = true
      let workoutGeneration = 0
      let currentPlanIds: readonly TrainingPlanId[] | null = null
      let currentPlansEvent: TrainingLiveReadEvent | null = null
      let workoutGroupReady = false
      let workoutUnsubscribes: Unsubscribe[] = []

      const emit = (events: TrainingLiveReadEventBatch): void => {
        if (active) onEvents(events)
      }

      const sourceError = (
        source:
          | 'profile'
          | 'activePlanState'
          | 'plans'
          | 'workouts'
          | 'runs'
          | 'shoes',
        error: unknown,
      ): void => {
        emit([
          {
            type: 'source_error',
            source,
            ownerId,
            sessionGeneration,
            message: messageFor(error),
            recoverable: true,
          },
        ])
      }

      const sourceSnapshot = (
        source:
          | 'profile'
          | 'activePlanState'
          | 'plans'
          | 'workouts'
          | 'runs'
          | 'shoes',
        value: SnapshotValue,
        metadata: TrainingListenerMetadata,
      ): TrainingLiveReadEvent =>
        ({
          type: 'source_snapshot',
          source,
          value,
          ownerId,
          sessionGeneration,
          origin: originFor(metadata),
          hasPendingWrites: metadata.hasPendingWrites,
          observedAt: clock(),
        }) as TrainingLiveReadEvent

      const stopWorkoutListeners = (): void => {
        workoutGeneration += 1
        workoutUnsubscribes.forEach((unsubscribe) => unsubscribe())
        workoutUnsubscribes = []
      }

      const listenForWorkouts = (
        plans: readonly TrainingPlan[],
        plansEvent: TrainingLiveReadEvent,
        plansMetadata: TrainingListenerMetadata,
      ): void => {
        stopWorkoutListeners()
        const generation = workoutGeneration
        const snapshots = new Map<TrainingPlanId, WorkoutSnapshot>()
        currentPlansEvent = plansEvent
        workoutGroupReady = false

        if (plans.length === 0) {
          workoutGroupReady = true
          emit([
            plansEvent,
            sourceSnapshot('workouts', [], plansMetadata),
          ])
          return
        }

        const publishWorkouts = (): void => {
          if (
            !active ||
            generation !== workoutGeneration ||
            snapshots.size !== plans.length
          ) {
            return
          }

          const workouts = plans
            .flatMap((plan) => snapshots.get(plan.id)?.workouts ?? [])
            .sort((left, right) =>
              left.scheduledDate.localeCompare(right.scheduledDate),
            )
          const workoutsEvent = sourceSnapshot(
            'workouts',
            workouts,
            combinedWorkoutMetadata(snapshots.values()),
          )

          if (!workoutGroupReady) {
            workoutGroupReady = true
            emit([currentPlansEvent ?? plansEvent, workoutsEvent])
          } else {
            emit([workoutsEvent])
          }
        }

        workoutUnsubscribes = plans.map((plan) =>
          backend.subscribeCollection(
            workoutsCollectionPath(ownerId, plan.id),
            (snapshot) => {
              if (!active || generation !== workoutGeneration) return

              try {
                snapshots.set(plan.id, {
                  workouts: snapshot.documents.map((document) =>
                    plannedWorkoutFromDocument(
                      document.id,
                      document.data,
                      ownerId,
                      plan.id,
                    ),
                  ),
                  metadata: snapshot.metadata,
                })
                publishWorkouts()
              } catch (error) {
                sourceError('workouts', error)
              }
            },
            (error) => {
              if (active && generation === workoutGeneration) {
                sourceError('workouts', error)
              }
            },
          ),
        )
      }

      const subscribeCollection = <Source extends keyof LiveCollectionValues>(
        path: string,
        source: Source,
        convert: (
          document: TrainingListenerDocument,
        ) => LiveCollectionValues[Source],
        compare: (
          left: LiveCollectionValues[Source],
          right: LiveCollectionValues[Source],
        ) => number,
      ): Unsubscribe =>
        backend.subscribeCollection(
          path,
          (snapshot) => {
            if (!active) return

            try {
              const values = snapshot.documents.map(convert).sort(compare)
              emit([
                sourceSnapshot(
                  source,
                  values as readonly CompletedRun[] | readonly Shoe[],
                  snapshot.metadata,
                ),
              ])
            } catch (error) {
              sourceError(source, error)
            }
          },
          (error) => sourceError(source, error),
        )

      const rootUnsubscribes: Unsubscribe[] = [
        backend.subscribeDocument(
          profileDocumentPath(ownerId),
          (snapshot) => {
            if (!active) return

            try {
              const profile =
                snapshot.document === null
                  ? null
                  : userProfileFromDocument(
                      snapshot.document.id,
                      snapshot.document.data,
                      ownerId,
                    )
              emit([sourceSnapshot('profile', profile, snapshot.metadata)])
            } catch (error) {
              sourceError('profile', error)
            }
          },
          (error) => sourceError('profile', error),
        ),
        backend.subscribeDocument(
          activePlanStateDocumentPath(ownerId),
          (snapshot) => {
            if (!active) return

            try {
              const activePlanState =
                snapshot.document === null
                  ? null
                  : activePlanStateFromDocument(
                      snapshot.document.data,
                      ownerId,
                    )
              emit([
                sourceSnapshot(
                  'activePlanState',
                  activePlanState,
                  snapshot.metadata,
                ),
              ])
            } catch (error) {
              sourceError('activePlanState', error)
            }
          },
          (error) => sourceError('activePlanState', error),
        ),
        backend.subscribeCollection(
          plansCollectionPath(ownerId),
          (snapshot) => {
            if (!active) return

            try {
              const plans = snapshot.documents
                .map((document) =>
                  trainingPlanFromDocument(
                    document.id,
                    document.data,
                    ownerId,
                  ),
                )
                .sort((left, right) =>
                  right.startDate.localeCompare(left.startDate),
                )
              const plansEvent = sourceSnapshot(
                'plans',
                plans,
                snapshot.metadata,
              )
              const planIds = plans
                .map((plan) => plan.id)
                .sort((left, right) => left.localeCompare(right))

              if (
                currentPlanIds !== null &&
                samePlanIds(currentPlanIds, planIds)
              ) {
                currentPlansEvent = plansEvent
                if (workoutGroupReady) {
                  emit(
                    plans.length === 0
                      ? [
                          plansEvent,
                          sourceSnapshot('workouts', [], snapshot.metadata),
                        ]
                      : [plansEvent],
                  )
                }
                return
              }

              currentPlanIds = planIds
              listenForWorkouts(plans, plansEvent, snapshot.metadata)
            } catch (error) {
              sourceError('plans', error)
            }
          },
          (error) => sourceError('plans', error),
        ),
        subscribeCollection(
          runsCollectionPath(ownerId),
          'runs',
          (document) =>
            completedRunFromDocument(document.id, document.data, ownerId),
          (left, right) => right.startedAt.localeCompare(left.startedAt),
        ),
        subscribeCollection(
          shoesCollectionPath(ownerId),
          'shoes',
          (document) =>
            shoeFromDocument(document.id, document.data, ownerId),
          (left, right) => left.name.localeCompare(right.name),
        ),
      ]

      return () => {
        if (!active) return

        active = false
        rootUnsubscribes.forEach((unsubscribe) => unsubscribe())
        stopWorkoutListeners()
        currentPlansEvent = null
      }
    },
  }
}

export function createFirestoreTrainingLiveReadSource(
  ownerId: UserId,
  sessionGeneration: number,
): TrainingLiveReadSource {
  return createFirestoreTrainingLiveReadSourceWithBackend({
    backend: createFirebaseTrainingListenerBackend(getFirebaseFirestore()),
    ownerId,
    sessionGeneration,
  })
}
