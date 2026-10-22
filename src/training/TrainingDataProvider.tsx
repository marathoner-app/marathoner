import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUtcDateTime,
  createUserId,
  type CompletedRun,
  type CompletedRunId,
  type DateOnly,
  type PlannedWorkout,
  type Shoe,
  type ShoeId,
  type UserId,
  type UserProfile,
} from "../domain/training";
import type {
  CreateCompletedRunInput,
  CreateShoeInput,
  SaveUserProfileInput,
  TrainingRepositories,
  UpdateCompletedRunInput,
} from "../persistence/trainingRepositories";
import {
  TrainingDataContext,
  type TrainingDataContextValue,
} from "./TrainingDataContext";
import {
  createTrainingSynchronizationKernel,
  reduceTrainingSynchronization,
  type SynchronizedTrainingSnapshot,
  type TrainingLiveReadSource,
  type TrainingSourceSnapshotEvent,
  type TrainingSynchronizationKernel,
  type TrainingSynchronizationState,
} from "./trainingSynchronization";

export type TrainingRepositoryFactory = (
  userId: UserId,
) => Promise<TrainingRepositories>;

export type TrainingLiveReadSourceFactory = (
  userId: UserId,
  sessionGeneration: number,
) => Promise<TrainingLiveReadSource>;

type TrainingDataProviderProps = {
  readonly userId: string;
  readonly children: ReactNode;
  readonly repositoryFactory?: TrainingRepositoryFactory;
  readonly liveReadSourceFactory?: TrainingLiveReadSourceFactory;
};

const defaultRepositoryFactory: TrainingRepositoryFactory = async (userId) => {
  const { createFirestoreTrainingRepositories } = await import(
    "../persistence/firestore"
  );
  return createFirestoreTrainingRepositories(userId);
};

const defaultLiveReadSourceFactory: TrainingLiveReadSourceFactory = async (
  userId,
  sessionGeneration,
) => {
  const { createFirestoreTrainingLiveReadSource } = await import(
    "../persistence/firestore"
  );
  return createFirestoreTrainingLiveReadSource(userId, sessionGeneration);
};

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Your training data could not be loaded. Please try again.";
}

function snapshotFor(
  state: TrainingSynchronizationState,
): SynchronizedTrainingSnapshot | null {
  return "snapshot" in state ? state.snapshot : null;
}

function errorFor(state: TrainingSynchronizationState): string | null {
  if (state.status === "error" || state.status === "conflict") {
    return state.message;
  }

  return null;
}

type AcknowledgedSource =
  | { readonly source: "profile"; readonly value: UserProfile | null }
  | { readonly source: "workouts"; readonly value: readonly PlannedWorkout[] }
  | { readonly source: "runs"; readonly value: readonly CompletedRun[] }
  | { readonly source: "shoes"; readonly value: readonly Shoe[] };

function replaceById<Value extends { readonly id: string }>(
  values: readonly Value[],
  replacement: Value,
): Value[] {
  const remaining = values.filter((value) => value.id !== replacement.id);
  return [...remaining, replacement];
}

