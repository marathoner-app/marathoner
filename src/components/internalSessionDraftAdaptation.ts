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

export interface InternalSessionDraftRunPair {
  readonly workoutId: PlannedWorkoutId;
  readonly run: CompletedRun;
  readonly confirmedAt: UtcDateTime;
}

interface AssembleInternalSessionDraftAdaptationRequest {
  readonly projection: GeneratedPlanEntityProjection;
  readonly pairs: readonly InternalSessionDraftRunPair[];
}

/**
 * Builds owner-confirmed adaptation evidence without mutating synchronized data.
 *
 * The returned entities are transient copies used only by the internal rehearsal.
 */
export function assembleInternalSessionDraftAdaptation({
  projection,
  pairs,
}: AssembleInternalSessionDraftAdaptationRequest): InternalSessionDraftAdaptationAssembly | null {
  if (pairs.length === 0) return null;

  const workoutIds = new Set<PlannedWorkoutId>();
  const runIds = new Set<CompletedRun["id"]>();
  const resolvedPairs = pairs.flatMap((pair) => {
    const workout = projection.workouts.find(
      (candidate) => candidate.id === pair.workoutId,
    );

    if (
      workout === undefined ||
      workout.kind === "rest" ||
      pair.run.userId !== projection.plan.userId ||
      getRunLocalDate(pair.run) !== workout.scheduledDate ||
      workoutIds.has(workout.id) ||
      runIds.has(pair.run.id)
    ) {
      return [];
    }

    workoutIds.add(workout.id);
    runIds.add(pair.run.id);
    return [{ ...pair, workout }];
  });

  if (resolvedPairs.length !== pairs.length) return null;

  const triggerPair = [...resolvedPairs].sort((left, right) => {
    const dateComparison = left.workout.scheduledDate.localeCompare(
      right.workout.scheduledDate,
    );
    if (dateComparison !== 0) return dateComparison;

    const startComparison = left.run.startedAt.localeCompare(
      right.run.startedAt,
    );
    if (startComparison !== 0) return startComparison;

    return left.workout.id.localeCompare(right.workout.id);
  })[resolvedPairs.length - 1];
  if (triggerPair === undefined) return null;

  const confirmedAtByWorkoutId = new Map(
    resolvedPairs.map((pair) => [pair.workout.id, pair.confirmedAt]),
  );

  const transientWorkouts = projection.workouts.map((workout) => {
    const confirmedAt = confirmedAtByWorkoutId.get(workout.id);
    return confirmedAt === undefined
      ? workout
      : { ...workout, status: "completed" as const, updatedAt: confirmedAt };
  });
  const transientRuns = resolvedPairs.map(({ run, workout, confirmedAt }) => ({
    ...run,
    plannedWorkoutPlanId: projection.plan.id,
    plannedWorkoutId: workout.id,
    updatedAt: confirmedAt,
  }));
  const latestConfirmation = resolvedPairs.reduce(
    (latest, pair) =>
      pair.confirmedAt > latest ? pair.confirmedAt : latest,
    triggerPair.confirmedAt,
  );
  const activePlanState: ActivePlanState = {
    userId: projection.plan.userId,
    activePlanId: projection.plan.id,
    activePlanRevision: 1,
    approvedAt: projection.plan.createdAt,
    updatedAt: latestConfirmation,
  };
  const evidenceWeek = evidenceWeekContaining(triggerPair.workout.scheduledDate);

  return {
    activePlanState,
    plan: projection.plan,
    workouts: transientWorkouts,
    runs: transientRuns,
    normalization: normalizeAdaptationHistory({
      ownerId: projection.plan.userId,
      activePlanState,
      plans: [projection.plan],
      workouts: transientWorkouts,
      runs: transientRuns,
      evaluationDate: triggerPair.workout.scheduledDate,
      currentWeekStartDate: evidenceWeek.startDate,
      currentWeekEndDate: evidenceWeek.endDate,
      triggerWorkoutId: triggerPair.workout.id,
      recentRunWindowSize: resolvedPairs.length,
    }),
  };
}
