import type { DateOnly, IanaTimeZone, UtcDateTime } from "./dates.js";
import type {
  CompletedRunId,
  PlannedWorkoutId,
  ShoeId,
  TrainingPlanId,
  UserId,
} from "./identifiers.js";
import type { DistanceMeters, DistanceUnit, DurationSeconds } from "./units.js";

export interface EntityTimestamps {
  readonly createdAt: UtcDateTime;
  readonly updatedAt: UtcDateTime;
}

export type RunningExperienceLevel =
  | "not_running"
  | "inconsistent"
  | "returning"
  | "consistent";

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type CompletionGoal = "complete_first_marathon";

export type TargetRaceTiming =
  | {
      readonly kind: "date";
      readonly date: DateOnly;
    }
  | {
      readonly kind: "window";
      readonly startDate: DateOnly;
      readonly endDate: DateOnly;
    };

export interface RecentRunPerformance {
  readonly completedOn: DateOnly;
  readonly distance: DistanceMeters;
  readonly duration: DurationSeconds;
}

export interface UserProfile extends EntityTimestamps {
  readonly id: UserId;
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

export type TrainingPlanStatus = "draft" | "active" | "completed" | "archived";

export interface TrainingPlan extends EntityTimestamps {
  readonly id: TrainingPlanId;
  readonly userId: UserId;
  readonly name: string;
  readonly startDate: DateOnly;
  readonly targetRaceDate: DateOnly;
  readonly endDate?: DateOnly;
  readonly completionGoal?: CompletionGoal;
  readonly status: TrainingPlanStatus;
}

export type TrainingPhase =
  | "learn_to_run"
  | "base_building"
  | "marathon_training"
  | "race_preparation"
  | "recovery";

export type WorkoutStatus = "planned" | "completed" | "skipped";
export type RunPurpose = "easy" | "recovery" | "long" | "tempo" | "intervals" | "race";

interface PlannedWorkoutBase extends EntityTimestamps {
  readonly id: PlannedWorkoutId;
  readonly userId: UserId;
  readonly planId: TrainingPlanId;
  readonly scheduledDate: DateOnly;
  readonly phase: TrainingPhase;
  readonly status: WorkoutStatus;
  readonly notes?: string;
}

export interface RestWorkout extends PlannedWorkoutBase {
  readonly kind: "rest";
}

export interface RunWorkout extends PlannedWorkoutBase {
  readonly kind: "run";
  readonly purpose: RunPurpose;
  readonly targetDistance?: DistanceMeters;
  readonly targetDuration?: DurationSeconds;
}

export interface WalkRunWorkout extends PlannedWorkoutBase {
  readonly kind: "walk_run";
  readonly targetDistance?: DistanceMeters;
  readonly targetDuration?: DurationSeconds;
}

export type PlannedWorkout = RestWorkout | RunWorkout | WalkRunWorkout;

export type PerceivedEffort =
  | "much_easier_than_expected"
  | "easier_than_expected"
  | "about_right"
  | "harder_than_expected"
  | "much_harder_than_expected";

export interface CompletedRun extends EntityTimestamps {
  readonly id: CompletedRunId;
  readonly userId: UserId;
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

export type ShoeStatus = "active" | "retired";

export interface Shoe extends EntityTimestamps {
  readonly id: ShoeId;
  readonly userId: UserId;
  readonly name: string;
  readonly startingDistance: DistanceMeters;
  readonly status: ShoeStatus;
  readonly retiredOn?: DateOnly;
}
