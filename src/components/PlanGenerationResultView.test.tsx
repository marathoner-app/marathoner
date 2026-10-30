import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlanApprovalReceiptResult } from "../domain/materialCommands/contract";
import {
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  createDistanceMeters,
  createPlanGenerationReasonCode,
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

const supportReasonCodes = {
  cohortGate: createPlanGenerationReasonCode("TEST-COHORT-GATE"),
  experience: createPlanGenerationReasonCode("TEST-EXPERIENCE"),
  consistencyDuration: createPlanGenerationReasonCode("TEST-CONSISTENCY"),
  weeklyDistance: createPlanGenerationReasonCode("TEST-WEEKLY-DISTANCE"),
  runFrequency: createPlanGenerationReasonCode("TEST-RUN-FREQUENCY"),
  longestRun: createPlanGenerationReasonCode("TEST-LONGEST-RUN"),
  raceDateRequired: createPlanGenerationReasonCode("TEST-RACE-DATE"),
  raceHorizon: createPlanGenerationReasonCode("TEST-RACE-HORIZON"),
  raceAlignment: createPlanGenerationReasonCode("TEST-RACE-ALIGNMENT"),
  availability: createPlanGenerationReasonCode("TEST-AVAILABILITY"),
  scheduleConstraint: createPlanGenerationReasonCode("TEST-SCHEDULE-CONSTRAINT"),
};

const supportRules = {
  minimumConsistentRunningWeeks: 8,
  currentWeeklyDistanceMeters: { minimum: 40_000, maximum: 45_000 },
  currentRunningFrequencyDaysPerWeek: { minimum: 4, maximum: 5 },
  longestRecentRunDistanceMeters: { minimum: 14_000, maximum: 20_000 },
  minimumAvailableTrainingDays: 4,
  wholeWeeksFromPlanStartToRace: { minimum: 18, maximum: 22 },
  reasonCodes: supportReasonCodes,
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
  const client = approvalClient();
  return {
    input: generatedFixture.input,
    distanceUnit: "mile" as const,
    supportRules,
    onReviewInputs: vi.fn(),
    onReviewRunnerProfile: vi.fn(),
    approval: {
      expectedActivePlanRevision: null,
      client,
      reloadTrainingData: vi.fn().mockResolvedValue(undefined),
      onApproved: vi.fn(),
      createCommandId: () => approved.commandId,
    },
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
    expect(props.approval.client.submit).not.toHaveBeenCalled();
  });

  it("presents a generated proposal without activation controls when approval is unavailable", async () => {
    const user = userEvent.setup();
    const onReviewInputs = vi.fn();

    render(
      <PlanGenerationResultView
        input={generatedFixture.input}
        result={generatedFixture.result}
        distanceUnit="mile"
        supportRules={supportRules}
        onReviewInputs={onReviewInputs}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Synthetic contract plan" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue review" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review inputs" }));
    expect(onReviewInputs).toHaveBeenCalledOnce();
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
      screen.getByText(
        "At least one saved detail is outside this plan’s supported boundary.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue review" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review inputs" }));
    expect(props.onReviewRunnerProfile).toHaveBeenCalledOnce();
    expect(props.onReviewInputs).not.toHaveBeenCalled();
  });

  it("explains every recognized unsupported input in the runner's unit", () => {
    const props = commonProps();
    const result: UnsupportedPlanGenerationResultV1 = {
      ...unsupportedResult(),
      reasonCodes: [
        supportReasonCodes.weeklyDistance,
        supportReasonCodes.runFrequency,
        supportReasonCodes.longestRun,
      ],
    };
    const input = {
      ...generatedFixture.input,
      runner: {
        ...generatedFixture.input.runner,
        currentWeeklyDistance: createDistanceMeters(64_374),
        currentRunningFrequencyDaysPerWeek: 7,
        longestRecentRunDistance: createDistanceMeters(25_750),
      },
    };

    render(
      <PlanGenerationResultView
        {...props}
        input={input}
        result={result}
      />,
    );

    expect(screen.getByText("What needs review:")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByText(
        "Your saved weekly distance is 40 miles; this plan supports 24.9–28 miles per week.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your saved running frequency is 7 days per week; this plan supports 4–5.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your saved longest recent run is 16 miles; this plan supports 8.7–12.4 miles.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/TEST-WEEKLY-DISTANCE/)).not.toBeInTheDocument();
  });

  it("formats supported distance ranges in kilometers", () => {
    const props = commonProps();
    const result: UnsupportedPlanGenerationResultV1 = {
      ...unsupportedResult(),
      reasonCodes: [supportReasonCodes.weeklyDistance],
    };
    const input = {
      ...generatedFixture.input,
      runner: {
        ...generatedFixture.input.runner,
        currentWeeklyDistance: createDistanceMeters(50_000),
      },
    };

    render(
      <PlanGenerationResultView
        {...props}
        input={input}
        result={result}
        distanceUnit="kilometer"
      />,
    );

    expect(
      screen.getByText(
        "Your saved weekly distance is 50 kilometers; this plan supports 40–45 kilometers per week.",
      ),
    ).toBeInTheDocument();
  });

  it("routes plan-setting failures back to plan settings", async () => {
    const user = userEvent.setup();
    const props = commonProps();
    const result: UnsupportedPlanGenerationResultV1 = {
      ...unsupportedResult(),
      reasonCodes: [supportReasonCodes.raceHorizon],
    };

    render(<PlanGenerationResultView {...props} result={result} />);

    await user.click(screen.getByRole("button", { name: "Review inputs" }));
    expect(props.onReviewInputs).toHaveBeenCalledOnce();
    expect(props.onReviewRunnerProfile).not.toHaveBeenCalled();
  });

  it("renders an invalid-input state without internal fields or messages", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole("button", { name: "Review inputs" }));
    expect(props.onReviewRunnerProfile).toHaveBeenCalledOnce();
    expect(props.onReviewInputs).not.toHaveBeenCalled();
  });
});
