import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUserId,
  type CompletedRunId,
  type DateOnly,
  type PlannedWorkout,
  type ShoeId,
  type UserId,
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
      return requireRepositories().shoes.create(input);
    },
    [requireRepositories],
  );

  const retireShoe = useCallback(
    async (id: ShoeId, retiredOn: DateOnly) => {
      return requireRepositories().shoes.retire(id, retiredOn);
    },
    [requireRepositories],
  );

  const saveProfile = useCallback(
    async (input: SaveUserProfileInput) => {
      return requireRepositories().profile.save(input);
    },
    [requireRepositories],
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

      if (
        run.plannedWorkoutPlanId !== undefined &&
        run.plannedWorkoutId !== undefined
      ) {
        try {
          await repositories.workouts.update(
            run.plannedWorkoutPlanId,
            run.plannedWorkoutId,
            { status: "completed" },
          );
        } catch (error) {
          await repositories.runs.delete(run.id);
          throw error;
        }
      }

      return run;
    },
    [requireRepositories, synchronizedSnapshot?.workouts],
  );

  const updateRun = useCallback(
    async (id: CompletedRunId, changes: UpdateCompletedRunInput) => {
      return requireRepositories().runs.update(id, changes);
    },
    [requireRepositories],
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
    },
    [requireRepositories, synchronizedSnapshot],
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
