import { describe, expect, it } from "vitest";
import {
  ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
  type AdaptationHistoryEvidenceV1,
} from "./adaptationHistoryNormalization";
import {
  previewWorkoutsForAdaptationProjection,
  projectAdaptationFromTrainingSnapshot,
} from "./adaptationTrainingProjection";
import { createDateOnly, createUtcDateTime } from "./dates";
import {
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
} from "./identifiers";
import type { PlannedWorkout, RunWorkout, TrainingPlan } from "./types";
import { createDistanceMeters } from "./units";

const ownerId = createUserId("runner-1");
const otherOwnerId = createUserId("runner-2");
const planId = createTrainingPlanId("plan-1");
const timestamp = createUtcDateTime("2030-01-01T12:00:00.000Z");

const activePlan: TrainingPlan = {
  id: planId,
  userId: ownerId,
  name: "Adaptation test plan",
  startDate: createDateOnly("2030-01-01"),
  targetRaceDate: createDateOnly("2030-05-05"),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};

function runWorkout(
  id: string,
  scheduledDate: string,
  distance: number,
  overrides: Partial<RunWorkout> = {},
): RunWorkout {
  return {
    id: createPlannedWorkoutId(id),
    userId: ownerId,
    planId,
    scheduledDate: createDateOnly(scheduledDate),
    phase: "base_building",
    status: "planned",
    kind: "run",
    purpose: "easy",
    targetDistance: createDistanceMeters(distance),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

const trigger = runWorkout("week-1-easy", "2030-01-02", 4_000, {
  status: "skipped",
});
const workouts: readonly PlannedWorkout[] = [
  trigger,
  runWorkout("week-1-recovery", "2030-01-04", 5_000, {
    purpose: "recovery",
  }),
  runWorkout("week-1-tempo", "2030-01-06", 6_000, { purpose: "tempo" }),
  runWorkout("week-1-long", "2030-01-07", 8_000, { purpose: "long" }),
  runWorkout("week-2-easy", "2030-01-09", 5_000),
  runWorkout("week-2-recovery", "2030-01-11", 6_000, {
    purpose: "recovery",
  }),
  runWorkout("week-2-tempo", "2030-01-13", 7_000, { purpose: "tempo" }),
  runWorkout("week-2-long", "2030-01-14", 9_000, { purpose: "long" }),
];

function evidence(
  overrides: Partial<AdaptationHistoryEvidenceV1> = {},
): AdaptationHistoryEvidenceV1 {
  return {
    schemaVersion: ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
    ownerId,
    activePlanId: planId,
    activePlanRevision: 7,
    evaluatedPlanRevision: 7,
    activePlanStatus: "active",
    evaluationDate: createDateOnly("2030-01-05"),
    currentWeekStartDate: createDateOnly("2030-01-01"),
    currentWeekEndDate: createDateOnly("2030-01-07"),
    triggerWorkoutId: trigger.id,
    triggerKind: "planned_run_skipped",
    currentWeek: {
      plannedRunCount: 2,
      completedRunCount: 0,
      skippedRunCount: 1,
      pendingRunCount: 1,
    },
    daysUntilRace: 120,
    daysSinceLastCompletedPlannedRun: 2,
    recentRunCount: 2,
    recentEfforts: ["about_right", "harder_than_expected"],
    recentRunsMissingPerceivedEffort: 0,
    safetyGateState: "none_reported",
    ...overrides,
  };
}

const noCandidate = {
  present: false,
  workoutPurpose: null,
  delayCalendarDays: null,
  samePlanWeek: false,
  runnerConfirmedAvailable: false,
  targetDateEmpty: false,
  consecutiveRunDatesAfterMove: 0,
} as const;

describe("projectAdaptationFromTrainingSnapshot", () => {
  it.each(["repeat_period", "hold_progression"] as const)(
    "projects a %s recommendation from the active plan snapshot",
    (action) => {
      const result = projectAdaptationFromTrainingSnapshot({
        evidence: evidence(),
        activePlan,
        workouts,
        action,
        rescheduleCandidate: noCandidate,
      });

      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") return;
      expect(result.adjustment).toEqual({
        action,
        sourceWeekNumber: 1,
        targetWeekNumber: 2,
      });
      expect(result.projection.resultingPlanRevision).toBe(8);
      expect(result.projection.changes).toHaveLength(4);
    },
  );

  it("projects and previews one validated reschedule without mutating the source snapshot", () => {
    const before = JSON.stringify(workouts);
    const result = projectAdaptationFromTrainingSnapshot({
      evidence: evidence(),
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
        consecutiveRunDatesAfterMove: 1,
      },
    });

    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    const preview = previewWorkoutsForAdaptationProjection({
      activePlan,
      workouts,
      projection: result.projection,
    });
    expect(preview.kind).toBe("ready");
    if (preview.kind !== "ready") return;
    expect(preview.initialDate).toBe("2030-01-03");
    expect(preview.workouts.find(({ id }) => id === trigger.id)).toMatchObject({
      scheduledDate: "2030-01-03",
      status: "planned",
    });
    expect(JSON.stringify(workouts)).toBe(before);
  });

  it("refuses stale ownership, revision, trigger, and candidate facts", () => {
    expect(
      projectAdaptationFromTrainingSnapshot({
        evidence: evidence({ ownerId: otherOwnerId }),
        activePlan,
        workouts,
        action: "hold_progression",
        rescheduleCandidate: noCandidate,
      }),
    ).toMatchObject({ kind: "not_ready", code: "active_plan_mismatch" });

    expect(
      projectAdaptationFromTrainingSnapshot({
        evidence: evidence({ evaluatedPlanRevision: 6 }),
        activePlan,
        workouts,
        action: "hold_progression",
        rescheduleCandidate: noCandidate,
      }),
    ).toMatchObject({ kind: "not_ready", code: "stale_revision" });

    expect(
      projectAdaptationFromTrainingSnapshot({
        evidence: evidence({
          triggerWorkoutId: createPlannedWorkoutId("missing-trigger"),
        }),
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
          consecutiveRunDatesAfterMove: 1,
        },
      }),
    ).toMatchObject({ kind: "not_ready", code: "trigger_workout_missing" });

    expect(
      projectAdaptationFromTrainingSnapshot({
        evidence: evidence(),
        activePlan,
        workouts,
        action: "reschedule",
        rescheduleCandidate: {
          present: true,
          workoutPurpose: "long",
          delayCalendarDays: 1,
          samePlanWeek: true,
          runnerConfirmedAvailable: true,
          targetDateEmpty: true,
          consecutiveRunDatesAfterMove: 1,
        },
      }),
    ).toMatchObject({
      kind: "not_ready",
      code: "reschedule_candidate_mismatch",
    });
  });
});
