import { describe, expect, it } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createIanaTimeZone,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type PlannedWorkout,
  type TrainingPlan,
} from ".";
import { selectNextPlannedWorkout } from "./nextWorkout";

const userId = createUserId("runner-1");
const otherUserId = createUserId("runner-2");
const planId = createTrainingPlanId("plan-1");
const otherPlanId = createTrainingPlanId("plan-2");
const timestamp = createUtcDateTime("2030-01-01T12:00:00Z");
const plan: TrainingPlan = {
  id: planId,
  userId,
  name: "First Marathon Journey",
  startDate: createDateOnly("2030-01-01"),
  targetRaceDate: createDateOnly("2030-05-05"),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};

function workout(
  id: string,
  scheduledDate: string,
  options: {
    planId?: typeof planId;
    status?: PlannedWorkout["status"];
    userId?: typeof userId;
  } = {},
): PlannedWorkout {
  return {
    id: createPlannedWorkoutId(id),
    userId: options.userId ?? userId,
    planId: options.planId ?? planId,
    scheduledDate: createDateOnly(scheduledDate),
    phase: "base_building",
    status: options.status ?? "planned",
    kind: "run",
    purpose: "easy",
    targetDistance: createDistanceMeters(5_000),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("selectNextPlannedWorkout", () => {
  it("selects the earliest planned workout for the active plan", () => {
    const selected = selectNextPlannedWorkout(
      plan,
      [
        workout("later-workout", "2030-01-03"),
        workout("today-workout", "2030-01-01"),
      ],
      createIanaTimeZone("America/Los_Angeles"),
      new Date("2030-01-02T07:30:00.000Z"),
    );

    expect(selected?.id).toBe("today-workout");
  });

  it("uses the runner time zone at a calendar-day boundary", () => {
    const candidates = [
      workout("january-first", "2030-01-01"),
      workout("january-second", "2030-01-02"),
    ];
    const instant = new Date("2030-01-02T07:30:00.000Z");

    expect(
      selectNextPlannedWorkout(
        plan,
        candidates,
        createIanaTimeZone("America/Los_Angeles"),
        instant,
      )?.id,
    ).toBe("january-first");
    expect(
      selectNextPlannedWorkout(
        plan,
        candidates,
        createIanaTimeZone("Asia/Tokyo"),
        instant,
      )?.id,
    ).toBe("january-second");
  });

  it("ignores completed, skipped, past, and wrong-owner or wrong-plan workouts", () => {
    const selected = selectNextPlannedWorkout(
      plan,
      [
        workout("past", "2029-12-31"),
        workout("completed", "2030-01-01", { status: "completed" }),
        workout("skipped", "2030-01-01", { status: "skipped" }),
        workout("wrong-plan", "2030-01-01", { planId: otherPlanId }),
        workout("wrong-owner", "2030-01-01", { userId: otherUserId }),
        workout("eligible", "2030-01-02"),
      ],
      createIanaTimeZone("UTC"),
      new Date("2030-01-01T12:00:00.000Z"),
    );

    expect(selected?.id).toBe("eligible");
  });

  it("uses the workout ID as a stable same-day tie-breaker", () => {
    const selected = selectNextPlannedWorkout(
      plan,
      [workout("workout-b", "2030-01-02"), workout("workout-a", "2030-01-02")],
      createIanaTimeZone("UTC"),
      new Date("2030-01-01T12:00:00.000Z"),
    );

    expect(selected?.id).toBe("workout-a");
  });

  it("returns no workout without an active plan or eligible candidate", () => {
    expect(
      selectNextPlannedWorkout(
        { ...plan, status: "draft" },
        [workout("candidate", "2030-01-02")],
        createIanaTimeZone("UTC"),
        new Date("2030-01-01T12:00:00.000Z"),
      ),
    ).toBeNull();
    expect(
      selectNextPlannedWorkout(
        plan,
        [],
        createIanaTimeZone("UTC"),
        new Date("2030-01-01T12:00:00.000Z"),
      ),
    ).toBeNull();
  });
});
