import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  planGenerationContractFixtures,
  projectGeneratedPlanEntities,
} from "../domain/training";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import InternalSessionPlanSchedule from "./InternalSessionPlanSchedule";

const generatedResult = planGenerationContractFixtures[0]?.result;

if (generatedResult?.kind !== "generated") {
  throw new Error("Expected the first contract fixture to contain a plan.");
}

const projection = projectGeneratedPlanEntities({
  proposal: generatedResult.plan,
  ownerId: createUserId("owner-1"),
  planId: createTrainingPlanId("session-plan-1"),
  projectedAt: createUtcDateTime("2026-10-28T18:00:00.000Z"),
  status: "active",
});

describe("InternalSessionPlanSchedule", () => {
  it("renders the active session draft through the real calendar", () => {
    render(
      <InternalSessionPlanSchedule
        projection={projection}
        distanceUnit="mile"
        isAdapted={false}
      />,
    );

    const schedule = screen.getByRole("region", {
      name: "Session-only plan calendar",
    });
    expect(schedule).toHaveTextContent("Synthetic contract plan");
    expect(
      screen.getByRole("heading", { name: "Week 1 of 1" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Tue, Jan 8 Easy run 3.1 mi Scheduled",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/does not replace synchronized Plan or Track data/iu),
    ).toBeVisible();
  });

  it("disappears when the session activation is cleared", () => {
    const { rerender } = render(
      <InternalSessionPlanSchedule
        projection={projection}
        distanceUnit="mile"
        isAdapted={false}
      />,
    );

    rerender(
      <InternalSessionPlanSchedule
        projection={null}
        distanceUnit="mile"
        isAdapted={false}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "Session-only plan calendar" }),
    ).not.toBeInTheDocument();
  });

  it("identifies an accepted rehearsal adjustment without implying persistence", () => {
    render(
      <InternalSessionPlanSchedule
        projection={projection}
        distanceUnit="mile"
        isAdapted={true}
      />,
    );

    const schedule = screen.getByRole("region", {
      name: "Session-only plan calendar",
    });
    expect(schedule).toHaveTextContent(
      "Adjusted owner-only session projection",
    );
    expect(schedule).toHaveTextContent(
      "This is the accepted rehearsal adjustment rendered through Marathoner's real plan calendar.",
    );
    expect(schedule).toHaveTextContent(
      "It exists only in memory and does not replace synchronized Plan or Track data.",
    );
  });

  it("has no beta-blocking accessibility violations", async () => {
    render(
      <InternalSessionPlanSchedule
        projection={projection}
        distanceUnit="mile"
        isAdapted={false}
      />,
    );

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });
});
