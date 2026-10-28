import {
  getRunLocalDate,
  normalizeAdaptationHistory,
  type ActivePlanState,
  type AdaptationHistoryNormalizationResult,
  type CompletedRun,
  type GeneratedPlanEntityProjection,
  type PlannedWorkout,
  type PlannedWorkoutId,
  type UtcDateTime,
} from "../domain/training";
import { evidenceWeekContaining } from "./internalAdaptationHistoryWeek";

export interface InternalSessionDraftAdaptationAssembly {
  readonly activePlanState: ActivePlanState;
  readonly plan: GeneratedPlanEntityProjection["plan"];
  readonly workouts: readonly PlannedWorkout[];
  readonly runs: readonly CompletedRun[];
  readonly normalization: AdaptationHistoryNormalizationResult;
}

interface AssembleInternalSessionDraftAdaptationRequest {
  readonly projection: GeneratedPlanEntityProjection;
  readonly workoutId: PlannedWorkoutId;
  readonly run: CompletedRun;
  readonly confirmedAt: UtcDateTime;
}

/**
 * Builds owner-confirmed adaptation evidence without mutating synchronized data.
 *
 * The returned entities are transient copies used only by the internal rehearsal.
 */
export function assembleInternalSessionDraftAdaptation({
  projection,
  workoutId,
  run,
  confirmedAt,
}: AssembleInternalSessionDraftAdaptationRequest): InternalSessionDraftAdaptationAssembly | null {
  const selectedWorkout = projection.workouts.find(
    (workout) => workout.id === workoutId,
  );

  if (
    selectedWorkout === undefined ||
    selectedWorkout.kind === "rest" ||
    run.userId !== projection.plan.userId ||
    getRunLocalDate(run) !== selectedWorkout.scheduledDate
  ) {
    return null;
  }

  const transientWorkouts = projection.workouts.map((workout) =>
    workout.id === selectedWorkout.id
      ? { ...workout, status: "completed" as const, updatedAt: confirmedAt }
      : workout,
  );
  const transientRun: CompletedRun = {
    ...run,
    plannedWorkoutPlanId: projection.plan.id,
    plannedWorkoutId: selectedWorkout.id,
    updatedAt: confirmedAt,
  };
  const activePlanState: ActivePlanState = {
    userId: projection.plan.userId,
    activePlanId: projection.plan.id,
    activePlanRevision: 1,
    approvedAt: projection.plan.createdAt,
    updatedAt: confirmedAt,
  };
  const evidenceWeek = evidenceWeekContaining(selectedWorkout.scheduledDate);

  return {
    activePlanState,
    plan: projection.plan,
    workouts: transientWorkouts,
    runs: [transientRun],
    normalization: normalizeAdaptationHistory({
      ownerId: projection.plan.userId,
      activePlanState,
      plans: [projection.plan],
      workouts: transientWorkouts,
      runs: [transientRun],
      evaluationDate: selectedWorkout.scheduledDate,
      currentWeekStartDate: evidenceWeek.startDate,
      currentWeekEndDate: evidenceWeek.endDate,
      triggerWorkoutId: selectedWorkout.id,
      recentRunWindowSize: 1,
    }),
  };
}
