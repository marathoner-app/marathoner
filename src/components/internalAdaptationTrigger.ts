import type { InternalAdaptationRecommendationCommand } from "../domain/recommendations/internalAdaptationRecommendation";
import type {
  ActivePlanState,
  CompletedRun,
  PlannedWorkout,
} from "../domain/training/types";

export interface InternalAdaptationTrigger {
  readonly workoutId: InternalAdaptationRecommendationCommand["triggerWorkoutId"];
  readonly evaluationDate: InternalAdaptationRecommendationCommand["evaluationDate"];
}

export function selectInternalAdaptationTrigger(
  activePlanState: ActivePlanState | null,
  workouts: readonly PlannedWorkout[],
  runs: readonly CompletedRun[],
): InternalAdaptationTrigger | null {
  if (activePlanState === null) return null;

  const completedWorkoutIds = new Set(
    runs
      .filter(
        (run) =>
          run.userId === activePlanState.userId &&
          run.plannedWorkoutPlanId === activePlanState.activePlanId &&
          run.plannedWorkoutId !== undefined,
      )
      .map((run) => run.plannedWorkoutId!),
  );
  const trigger = workouts
    .filter(
      (workout) =>
        workout.planId === activePlanState.activePlanId &&
        workout.userId === activePlanState.userId &&
        workout.kind !== "rest" &&
        workout.status === "completed" &&
        completedWorkoutIds.has(workout.id),
    )
    .sort(
      (left, right) =>
        right.scheduledDate.localeCompare(left.scheduledDate) ||
        right.id.localeCompare(left.id),
    )[0];

  return trigger === undefined
    ? null
    : {
        workoutId: trigger.id,
        evaluationDate: trigger.scheduledDate,
      };
}
