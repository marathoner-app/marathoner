import { render, screen, within } from "@testing-library/react";
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
  type GeneratedPlanResultV1,
  type PlannedWorkout,
  type TrainingPlan,
  type UserProfile,
} from "../domain/training";
import { planGenerationContractFixtures } from "../domain/training/planGenerationFixtures";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import InternalDogfoodJourneyOverview from "./InternalDogfoodJourneyOverview";

const ownerId = createUserId("owner-1");
const planId = createTrainingPlanId("plan-1");
const workoutId = createPlannedWorkoutId("workout-1");
const timestamp = createUtcDateTime("2026-10-28T12:00:00Z");
const timeZone = createIanaTimeZone("America/Los_Angeles");
const profile: UserProfile = {
  id: ownerId,
  preferredDistanceUnit: "mile",
  timeZone,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const plan: TrainingPlan = {
  id: planId,
  userId: ownerId,
  name: "Owner dogfood plan",
  startDate: createDateOnly("2026-10-26"),
  targetRaceDate: createDateOnly("2027-04-18"),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const workout: PlannedWorkout = {
  id: workoutId,
  userId: ownerId,
  planId,
  scheduledDate: createDateOnly("2026-10-28"),
  phase: "base_building",
  status: "completed",
  kind: "run",
  purpose: "easy",
  targetDistance: createDistanceMeters(5_000),
  createdAt: timestamp,
  updatedAt: timestamp,
};
const run: CompletedRun = {
  id: createCompletedRunId("run-1"),
  userId: ownerId,
  plannedWorkoutPlanId: planId,
  plannedWorkoutId: workoutId,
  startedAt: timestamp,
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
  activePlanRevision: 1,
  approvedAt: timestamp,
  updatedAt: timestamp,
};
const generatedFixtureResult = planGenerationContractFixtures[0]?.result;

if (generatedFixtureResult?.kind !== "generated") {
  throw new Error("Expected the first contract fixture to contain a plan.");
}

const generatedPlan: GeneratedPlanResultV1 = generatedFixtureResult;

function renderOverview(
  overrides: Partial<{
    profile: UserProfile | null;
    activePlanState: ActivePlanState | null;
    plans: readonly TrainingPlan[];
    workouts: readonly PlannedWorkout[];
    runs: readonly CompletedRun[];
    sessionDraftPlan: typeof generatedPlan | null;
  }> = {},
) {
  return render(
    <InternalDogfoodJourneyOverview
      ownerId={ownerId}
      profile={overrides.profile === undefined ? profile : overrides.profile}
      activePlanState={
        overrides.activePlanState === undefined
          ? activePlanState
          : overrides.activePlanState
      }
      plans={overrides.plans ?? [plan]}
      workouts={overrides.workouts ?? [workout]}
      runs={overrides.runs ?? [run]}
      sessionDraftPlan={overrides.sessionDraftPlan ?? null}
    />,
  );
}

describe("InternalDogfoodJourneyOverview", () => {
  it("reports the synchronized evidence available for a ready owner snapshot", () => {
    renderOverview();

    const evidence = screen.getByRole("list", {
      name: "Synchronized owner evidence",
    });
    expect(within(evidence).getByText("Saved profile present")).toBeVisible();
    expect(within(evidence).getByText("Synchronized plan found")).toBeVisible();
    expect(
      within(evidence).getByText("Synchronized workouts found"),
    ).toBeVisible();
    expect(within(evidence).getByText("Synchronized runs found")).toBeVisible();
  });

  it("reports each missing prerequisite without implying methodology approval", () => {
    renderOverview({
      profile: null,
      activePlanState: null,
      plans: [],
      workouts: [],
      runs: [],
    });

    expect(screen.getByText("Save runner setup first")).toBeVisible();
    expect(screen.getByText("No synchronized active plan")).toBeVisible();
    expect(screen.getByText("No synchronized workouts")).toBeVisible();
    expect(screen.getByText("No synchronized runs")).toBeVisible();
    expect(
      screen.getByText(/does not mean the draft methodology is approved/iu),
    ).toBeVisible();
  });

  it("links the ordered journey to every existing rehearsal surface", () => {
    renderOverview();

    const navigation = screen.getByRole("navigation", {
      name: "Internal dogfood journey",
    });
    expect(
      within(navigation).getByRole("link", { name: "Review a draft plan" }),
    ).toHaveAttribute("href", "#internal-plan-proposal");
    expect(
      within(navigation).getByRole("link", {
        name: "Inspect synchronized history",
      }),
    ).toHaveAttribute("href", "#internal-adaptation-history");
    expect(
      within(navigation).getByRole("link", {
        name: "Compare frozen adaptation cases",
      }),
    ).toHaveAttribute("href", "#internal-adaptation-scenarios");
    expect(
      within(navigation).getByRole("link", { name: "Review draft guidance" }),
    ).toHaveAttribute("href", "#internal-guidance-review");
    expect(
      within(navigation).getByRole("link", {
        name: "Rehearse safety escalation",
      }),
    ).toHaveAttribute("href", "#internal-safety-review");
    expect(
      screen.getByText(/draft plan activation lasts only for this rehearsal/iu),
    ).toBeVisible();
  });

  it("identifies the exact active session draft without calling it synchronized", () => {
    renderOverview({ sessionDraftPlan: generatedPlan });

    const sessionDraft = screen.getByRole("region", {
      name: "Session draft plan",
    });
    expect(
      within(sessionDraft).getByText("Synthetic contract plan"),
    ).toBeVisible();
    expect(
      within(sessionDraft).getByText(
        "Starts Jan 7, 2030 · Race day Jan 13, 2030",
      ),
    ).toBeVisible();
    expect(
      within(sessionDraft).getByText(/active only in this workspace session/iu),
    ).toBeVisible();
  });

  it("has no beta-blocking accessibility violations", async () => {
    renderOverview();

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });
});
