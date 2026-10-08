import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  planGenerationContractFixtures,
  type GeneratedPlanResultV1,
  type InvalidPlanGenerationResultV1,
  type UnsupportedPlanGenerationResultV1,
} from "../domain/training";
import PlanGenerationResultView from "./PlanGenerationResultView";

function generatedResult(): GeneratedPlanResultV1 {
  const fixture = planGenerationContractFixtures.find(
    (candidate) => candidate.id === "generated-exact-date-distance-target",
  );

  if (fixture?.result.kind !== "generated") {
    throw new Error("Expected the generated contract fixture.");
  }

  return fixture.result;
}

function unsupportedResult(): UnsupportedPlanGenerationResultV1 {
  const fixture = planGenerationContractFixtures.find(
    (candidate) => candidate.id === "unsupported-result-shape",
  );

  if (fixture?.result.kind !== "unsupported") {
    throw new Error("Expected the unsupported contract fixture.");
  }

  return fixture.result;
}

const invalidResult: InvalidPlanGenerationResultV1 = {
  schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  kind: "invalid_input",
  issues: [
    {
      code: "invalid_value",
      field: "runner.currentWeeklyDistance",
      message: "Internal fixture detail that must stay hidden.",
    },
  ],
};

describe("PlanGenerationResultView", () => {
  it("delegates a generated result to the inactive proposal review", async () => {
    const user = userEvent.setup();
    const onReviewInputs = vi.fn();
    const onContinueReview = vi.fn();

    render(
      <PlanGenerationResultView
        result={generatedResult()}
        onReviewInputs={onReviewInputs}
        onContinueReview={onContinueReview}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Proposed plan — not active",
    );

    await user.click(screen.getByRole("button", { name: "Review inputs" }));
    await user.click(screen.getByRole("button", { name: "Continue review" }));

    expect(onReviewInputs).toHaveBeenCalledOnce();
    expect(onContinueReview).toHaveBeenCalledOnce();
  });

  it("renders an honest unsupported state without internal reason codes", async () => {
    const user = userEvent.setup();
    const onReviewInputs = vi.fn();

    render(
      <PlanGenerationResultView
        result={unsupportedResult()}
        onReviewInputs={onReviewInputs}
        onContinueReview={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "A plan wasn’t created" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No plan created");
    expect(screen.queryByText(/FIXTURE-UNSUPPORTED/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue review" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review inputs" }));
    expect(onReviewInputs).toHaveBeenCalledOnce();
  });

  it("renders an invalid-input state without internal fields or messages", () => {
    render(
      <PlanGenerationResultView
        result={invalidResult}
        onReviewInputs={() => undefined}
        onContinueReview={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Review your running details" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No plan created");
    expect(
      screen.queryByText("runner.currentWeeklyDistance"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Internal fixture detail that must stay hidden."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review inputs" })).toBeEnabled();
  });
});
