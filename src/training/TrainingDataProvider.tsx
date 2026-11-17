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
  getRunLocalDate,
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
  PlannedWorkoutCommandReferenceV1,
  RunCompletionReceiptResult,
  RunUpdateReceiptResult,
} from "../domain/materialCommands/contract";
import { recordSlowRunDiagnostic } from "../diagnostics/slowRunDiagnostics";
import {
  measureOperation,
  runCreationTimingNames,
  type OperationMeasurement,
} from "../persistence/operationTiming";
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
  RunUpdateClientResult,
  RunUpdateSubmission,
} from "../services/completedRunCommandClient";
import {
  TrainingDataContext,
  type TrainingDataContextValue,
} from "./TrainingDataContext";
import {
  browserPendingRunSaveStore,
  PendingRunSaveError,
  type PendingRunSaveCheckResult,
  type PendingRunSaveStore,
} from "./pendingRunSave";
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

export type CompletedRunCommandClientFactory = () =>
  Promise<CompletedRunCommandClient>;

export type CompletedRunCommandOperation = "complete" | "delete" | "update";

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
  readonly pendingRunSaveStore?: PendingRunSaveStore;
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
    const { firebaseCompletedRunCommandClient } = await import(
      "../services/firebaseCompletedRunCommandClient"
    );
    return firebaseCompletedRunCommandClient;
  };

const defaultCompletedRunCommandId: CompletedRunCommandIdFactory = (
  operation,
) => `run-${operation}-${globalThis.crypto.randomUUID()}`;

type PendingRunCompletion = {
  readonly commandId: string;
  readonly input?: CreateCompletedRunInput;
};

type PendingRunDeletion = {
  readonly prior: CompletedRun;
  readonly submission: RunDeletionSubmission;
};

type PendingRunUpdate = {
  readonly prior: CompletedRun;
  readonly changes: UpdateCompletedRunInput;
  readonly submission: RunUpdateSubmission;
};

type PendingRunConvergence = {
  readonly runId: CompletedRunId;
  readonly plannedWorkout: boolean;
  readonly startedAtMilliseconds: number;
  submission: OperationMeasurement | null;
  listenerDurationMilliseconds: number | null;
  listenerStatus: "confirmed" | "timed_out" | null;
  timeout: ReturnType<typeof setTimeout> | null;
};

function performanceNow(): number {
  try {
    return globalThis.performance?.now() ?? Date.now();
  } catch {
    return Date.now();
  }
}

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
  planId: CreateCompletedRunInput["plannedWorkoutPlanId"] | null,
  workoutId: CreateCompletedRunInput["plannedWorkoutId"] | null,
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

function updatedRun(
  prior: CompletedRun,
  changes: UpdateCompletedRunInput,
  updatedAt: CompletedRun["updatedAt"],
): CompletedRun {
  const imported = prior.importProvider !== undefined;
  const plannedWorkoutPlanId =
    changes.plannedWorkoutPlanId === null
      ? undefined
      : changes.plannedWorkoutPlanId ?? prior.plannedWorkoutPlanId;
  const plannedWorkoutId =
    changes.plannedWorkoutId === null
      ? undefined
      : changes.plannedWorkoutId ?? prior.plannedWorkoutId;
  const shoeId =
    changes.shoeId === null ? undefined : changes.shoeId ?? prior.shoeId;
  const perceivedEffort =
    changes.perceivedEffort === null
      ? undefined
      : changes.perceivedEffort ?? prior.perceivedEffort;
  const unusualPain =
    changes.unusualPain === null
      ? undefined
      : changes.unusualPain ?? prior.unusualPain;
  const notes =
    changes.notes === null ? undefined : changes.notes ?? prior.notes;

  if ((plannedWorkoutPlanId === undefined) !== (plannedWorkoutId === undefined)) {
    throw new Error("Select a complete planned-workout association.");
  }

  return {
    id: prior.id,
    userId: prior.userId,
    ...(plannedWorkoutPlanId === undefined ? {} : { plannedWorkoutPlanId }),
    ...(plannedWorkoutId === undefined ? {} : { plannedWorkoutId }),
    ...(shoeId === undefined ? {} : { shoeId }),
    startedAt: imported ? prior.startedAt : changes.startedAt ?? prior.startedAt,
    timeZone: imported ? prior.timeZone : changes.timeZone ?? prior.timeZone,
    distance: imported ? prior.distance : changes.distance ?? prior.distance,
    duration: imported ? prior.duration : changes.duration ?? prior.duration,
    ...(perceivedEffort === undefined ? {} : { perceivedEffort }),
    ...(unusualPain === undefined ? {} : { unusualPain }),
    ...(notes === undefined ? {} : { notes }),
    ...(prior.importProvider === undefined
      ? {}
      : { importProvider: prior.importProvider }),
    ...(prior.reportedOrigin === undefined
      ? {}
      : { reportedOrigin: prior.reportedOrigin }),
    ...(prior.averageHeartRateBpm === undefined
      ? {}
      : { averageHeartRateBpm: prior.averageHeartRateBpm }),
    ...(prior.maximumHeartRateBpm === undefined
      ? {}
      : { maximumHeartRateBpm: prior.maximumHeartRateBpm }),
    createdAt: prior.createdAt,
    updatedAt,
  };
}

