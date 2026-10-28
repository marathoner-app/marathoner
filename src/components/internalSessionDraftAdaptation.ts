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

export interface InternalSessionDraftSkippedWorkout {
  readonly workoutId: PlannedWorkoutId;
  readonly confirmedAt: UtcDateTime;
}

interface AssembleInternalSessionDraftAdaptationRequest {
  readonly projection: GeneratedPlanEntityProjection;
  readonly pairs: readonly InternalSessionDraftRunPair[];
  readonly skippedWorkouts: readonly InternalSessionDraftSkippedWorkout[];
}

/**
 * Builds owner-confirmed adaptation evidence without mutating synchronized data.
 *
 * The returned entities are transient copies used only by the internal rehearsal.
 */
export function assembleInternalSessionDraftAdaptation({
  projection,
  pairs,
  skippedWorkouts,
}: AssembleInternalSessionDraftAdaptationRequest): InternalSessionDraftAdaptationAssembly | null {
  if (pairs.length === 0 && skippedWorkouts.length === 0) return null;

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

  const resolvedSkippedWorkouts = skippedWorkouts.flatMap((skippedWorkout) => {
    const workout = projection.workouts.find(
      (candidate) => candidate.id === skippedWorkout.workoutId,
    );

    if (
      workout === undefined ||
      workout.kind === "rest" ||
      workoutIds.has(workout.id)
    ) {
      return [];
    }

    workoutIds.add(workout.id);
    return [{ ...skippedWorkout, workout }];
  });

  if (resolvedSkippedWorkouts.length !== skippedWorkouts.length) return null;

  const confirmedEvents = [
    ...resolvedPairs.map(({ workout, confirmedAt }) => ({
      workout,
      confirmedAt,
      status: "completed" as const,
    })),
    ...resolvedSkippedWorkouts.map(({ workout, confirmedAt }) => ({
      workout,
      confirmedAt,
      status: "skipped" as const,
    })),
  ];
  const triggerEvent = [...confirmedEvents].sort((left, right) => {
    const dateComparison = left.workout.scheduledDate.localeCompare(
      right.workout.scheduledDate,
    );
    if (dateComparison !== 0) return dateComparison;

    return left.workout.id.localeCompare(right.workout.id);
  })[confirmedEvents.length - 1];
  if (triggerEvent === undefined) return null;

  const confirmedEventByWorkoutId = new Map(
    confirmedEvents.map((event) => [event.workout.id, event]),
  );

  const transientWorkouts = projection.workouts.map((workout) => {
    const confirmedEvent = confirmedEventByWorkoutId.get(workout.id);
    return confirmedEvent === undefined
      ? workout
      : {
          ...workout,
          status: confirmedEvent.status,
          updatedAt: confirmedEvent.confirmedAt,
        };
  });
  const transientRuns = resolvedPairs.map(({ run, workout, confirmedAt }) => ({
    ...run,
    plannedWorkoutPlanId: projection.plan.id,
    plannedWorkoutId: workout.id,
    updatedAt: confirmedAt,
  }));
  const latestConfirmation = confirmedEvents.reduce(
    (latest, event) =>
      event.confirmedAt > latest ? event.confirmedAt : latest,
    triggerEvent.confirmedAt,
  );
  const activePlanState: ActivePlanState = {
    userId: projection.plan.userId,
    activePlanId: projection.plan.id,
    activePlanRevision: 1,
    approvedAt: projection.plan.createdAt,
    updatedAt: latestConfirmation,
  };
  const evidenceWeek = evidenceWeekContaining(
    triggerEvent.workout.scheduledDate,
  );
  // The normalizer requires a positive window even when it will separately
  // report that a skip-only rehearsal lacks completed-run history.
  const recentRunWindowSize = Math.max(1, resolvedPairs.length);

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
      evaluationDate: triggerEvent.workout.scheduledDate,
      currentWeekStartDate: evidenceWeek.startDate,
      currentWeekEndDate: evidenceWeek.endDate,
      triggerWorkoutId: triggerEvent.workout.id,
      recentRunWindowSize,
    }),
  };
}
