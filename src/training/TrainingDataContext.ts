import { createContext } from "react";
import type {
  CompletedRun,
  CompletedRunId,
  DateOnly,
  PlannedWorkout,
  Shoe,
  ShoeId,
  TrainingPlan,
  UserProfile,
} from "../domain/training";
import type {
  CreateCompletedRunInput,
  CreateShoeInput,
  SaveUserProfileInput,
  UpdateCompletedRunInput,
} from "../persistence/trainingRepositories";

export type TrainingDataStatus = "loading" | "ready" | "error";

export interface TrainingDataContextValue {
  readonly status: TrainingDataStatus;
  readonly error: string | null;
  readonly profile: UserProfile | null;
  readonly plans: TrainingPlan[];
  readonly workouts: PlannedWorkout[];
  readonly runs: CompletedRun[];
  readonly shoes: Shoe[];
  readonly reload: () => Promise<void>;
  readonly saveProfile: (input: SaveUserProfileInput) => Promise<UserProfile>;
  readonly createShoe: (input: CreateShoeInput) => Promise<Shoe>;
  readonly retireShoe: (id: ShoeId, retiredOn: DateOnly) => Promise<Shoe>;
  readonly createRun: (input: CreateCompletedRunInput) => Promise<CompletedRun>;
  readonly updateRun: (
    id: CompletedRunId,
    changes: UpdateCompletedRunInput,
  ) => Promise<CompletedRun>;
  readonly deleteRun: (id: CompletedRunId) => Promise<void>;
}

export const TrainingDataContext = createContext<
  TrainingDataContextValue | undefined
>(undefined);
