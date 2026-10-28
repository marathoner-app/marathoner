import {
  createCompletedRunId,
  createDistanceMeters,
  createDurationSeconds,
  createUtcDateTime,
  type CompletedRun,
  type GeneratedPlanEntityProjection,
  type PlannedWorkoutId,
} from "../domain/training";
import {
  internalEligiblePlanRehearsalProfile,
  type InternalPlanRehearsalProfileSource,
} from "./internalEligiblePlanRehearsalProfile";

export const INTERNAL_ELIGIBLE_PLAN_REHEARSAL_RUN_VERSION =
  "internal-eligible-run@1.0.0";

export interface InternalEligiblePlanRehearsalRunFixture {
  readonly version: typeof INTERNAL_ELIGIBLE_PLAN_REHEARSAL_RUN_VERSION;
  readonly alignedWorkoutId: PlannedWorkoutId;
  readonly run: CompletedRun;
}

/**
 * Creates one visibly synthetic run aligned to the final distance-based workout
 * in the frozen plan's first week. That position leaves a recent completion
 * before the following week's first easy run, allowing the owner to exercise a
 * real reschedule recommendation without manufacturing a long disruption. The
 * returned run has no saved workout association; the owner must still confirm
 * that pairing in the rehearsal UI.
 */
export function createInternalEligiblePlanRehearsalRunFixture(
  projection: GeneratedPlanEntityProjection,
): InternalEligiblePlanRehearsalRunFixture | null {
  const firstWeekEnd = new Date(`${projection.plan.startDate}T00:00:00.000Z`);
  firstWeekEnd.setUTCDate(firstWeekEnd.getUTCDate() + 7);
  const firstWeekEndDate = firstWeekEnd.toISOString().slice(0, 10);
  const workout = projection.workouts
    .filter(
      (candidate) =>
        candidate.scheduledDate < firstWeekEndDate &&
        candidate.kind !== "rest" &&
        candidate.targetDistance !== undefined,
    )
    .sort((left, right) =>
      right.scheduledDate.localeCompare(left.scheduledDate),
    )[0];
  if (
    workout === undefined ||
    workout.kind === "rest" ||
    workout.targetDistance === undefined
  ) {
    return null;
  }

  const distance = createDistanceMeters(Number(workout.targetDistance));
  const duration = createDurationSeconds(
    Math.round((Number(distance) / 1_000) * 360),
  );
  const timestamp = createUtcDateTime(
    `${workout.scheduledDate}T16:00:00.000Z`,
  );

  return {
    version: INTERNAL_ELIGIBLE_PLAN_REHEARSAL_RUN_VERSION,
    alignedWorkoutId: workout.id,
    run: {
      id: createCompletedRunId("internal-eligible-plan-rehearsal-run"),
      userId: projection.plan.userId,
      startedAt: timestamp,
      timeZone: internalEligiblePlanRehearsalProfile.timeZone,
      distance,
      duration,
      perceivedEffort: "about_right",
      unusualPain: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function selectInternalEligiblePlanRehearsalRunFixture(
  source: InternalPlanRehearsalProfileSource,
  projection: GeneratedPlanEntityProjection | null,
): InternalEligiblePlanRehearsalRunFixture | null {
  return source === "frozen_eligible_profile" && projection !== null
    ? createInternalEligiblePlanRehearsalRunFixture(projection)
    : null;
}