function workoutsFromRunUpdateReceipt(
  workouts: readonly PlannedWorkout[],
  receipt: RunUpdateReceiptResult,
): PlannedWorkout[] {
  return workouts.map((workout) => {
    if (
      receipt.completedPlannedWorkout?.planId === workout.planId &&
      receipt.completedPlannedWorkout.workoutId === workout.id
    ) {
      return {
        ...workout,
        status: "completed",
        updatedAt: receipt.completedPlannedWorkout.updatedAt,
      };
    }

    if (
      receipt.reopenedPlannedWorkout?.planId === workout.planId &&
      receipt.reopenedPlannedWorkout.workoutId === workout.id
    ) {
      return {
        ...workout,
        status: "planned",
        updatedAt: receipt.reopenedPlannedWorkout.updatedAt,
      };
    }

    return workout;
  });
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
  if (result.status === "outcome_unknown") {
    return new PendingRunSaveError();
  }
  return new Error(result.message);
}

function runSaveResolutionIsInconclusive(
  result: RunCompletionClientResult,
): boolean {
  return (
    result.status === "outcome_unknown" ||
    result.status === "retryable_error" ||
    result.status === "authentication_error" ||
    result.status === "authorization_error"
  );
}

function deletionFailure(result: RunDeletionClientResult): Error {
  if (result.status === "run_deleted") {
    return new Error("The run deletion receipt was handled incorrectly.");
  }
  return new Error(result.message);
}

