import { describe, expect, it } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type GeneratedPlanEntityProjection,
  type PlannedWorkout,
  type TrainingPlan,
} from "../domain/training";
import { resolvePlanSurfaceData } from "./planSurfaceData";

const ownerId = createUserId("owner-1");
const timestamp = createUtcDateTime("2026-10-28T18:00:00.000Z");

function plan(id: string, name: string): TrainingPlan {
  return {
    id: createTrainingPlanId(id),
    userId: ownerId,
    name,
    startDate: createDateOnly("2026-11-02"),
    targetRaceDate: createDateOnly("2027-03-14"),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function workout(id: string, planId: TrainingPlan["id"]): PlannedWorkout {
  return {
    id: createPlannedWorkoutId(id),
    userId: ownerId,
    planId,
    scheduledDate: createDateOnly("2026-11-03"),
    phase: "base_building",
    status: "planned",
    kind: "run",
    purpose: "easy",
    targetDistance: createDistanceMeters(5_000),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("resolvePlanSurfaceData", () => {
  it("uses the active session projection for read-only Plan surfaces", () => {
    const synchronizedPlan = plan("synchronized-plan", "Synchronized plan");
    const synchronizedWorkout = workout(
      "synchronized-workout",
      synchronizedPlan.id,
    );
    const sessionPlan = plan("session-plan", "Session draft plan");
    const sessionWorkout = workout("session-workout", sessionPlan.id);
    const sessionProjection: GeneratedPlanEntityProjection = {
      plan: sessionPlan,
      workouts: [sessionWorkout],
    };

    expect(
      resolvePlanSurfaceData({
        sessionProjection,
        synchronizedPlan,
        synchronizedWorkouts: [synchronizedWorkout],
      }),
    ).toEqual({
      activePlan: sessionPlan,
      workouts: [sessionWorkout],
    });
  });

  it("returns to synchronized data when the session projection is cleared", () => {
    const synchronizedPlan = plan("synchronized-plan", "Synchronized plan");
    const synchronizedWorkout = workout(
      "synchronized-workout",
      synchronizedPlan.id,
    );

    expect(
      resolvePlanSurfaceData({
        sessionProjection: null,
        synchronizedPlan,
        synchronizedWorkouts: [synchronizedWorkout],
      }),
    ).toEqual({
      activePlan: synchronizedPlan,
      workouts: [synchronizedWorkout],
    });
  });
});
