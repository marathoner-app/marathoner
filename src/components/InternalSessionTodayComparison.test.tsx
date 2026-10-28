import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createCompletedRunId,
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  planGenerationContractFixtures,
  projectGeneratedPlanEntities,
  type CompletedRun,
} from "../domain/training";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import InternalSessionTodayComparison from "./InternalSessionTodayComparison";

const generatedResult = planGenerationContractFixtures[0]?.result;

if (generatedResult?.kind !== "generated") {
  throw new Error("Expected the first contract fixture to contain a plan.");
}

const ownerId = createUserId("owner-1");
const timeZone = createIanaTimeZone("America/Los_Angeles");
const projection = projectGeneratedPlanEntities({
  proposal: generatedResult.plan,
  ownerId,
  planId: createTrainingPlanId("session-plan-1"),
  projectedAt: createUtcDateTime("2030-01-08T18:00:00.000Z"),
  status: "active",
});
const run: CompletedRun = {
  id: createCompletedRunId("run-1"),
  userId: ownerId,
  startedAt: createUtcDateTime("2030-01-09T07:30:00.000Z"),
  timeZone,
  distance: createDistanceMeters(5_000),
  duration: createDurationSeconds(1_800),
  createdAt: createUtcDateTime("2030-01-09T07:31:00.000Z"),
  updatedAt: createUtcDateTime("2030-01-09T07:31:00.000Z"),
};

describe("InternalSessionTodayComparison", () => {
  it("compares a draft workout with a synchronized run on the same local date", () => {
    render(
      <InternalSessionTodayComparison
        projection={projection}
        runs={[run]}
        distanceUnit="mile"
        timeZone={timeZone}
        today={createDateOnly("2030-01-08")}
      />,
    );

    const comparison = screen.getByRole("region", {
      name: "Today in the session draft",
    });
    expect(comparison).toHaveTextContent("Tuesday, January 8, 2030");
    expect(
      within(comparison).getByRole("heading", { name: "Draft schedule" }),
    ).toBeVisible();
    expect(comparison).toHaveTextContent("Easy run");
    expect(comparison).toHaveTextContent("3.11 mi");
    expect(comparison).toHaveTextContent("30 min");
    expect(
      within(comparison).getByRole("complementary", {
        name: "Comparison boundary",
      }),
    ).toHaveTextContent("not associated with the draft plan or workouts");
  });

  it("distinguishes rest, an empty schedule, and no synchronized run", () => {
    const { rerender } = render(
      <InternalSessionTodayComparison
        projection={projection}
        runs={[]}
        distanceUnit="mile"
        timeZone={timeZone}
        today={createDateOnly("2030-01-09")}
      />,
    );

    expect(
      screen.getByText("The session draft schedules a rest day today."),
    ).toBeVisible();
    expect(
      screen.getByText("No synchronized run is logged for today."),
    ).toBeVisible();

    rerender(
      <InternalSessionTodayComparison
        projection={projection}
        runs={[]}
        distanceUnit="mile"
        timeZone={timeZone}
        today={createDateOnly("2030-01-10")}
      />,
    );

    expect(
      screen.getByText(
        "No training workout is scheduled in the session draft today.",
      ),
    ).toBeVisible();
  });

  it("uses the selected distance unit and disappears when activation clears", () => {
    const { rerender } = render(
      <InternalSessionTodayComparison
        projection={projection}
        runs={[run]}
        distanceUnit="kilometer"
        timeZone={timeZone}
        today={createDateOnly("2030-01-08")}
      />,
    );

    expect(screen.getAllByText("5 km")).toHaveLength(2);

    rerender(
      <InternalSessionTodayComparison
        projection={null}
        runs={[run]}
        distanceUnit="kilometer"
        timeZone={timeZone}
        today={createDateOnly("2030-01-08")}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "Today in the session draft" }),
    ).not.toBeInTheDocument();
  });

  it("has no beta-blocking accessibility violations", async () => {
    render(
      <InternalSessionTodayComparison
        projection={projection}
        runs={[run]}
        distanceUnit="mile"
        timeZone={timeZone}
        today={createDateOnly("2030-01-08")}
      />,
    );

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });
});
