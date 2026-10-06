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
  type PlannedWorkout,
  type Shoe,
  type TrainingPlan,
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
  type TrainingDataStatus,
} from "./TrainingDataContext";

export type TrainingRepositoryFactory = (
  userId: UserId,
) => Promise<TrainingRepositories>;

type TrainingDataProviderProps = {
  readonly userId: string;
  readonly children: ReactNode;
  readonly repositoryFactory?: TrainingRepositoryFactory;
};

interface TrainingSnapshot {
  readonly status: TrainingDataStatus;
  readonly error: string | null;
  readonly profile: UserProfile | null;
  readonly plans: TrainingPlan[];
  readonly workouts: PlannedWorkout[];
  readonly runs: CompletedRun[];
  readonly shoes: Shoe[];
}

const emptySnapshot: TrainingSnapshot = {
  status: "loading",
  error: null,
  profile: null,
  plans: [],
  workouts: [],
  runs: [],
  shoes: [],
};

const defaultRepositoryFactory: TrainingRepositoryFactory = async (userId) => {
  const { createFirestoreTrainingRepositories } = await import(
    "../persistence/firestore"
  );
  return createFirestoreTrainingRepositories(userId);
};

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Your training data could not be loaded. Please try again.";
}

export default function TrainingDataProvider({
  userId: rawUserId,
  children,
  repositoryFactory = defaultRepositoryFactory,
}: TrainingDataProviderProps) {
  const userId = useMemo(() => createUserId(rawUserId), [rawUserId]);
  const repositoryRef = useRef<TrainingRepositories | null>(null);
  const loadGenerationRef = useRef(0);
  const [snapshot, setSnapshot] = useState<TrainingSnapshot>(emptySnapshot);

  const load = useCallback(async () => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    setSnapshot((current) => ({ ...current, status: "loading", error: null }));

    try {
      const repositories = await repositoryFactory(userId);
      const [profile, plans, runs, shoes] = await Promise.all([
        repositories.profile.load(),
        repositories.plans.list(),
        repositories.runs.list(),
        repositories.shoes.list(),
      ]);
      const workouts = (
        await Promise.all(
          plans.map((plan) => repositories.workouts.listForPlan(plan.id)),
        )
      ).flat();

      if (generation !== loadGenerationRef.current) return;

      repositoryRef.current = repositories;
      setSnapshot({
        status: "ready",
        error: null,
        profile,
        plans,
        workouts,
        runs,
        shoes,
      });
    } catch (error) {
      if (generation !== loadGenerationRef.current) return;

      repositoryRef.current = null;
      setSnapshot((current) => ({
        ...current,
        status: "error",
        error: messageFor(error),
      }));
    }
  }, [repositoryFactory, userId]);

  useEffect(() => {
    void load();

    return () => {
      loadGenerationRef.current += 1;
      repositoryRef.current = null;
    };
  }, [load]);

  const requireRepositories = useCallback(() => {
    if (repositoryRef.current === null) {
      throw new Error("Training data is still loading. Please try again.");
    }

    return repositoryRef.current;
  }, []);

  const createShoe = useCallback(
    async (input: CreateShoeInput) => {
      const shoe = await requireRepositories().shoes.create(input);
      setSnapshot((current) => ({
        ...current,
        shoes: [...current.shoes, shoe].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      }));
      return shoe;
    },
    [requireRepositories],
  );

  const saveProfile = useCallback(
    async (input: SaveUserProfileInput) => {
      const profile = await requireRepositories().profile.save(input);
      setSnapshot((current) => ({ ...current, profile }));
      return profile;
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
          : snapshot.workouts.find(
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

      setSnapshot((current) => ({
        ...current,
        runs: [run, ...current.runs],
        workouts:
          completedWorkout === null
            ? current.workouts
            : current.workouts.map((workout) =>
                workout.planId === completedWorkout.planId &&
                workout.id === completedWorkout.id
                  ? completedWorkout
                  : workout,
              ),
      }));
      return run;
    },
    [requireRepositories, snapshot.workouts],
  );

  const updateRun = useCallback(
    async (id: CompletedRunId, changes: UpdateCompletedRunInput) => {
      const updated = await requireRepositories().runs.update(id, changes);
      setSnapshot((current) => ({
        ...current,
        runs: current.runs
          .map((run) => (run.id === updated.id ? updated : run))
          .sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
      }));
      return updated;
    },
    [requireRepositories],
  );

  const deleteRun = useCallback(
    async (id: CompletedRunId) => {
      const repositories = requireRepositories();
      const run = snapshot.runs.find((candidate) => candidate.id === id);

      if (run === undefined) {
        return;
      }

      const hasAnotherCompletion = snapshot.runs.some(
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

      setSnapshot((current) => ({
        ...current,
        runs: current.runs.filter((candidate) => candidate.id !== id),
        workouts:
          reopenedWorkout === null
            ? current.workouts
            : current.workouts.map((workout) =>
                workout.planId === reopenedWorkout.planId &&
                workout.id === reopenedWorkout.id
                  ? reopenedWorkout
                  : workout,
              ),
      }));
    },
    [requireRepositories, snapshot.runs],
  );

  const value: TrainingDataContextValue = {
    ...snapshot,
    reload: load,
    saveProfile,
    createShoe,
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
