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
  type CompletedRun,
  type CompletedRunId,
  type DateOnly,
  type ShoeId,
  type UserId,
} from "../domain/training";
import type {
  PlannedWorkoutCommandReferenceV1,
  RunCompletionReceiptResult,
} from "../domain/materialCommands/contract";
import type {
  CreateCompletedRunInput,
  CreateShoeInput,
  SaveUserProfileInput,
  TrainingRepositories,
  UpdateCompletedRunInput,
} from "../persistence/trainingRepositories";
import type {
  CompletedRunCommandClient,
  RunCompletionClientResult,
  RunCompletionSubmission,
  RunDeletionClientResult,
  RunDeletionSubmission,
} from "../services/completedRunCommandClient";
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

export type CompletedRunCommandClientFactory = () =>
  Promise<CompletedRunCommandClient>;

export type CompletedRunCommandOperation = "complete" | "delete";

export type CompletedRunCommandIdFactory = (
  operation: CompletedRunCommandOperation,
) => string;

type TrainingDataProviderProps = {
  readonly userId: string;
  readonly children: ReactNode;
  readonly repositoryFactory?: TrainingRepositoryFactory;
  readonly liveReadSourceFactory?: TrainingLiveReadSourceFactory;
  readonly completedRunCommandClientFactory?: CompletedRunCommandClientFactory;
  readonly createCompletedRunCommandId?: CompletedRunCommandIdFactory;
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

const defaultCompletedRunCommandClientFactory: CompletedRunCommandClientFactory =
  async () => {
    const { completedRunCommandClient } = await import(
      "../services/firebaseMaterialCommandClient"
    );
    return completedRunCommandClient;
  };

const defaultCompletedRunCommandId: CompletedRunCommandIdFactory = (
  operation,
) => `run-${operation}-${globalThis.crypto.randomUUID()}`;

type PendingRunCompletion = {
  readonly input: CreateCompletedRunInput;
  readonly submission: RunCompletionSubmission;
};

type PendingRunDeletion = {
  readonly submission: RunDeletionSubmission;
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

function plannedWorkoutReference(
  planId: CreateCompletedRunInput["plannedWorkoutPlanId"],
  workoutId: CreateCompletedRunInput["plannedWorkoutId"],
  snapshot: SynchronizedTrainingSnapshot | null,
  operation: CompletedRunCommandOperation,
): PlannedWorkoutCommandReferenceV1 | null {
  if (planId === undefined && workoutId === undefined) return null;
  if (planId === undefined || workoutId === undefined) {
    throw new Error("Select a complete planned-workout association.");
  }

  const workout = snapshot?.workouts.find(
    (candidate) => candidate.planId === planId && candidate.id === workoutId,
  );

  if (workout === undefined) {
    throw new Error("That planned workout is no longer available.");
  }
  if (workout.kind === "rest") {
    throw new Error("A completed run cannot be attached to a rest day.");
  }
  if (operation === "complete" && workout.status === "completed") {
    throw new Error("That planned workout already has a completion record.");
  }

  return {
    planId: workout.planId,
    workoutId: workout.id,
    expectedUpdatedAt: workout.updatedAt,
  };
}

function completedRunFromReceipt(
  userId: UserId,
  input: CreateCompletedRunInput,
  receipt: RunCompletionReceiptResult,
): CompletedRun {
  return {
    ...input,
    id: receipt.completedRunId,
    userId,
    createdAt: receipt.completedRunUpdatedAt,
    updatedAt: receipt.completedRunUpdatedAt,
  };
}

function completionFailure(result: RunCompletionClientResult): Error {
  if (result.status === "run_completed") {
    return new Error("The completed run receipt was handled incorrectly.");
  }
  return new Error(result.message);
}

function deletionFailure(result: RunDeletionClientResult): Error {
  if (result.status === "run_deleted") {
    return new Error("The run deletion receipt was handled incorrectly.");
  }
  return new Error(result.message);
}

export default function TrainingDataProvider({
  userId: rawUserId,
  children,
  repositoryFactory = defaultRepositoryFactory,
  liveReadSourceFactory = defaultLiveReadSourceFactory,
  completedRunCommandClientFactory = defaultCompletedRunCommandClientFactory,
  createCompletedRunCommandId = defaultCompletedRunCommandId,
}: TrainingDataProviderProps) {
  const userId = useMemo(() => createUserId(rawUserId), [rawUserId]);
  const repositoryRef = useRef<TrainingRepositories | null>(null);
  const completedRunCommandClientRef =
    useRef<CompletedRunCommandClient | null>(null);
  const pendingRunCompletionRef = useRef<PendingRunCompletion | null>(null);
  const pendingRunDeletionRef = useRef<PendingRunDeletion | null>(null);
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
    completedRunCommandClientRef.current = null;
    pendingRunCompletionRef.current = null;
    pendingRunDeletionRef.current = null;
    setSynchronization(
      createTrainingSynchronizationKernel({
        ownerId: userId,
        sessionGeneration: generation,
      }),
    );

    try {
      const [repositories, source, completedRunCommandClient] = await Promise.all([
        repositoryFactory(userId),
        liveReadSourceFactory(userId, generation),
        completedRunCommandClientFactory(),
      ]);

      if (generation !== sessionGenerationRef.current) return;

      repositoryRef.current = repositories;
      completedRunCommandClientRef.current = completedRunCommandClient;
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
      completedRunCommandClientRef.current = null;
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
  }, [
    completedRunCommandClientFactory,
    liveReadSourceFactory,
    repositoryFactory,
    userId,
  ]);

  useEffect(() => {
    void startSynchronization();

    return () => {
      sessionGenerationRef.current += 1;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      repositoryRef.current = null;
      completedRunCommandClientRef.current = null;
      pendingRunCompletionRef.current = null;
      pendingRunDeletionRef.current = null;
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

  const requireCompletedRunCommandClient = useCallback(() => {
    if (synchronization.state.status !== "current") {
      throw new Error("Training data is not current. Reconnect and try again.");
    }

    if (completedRunCommandClientRef.current === null) {
      throw new Error("Run commands are still loading. Please try again.");
    }

    return completedRunCommandClientRef.current;
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
      const commandClient = requireCompletedRunCommandClient();
      const pending = pendingRunCompletionRef.current;

      if (pending !== null) {
        const resolved = await commandClient.resolveCompletion(
          pending.submission.commandId,
        );
        if (resolved.status === "run_completed") {
          pendingRunCompletionRef.current = null;
          return completedRunFromReceipt(userId, pending.input, resolved);
        }
        if (resolved.status !== "outcome_unknown") {
          pendingRunCompletionRef.current = null;
        }
        throw completionFailure(resolved);
      }

      const plannedWorkout = plannedWorkoutReference(
        input.plannedWorkoutPlanId,
        input.plannedWorkoutId,
        synchronizedSnapshot,
        "complete",
      );
      const submission: RunCompletionSubmission = {
        commandId: createCompletedRunCommandId("complete"),
        input: {
          plannedWorkout,
          shoeId: input.shoeId,
          startedAt: input.startedAt,
          timeZone: input.timeZone,
          distance: input.distance,
          duration: input.duration,
          perceivedEffort: input.perceivedEffort,
          unusualPain: input.unusualPain,
          notes: input.notes,
        },
      };
      pendingRunCompletionRef.current = { input, submission };

      let result: RunCompletionClientResult;
      try {
        result = await commandClient.submitCompletion(submission);
      } catch (error) {
        pendingRunCompletionRef.current = null;
        throw error;
      }
      if (result.status === "outcome_unknown") {
        result = await commandClient.resolveCompletion(submission.commandId);
      }
      if (result.status === "run_completed") {
        pendingRunCompletionRef.current = null;
        return completedRunFromReceipt(userId, input, result);
      }
      if (result.status !== "outcome_unknown") {
        pendingRunCompletionRef.current = null;
      }
      throw completionFailure(result);
    },
    [
      createCompletedRunCommandId,
      requireCompletedRunCommandClient,
      synchronizedSnapshot,
      userId,
    ],
  );

  const updateRun = useCallback(
    async (id: CompletedRunId, changes: UpdateCompletedRunInput) => {
      return requireRepositories().runs.update(id, changes);
    },
    [requireRepositories],
  );

  const deleteRun = useCallback(
    async (id: CompletedRunId) => {
      const commandClient = requireCompletedRunCommandClient();
      const pending = pendingRunDeletionRef.current;

      if (pending !== null) {
        const resolved = await commandClient.resolveDeletion(
          pending.submission.commandId,
        );
        if (resolved.status === "run_deleted") {
          pendingRunDeletionRef.current = null;
          if (pending.submission.completedRunId === id) return;
        } else {
          if (resolved.status !== "outcome_unknown") {
            pendingRunDeletionRef.current = null;
          }
          throw deletionFailure(resolved);
        }
      }

      const currentSnapshot = synchronizedSnapshot;
      const run = currentSnapshot?.runs.find(
        (candidate) => candidate.id === id,
      );

      if (currentSnapshot === null || run === undefined) {
        return;
      }

      const plannedWorkout = plannedWorkoutReference(
        run.plannedWorkoutPlanId,
        run.plannedWorkoutId,
        currentSnapshot,
        "delete",
      );
      const submission: RunDeletionSubmission = {
        commandId: createCompletedRunCommandId("delete"),
        completedRunId: run.id,
        expectedCompletedRunUpdatedAt: run.updatedAt,
        plannedWorkout,
      };
      pendingRunDeletionRef.current = { submission };

      let result: RunDeletionClientResult;
      try {
        result = await commandClient.submitDeletion(submission);
      } catch (error) {
        pendingRunDeletionRef.current = null;
        throw error;
      }
      if (result.status === "outcome_unknown") {
        result = await commandClient.resolveDeletion(submission.commandId);
      }
      if (result.status === "run_deleted") {
        pendingRunDeletionRef.current = null;
        return;
      }
      if (result.status !== "outcome_unknown") {
        pendingRunDeletionRef.current = null;
      }
      throw deletionFailure(result);
    },
    [
      createCompletedRunCommandId,
      requireCompletedRunCommandClient,
      synchronizedSnapshot,
    ],
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
