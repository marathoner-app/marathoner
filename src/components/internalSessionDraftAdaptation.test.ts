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
const secondWorkoutId = createPlannedWorkoutId("session-workout-2");
const createdAt = createUtcDateTime("2030-01-07T12:00:00.000Z");
const confirmedAt = createUtcDateTime("2030-01-08T18:00:00.000Z");
const secondConfirmedAt = createUtcDateTime("2030-01-09T18:00:00.000Z");
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
    {
      id: secondWorkoutId,
      userId: ownerId,
      planId,
      scheduledDate: createDateOnly("2030-01-09"),
      phase: "base_building",
      status: "planned",
      kind: "run",
      purpose: "long",
      targetDistance: createDistanceMeters(8_000),
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
const secondRun: CompletedRun = {
  ...run,
  id: createCompletedRunId("run-2"),
  startedAt: createUtcDateTime("2030-01-09T16:00:00.000Z"),
  distance: createDistanceMeters(8_000),
  duration: createDurationSeconds(2_880),
};

describe("assembleInternalSessionDraftAdaptation", () => {
  it("normalizes every transient pair and uses the latest workout as the trigger", () => {
    const assembly = assembleInternalSessionDraftAdaptation({
      projection,
      pairs: [
        {
          workoutId: secondWorkoutId,
          run: secondRun,
          confirmedAt: secondConfirmedAt,
        },
        { workoutId, run, confirmedAt },
      ],
    });

    expect(assembly?.normalization.kind).toBe("ready");
    expect(assembly?.workouts).toEqual([
      expect.objectContaining({
        id: workoutId,
        status: "completed",
        updatedAt: confirmedAt,
      }),
      expect.objectContaining({
        id: secondWorkoutId,
        status: "completed",
        updatedAt: secondConfirmedAt,
      }),
    ]);
    expect(assembly?.runs).toEqual([
      expect.objectContaining({
        id: secondRun.id,
        plannedWorkoutPlanId: planId,
        plannedWorkoutId: secondWorkoutId,
        updatedAt: secondConfirmedAt,
      }),
      expect.objectContaining({
        id: run.id,
        plannedWorkoutPlanId: planId,
        plannedWorkoutId: workoutId,
        updatedAt: confirmedAt,
      }),
    ]);
    if (assembly?.normalization.kind === "ready") {
      expect(assembly.normalization.evidence).toMatchObject({
        evaluationDate: "2030-01-09",
        triggerWorkoutId: secondWorkoutId,
        recentRunCount: 2,
        currentWeek: { completedRunCount: 2 },
      });
    }
    expect(projection.workouts.map(({ status }) => status)).toEqual([
      "planned",
      "planned",
    ]);
    expect(run.plannedWorkoutId).toBeUndefined();
    expect(secondRun.plannedWorkoutId).toBeUndefined();
  });

  it("refuses a run that is not from the selected workout date", () => {
    expect(
      assembleInternalSessionDraftAdaptation({
        projection,
        pairs: [
          {
            workoutId,
            run: {
              ...run,
              startedAt: createUtcDateTime("2030-01-09T16:00:00.000Z"),
            },
            confirmedAt,
          },
        ],
      }),
    ).toBeNull();
  });

  it("refuses duplicate workout or run confirmations", () => {
    expect(
      assembleInternalSessionDraftAdaptation({
        projection,
        pairs: [
          { workoutId, run, confirmedAt },
          {
            workoutId,
            run: { ...run, id: createCompletedRunId("run-alternate") },
            confirmedAt: secondConfirmedAt,
          },
        ],
      }),
    ).toBeNull();

    expect(
      assembleInternalSessionDraftAdaptation({
        projection: {
          ...projection,
          workouts: [
            projection.workouts[0]!,
            {
              ...projection.workouts[1]!,
              scheduledDate: createDateOnly("2030-01-08"),
            },
          ],
        },
        pairs: [
          { workoutId, run, confirmedAt },
          {
            workoutId: secondWorkoutId,
            run,
            confirmedAt: secondConfirmedAt,
          },
        ],
      }),
    ).toBeNull();
  });
});
