import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type PlannedWorkout,
  type TrainingPlan,
} from "../domain/training";
import NextWorkoutSummary from "./NextWorkoutSummary";

const userId = createUserId("runner-1");
const planId = createTrainingPlanId("plan-1");
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
const run: PlannedWorkout = {
  id: createPlannedWorkoutId("workout-1"),
  userId,
  planId,
  scheduledDate: createDateOnly("2030-01-02"),
  phase: "base_building",
  status: "planned",
  kind: "run",
  purpose: "easy",
  targetDistance: createDistanceMeters(5_000),
  targetDuration: createDurationSeconds(1_800),
  createdAt: timestamp,
  updatedAt: timestamp,
};
const rest: PlannedWorkout = {
  id: createPlannedWorkoutId("workout-2"),
  userId,
  planId,
  scheduledDate: createDateOnly("2030-01-03"),
  phase: "base_building",
  status: "planned",
  kind: "rest",
  createdAt: timestamp,
  updatedAt: timestamp,
};

describe("NextWorkoutSummary", () => {
  it("shows the next workout date and preferred-unit targets", () => {
    render(
      <NextWorkoutSummary
        plan={plan}
        workout={run}
        distanceUnit="kilometer"
        onOpenPlan={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Easy run" })).toBeInTheDocument();
    expect(screen.getByText("Wednesday, January 2, 2030")).toBeInTheDocument();
    expect(screen.getByText("5 km · 30 min")).toBeInTheDocument();
  });

  it("opens the Plan surface only through the supplied action", async () => {
    const user = userEvent.setup();
    const onOpenPlan = vi.fn();
    render(
      <NextWorkoutSummary
        plan={plan}
        workout={rest}
        distanceUnit="mile"
        onOpenPlan={onOpenPlan}
      />,
    );

    expect(screen.getByRole("heading", { name: "Rest day" })).toBeInTheDocument();
    expect(screen.queryByText(/mi|km|min/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Plan" }));
    expect(onOpenPlan).toHaveBeenCalledOnce();
  });

  it("distinguishes no active plan from no upcoming workout", () => {
    const { rerender } = render(
      <NextWorkoutSummary
        plan={null}
        workout={null}
        distanceUnit="mile"
        onOpenPlan={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No active plan yet" }),
    ).toBeInTheDocument();

    rerender(
      <NextWorkoutSummary
        plan={plan}
        workout={null}
        distanceUnit="mile"
        onOpenPlan={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No upcoming planned workouts" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/First Marathon Journey/)).toBeInTheDocument();
  });
});
