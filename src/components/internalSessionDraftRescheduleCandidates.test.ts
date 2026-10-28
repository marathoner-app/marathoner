import { describe, expect, it } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type AdaptationHistoryEvidenceV1,
  type PlannedWorkout,
  type TrainingPlan,
} from "../domain/training";
import { deriveInternalSessionDraftRescheduleCandidates } from "./internalSessionDraftRescheduleCandidates";

const ownerId = createUserId("owner-1");
const planId = createTrainingPlanId("plan-1");
const triggerId = createPlannedWorkoutId("trigger");
const timestamp = createUtcDateTime("2030-01-07T12:00:00.000Z");
const plan: TrainingPlan = {
  id: planId,
  userId: ownerId,
  name: "Session plan",
  startDate: createDateOnly("2030-01-07"),
  targetRaceDate: createDateOnly("2030-04-21"),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};

function workout(
  id: string,
  scheduledDate: string,
  overrides: Partial<PlannedWorkout> = {},
): PlannedWorkout {
  return {
    id: createPlannedWorkoutId(id),
    userId: ownerId,
    planId,
    scheduledDate: createDateOnly(scheduledDate),
    phase: "base_building",
    status: "planned",
    kind: "run",
    purpose: "easy",
    targetDistance: createDistanceMeters(5_000),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  } as PlannedWorkout;
}

const trigger = workout("trigger", "2030-01-09", { status: "skipped" });
const evidence = {
  ownerId,
  activePlanId: planId,
  triggerWorkoutId: triggerId,
  triggerKind: "planned_run_skipped",
} as AdaptationHistoryEvidenceV1;
const rules = {
  allowedReschedulePurposes: ["easy", "recovery"] as const,
  maximumRescheduleDelayDays: 2,
  maximumConsecutiveRunDatesAfterReschedule: 2,
};

describe("deriveInternalSessionDraftRescheduleCandidates", () => {
  it("derives schedule facts while leaving runner availability unconfirmed", () => {
    expect(
      deriveInternalSessionDraftRescheduleCandidates({
        plan,
        workouts: [trigger, workout("long", "2030-01-13")],
        evidence,
        rules,
      }),
    ).toEqual([
      {
        targetDate: "2030-01-10",
        candidate: {
          present: true,
          workoutPurpose: "easy",
          delayCalendarDays: 1,
          samePlanWeek: true,
          runnerConfirmedAvailable: false,
          targetDateEmpty: true,
          consecutiveRunDatesAfterMove: 1,
        },
      },
      {
        targetDate: "2030-01-11",
        candidate: {
          present: true,
          workoutPurpose: "easy",
          delayCalendarDays: 2,
          samePlanWeek: true,
          runnerConfirmedAvailable: false,
          targetDateEmpty: true,
          consecutiveRunDatesAfterMove: 1,
        },
      },
    ]);
  });

  it("omits occupied and cross-week dates", () => {
    const sundayTrigger = workout("trigger", "2030-01-13", {
      status: "skipped",
    });
    expect(
      deriveInternalSessionDraftRescheduleCandidates({
        plan,
        workouts: [sundayTrigger],
        evidence: { ...evidence, triggerWorkoutId: sundayTrigger.id },
        rules,
      }),
    ).toEqual([]);
    expect(
      deriveInternalSessionDraftRescheduleCandidates({
        plan,
        workouts: [trigger, workout("occupied", "2030-01-10")],
        evidence,
        rules: { ...rules, maximumRescheduleDelayDays: 1 },
      }),
    ).toEqual([]);
  });

  it("omits a move that would create too many consecutive run dates", () => {
    expect(
      deriveInternalSessionDraftRescheduleCandidates({
        plan,
        workouts: [
          trigger,
          workout("saturday", "2030-01-12"),
          workout("sunday", "2030-01-13"),
        ],
        evidence,
        rules,
      }).map(({ targetDate }) => targetDate),
    ).toEqual(["2030-01-10"]);
  });

  it("returns no candidates for unsupported purposes or a non-skipped trigger", () => {
    const longTrigger = workout("trigger", "2030-01-09", {
      status: "skipped",
      purpose: "long",
    });
    expect(
      deriveInternalSessionDraftRescheduleCandidates({
        plan,
        workouts: [longTrigger],
        evidence,
        rules,
      }),
    ).toEqual([]);
    expect(
      deriveInternalSessionDraftRescheduleCandidates({
        plan,
        workouts: [trigger],
        evidence: { ...evidence, triggerKind: "planned_run_completed" },
        rules,
      }),
    ).toEqual([]);
  });

  it("does not mutate the plan workouts", () => {
    const workouts = [trigger, workout("other", "2030-01-12")];
    const snapshot = structuredClone(workouts);
    deriveInternalSessionDraftRescheduleCandidates({
      plan,
      workouts,
      evidence,
      rules,
    });
    expect(workouts).toEqual(snapshot);
  });
});
