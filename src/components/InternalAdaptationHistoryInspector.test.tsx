import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  type ActivePlanState,
  type CompletedRun,
  type PlannedWorkout,
  type TrainingPlan,
} from "../domain/training";
import InternalAdaptationHistoryInspector from "./InternalAdaptationHistoryInspector";
import { evidenceWeekContaining } from "./internalAdaptationHistoryWeek";
import type { InternalAdaptationScenarioPacket } from "./internalAdaptationScenarioPacket";

const ownerId = createUserId("runner-1");
const planId = createTrainingPlanId("plan-1");
const completedWorkoutId = createPlannedWorkoutId("workout-completed");
const skippedWorkoutId = createPlannedWorkoutId("workout-skipped");
const timestamp = createUtcDateTime("2026-10-01T12:00:00Z");
const timeZone = createIanaTimeZone("America/Los_Angeles");
const draftPacket = {
  rules: {
    basePlanArtifactVersion: "test-base-plan-draft",
    adaptationArtifactVersion: "test-adaptation-draft",
    allowedReschedulePurposes: [],
  },
} as unknown as InternalAdaptationScenarioPacket;
const plan: TrainingPlan = {
  id: planId,
  userId: ownerId,
  name: "First marathon",
  startDate: createDateOnly("2026-10-01"),
  targetRaceDate: createDateOnly("2027-04-18"),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const completedWorkout: PlannedWorkout = {
  id: completedWorkoutId,
  userId: ownerId,
  planId,
  scheduledDate: createDateOnly("2026-10-26"),
  phase: "base_building",
  status: "completed",
  kind: "run",
  purpose: "easy",
  targetDistance: createDistanceMeters(5_000),
  createdAt: timestamp,
  updatedAt: timestamp,
};
const skippedWorkout: PlannedWorkout = {
  id: skippedWorkoutId,
  userId: ownerId,
  planId,
  scheduledDate: createDateOnly("2026-10-27"),
  phase: "base_building",
  status: "skipped",
  kind: "run",
  purpose: "recovery",
  targetDistance: createDistanceMeters(4_000),
  createdAt: timestamp,
  updatedAt: timestamp,
};
const completedRun: CompletedRun = {
  id: createCompletedRunId("run-1"),
  userId: ownerId,
  plannedWorkoutPlanId: planId,
  plannedWorkoutId: completedWorkoutId,
  startedAt: createUtcDateTime("2026-10-26T17:00:00Z"),
  timeZone,
  distance: createDistanceMeters(5_000),
  duration: createDurationSeconds(1_800),
  perceivedEffort: "about_right",
  unusualPain: false,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const activePlanState: ActivePlanState = {
  userId: ownerId,
  activePlanId: planId,
  activePlanRevision: 4,
  approvedAt: timestamp,
  updatedAt: timestamp,
};

function renderInspector(overrides: {
  activePlanState?: ActivePlanState | null;
  workouts?: readonly PlannedWorkout[];
  runs?: readonly CompletedRun[];
} = {}) {
  return render(
    <InternalAdaptationHistoryInspector
      ownerId={ownerId}
      activePlanState={
        overrides.activePlanState === undefined
          ? activePlanState
          : overrides.activePlanState
      }
      plans={[plan]}
      workouts={overrides.workouts ?? [completedWorkout, skippedWorkout]}
      runs={overrides.runs ?? [completedRun]}
      timeZone={timeZone}
      distanceUnit="mile"
      draftPacket={draftPacket}
      initialEvaluationDate={createDateOnly("2026-10-27")}
    />,
  );
}

async function inspect(triggerWorkoutId = skippedWorkoutId) {
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByLabelText("Trigger workout"),
    `${planId}:${triggerWorkoutId}`,
  );
  await user.click(
    screen.getByRole("button", { name: "Inspect saved history" }),
  );
  return user;
}

describe("evidenceWeekContaining", () => {
  it("returns an inclusive Monday-through-Sunday calendar week", () => {
    expect(evidenceWeekContaining(createDateOnly("2026-10-26"))).toEqual({
      startDate: "2026-10-26",
      endDate: "2026-11-01",
    });
    expect(evidenceWeekContaining(createDateOnly("2026-11-01"))).toEqual({
      startDate: "2026-10-26",
      endDate: "2026-11-01",
    });
  });
});

describe("InternalAdaptationHistoryInspector", () => {
  it("renders trustworthy objective facts without producing a recommendation", async () => {
    renderInspector();

    expect(screen.getByText("2026-10-26 through 2026-11-01")).toBeVisible();
    const user = await inspect();

    expect(
      screen.getByRole("heading", { name: "Objective history is coherent" }),
    ).toBeVisible();
    expect(screen.getByText("Planned run skipped")).toBeVisible();
    expect(screen.getByText("Approved adaptation artifact version")).toBeVisible();
    expect(
      screen.getByText(/history-ready is not participant-ready/iu),
    ).toBeVisible();
    expect(screen.getByLabelText("Current core week")).toBeVisible();
    expect(screen.getByLabelText("Candidate state")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Candidate state"), "present");
    expect(screen.getByLabelText("Workout purpose")).toBeVisible();
    expect(screen.getByLabelText("Delay in calendar days")).toBeVisible();
    expect(
      screen.getByLabelText("Candidate remains in the same plan week"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /recommend|apply|change plan/iu }),
    ).not.toBeInTheDocument();
  });

  it("shows stable refusal issues and no partial evidence", async () => {
    renderInspector({ activePlanState: null });
    await inspect();

    expect(
      screen.getByRole("heading", { name: "Saved history is not ready" }),
    ).toBeVisible();
    expect(screen.getByText(/missing_active_plan_state/iu)).toBeVisible();
    expect(screen.getByText(/no partial evidence was produced/iu)).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Objective history is coherent" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Evaluate live draft evidence" }),
    ).not.toBeInTheDocument();
  });

  it("re-inspects the selected completed or skipped trigger", async () => {
    renderInspector();
    const user = await inspect(completedWorkoutId);
    expect(screen.getByText("Planned run completed")).toBeVisible();

    await user.selectOptions(
      screen.getByLabelText("Trigger workout"),
      `${planId}:${skippedWorkoutId}`,
    );
    expect(
      screen.queryByRole("heading", { name: "Objective history is coherent" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Inspect saved history" }),
    );
    expect(screen.getByText("Planned run skipped")).toBeVisible();
  });

  it("keeps inspection unavailable when the selected week has no trigger", async () => {
    renderInspector();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Evaluation date"));
    await user.type(screen.getByLabelText("Evaluation date"), "2026-11-10");

    expect(
      screen.getByText(/no completed or skipped run\/walk-run workout exists/iu),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Inspect saved history" }),
    ).toBeDisabled();
  });

  it("labels the window as an inspection input rather than approved methodology", () => {
    renderInspector();

    expect(
      screen.getByText(/not an approved methodology threshold/iu),
    ).toBeVisible();
    expect(
      screen.getByText(/does not run the draft evaluator, recommend a change/iu),
    ).toBeVisible();
  });
});
