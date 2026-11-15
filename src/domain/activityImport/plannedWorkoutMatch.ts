import { createDateOnly } from "../training/dates.js";
import type {
  CompletedRun,
  PlannedWorkout,
  TrainingPlan,
} from "../training/types.js";

export const IMPORTED_RUN_TARGET_COMPLETION_RATIO = 0.9;

function runLocalDate(run: CompletedRun) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: run.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(run.startedAt));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return createDateOnly(`${values.year}-${values.month}-${values.day}`);
}

export type ImportedRunWorkoutMatchDecision =
  | {
      readonly kind: "matched";
      readonly workout: Exclude<PlannedWorkout, { readonly kind: "rest" }>;
    }
  | {
      readonly kind: "not_matched";
      readonly reason:
        | "active_plan_not_unique"
        | "same_day_workout_not_unique"
        | "target_not_supported"
        | "below_target_tolerance";
    };

function targetIsCompatible(
  run: CompletedRun,
  workout: Exclude<PlannedWorkout, { readonly kind: "rest" }>,
): boolean | null {
  if (workout.targetDistance !== undefined) {
    return (
      run.distance >=
      workout.targetDistance * IMPORTED_RUN_TARGET_COMPLETION_RATIO
    );
  }

  if (workout.targetDuration !== undefined) {
    return (
      run.duration >=
      workout.targetDuration * IMPORTED_RUN_TARGET_COMPLETION_RATIO
    );
  }

  return null;
}

export function selectImportedRunWorkoutMatch(options: {
  readonly run: CompletedRun;
  readonly plans: readonly TrainingPlan[];
  readonly workouts: readonly PlannedWorkout[];
}): ImportedRunWorkoutMatchDecision {
  const activePlans = options.plans.filter(
    (plan) =>
      plan.userId === options.run.userId && plan.status === "active",
  );
  if (activePlans.length !== 1) {
    return { kind: "not_matched", reason: "active_plan_not_unique" };
  }

  const activePlan = activePlans[0];
  const runDate = runLocalDate(options.run);
  const sameDayWorkouts = options.workouts.filter(
    (
      workout,
    ): workout is Exclude<PlannedWorkout, { readonly kind: "rest" }> =>
      workout.userId === options.run.userId &&
      workout.planId === activePlan.id &&
      workout.scheduledDate === runDate &&
      workout.status === "planned" &&
      workout.kind !== "rest",
  );
  if (sameDayWorkouts.length !== 1) {
    return {
      kind: "not_matched",
      reason: "same_day_workout_not_unique",
    };
  }

  const workout = sameDayWorkouts[0];
  const compatible = targetIsCompatible(options.run, workout);
  if (compatible === null) {
    return { kind: "not_matched", reason: "target_not_supported" };
  }
  if (!compatible) {
    return { kind: "not_matched", reason: "below_target_tolerance" };
  }

  return { kind: "matched", workout };
}
