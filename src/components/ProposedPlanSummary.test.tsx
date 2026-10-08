import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  planGenerationContractFixtures,
  type GeneratedPlanResultV1,
} from "../domain/training";
import ProposedPlanSummary from "./ProposedPlanSummary";

function generatedResult(fixtureId: string): GeneratedPlanResultV1 {
  const fixture = planGenerationContractFixtures.find(
    (candidate) => candidate.id === fixtureId,
  );

  if (fixture?.result.kind !== "generated") {
    throw new Error(`Expected generated fixture ${fixtureId}.`);
  }

  return fixture.result;
}

describe("ProposedPlanSummary", () => {
  it("presents the synthetic proposal as inactive with its dates and provenance", () => {
    render(
      <ProposedPlanSummary
        result={generatedResult("generated-exact-date-distance-target")}
        onReviewInputs={() => undefined}
        onContinueReview={() => undefined}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Proposed plan — not active",
    );
    expect(
      screen.getByRole("heading", { name: "Synthetic contract plan" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Proposed plan dates")).getByText(
        "Jan 7, 2030",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("fixture-rules@1.0.0")).toBeInTheDocument();
    expect(screen.getByText("fixture-generator@1.0.0")).toBeInTheDocument();
    expect(screen.queryByText(/FIXTURE-/)).not.toBeInTheDocument();
  });

  it("lists phases, weeks, and distance or rest workouts", () => {
    render(
      <ProposedPlanSummary
        result={generatedResult("generated-exact-date-distance-target")}
        onReviewInputs={() => undefined}
        onContinueReview={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Week 1: Base building" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Easy run")).toBeInTheDocument();
    expect(screen.getByText("3.1 mi")).toBeInTheDocument();
    expect(screen.getByText("Rest")).toBeInTheDocument();
  });

  it("formats duration targets and calls only the supplied review actions", async () => {
    const user = userEvent.setup();
    const onReviewInputs = vi.fn();
    const onContinueReview = vi.fn();

    render(
      <ProposedPlanSummary
        result={generatedResult("generated-target-window-duration-target")}
        onReviewInputs={onReviewInputs}
        onContinueReview={onContinueReview}
      />,
    );

    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("35 min")).toBeInTheDocument();
    expect(screen.getByText("Walk/run")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review inputs" }));
    await user.click(screen.getByRole("button", { name: "Continue review" }));

    expect(onReviewInputs).toHaveBeenCalledOnce();
    expect(onContinueReview).toHaveBeenCalledOnce();
  });
});
