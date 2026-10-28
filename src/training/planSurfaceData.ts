import type {
  GeneratedPlanEntityProjection,
  PlannedWorkout,
  TrainingPlan,
} from "../domain/training";

export interface PlanSurfaceData {
  readonly activePlan: TrainingPlan | null;
  readonly workouts: readonly PlannedWorkout[];
}

interface ResolvePlanSurfaceDataOptions {
  readonly sessionProjection: GeneratedPlanEntityProjection | null;
  readonly synchronizedPlan: TrainingPlan | null;
  readonly synchronizedWorkouts: readonly PlannedWorkout[];
}

export function resolvePlanSurfaceData({
  sessionProjection,
  synchronizedPlan,
  synchronizedWorkouts,
}: ResolvePlanSurfaceDataOptions): PlanSurfaceData {
  if (sessionProjection !== null) {
    return {
      activePlan: sessionProjection.plan,
      workouts: sessionProjection.workouts,
    };
  }

  return {
    activePlan: synchronizedPlan,
    workouts: synchronizedWorkouts,
  };
}
