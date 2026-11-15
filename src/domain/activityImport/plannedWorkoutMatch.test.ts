import { describe, expect, it } from "vitest";

import {
  createCompletedRunId,
  createDateOnly,
  createDurationSeconds,
  createIanaTimeZone,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  milesToMeters,
  type CompletedRun,
  type PlannedWorkout,
  type TrainingPlan,
} from "../training/index.js";
import {
  IMPORTED_RUN_TARGET_COMPLETION_RATIO,
  selectImportedRunWorkoutMatch,
} from "./plannedWorkoutMatch.js";

const userId = createUserId("runner-1");
const otherUserId = createUserId("runner-2");
const planId = createTrainingPlanId("plan-1");
const timestamp = createUtcDateTime("2026-11-15T18:00:00.000Z");

function plan(changes: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: planId,
    userId,
    name: "First marathon",
    startDate: createDateOnly("2026-11-02"),
    targetRaceDate: createDateOnly("2027-04-11"),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...changes,
  };
}

function workout(
  id: string,
  changes: Partial<PlannedWorkout> = {},
): PlannedWorkout {
  return {
    id: createPlannedWorkoutId(id),
    userId,
    planId,
    scheduledDate: createDateOnly("2026-11-15"),
    phase: "base_building",
    status: "planned",
    kind: "run",
    purpose: "long",
    targetDistance: milesToMeters(9),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...changes,
  } as PlannedWorkout;
}

function importedRun(changes: Partial<CompletedRun> = {}): CompletedRun {
  return {
    id: createCompletedRunId("run-1"),
    userId,
    startedAt: createUtcDateTime("2026-11-15T16:00:00.000Z"),
    timeZone: createIanaTimeZone("America/Los_Angeles"),
    distance: milesToMeters(9),
    duration: createDurationSeconds(5_400),
    importProvider: "garmin_connect",
    reportedOrigin: "garmin",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...changes,
  };
}

describe("selectImportedRunWorkoutMatch", () => {
  it("matches one same-day workout when the imported run meets or exceeds its target", () => {
    const scheduled = workout("long-run");

    expect(
      selectImportedRunWorkoutMatch({
        run: importedRun({ distance: milesToMeters(10) }),
        plans: [plan()],
        workouts: [scheduled],
      }),
    ).toEqual({ kind: "matched", workout: scheduled });
  });

  it("accepts the documented ninety-percent lower tolerance", () => {
    const scheduled = workout("long-run");

    expect(
      selectImportedRunWorkoutMatch({
        run: importedRun({
          distance: milesToMeters(
            9 * IMPORTED_RUN_TARGET_COMPLETION_RATIO,
          ),
        }),
        plans: [plan()],
        workouts: [scheduled],
      }),
    ).toEqual({ kind: "matched", workout: scheduled });
  });

  it("uses duration only when the planned workout has no distance target", () => {
    const scheduled = workout("timed-run", {
      targetDistance: undefined,
      targetDuration: createDurationSeconds(3_600),
    });

    expect(
      selectImportedRunWorkoutMatch({
        run: importedRun({ duration: createDurationSeconds(3_300) }),
        plans: [plan()],
        workouts: [scheduled],
      }),
    ).toEqual({ kind: "matched", workout: scheduled });
  });

  it.each([
    {
      name: "there is no unique active plan",
      plans: [plan({ status: "draft" })],
      workouts: [workout("long-run")],
      reason: "active_plan_not_unique",
    },
    {
      name: "two running workouts share the local date",
      plans: [plan()],
      workouts: [workout("first"), workout("second")],
      reason: "same_day_workout_not_unique",
    },
    {
      name: "the only workout is already completed",
      plans: [plan()],
      workouts: [workout("long-run", { status: "completed" })],
      reason: "same_day_workout_not_unique",
    },
    {
      name: "the workout belongs to another runner",
      plans: [plan()],
      workouts: [workout("long-run", { userId: otherUserId })],
      reason: "same_day_workout_not_unique",
    },
    {
      name: "the workout has no supported target",
      plans: [plan()],
      workouts: [
        workout("targetless", {
          targetDistance: undefined,
          targetDuration: undefined,
        }),
      ],
      reason: "target_not_supported",
    },
    {
      name: "the imported run is below the target tolerance",
      plans: [plan()],
      workouts: [workout("long-run")],
      reason: "below_target_tolerance",
      run: importedRun({ distance: milesToMeters(8) }),
    },
  ])("does not match when $name", ({ plans, workouts, reason, run }) => {
    expect(
      selectImportedRunWorkoutMatch({
        run: run ?? importedRun(),
        plans,
        workouts,
      }),
    ).toEqual({ kind: "not_matched", reason });
  });
});
