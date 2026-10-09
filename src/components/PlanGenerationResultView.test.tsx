import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlanApprovalReceiptResult } from "../domain/materialCommands/contract";
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  planGenerationContractFixtures,
  type PlanGenerationContractFixtureV1,
  type InvalidPlanGenerationResultV1,
  type UnsupportedPlanGenerationResultV1,
} from "../domain/training";
import type { PlanApprovalClient } from "../services/planApprovalClient";
import PlanGenerationResultView from "./PlanGenerationResultView";

function fixture(fixtureId: string): PlanGenerationContractFixtureV1 {
  const match = planGenerationContractFixtures.find(
    (candidate) => candidate.id === fixtureId,
  );

  if (match === undefined) throw new Error(`Expected fixture ${fixtureId}.`);
  return match;
}

const generatedFixture = fixture("generated-exact-date-distance-target");
if (generatedFixture.result.kind !== "generated") {
  throw new Error("Expected the generated contract fixture.");
}

function unsupportedResult(): UnsupportedPlanGenerationResultV1 {
  const result = fixture("unsupported-result-shape").result;
  if (result.kind !== "unsupported") {
    throw new Error("Expected the unsupported contract fixture.");
  }
  return result;
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

const approved: PlanApprovalReceiptResult = {
  status: "plan_approved",
  commandId: "approve-plan-command-0001",
  planId: "plan-generated-0001",
  activePlanRevision: 1,
  approvedAt: "2026-10-08T00:00:00.000Z",
};

function approvalClient(): PlanApprovalClient {
  return {
    submit: vi.fn().mockResolvedValue(approved),
    resolve: vi.fn().mockResolvedValue(approved),
  };
}

function commonProps() {
  return {
    input: generatedFixture.input,
    expectedActivePlanRevision: null,
    approvalClient: approvalClient(),
    reloadTrainingData: vi.fn().mockResolvedValue(undefined),
    onReviewInputs: vi.fn(),
    onApproved: vi.fn(),
    createCommandId: () => approved.commandId,
  };
}

describe("PlanGenerationResultView", () => {
  it("continues a generated result into explicit final confirmation", async () => {
    const user = userEvent.setup();
    const props = commonProps();

    render(
      <PlanGenerationResultView
        {...props}
        result={generatedFixture.result}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Proposed plan — not active",
    );
    await user.click(screen.getByRole("button", { name: "Continue review" }));

    expect(
      screen.getByRole("heading", { name: "Activate Synthetic contract plan?" }),
    ).toHaveFocus();
    expect(props.approvalClient.submit).not.toHaveBeenCalled();
  });

  it("renders an honest unsupported state without internal reason codes", async () => {
    const user = userEvent.setup();
    const props = commonProps();

    render(
      <PlanGenerationResultView {...props} result={unsupportedResult()} />,
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
    expect(props.onReviewInputs).toHaveBeenCalledOnce();
  });

  it("renders an invalid-input state without internal fields or messages", () => {
    const props = commonProps();
    render(<PlanGenerationResultView {...props} result={invalidResult} />);

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
