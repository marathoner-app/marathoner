import type {
  CompletedRun,
  CompletedRunId,
  CompletionGoal,
  DateOnly,
  DistanceMeters,
  DistanceUnit,
  DurationSeconds,
  IanaTimeZone,
  PerceivedEffort,
  PlannedWorkout,
  PlannedWorkoutId,
  RecentRunPerformance,
  RunPurpose,
  RunningExperienceLevel,
  Shoe,
  ShoeId,
  ShoeStatus,
  TargetRaceTiming,
  TrainingPhase,
  TrainingPlan,
  TrainingPlanId,
  TrainingPlanStatus,
  UserProfile,
  UtcDateTime,
  Weekday,
  WorkoutStatus,
} from "../domain/training";

export interface SaveUserProfileInput {
  readonly displayName?: string;
  readonly preferredDistanceUnit: DistanceUnit;
  readonly timeZone: IanaTimeZone;
  readonly experienceLevel?: RunningExperienceLevel;
  readonly targetRace?: TargetRaceTiming;
  readonly currentWeeklyDistance?: DistanceMeters;
  readonly currentRunningFrequencyDaysPerWeek?: number;
  readonly longestRecentRunDistance?: DistanceMeters;
  readonly recentPerformance?: RecentRunPerformance;
  readonly availableTrainingDays?: readonly Weekday[];
  readonly preferredLongRunDay?: Weekday;
  readonly scheduleConstraints?: string;
  readonly completionGoal?: CompletionGoal;
}

export interface CreateTrainingPlanInput {
  readonly name: string;
  readonly startDate: DateOnly;
  readonly targetRaceDate: DateOnly;
}

export interface UpdateTrainingPlanInput {
  readonly name?: string;
  readonly startDate?: DateOnly;
  readonly targetRaceDate?: DateOnly;
  readonly status?: TrainingPlanStatus;
}

interface CreatePlannedWorkoutBase {
  readonly planId: TrainingPlanId;
  readonly scheduledDate: DateOnly;
  readonly phase: TrainingPhase;
  readonly notes?: string;
}

export interface CreateRestWorkoutInput extends CreatePlannedWorkoutBase {
  readonly kind: "rest";
}

export interface CreateRunWorkoutInput extends CreatePlannedWorkoutBase {
  readonly kind: "run";
  readonly purpose: RunPurpose;
  readonly targetDistance?: DistanceMeters;
  readonly targetDuration?: DurationSeconds;
}

export interface CreateWalkRunWorkoutInput extends CreatePlannedWorkoutBase {
  readonly kind: "walk_run";
  readonly targetDistance?: DistanceMeters;
  readonly targetDuration?: DurationSeconds;
}

export type CreatePlannedWorkoutInput =
  | CreateRestWorkoutInput
  | CreateRunWorkoutInput
  | CreateWalkRunWorkoutInput;

export interface UpdatePlannedWorkoutInput {
  readonly scheduledDate?: DateOnly;
  readonly phase?: TrainingPhase;
  readonly status?: WorkoutStatus;
  readonly notes?: string | null;
  readonly purpose?: RunPurpose;
  readonly targetDistance?: DistanceMeters | null;
  readonly targetDuration?: DurationSeconds | null;
}

export interface CreateCompletedRunInput {
  readonly plannedWorkoutPlanId?: TrainingPlanId;
  readonly plannedWorkoutId?: PlannedWorkoutId;
  readonly shoeId?: ShoeId;
  readonly startedAt: UtcDateTime;
  readonly timeZone: IanaTimeZone;
  readonly distance: DistanceMeters;
  readonly duration: DurationSeconds;
  readonly perceivedEffort?: PerceivedEffort;
  readonly unusualPain?: boolean;
  readonly notes?: string;
}

export interface UpdateCompletedRunInput {
  readonly plannedWorkoutPlanId?: TrainingPlanId | null;
  readonly plannedWorkoutId?: PlannedWorkoutId | null;
  readonly shoeId?: ShoeId | null;
  readonly startedAt?: UtcDateTime;
  readonly timeZone?: IanaTimeZone;
  readonly distance?: DistanceMeters;
  readonly duration?: DurationSeconds;
  readonly perceivedEffort?: PerceivedEffort | null;
  readonly unusualPain?: boolean | null;
  readonly notes?: string | null;
}

export interface CreateShoeInput {
  readonly name: string;
  readonly startingDistance?: DistanceMeters;
}

export interface UpdateShoeInput {
  readonly name?: string;
  readonly startingDistance?: DistanceMeters;
  readonly status?: ShoeStatus;
  readonly retiredOn?: DateOnly | null;
}

export interface TrainingPlanRepository {
  create(input: CreateTrainingPlanInput): Promise<TrainingPlan>;
  get(id: TrainingPlanId): Promise<TrainingPlan | null>;
  list(): Promise<TrainingPlan[]>;
  update(id: TrainingPlanId, changes: UpdateTrainingPlanInput): Promise<TrainingPlan>;
  archive(id: TrainingPlanId): Promise<TrainingPlan>;
  permanentlyDelete(id: TrainingPlanId): Promise<void>;
}

export interface PlannedWorkoutRepository {
  create(input: CreatePlannedWorkoutInput): Promise<PlannedWorkout>;
  get(planId: TrainingPlanId, id: PlannedWorkoutId): Promise<PlannedWorkout | null>;
  listForPlan(planId: TrainingPlanId): Promise<PlannedWorkout[]>;
  update(
    planId: TrainingPlanId,
    id: PlannedWorkoutId,
    changes: UpdatePlannedWorkoutInput,
  ): Promise<PlannedWorkout>;
  delete(planId: TrainingPlanId, id: PlannedWorkoutId): Promise<void>;
}

export interface CompletedRunRepository {
  create(input: CreateCompletedRunInput): Promise<CompletedRun>;
  get(id: CompletedRunId): Promise<CompletedRun | null>;
  list(): Promise<CompletedRun[]>;
  update(id: CompletedRunId, changes: UpdateCompletedRunInput): Promise<CompletedRun>;
  delete(id: CompletedRunId): Promise<void>;
}

export interface ShoeRepository {
  create(input: CreateShoeInput): Promise<Shoe>;
  get(id: ShoeId): Promise<Shoe | null>;
  list(): Promise<Shoe[]>;
  update(id: ShoeId, changes: UpdateShoeInput): Promise<Shoe>;
  retire(id: ShoeId, retiredOn: DateOnly): Promise<Shoe>;
  permanentlyDelete(id: ShoeId): Promise<void>;
}

export interface UserProfileRepository {
  load(): Promise<UserProfile | null>;
  save(input: SaveUserProfileInput): Promise<UserProfile>;
}

export interface TrainingRepositories {
  readonly profile: UserProfileRepository;
  readonly plans: TrainingPlanRepository;
  readonly workouts: PlannedWorkoutRepository;
  readonly runs: CompletedRunRepository;
  readonly shoes: ShoeRepository;
}
