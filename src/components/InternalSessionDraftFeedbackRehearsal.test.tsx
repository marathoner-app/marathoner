import { render, screen, within } from "@testing-library/react";
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
  type CompletedRun,
  type GeneratedPlanEntityProjection,
} from "../domain/training";
import InternalSessionDraftFeedbackRehearsal from "./InternalSessionDraftFeedbackRehearsal";
import type { InternalAdaptationScenarioPacket } from "./internalAdaptationScenarioPacket";
import type { InternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";

const ownerId = createUserId("owner-1");
const planId = createTrainingPlanId("session-plan-1");
const firstWorkoutId = createPlannedWorkoutId("session-workout-1");
const secondWorkoutId = createPlannedWorkoutId("session-workout-2");
const skippedEasyWorkoutId = createPlannedWorkoutId("session-workout-3");
const createdAt = createUtcDateTime("2030-01-07T12:00:00.000Z");
const timeZone = createIanaTimeZone("UTC");
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
      id: firstWorkoutId,
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
      kind: "walk_run",
      targetDuration: createDurationSeconds(2_400),
      createdAt,
      updatedAt: createdAt,
    },
  ],
};
const firstRun: CompletedRun = {
  id: createCompletedRunId("run-1"),
  userId: ownerId,
  startedAt: createUtcDateTime("2030-01-08T16:00:00.000Z"),
  timeZone,
  distance: createDistanceMeters(5_000),
  duration: createDurationSeconds(1_800),
  perceivedEffort: "about_right",
  unusualPain: false,
  createdAt,
  updatedAt: createdAt,
};
const secondRun: CompletedRun = {
  ...firstRun,
  id: createCompletedRunId("run-2"),
  startedAt: createUtcDateTime("2030-01-09T16:00:00.000Z"),
};
const alternateFirstRun: CompletedRun = {
  ...firstRun,
  id: createCompletedRunId("run-1-alternate"),
  startedAt: createUtcDateTime("2030-01-08T18:00:00.000Z"),
};
const draftPacket = {
  rules: {
    basePlanArtifactVersion: "test-base-plan-draft",
    adaptationArtifactVersion: "test-adaptation-draft",
    allowedReschedulePurposes: ["easy", "recovery"],
    maximumRescheduleDelayDays: 2,
    maximumConsecutiveRunDatesAfterReschedule: 2,
    supportedCoreWeeks: { minimum: 1, maximum: 14 },
  },
} as unknown as InternalAdaptationScenarioPacket;
const planRuleSet = {
  coreWeekKinds: Array.from({ length: 15 }, () => "load"),
  rules: {
    positionPurposes: ["easy", "easy", "recovery", "long"],
    leadInWeek: {
      distancesMetersByPosition: [
        createDistanceMeters(5_000),
        createDistanceMeters(5_000),
        createDistanceMeters(4_000),
        createDistanceMeters(10_000),
      ],
    },
    coreWeeks: Array.from({ length: 15 }, (_, index) => ({
      distancesMetersByPosition: [
        createDistanceMeters(5_000),
        createDistanceMeters(5_000),
        createDistanceMeters(4_000),
        createDistanceMeters(10_000 + index * 1_000),
      ],
    })),
  },
} as unknown as InternalPlanProposalRehearsalRuleSet;

function renderRehearsal(
  projectionOverride: GeneratedPlanEntityProjection | null = projection,
  runs: readonly CompletedRun[] = [firstRun, alternateFirstRun, secondRun],
) {
  return render(
    <InternalSessionDraftFeedbackRehearsal
      projection={projectionOverride}
      runs={runs}
      distanceUnit="mile"
      draftPacket={draftPacket}
      planRuleSet={planRuleSet}
    />,
  );
}

