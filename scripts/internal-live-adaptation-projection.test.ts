import { describe, expect, it } from "vitest";
import {
  previewWorkoutsForInternalLiveAdaptation,
  projectInternalLiveAdaptation,
} from "../src/components/internalLiveAdaptationProjection";
import {
  ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type AdaptationHistoryEvidenceV1,
  type AdaptationRescheduleCandidateV1,
  type PlannedWorkout,
  type RunPurpose,
  type TrainingPlan,
} from "../src/domain/training";

const ownerId = createUserId("owner-1");
const planId = createTrainingPlanId("plan-1");
const timestamp = createUtcDateTime("2026-10-01T12:00:00Z");

const activePlan: TrainingPlan = {
  id: planId,
  userId: ownerId,
  name: "First marathon",
  startDate: createDateOnly("2026-10-26"),
  targetRaceDate: createDateOnly("2027-04-18"),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};

function runWorkout(
  id: string,
  scheduledDate: string,
  distance: number,
  purpose: RunPurpose,
): PlannedWorkout {
  return {
    id: createPlannedWorkoutId(id),
    userId: ownerId,
    planId,
    scheduledDate: createDateOnly(scheduledDate),
    phase: "marathon_training",
    status: id === "workout-1" ? "skipped" : "planned",
    kind: "run",
    purpose,
    targetDistance: createDistanceMeters(distance),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const workouts: readonly PlannedWorkout[] = [
  runWorkout("workout-1", "2026-10-26", 4_000, "easy"),
  runWorkout("week-1-recovery", "2026-10-28", 5_000, "recovery"),
  runWorkout("week-1-tempo", "2026-10-30", 6_000, "tempo"),
  runWorkout("week-1-long", "2026-11-01", 8_000, "long"),
  runWorkout("week-2-easy", "2026-11-02", 4_500, "easy"),
  runWorkout("week-2-recovery", "2026-11-04", 5_500, "recovery"),
  runWorkout("week-2-tempo", "2026-11-06", 6_500, "tempo"),
  runWorkout("week-2-long", "2026-11-08", 9_000, "long"),
];
const restWorkout: PlannedWorkout = {
  id: createPlannedWorkoutId("week-2-rest"),
  userId: ownerId,
  planId,
  scheduledDate: createDateOnly("2026-11-03"),
  phase: "marathon_training",
  status: "planned",
  kind: "rest",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const otherPlanWorkout: PlannedWorkout = {
  ...workouts[0],
  planId: createTrainingPlanId("other-plan"),
  targetDistance: createDistanceMeters(12_000),
};

const evidence: AdaptationHistoryEvidenceV1 = {
  schemaVersion: ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
  ownerId,
  activePlanId: planId,
  activePlanRevision: 4,
  evaluatedPlanRevision: 4,
  activePlanStatus: "active",
  evaluationDate: createDateOnly("2026-10-27"),
  currentWeekStartDate: createDateOnly("2026-10-26"),
  currentWeekEndDate: createDateOnly("2026-11-01"),
  triggerWorkoutId: createPlannedWorkoutId("workout-1"),
  triggerKind: "planned_run_skipped",
  currentWeek: {
    plannedRunCount: 4,
    completedRunCount: 2,
    skippedRunCount: 2,
    pendingRunCount: 0,
  },
  daysUntilRace: 173,
  daysSinceLastCompletedPlannedRun: 2,
  recentRunCount: 4,
  recentEfforts: ["about_right"],
  recentRunsMissingPerceivedEffort: 0,
  safetyGateState: "none_reported",
};

const noCandidate: AdaptationRescheduleCandidateV1 = {
  present: false,
  workoutPurpose: null,
  delayCalendarDays: null,
  samePlanWeek: false,
  runnerConfirmedAvailable: false,
  targetDateEmpty: false,
  consecutiveRunDatesAfterMove: 0,
};

describe("projectInternalLiveAdaptation", () => {
  it("projects the evaluated plan week onto the next week in memory", () => {
    const result = projectInternalLiveAdaptation({
      evidence,
      activePlan,
      workouts,
      action: "hold_progression",
      rescheduleCandidate: noCandidate,
    });

    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.projection.evaluatedPlanRevision).toBe(4);
    expect(result.projection.resultingPlanRevision).toBe(5);
    expect(result.projection.changes).toHaveLength(4);
    expect(
      result.projection.workouts
        .filter(({ weekNumber }) => weekNumber === 2)
        .map(({ target }) => target),
    ).toEqual(
      workouts.slice(0, 4).map((workout) => ({
        kind: "distance",
        distance:
          workout.kind === "rest" ? undefined : workout.targetDistance,
      })),
    );
  });

  it("projects the exact trigger workout by the supplied candidate delay", () => {
    const result = projectInternalLiveAdaptation({
      evidence,
      activePlan,
      workouts,
      action: "reschedule",
      rescheduleCandidate: {
        present: true,
        workoutPurpose: "easy",
        delayCalendarDays: 1,
        samePlanWeek: true,
        runnerConfirmedAvailable: true,
        targetDateEmpty: true,
        consecutiveRunDatesAfterMove: 2,
      },
    });

    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.projection.changes).toHaveLength(1);
    expect(result.projection.changes[0]).toMatchObject({
      workoutId: "workout-1",
      before: { scheduledDate: "2026-10-26" },
      after: { scheduledDate: "2026-10-27" },
    });
  });

  it("fails closed for ambiguous live targets and stale revisions", () => {
    const ambiguous = workouts.map((workout) =>
      workout.id === "workout-1" && workout.kind !== "rest"
        ? { ...workout, targetDuration: createDurationSeconds(1_800) }
        : workout,
    );
    expect(
      projectInternalLiveAdaptation({
        evidence,
        activePlan,
        workouts: ambiguous,
        action: "hold_progression",
        rescheduleCandidate: noCandidate,
      }),
    ).toMatchObject({
      kind: "not_ready",
      code: "ambiguous_workout_target",
    });

    expect(
      projectInternalLiveAdaptation({
        evidence: { ...evidence, activePlanRevision: 5 },
        activePlan,
        workouts,
        action: "hold_progression",
        rescheduleCandidate: noCandidate,
      }),
    ).toMatchObject({ kind: "not_ready", code: "stale_revision" });
  });

  it("binds a reschedule candidate to the actual skipped trigger", () => {
    expect(
      projectInternalLiveAdaptation({
        evidence,
        activePlan,
        workouts,
        action: "reschedule",
        rescheduleCandidate: {
          present: true,
          workoutPurpose: "recovery",
          delayCalendarDays: 1,
          samePlanWeek: true,
          runnerConfirmedAvailable: true,
          targetDateEmpty: true,
          consecutiveRunDatesAfterMove: 2,
        },
      }),
    ).toMatchObject({
      kind: "not_ready",
      code: "reschedule_candidate_mismatch",
    });
  });
});

describe("previewWorkoutsForInternalLiveAdaptation", () => {
  it("reconciles a complete projection into a view-only calendar snapshot", () => {
    const projected = projectInternalLiveAdaptation({
      evidence,
      activePlan,
      workouts,
      action: "hold_progression",
      rescheduleCandidate: noCandidate,
    });
    expect(projected.kind).toBe("ready");
    if (projected.kind !== "ready") return;

    const preview = previewWorkoutsForInternalLiveAdaptation({
      activePlan,
      workouts: [...workouts, restWorkout, otherPlanWorkout],
      projection: projected.projection,
    });

    expect(preview.kind).toBe("ready");
    if (preview.kind !== "ready") return;
    expect(preview.initialDate).toBe("2026-11-02");
    expect(
      preview.workouts.find(({ id }) => id === "week-2-easy"),
    ).toEqual({
      ...workouts[4],
      targetDistance: createDistanceMeters(4_000),
      targetDuration: undefined,
    });
    expect(preview.workouts.at(-2)).toBe(restWorkout);
    expect(preview.workouts.at(-1)).toBe(otherPlanWorkout);
    expect(
      workouts.find(({ id }) => id === "week-2-easy"),
    ).toHaveProperty("targetDistance", 4_500);
  });

  it("refuses missing, duplicate, and incompatible synchronized mappings", () => {
    const projected = projectInternalLiveAdaptation({
      evidence,
      activePlan,
      workouts,
      action: "hold_progression",
      rescheduleCandidate: noCandidate,
    });
    expect(projected.kind).toBe("ready");
    if (projected.kind !== "ready") return;

    expect(
      previewWorkoutsForInternalLiveAdaptation({
        activePlan,
        workouts: workouts.slice(0, -1),
        projection: projected.projection,
      }),
    ).toMatchObject({ kind: "not_ready", code: "preview_workout_missing" });

    expect(
      previewWorkoutsForInternalLiveAdaptation({
        activePlan,
        workouts: [...workouts, workouts[0]],
        projection: projected.projection,
      }),
    ).toMatchObject({
      kind: "not_ready",
      code: "preview_duplicate_live_workout",
    });

    expect(
      previewWorkoutsForInternalLiveAdaptation({
        activePlan,
        workouts: workouts.map((workout) =>
          workout.id === "week-2-easy" && workout.kind !== "rest"
            ? { ...workout, phase: "race_preparation" as const }
            : workout,
        ),
        projection: projected.projection,
      }),
    ).toMatchObject({
      kind: "not_ready",
      code: "preview_workout_mismatch",
    });
  });
});
