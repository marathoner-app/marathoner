import {
  ADAPTATION_PLAN_PROJECTION_INPUT_SCHEMA_VERSION,
  AdaptationPlanProjectionError,
  createDateOnly,
  projectAdaptationPlan,
  type AdaptationAction,
  type AdaptationHistoryEvidenceV1,
  type AdaptationPlanAdjustmentV1,
  type AdaptationPlanProjectionV1,
  type AdaptationPlanWorkoutV1,
  type AdaptationRescheduleCandidateV1,
  type DateOnly,
  type PlannedWorkout,
  type TrainingPlan,
} from "../domain/training";

type MaterialAdaptationAction = Exclude<AdaptationAction, "no_change">;

export interface InternalLiveAdaptationProjectionRequest {
  readonly evidence: AdaptationHistoryEvidenceV1;
  readonly activePlan: TrainingPlan;
  readonly workouts: readonly PlannedWorkout[];
  readonly action: MaterialAdaptationAction;
  readonly rescheduleCandidate: AdaptationRescheduleCandidateV1;
}

export type InternalLiveAdaptationProjectionResult =
  | {
      readonly kind: "ready";
      readonly projection: AdaptationPlanProjectionV1;
    }
  | {
      readonly kind: "not_ready";
      readonly code: string;
      readonly message: string;
    };

class LiveProjectionInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LiveProjectionInputError";
  }
}

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

function calendarDay(date: DateOnly): number {
  return Date.parse(`${date}T00:00:00.000Z`) / DAY_MILLISECONDS;
}

function shiftDate(date: DateOnly, days: number): DateOnly {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return createDateOnly(shifted.toISOString().slice(0, 10));
}

function weekNumberFor(plan: TrainingPlan, date: DateOnly): number {
  const dayOffset = calendarDay(date) - calendarDay(plan.startDate);
  if (dayOffset < 0) {
    throw new LiveProjectionInputError(
      "workout_before_plan",
      "The projection snapshot contains a date before the active plan starts.",
    );
  }
  return Math.floor(dayOffset / 7) + 1;
}

function projectionTarget(
  workout: Exclude<PlannedWorkout, { readonly kind: "rest" }>,
): AdaptationPlanWorkoutV1["target"] {
  const hasDistance = workout.targetDistance !== undefined;
  const hasDuration = workout.targetDuration !== undefined;
  if (hasDistance === hasDuration) {
    throw new LiveProjectionInputError(
      "ambiguous_workout_target",
      `Workout ${workout.id} must have exactly one distance or duration target.`,
    );
  }
  if (workout.targetDistance !== undefined) {
    return { kind: "distance", distance: workout.targetDistance };
  }
  if (workout.targetDuration !== undefined) {
    return { kind: "duration", duration: workout.targetDuration };
  }
  throw new LiveProjectionInputError(
    "missing_workout_target",
    `Workout ${workout.id} has no projection target.`,
  );
}

function projectionWorkouts(
  activePlan: TrainingPlan,
  workouts: readonly PlannedWorkout[],
): readonly AdaptationPlanWorkoutV1[] {
  return workouts
    .filter((workout) => workout.planId === activePlan.id)
    .filter(
      (workout): workout is Exclude<PlannedWorkout, { readonly kind: "rest" }> =>
        workout.kind !== "rest",
    )
    .map((workout) => {
      if (workout.userId !== activePlan.userId) {
        throw new LiveProjectionInputError(
          "workout_owner_mismatch",
          `Workout ${workout.id} does not belong to the active-plan owner.`,
        );
      }
      const base = {
        id: workout.id,
        weekNumber: weekNumberFor(activePlan, workout.scheduledDate),
        scheduledDate: workout.scheduledDate,
        phase: workout.phase,
        target: projectionTarget(workout),
      };
      return workout.kind === "run"
        ? { ...base, kind: "run" as const, purpose: workout.purpose }
        : { ...base, kind: "walk_run" as const };
    });
}

function adjustmentFor(
  request: InternalLiveAdaptationProjectionRequest,
  workouts: readonly AdaptationPlanWorkoutV1[],
): AdaptationPlanAdjustmentV1 {
  if (
    request.action === "repeat_period" ||
    request.action === "hold_progression"
  ) {
    const sourceWeekNumber = weekNumberFor(
      request.activePlan,
      request.evidence.evaluationDate,
    );
    return {
      action: request.action,
      sourceWeekNumber,
      targetWeekNumber: sourceWeekNumber + 1,
    };
  }

  const candidate = request.rescheduleCandidate;
  const delayCalendarDays = candidate.delayCalendarDays;
  if (
    !candidate.present ||
    delayCalendarDays === null ||
    !Number.isSafeInteger(delayCalendarDays) ||
    delayCalendarDays < 1 ||
    !candidate.samePlanWeek ||
    !candidate.runnerConfirmedAvailable ||
    !candidate.targetDateEmpty
  ) {
    throw new LiveProjectionInputError(
      "missing_reschedule_candidate",
      "The accepted reschedule recommendation needs one complete prevalidated candidate.",
    );
  }
  const trigger = workouts.find(
    (workout) => workout.id === request.evidence.triggerWorkoutId,
  );
  if (trigger === undefined) {
    throw new LiveProjectionInputError(
      "trigger_workout_missing",
      "The trigger workout is not present in the active-plan projection snapshot.",
    );
  }
  if (
    request.evidence.triggerKind !== "planned_run_skipped" ||
    trigger.kind !== "run" ||
    candidate.workoutPurpose !== trigger.purpose
  ) {
    throw new LiveProjectionInputError(
      "reschedule_candidate_mismatch",
      "The prevalidated reschedule candidate does not match the skipped trigger workout.",
    );
  }
  const weekStartDate = shiftDate(
    request.activePlan.startDate,
    (trigger.weekNumber - 1) * 7,
  );
  return {
    action: "reschedule",
    workoutId: trigger.id,
    weekNumber: trigger.weekNumber,
    weekStartDate,
    weekEndDate: shiftDate(weekStartDate, 6),
    targetDate: shiftDate(trigger.scheduledDate, delayCalendarDays),
  };
}

export function projectInternalLiveAdaptation(
  request: InternalLiveAdaptationProjectionRequest,
): InternalLiveAdaptationProjectionResult {
  try {
    if (
      request.activePlan.id !== request.evidence.activePlanId ||
      request.activePlan.userId !== request.evidence.ownerId ||
      request.activePlan.status !== "active"
    ) {
      throw new LiveProjectionInputError(
        "active_plan_mismatch",
        "The inspected evidence no longer matches the loaded active plan.",
      );
    }
    const workouts = projectionWorkouts(request.activePlan, request.workouts);
    const projection = projectAdaptationPlan({
      schemaVersion: ADAPTATION_PLAN_PROJECTION_INPUT_SCHEMA_VERSION,
      planId: request.activePlan.id,
      activePlanRevision: request.evidence.activePlanRevision,
      evaluatedPlanRevision: request.evidence.evaluatedPlanRevision,
      targetRaceDate: request.activePlan.targetRaceDate,
      workouts,
      adjustment: adjustmentFor(request, workouts),
    });
    return { kind: "ready", projection };
  } catch (error) {
    if (
      error instanceof LiveProjectionInputError ||
      error instanceof AdaptationPlanProjectionError
    ) {
      return {
        kind: "not_ready",
        code: error.code,
        message: error.message,
      };
    }
    throw error;
  }
}
