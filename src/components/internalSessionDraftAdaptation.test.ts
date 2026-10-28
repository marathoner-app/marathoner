import { describe, expect, it } from "vitest";
import {
  createCompletedRunId,
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type CompletedRun,
  type GeneratedPlanEntityProjection,
} from "../domain/training";
import { assembleInternalSessionDraftAdaptation } from "./internalSessionDraftAdaptation";

const ownerId = createUserId("owner-1");
const planId = createTrainingPlanId("session-plan-1");
const workoutId = createPlannedWorkoutId("session-workout-1");
const createdAt = createUtcDateTime("2030-01-07T12:00:00.000Z");
const confirmedAt = createUtcDateTime("2030-01-08T18:00:00.000Z");
const projection: GeneratedPlanEntityProjection = {
  plan: {
    id: planId,
    userId: ownerId,
    name: "Session plan",
    startDate: createDateOnly("2030-01-07"),
    targetRaceDate: createDateOnly("2030-04-21"),
    status: "active",
    createdAt,
    updatedAt: createdAt,
  },
  workouts: [
    {
      id: workoutId,
      userId: ownerId,
      planId,
      scheduledDate: createDateOnly("2030-01-08"),
      phase: "base_building",
      status: "planned",
      kind: "run",
      purpose: "easy",
      targetDistance: createDistanceMeters(5_000),
      createdAt,
      updatedAt: createdAt,
    },
  ],
};
const run: CompletedRun = {
  id: createCompletedRunId("run-1"),
  userId: ownerId,
  startedAt: createUtcDateTime("2030-01-08T16:00:00.000Z"),
  timeZone: createIanaTimeZone("UTC"),
  distance: createDistanceMeters(5_000),
  duration: createDurationSeconds(1_800),
  perceivedEffort: "about_right",
  unusualPain: false,
  createdAt,
  updatedAt: createdAt,
};

describe("assembleInternalSessionDraftAdaptation", () => {
  it("creates strict normalized evidence from transient entity copies", () => {
    const assembly = assembleInternalSessionDraftAdaptation({
      projection,
      workoutId,
      run,
      confirmedAt,
    });

    expect(assembly?.normalization.kind).toBe("ready");
    expect(assembly?.workouts[0]).toMatchObject({
      id: workoutId,
      status: "completed",
      updatedAt: confirmedAt,
    });
    expect(assembly?.runs[0]).toMatchObject({
      id: run.id,
      plannedWorkoutPlanId: planId,
      plannedWorkoutId: workoutId,
      updatedAt: confirmedAt,
    });
    expect(projection.workouts[0]?.status).toBe("planned");
    expect(run.plannedWorkoutId).toBeUndefined();
  });

  it("refuses a run that is not from the selected workout date", () => {
    expect(
      assembleInternalSessionDraftAdaptation({
        projection,
        workoutId,
        run: {
          ...run,
          startedAt: createUtcDateTime("2030-01-09T16:00:00.000Z"),
        },
        confirmedAt,
      }),
    ).toBeNull();
  });
});
