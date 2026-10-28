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
  type CompletedRun,
  type GeneratedPlanEntityProjection,
} from "../domain/training";
import InternalSessionDraftFeedbackRehearsal from "./InternalSessionDraftFeedbackRehearsal";
import type { InternalAdaptationScenarioPacket } from "./internalAdaptationScenarioPacket";

const ownerId = createUserId("owner-1");
const planId = createTrainingPlanId("session-plan-1");
const firstWorkoutId = createPlannedWorkoutId("session-workout-1");
const secondWorkoutId = createPlannedWorkoutId("session-workout-2");
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
    allowedReschedulePurposes: [],
  },
} as unknown as InternalAdaptationScenarioPacket;

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
    expect(screen.getByText(/1 confirmed pair is contributing/iu)).toBeVisible();
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
    expect(screen.getByText(/2 confirmed pairs are contributing/iu)).toBeVisible();
    expect(
      screen.getByText(/every currently eligible workout\/run pair/iu),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Remove confirmed pair for Jan 8, 2030",
      }),
    );
    expect(screen.getByText(/1 confirmed pair is contributing/iu)).toBeVisible();
    expect(
      screen.getByRole("option", { name: /Jan 8, 2030/iu }),
    ).toBeInTheDocument();
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
      />,
    );
    expect(
      screen.queryByRole("heading", {
        name: "Rehearse session-draft feedback",
      }),
    ).not.toBeInTheDocument();
  });
});