function updateFailure(result: RunUpdateClientResult): Error {
  if (result.status === "run_updated") {
    return new Error("The run update receipt was handled incorrectly.");
  }
  return new Error(result.message);
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
  completedRunCommandClientFactory = defaultCompletedRunCommandClientFactory,
  createCompletedRunCommandId = defaultCompletedRunCommandId,
  pendingRunSaveStore = browserPendingRunSaveStore,
}: TrainingDataProviderProps) {
  const userId = useMemo(() => createUserId(rawUserId), [rawUserId]);
  const initialPendingRunSaveCommandId = useMemo(
    () => pendingRunSaveStore.read(userId),
    [pendingRunSaveStore, userId],
  );
  const repositoryRef = useRef<TrainingRepositories | null>(null);
  const completedRunCommandClientRef =
    useRef<CompletedRunCommandClient | null>(null);
  const pendingRunCompletionRef = useRef<PendingRunCompletion | null>(
    initialPendingRunSaveCommandId === null
      ? null
      : { commandId: initialPendingRunSaveCommandId },
  );
  const [pendingRunSaveCommandId, setPendingRunSaveCommandId] = useState(
    initialPendingRunSaveCommandId,
  );
  const pendingRunDeletionRef = useRef<PendingRunDeletion | null>(null);
  const pendingRunUpdateRef = useRef<PendingRunUpdate | null>(null);
  const pendingRunConvergenceRef = useRef<PendingRunConvergence | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const sessionGenerationRef = useRef(0);
  const [synchronization, setSynchronization] = useState(() =>
    createTrainingSynchronizationKernel({
      ownerId: userId,
      sessionGeneration: 0,
    }),
  );

  const finishRunConvergence = useCallback(
    (pending: PendingRunConvergence) => {
      if (
        pendingRunConvergenceRef.current !== pending ||
        pending.submission === null ||
        pending.listenerStatus === null
      ) {
        return;
      }
      if (pending.timeout !== null) clearTimeout(pending.timeout);
      recordSlowRunDiagnostic({
        submission: pending.submission,
        plannedWorkout: pending.plannedWorkout,
        commandOutcome: "committed",
        listenerConfirmation: {
          durationMilliseconds: pending.listenerDurationMilliseconds,
          status: pending.listenerStatus,
        },
      });
      pendingRunConvergenceRef.current = null;
    },
    [],
  );

  const rememberPendingRunSave = useCallback(
    (commandId: string, input?: CreateCompletedRunInput) => {
      pendingRunCompletionRef.current = { commandId, input };
      pendingRunSaveStore.write(userId, commandId);
    },
    [pendingRunSaveStore, userId],
  );

  const clearPendingRunSave = useCallback(() => {
    pendingRunCompletionRef.current = null;
    pendingRunSaveStore.clear(userId);
    setPendingRunSaveCommandId(null);
  }, [pendingRunSaveStore, userId]);

  const restorePendingRunSave = useCallback(() => {
    const commandId = pendingRunSaveStore.read(userId);
    pendingRunCompletionRef.current =
      commandId === null ? null : { commandId };
    setPendingRunSaveCommandId(commandId);
  }, [pendingRunSaveStore, userId]);

  const startSynchronization = useCallback(async () => {
    const generation = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = generation;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    repositoryRef.current = null;
    completedRunCommandClientRef.current = null;
    restorePendingRunSave();
    pendingRunDeletionRef.current = null;
    pendingRunUpdateRef.current = null;
    const priorConvergence = pendingRunConvergenceRef.current;
    if (priorConvergence?.timeout != null) {
      clearTimeout(priorConvergence.timeout);
    }
    pendingRunConvergenceRef.current = null;
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

        const pending = pendingRunConvergenceRef.current;
        const runs = events.find(
          (event) => event.type === "source_snapshot" && event.source === "runs",
        );
        if (
          pending !== null &&
          runs?.type === "source_snapshot" &&
          runs.source === "runs" &&
          runs.value.some((run) => run.id === pending.runId)
        ) {
          const endedAt = performanceNow();
          pending.listenerDurationMilliseconds = Math.max(
            0,
            endedAt - pending.startedAtMilliseconds,
          );
          pending.listenerStatus = "confirmed";
          try {
            globalThis.performance?.measure(
              runCreationTimingNames.listenerConfirmation,
              {
                start: pending.startedAtMilliseconds,
                end: endedAt,
              },
            );
          } catch {
            // Listener timing must never change synchronization behavior.
          }
          finishRunConvergence(pending);
        }

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
    restorePendingRunSave,
    finishRunConvergence,
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
      pendingRunDeletionRef.current = null;
      pendingRunUpdateRef.current = null;
      const pendingConvergence = pendingRunConvergenceRef.current;
      if (pendingConvergence?.timeout != null) {
        clearTimeout(pendingConvergence.timeout);
      }
      pendingRunConvergenceRef.current = null;
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
  const hasRecoverableSnapshotError =
    synchronization.state.status === "error" &&
    synchronizedSnapshot !== null &&
    synchronization.state.recoverable;
  const status =
    synchronization.state.status === "current"
      ? "current"
      : synchronization.state.status === "stale" ||
          synchronization.state.status === "saving" ||
          hasRecoverableSnapshotError
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

  const checkPendingRunSave = useCallback(async (): Promise<PendingRunSaveCheckResult> => {
    const pending = pendingRunCompletionRef.current;
    if (pending === null) return { status: "none" };

    const result = await requireCompletedRunCommandClient().resolveCompletion(
      pending.commandId,
    );
    if (result.status === "run_completed") {
      clearPendingRunSave();
      return { status: "confirmed" };
    }
    if (runSaveResolutionIsInconclusive(result)) {
      return { status: "still_unconfirmed" };
    }

    clearPendingRunSave();
    return { status: "failed", message: result.message };
  }, [clearPendingRunSave, requireCompletedRunCommandClient]);

  const createRun = useCallback(
    (input: CreateCompletedRunInput) => {
      let commandOutcome: "committed" | "failed" | "outcome_unknown" =
        "failed";
      const convergenceStartedAt = performanceNow();
      const plannedWorkoutSelected =
        input.plannedWorkoutPlanId !== undefined &&
        input.plannedWorkoutId !== undefined;
      const rememberConvergence = (run: CompletedRun) => {
        const alreadyConfirmed =
          synchronizedSnapshot?.runs.some(({ id }) => id === run.id) ?? false;
        pendingRunConvergenceRef.current = {
          runId: run.id,
          plannedWorkout: plannedWorkoutSelected,
          startedAtMilliseconds: convergenceStartedAt,
          submission: null,
          listenerDurationMilliseconds: alreadyConfirmed
            ? Math.max(0, performanceNow() - convergenceStartedAt)
            : null,
          listenerStatus: alreadyConfirmed ? "confirmed" : null,
          timeout: null,
        };
        return run;
      };

      return measureOperation(
        runCreationTimingNames.submissionTotal,
        async () => {
          const commandClient = await measureOperation(
            runCreationTimingNames.commandClientAcquisition,
            async () => requireCompletedRunCommandClient(),
          );
          const pending = pendingRunCompletionRef.current;

          if (pending !== null) {
            const resolved = await commandClient.resolveCompletion(
              pending.commandId,
            );
            if (resolved.status === "run_completed") {
              clearPendingRunSave();
              if (pending.input !== undefined) {
                commandOutcome = "committed";
                return rememberConvergence(
                  completedRunFromReceipt(userId, pending.input, resolved),
                );
              }
              throw new Error(
                "Your earlier run was saved. It will appear in Logged Runs when synchronization finishes.",
              );
            }
            if (!runSaveResolutionIsInconclusive(resolved)) {
              clearPendingRunSave();
              throw completionFailure(resolved);
            }
            throw new PendingRunSaveError();
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
          rememberPendingRunSave(submission.commandId, input);

          let result = await commandClient.submitCompletion(submission);
          if (result.status === "outcome_unknown") {
            result = await commandClient.resolveCompletion(
              submission.commandId,
            );
          }
          if (result.status === "run_completed") {
            clearPendingRunSave();
            commandOutcome = "committed";
            return rememberConvergence(
              completedRunFromReceipt(userId, input, result),
            );
          }
          if (result.status !== "outcome_unknown") {
            clearPendingRunSave();
          } else {
            commandOutcome = "outcome_unknown";
            setPendingRunSaveCommandId(submission.commandId);
          }
          throw completionFailure(result);
        },
        (submission) => {
          const convergence = pendingRunConvergenceRef.current;
          if (commandOutcome === "committed" && convergence !== null) {
            convergence.submission = submission;
            if (convergence.listenerStatus !== null) {
              finishRunConvergence(convergence);
              return;
            }
            convergence.timeout = setTimeout(() => {
              if (pendingRunConvergenceRef.current !== convergence) return;
              convergence.listenerDurationMilliseconds = Math.max(
                0,
                performanceNow() - convergence.startedAtMilliseconds,
              );
              convergence.listenerStatus = "timed_out";
              finishRunConvergence(convergence);
            }, 5_000);
            return;
          }
          recordSlowRunDiagnostic({
            submission,
            plannedWorkout: plannedWorkoutSelected,
            commandOutcome,
          });
        },
      );
    },
    [
      clearPendingRunSave,
      createCompletedRunCommandId,
      finishRunConvergence,
      rememberPendingRunSave,
      requireCompletedRunCommandClient,
      synchronizedSnapshot,
      userId,
    ],
  );

  const acknowledgeRunUpdate = useCallback(
    (run: CompletedRun, receipt: RunUpdateReceiptResult) => {
      acknowledgeServerWrites((kernel) => [
        {
          source: "runs",
          value: replaceById(kernel.sources.runs.value, run).sort((left, right) =>
            right.startedAt.localeCompare(left.startedAt),
          ),
        },
        {
          source: "workouts",
          value: workoutsFromRunUpdateReceipt(
            kernel.sources.workouts.value,
            receipt,
          ),
        },
      ]);
      return run;
    },
    [acknowledgeServerWrites],
  );

  const updateRun = useCallback(
    async (id: CompletedRunId, changes: UpdateCompletedRunInput) => {
      const commandClient = requireCompletedRunCommandClient();
      const pending = pendingRunUpdateRef.current;

      if (pending !== null) {
        const resolved = await commandClient.resolveUpdate(
          pending.submission.commandId,
        );
        if (resolved.status === "run_updated") {
          pendingRunUpdateRef.current = null;
          if (pending.submission.completedRunId === id) {
            return acknowledgeRunUpdate(
              updatedRun(
                pending.prior,
                pending.changes,
                resolved.completedRunUpdatedAt,
              ),
              resolved,
            );
          }
        } else {
          if (resolved.status !== "outcome_unknown") {
            pendingRunUpdateRef.current = null;
          }
          throw updateFailure(resolved);
        }
      }

      const currentSnapshot = synchronizedSnapshot;
      const prior = currentSnapshot?.runs.find((candidate) => candidate.id === id);
      if (currentSnapshot === null || prior === undefined) {
        throw new Error("That run is no longer available.");
      }

      const projected = updatedRun(prior, changes, prior.updatedAt);
      const submission: RunUpdateSubmission = {
        commandId: createCompletedRunCommandId("update"),
        completedRunId: prior.id,
        expectedCompletedRunUpdatedAt: prior.updatedAt,
        input: {
          plannedWorkout: plannedWorkoutReference(
            projected.plannedWorkoutPlanId,
            projected.plannedWorkoutId,
            currentSnapshot,
            "update",
          ),
          shoeId: projected.shoeId,
          startedAt: projected.startedAt,
          timeZone: projected.timeZone,
          distance: projected.distance,
          duration: projected.duration,
          perceivedEffort: projected.perceivedEffort,
          unusualPain: projected.unusualPain,
          notes: projected.notes,
        },
      };
      pendingRunUpdateRef.current = { prior, changes, submission };

      let result = await commandClient.submitUpdate(submission);
      if (result.status === "outcome_unknown") {
        result = await commandClient.resolveUpdate(submission.commandId);
      }
      if (result.status === "run_updated") {
        pendingRunUpdateRef.current = null;
        return acknowledgeRunUpdate(
          updatedRun(prior, changes, result.completedRunUpdatedAt),
          result,
        );
      }
      if (result.status !== "outcome_unknown") {
        pendingRunUpdateRef.current = null;
      }
      throw updateFailure(result);
    },
    [
      acknowledgeRunUpdate,
      createCompletedRunCommandId,
      requireCompletedRunCommandClient,
      synchronizedSnapshot,
    ],
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
          throw new Error(
            `Marathoner finished deleting the previously confirmed run from ${getRunLocalDate(pending.prior)}. Review your updated run history, then confirm any other deletion separately.`,
          );
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

      if (currentSnapshot === null || run === undefined) return;

      const submission: RunDeletionSubmission = {
        commandId: createCompletedRunCommandId("delete"),
        completedRunId: run.id,
        expectedCompletedRunUpdatedAt: run.updatedAt,
        plannedWorkout: plannedWorkoutReference(
          run.plannedWorkoutPlanId,
          run.plannedWorkoutId,
          currentSnapshot,
          "delete",
        ),
      };
      pendingRunDeletionRef.current = { prior: run, submission };

      let result = await commandClient.submitDeletion(submission);
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
    activePlanState: synchronizedSnapshot?.activePlanState ?? null,
    plans: synchronizedSnapshot?.plans ?? [],
    workouts: synchronizedSnapshot?.workouts ?? [],
    runs: synchronizedSnapshot?.runs ?? [],
    shoes: synchronizedSnapshot?.shoes ?? [],
    canWrite: status === "current",
    staleReasons:
      synchronization.state.status === "stale"
        ? synchronization.state.reasons
        : hasRecoverableSnapshotError
          ? ["reconnecting"]
          : [],
    lastServerConfirmedAt:
      "freshness" in synchronization.state
        ? synchronization.state.freshness.lastServerConfirmedAt
        : null,
    hasPendingRunSave: pendingRunSaveCommandId !== null,
    reload: startSynchronization,
    checkPendingRunSave,
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