describe("InternalSessionDraftFeedbackRehearsal", () => {
  it("requires an explicit workout and run confirmation before rehearsal", async () => {
    const user = userEvent.setup();
    renderRehearsal();

    expect(
      screen.queryByRole("heading", { name: "Evaluate live draft evidence" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Draft workout"),
      firstWorkoutId,
    );
    await user.selectOptions(
      screen.getByLabelText("Synchronized run"),
      firstRun.id,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Add pair to session rehearsal",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Session draft evidence is coherent",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Evaluate live draft evidence" }),
    ).toBeVisible();
    const planContext = screen.getByRole("region", {
      name: "Derived session plan context",
    });
    expect(within(planContext).getByText("Current core week")).toBeVisible();
    expect(within(planContext).getByText("1")).toBeVisible();
    expect(
      screen.queryByLabelText("Current core week"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/facts come from the activated session draft/iu),
    ).toBeVisible();
    expect(
      screen.getByText(/do not write Firestore, associate real runs/iu),
    ).toBeVisible();
  });

  it("accumulates and removes explicit pairs without reusing a workout or run", async () => {
    const user = userEvent.setup();
    renderRehearsal();

    await user.selectOptions(
      screen.getByLabelText("Draft workout"),
      firstWorkoutId,
    );
    await user.selectOptions(
      screen.getByLabelText("Synchronized run"),
      firstRun.id,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Add pair to session rehearsal",
      }),
    );
    expect(
      screen.getByRole("heading", {
        name: "Session draft evidence is coherent",
      }),
    ).toBeVisible();
    expect(screen.getByText(/1 confirmed event is contributing/iu)).toBeVisible();
    expect(
      screen.queryByRole("option", { name: /Jan 8, 2030/iu }),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Draft workout"),
      secondWorkoutId,
    );
    await user.selectOptions(
      screen.getByLabelText("Synchronized run"),
      secondRun.id,
    );
    expect(
      screen.getByRole("heading", {
        name: "Session draft evidence is coherent",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Add pair to session rehearsal",
      }),
    );
    expect(screen.getByText(/2 confirmed events are contributing/iu)).toBeVisible();
    expect(
      screen.getByText(/no unused workout\/run pair is currently available/iu),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Remove confirmed pair for Jan 8, 2030",
      }),
    );
    expect(screen.getByText(/1 confirmed event is contributing/iu)).toBeVisible();
    expect(
      screen.getAllByRole("option", { name: /Jan 8, 2030/iu }),
    ).toHaveLength(2);
  });

  it("combines an explicit skip with completed-run history and removes it", async () => {
    const user = userEvent.setup();
    renderRehearsal();

    await user.selectOptions(
      screen.getByLabelText("Draft workout"),
      firstWorkoutId,
    );
    await user.selectOptions(
      screen.getByLabelText("Synchronized run"),
      firstRun.id,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Add pair to session rehearsal",
      }),
    );

    await user.selectOptions(
      screen.getByLabelText("Draft workout to skip"),
      secondWorkoutId,
    );
    await user.click(
      screen.getByRole("button", { name: "Mark skipped for rehearsal" }),
    );

    expect(screen.getByText(/2 confirmed events are contributing/iu)).toBeVisible();
    expect(
      screen.getByText(/skipped for rehearsal · no run associated/iu),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Session draft evidence is coherent",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Remove skipped workout for Jan 9, 2030",
      }),
    );
    expect(screen.getByText(/1 confirmed event is contributing/iu)).toBeVisible();
    expect(
      screen.queryByText(/skipped for rehearsal · no run associated/iu),
    ).not.toBeInTheDocument();
  });

  it("shows that a skip alone cannot invent completed-run evidence", async () => {
    const user = userEvent.setup();
    renderRehearsal();

    await user.selectOptions(
      screen.getByLabelText("Draft workout to skip"),
      secondWorkoutId,
    );
    await user.click(
      screen.getByRole("button", { name: "Mark skipped for rehearsal" }),
    );

    expect(
      screen.getByRole("heading", { name: "Session evidence is not ready" }),
    ).toBeVisible();
    expect(screen.getByText(/missing_completed_planned_run/iu)).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Evaluate live draft evidence" }),
    ).not.toBeInTheDocument();
  });

  it("shows plan-derived candidate dates and asks only for availability", async () => {
    const user = userEvent.setup();
    const projectionWithSkippedEasyWorkout: GeneratedPlanEntityProjection = {
      ...projection,
      workouts: [
        ...projection.workouts,
        {
          id: skippedEasyWorkoutId,
          userId: ownerId,
          planId,
          scheduledDate: createDateOnly("2030-01-10"),
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
    renderRehearsal(projectionWithSkippedEasyWorkout, [firstRun]);

    await user.selectOptions(
      screen.getByLabelText("Draft workout"),
      firstWorkoutId,
    );
    await user.selectOptions(
      screen.getByLabelText("Synchronized run"),
      firstRun.id,
    );
    await user.click(
      screen.getByRole("button", { name: "Add pair to session rehearsal" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Draft workout to skip"),
      skippedEasyWorkoutId,
    );
    await user.click(
      screen.getByRole("button", { name: "Mark skipped for rehearsal" }),
    );

    const candidateSelect = screen.getByLabelText("Reschedule choice");
    expect(
      within(candidateSelect).getByRole("option", {
        name: "Jan 11, 2030 · 1 day later",
      }),
    ).toBeVisible();
    expect(
      within(candidateSelect).getByRole("option", {
        name: "Jan 12, 2030 · 2 days later",
      }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Workout purpose")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Delay in calendar days"),
    ).not.toBeInTheDocument();

    await user.selectOptions(candidateSelect, "2030-01-11");
    const derivedFacts = screen.getByRole("group", {
      name: "Derived reschedule facts",
    });
    expect(within(derivedFacts).getByText("Workout purpose")).toBeVisible();
    expect(within(derivedFacts).getByText("Easy")).toBeVisible();
    expect(within(derivedFacts).getByText("Same plan week")).toBeVisible();
    expect(
      screen.getByLabelText("I confirm I am available on Jan 11, 2030."),
    ).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Evaluate live draft evidence" }),
    ).toBeDisabled();

    await user.click(
      screen.getByLabelText("I confirm I am available on Jan 11, 2030."),
    );
    await user.click(
      screen.getByLabelText(/I inspected the live history above/iu),
    );
    expect(
      screen.getByRole("button", { name: "Evaluate live draft evidence" }),
    ).toBeEnabled();
  });

  it("explains unavailable evidence and stays hidden without a draft", () => {
    const { rerender } = renderRehearsal(projection, []);

    expect(
      screen.getByText(/no non-rest draft workout has a same-date/iu),
    ).toBeVisible();

    rerender(
      <InternalSessionDraftFeedbackRehearsal
        projection={null}
        runs={[]}
        distanceUnit="mile"
        draftPacket={draftPacket}
        planRuleSet={planRuleSet}
      />,
    );
    expect(
      screen.queryByRole("heading", {
        name: "Rehearse session-draft feedback",
      }),
    ).not.toBeInTheDocument();
  });
});
