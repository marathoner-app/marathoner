import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import Calendar from "./Calendar";

const userId = createUserId("runner-1");
const planId = createTrainingPlanId("plan-1");
const timestamp = createUtcDateTime("2026-07-30T12:00:00Z");
const plan: TrainingPlan = {
  id: planId,
  userId,
  name: "First Marathon Journey",
  startDate: createDateOnly("2026-08-03"),
  targetRaceDate: createDateOnly("2026-08-16"),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const workouts: PlannedWorkout[] = [
  {
    id: createPlannedWorkoutId("workout-1"),
    userId,
    planId,
    scheduledDate: createDateOnly("2026-08-03"),
    phase: "base_building",
    status: "completed",
    kind: "run",
    purpose: "easy",
    targetDistance: createDistanceMeters(4_828),
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: createPlannedWorkoutId("workout-2"),
    userId,
    planId,
    scheduledDate: createDateOnly("2026-08-10"),
    phase: "base_building",
    status: "planned",
    kind: "rest",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: createPlannedWorkoutId("workout-3"),
    userId,
    planId,
    scheduledDate: createDateOnly("2026-08-05"),
    phase: "base_building",
    status: "skipped",
    kind: "run",
    purpose: "tempo",
    targetDistance: createDistanceMeters(8_000),
    targetDuration: createDurationSeconds(2_700),
    notes: "Keep the opening miles controlled, then settle into tempo effort.",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: createPlannedWorkoutId("workout-4"),
    userId,
    planId,
    scheduledDate: createDateOnly("2026-08-07"),
    phase: "base_building",
    status: "planned",
    kind: "rest",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

function renderCalendar(
  overrides: {
    readonly plan?: TrainingPlan | null;
    readonly workouts?: readonly PlannedWorkout[];
    readonly distanceUnit?: "mile" | "kilometer";
    readonly initialDate?: ReturnType<typeof createDateOnly>;
  } = {},
) {
  return render(
    <Calendar
      plan={overrides.plan === undefined ? plan : overrides.plan}
      workouts={overrides.workouts ?? workouts}
      distanceUnit={overrides.distanceUnit ?? "mile"}
      initialDate={overrides.initialDate}
    />,
  );
}

describe("Calendar", () => {
  it("shows an honest empty state without a plan", () => {
    renderCalendar({ plan: null, workouts: [] });

    expect(screen.getByText(/no training plan yet/i)).toBeInTheDocument();
  });

  it("summarizes the selected week and presents readable workout cards", () => {
    renderCalendar();

    expect(
      screen.getByRole("heading", { name: "Week 1 of 2" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Aug 3")).toBeInTheDocument();
    expect(screen.getByText("Aug 9")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Training week" }),
    ).toHaveValue("1");
    expect(screen.getByText("Base building")).toBeInTheDocument();
    expect(screen.getByText("8 mi")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 workouts complete")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Mon, Aug 3 Easy run 3 mi Completed",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Wed, Aug 5 Tempo run 5 mi · 45 min Skipped",
      }),
    ).toBeInTheDocument();
  });

  it("uses the runner's preferred distance unit", () => {
    renderCalendar({ distanceUnit: "kilometer" });

    expect(screen.getByText("12.8 km")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Mon, Aug 3 Easy run 4.8 km Completed",
      }),
    ).toBeInTheDocument();
  });

  it("moves between weeks with explicit controls and direct selection", async () => {
    const user = userEvent.setup();
    renderCalendar();

    const previousWeek = screen.getByRole("button", { name: "Previous week" });
    const nextWeek = screen.getByRole("button", { name: "Next week" });
    expect(previousWeek).toBeDisabled();
    expect(nextWeek).toBeEnabled();

    await user.click(nextWeek);

    expect(
      screen.getByRole("heading", { name: "Week 2 of 2" }),
    ).toBeInTheDocument();
    expect(previousWeek).toBeEnabled();
    expect(nextWeek).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Mon, Aug 10 Rest No training target Scheduled",
      }),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Training week" }),
      "1",
    );

    expect(
      screen.getByRole("button", {
        name: "Mon, Aug 3 Easy run 3 mi Completed",
      }),
    ).toBeInTheDocument();
  });

  it("opens on the week containing the next relevant plan date", () => {
    renderCalendar({ initialDate: createDateOnly("2026-08-10") });

    expect(
      screen.getByRole("heading", { name: "Week 2 of 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Mon, Aug 10 Rest No training target Scheduled",
      }),
    ).toBeInTheDocument();
  });

  it("shows post-race recovery weeks through the plan end date", async () => {
    const user = userEvent.setup();
    const recoveryWorkout: PlannedWorkout = {
      id: createPlannedWorkoutId("workout-recovery"),
      userId,
      planId,
      scheduledDate: createDateOnly("2026-08-17"),
      phase: "recovery",
      status: "planned",
      kind: "run",
      purpose: "recovery",
      targetDistance: createDistanceMeters(3_000),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    renderCalendar({
      plan: {
        ...plan,
        endDate: createDateOnly("2026-08-23"),
      },
      workouts: [...workouts, recoveryWorkout],
    });

    expect(
      screen.getByRole("heading", { name: "Week 1 of 3" }),
    ).toBeInTheDocument();
    const nextWeek = screen.getByRole("button", { name: "Next week" });
    const weekSelector = screen.getByRole("combobox", {
      name: "Training week",
    });

    await user.click(nextWeek);
    expect(
      screen.getByRole("heading", { name: "Week 2 of 3" }),
    ).toBeInTheDocument();

    await user.click(nextWeek);

    expect(
      screen.getByRole("heading", { name: "Week 3 of 3" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Mon, Aug 17 Recovery run 1.9 mi Scheduled",
      }),
    ).toBeInTheDocument();
    expect(nextWeek).toBeDisabled();

    await user.selectOptions(weekSelector, "1");
    await user.selectOptions(weekSelector, "3");

    expect(
      screen.getByRole("heading", { name: "Week 3 of 3" }),
    ).toBeInTheDocument();
  });

  it("clamps the initial date to the recovery-aware plan range", () => {
    renderCalendar({
      plan: {
        ...plan,
        endDate: createDateOnly("2026-08-23"),
      },
      initialDate: createDateOnly("2026-08-30"),
    });

    expect(
      screen.getByRole("heading", { name: "Week 3 of 3" }),
    ).toBeInTheDocument();
  });

  it("falls back to the target race date when the plan has no end date", () => {
    renderCalendar();

    expect(
      screen.getByRole("heading", { name: "Week 1 of 2" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "3" }),
    ).not.toBeInTheDocument();
  });

  it("explains a week without scheduled workouts", async () => {
    const user = userEvent.setup();
    renderCalendar({
      plan: {
        ...plan,
        targetRaceDate: createDateOnly("2026-08-23"),
      },
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Training week" }),
      "3",
    );

    expect(screen.getByText("Not scheduled")).toBeInTheDocument();
    expect(screen.getByText("No workouts scheduled")).toBeInTheDocument();
    expect(
      screen.getByText("No workouts are scheduled this week."),
    ).toBeInTheDocument();
  });

  it("shows every stored target and note in the workout dialog", async () => {
    const user = userEvent.setup();
    renderCalendar();

    const trigger = screen.getByRole("button", {
      name: "Wed, Aug 5 Tempo run 5 mi · 45 min Skipped",
    });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Tempo run" });
    expect(
      within(dialog).getByRole("heading", { name: "Tempo run" }),
    ).toHaveFocus();
    expect(within(dialog).getByText("Wed, Aug 5")).toBeInTheDocument();
    expect(within(dialog).getByText("Skipped")).toBeInTheDocument();
    expect(within(dialog).getByText("Base building")).toBeInTheDocument();
    expect(within(dialog).getByText("5 mi")).toBeInTheDocument();
    expect(within(dialog).getByText("45 min")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Keep the opening miles controlled, then settle into tempo effort.",
      ),
    ).toBeInTheDocument();

    await user.tab();
    const closeButton = within(dialog).getByRole("button", { name: "Close" });
    expect(closeButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.click(closeButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes the workout dialog with Escape and restores trigger focus", async () => {
    const user = userEvent.setup();
    renderCalendar();

    const trigger = screen.getByRole("button", {
      name: "Mon, Aug 3 Easy run 3 mi Completed",
    });
    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Easy run" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("has no beta-blocking accessibility violations in the week and dialog", async () => {
    const user = userEvent.setup();
    renderCalendar();

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);

    await user.click(
      screen.getByRole("button", {
        name: "Wed, Aug 5 Tempo run 5 mi · 45 min Skipped",
      }),
    );

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });
});