export default function TrainingDataProvider({
  userId: rawUserId,
  children,
  repositoryFactory = defaultRepositoryFactory,
  liveReadSourceFactory = defaultLiveReadSourceFactory,
}: TrainingDataProviderProps) {
  const userId = useMemo(() => createUserId(rawUserId), [rawUserId]);
  const repositoryRef = useRef<TrainingRepositories | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const sessionGenerationRef = useRef(0);
  const [synchronization, setSynchronization] = useState(() =>
    createTrainingSynchronizationKernel({
      ownerId: userId,
      sessionGeneration: 0,
    }),
  );

  const startSynchronization = useCallback(async () => {
    const generation = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = generation;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    repositoryRef.current = null;
    setSynchronization(
      createTrainingSynchronizationKernel({
        ownerId: userId,
        sessionGeneration: generation,
      }),
    );

    try {
      const [repositories, source] = await Promise.all([
        repositoryFactory(userId),
        liveReadSourceFactory(userId, generation),
      ]);

      if (generation !== sessionGenerationRef.current) return;

      repositoryRef.current = repositories;
      const unsubscribe = source.subscribe((events) => {
        if (generation !== sessionGenerationRef.current) return;

        setSynchronization((current) =>
          events.reduce(reduceTrainingSynchronization, current),
        );
      });

      if (generation !== sessionGenerationRef.current) {
        unsubscribe();
        return;
      }

      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      if (generation !== sessionGenerationRef.current) return;

      repositoryRef.current = null;
      setSynchronization((current) =>
        reduceTrainingSynchronization(current, {
          type: "source_error",
          source: "profile",
          ownerId: userId,
          sessionGeneration: generation,
          message: messageFor(error),
          recoverable: true,
        }),
      );
    }
  }, [liveReadSourceFactory, repositoryFactory, userId]);

  useEffect(() => {
    void startSynchronization();

    return () => {
      sessionGenerationRef.current += 1;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      repositoryRef.current = null;
    };
  }, [startSynchronization]);

  const acknowledgeServerWrites = useCallback(
    (
      acknowledgedSources: (
        kernel: TrainingSynchronizationKernel,
      ) => readonly AcknowledgedSource[],
    ) => {
      const generation = sessionGenerationRef.current;

      setSynchronization((current) => {
        if (current.sessionGeneration !== generation) return current;

        // Firestore write promises resolve only after the remote backend accepts
        // the write. Feed that acknowledgement through the same synchronization
        // reducer so the UI does not depend on a second metadata-only callback.
        const observedAt = createUtcDateTime(new Date().toISOString());
        const sources = acknowledgedSources(current);
        return sources.reduce(
          (kernel, source) =>
            reduceTrainingSynchronization(kernel, {
              ...source,
              type: "source_snapshot",
              ownerId: userId,
              sessionGeneration: generation,
              origin: "server",
              hasPendingWrites: false,
              observedAt,
            } as TrainingSourceSnapshotEvent),
          current,
        );
      });
    },
    [userId],
  );

  const synchronizedSnapshot = snapshotFor(synchronization.state);
  const status =
    synchronization.state.status === "current"
      ? "current"
      : synchronization.state.status === "stale" ||
          synchronization.state.status === "saving"
        ? "stale"
        : synchronization.state.status === "loading"
          ? "loading"
          : "error";

  const requireRepositories = useCallback(() => {
    if (synchronization.state.status !== "current") {
      throw new Error(
        "Training data is not current. Reconnect and try again.",
      );
    }

    if (repositoryRef.current === null) {
      throw new Error("Training data is still loading. Please try again.");
    }

    return repositoryRef.current;
  }, [synchronization.state.status]);

  const createShoe = useCallback(
    async (input: CreateShoeInput) => {
      const shoe = await requireRepositories().shoes.create(input);
      acknowledgeServerWrites((kernel) => [
        {
          source: "shoes",
          value: replaceById(kernel.sources.shoes.value, shoe).sort((left, right) =>
            left.name.localeCompare(right.name),
          ),
        },
      ]);
      return shoe;
    },
    [acknowledgeServerWrites, requireRepositories],
  );

  const retireShoe = useCallback(
    async (id: ShoeId, retiredOn: DateOnly) => {
      const shoe = await requireRepositories().shoes.retire(id, retiredOn);
      acknowledgeServerWrites((kernel) => [
        {
          source: "shoes",
          value: replaceById(kernel.sources.shoes.value, shoe).sort((left, right) =>
            left.name.localeCompare(right.name),
          ),
        },
      ]);
      return shoe;
    },
    [acknowledgeServerWrites, requireRepositories],
  );

  const saveProfile = useCallback(
    async (input: SaveUserProfileInput) => {
      const profile = await requireRepositories().profile.save(input);
      acknowledgeServerWrites(() => [{ source: "profile", value: profile }]);
      return profile;
    },
    [acknowledgeServerWrites, requireRepositories],
  );

  const createRun = useCallback(
    async (input: CreateCompletedRunInput) => {
      const repositories = requireRepositories();
      const associatedWorkout =
        input.plannedWorkoutPlanId === undefined ||
        input.plannedWorkoutId === undefined
          ? null
          : synchronizedSnapshot?.workouts.find(
              (workout) =>
                workout.planId === input.plannedWorkoutPlanId &&
                workout.id === input.plannedWorkoutId,
            ) ?? null;

      if (associatedWorkout?.kind === "rest") {
        throw new Error("A completed run cannot be attached to a rest day.");
      }

      if (
        input.plannedWorkoutPlanId !== undefined &&
        input.plannedWorkoutId !== undefined &&
        associatedWorkout === null
      ) {
        throw new Error("That planned workout is no longer available.");
      }

      if (associatedWorkout?.status === "completed") {
        throw new Error("That planned workout already has a completion record.");
      }

      const run = await repositories.runs.create(input);
      let completedWorkout: PlannedWorkout | null = null;

      if (
        run.plannedWorkoutPlanId !== undefined &&
        run.plannedWorkoutId !== undefined
      ) {
        try {
          completedWorkout = await repositories.workouts.update(
            run.plannedWorkoutPlanId,
            run.plannedWorkoutId,
            { status: "completed" },
          );
        } catch (error) {
          await repositories.runs.delete(run.id);
          throw error;
        }
      }

      acknowledgeServerWrites((kernel) => [
        {
          source: "runs",
          value: replaceById(kernel.sources.runs.value, run).sort((left, right) =>
            right.startedAt.localeCompare(left.startedAt),
          ),
        },
        ...(completedWorkout === null
          ? []
          : [
              {
                source: "workouts" as const,
                value: replaceById(
                  kernel.sources.workouts.value,
                  completedWorkout,
                ).sort((left, right) =>
                  left.scheduledDate.localeCompare(right.scheduledDate),
                ),
              },
            ]),
      ]);

      return run;
    },
    [
      acknowledgeServerWrites,
      requireRepositories,
      synchronizedSnapshot?.workouts,
    ],
  );

  const updateRun = useCallback(
    async (id: CompletedRunId, changes: UpdateCompletedRunInput) => {
      const run = await requireRepositories().runs.update(id, changes);
      acknowledgeServerWrites((kernel) => [
        {
          source: "runs",
          value: replaceById(kernel.sources.runs.value, run).sort((left, right) =>
            right.startedAt.localeCompare(left.startedAt),
          ),
        },
      ]);
      return run;
    },
    [acknowledgeServerWrites, requireRepositories],
  );

  const deleteRun = useCallback(
    async (id: CompletedRunId) => {
      const repositories = requireRepositories();
      const currentSnapshot = synchronizedSnapshot;
      const run = currentSnapshot?.runs.find(
        (candidate) => candidate.id === id,
      );

      if (currentSnapshot === null || run === undefined) {
        return;
      }

      const hasAnotherCompletion = currentSnapshot.runs.some(
        (candidate) =>
          candidate.id !== run.id &&
          candidate.plannedWorkoutPlanId === run.plannedWorkoutPlanId &&
          candidate.plannedWorkoutId === run.plannedWorkoutId,
      );
      let reopenedWorkout: PlannedWorkout | null = null;

      if (
        !hasAnotherCompletion &&
        run.plannedWorkoutPlanId !== undefined &&
        run.plannedWorkoutId !== undefined
      ) {
        reopenedWorkout = await repositories.workouts.update(
          run.plannedWorkoutPlanId,
          run.plannedWorkoutId,
          { status: "planned" },
        );
      }

      try {
        await repositories.runs.delete(id);
      } catch (error) {
        if (reopenedWorkout !== null) {
          await repositories.workouts.update(
            reopenedWorkout.planId,
            reopenedWorkout.id,
            { status: "completed" },
          );
        }
        throw error;
      }

      acknowledgeServerWrites((kernel) => [
        {
          source: "runs",
          value: kernel.sources.runs.value.filter((candidate) => candidate.id !== id),
        },
        ...(reopenedWorkout === null
          ? []
          : [
              {
                source: "workouts" as const,
                value: replaceById(
                  kernel.sources.workouts.value,
                  reopenedWorkout,
                ).sort((left, right) =>
                  left.scheduledDate.localeCompare(right.scheduledDate),
                ),
              },
            ]),
      ]);
    },
    [acknowledgeServerWrites, requireRepositories, synchronizedSnapshot],
  );

  const value: TrainingDataContextValue = {
    status,
    error: errorFor(synchronization.state),
    profile: synchronizedSnapshot?.profile ?? null,
    plans: synchronizedSnapshot?.plans ?? [],
    workouts: synchronizedSnapshot?.workouts ?? [],
    runs: synchronizedSnapshot?.runs ?? [],
    shoes: synchronizedSnapshot?.shoes ?? [],
    canWrite: status === "current",
    staleReasons:
      synchronization.state.status === "stale"
        ? synchronization.state.reasons
        : [],
    lastServerConfirmedAt:
      "freshness" in synchronization.state
        ? synchronization.state.freshness.lastServerConfirmedAt
        : null,
    reload: startSynchronization,
    saveProfile,
    createShoe,
    retireShoe,
    createRun,
    updateRun,
    deleteRun,
  };

  return (
    <TrainingDataContext.Provider value={value}>
      {children}
    </TrainingDataContext.Provider>
  );
}
