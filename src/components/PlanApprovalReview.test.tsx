import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  MaterialCommandResult,
  PlanApprovalReceiptResult,
} from "../domain/materialCommands/contract";
import {
  planGenerationContractFixtures,
  type GeneratedPlanResultV1,
  type PlanGenerationContractFixtureV1,
} from "../domain/training";
import type {
  PlanApprovalClient,
  PlanApprovalClientResult,
} from "../services/planApprovalClient";
import PlanApprovalReview, {
  type PlanApprovalReviewProps,
} from "./PlanApprovalReview";

function fixture(fixtureId: string): PlanGenerationContractFixtureV1 & {
  result: GeneratedPlanResultV1;
} {
  const match = planGenerationContractFixtures.find(
    (candidate) => candidate.id === fixtureId,
  );
  if (match?.result.kind !== "generated") {
    throw new Error(`Expected generated fixture ${fixtureId}.`);
  }
  return { ...match, result: match.result };
}

const reviewedFixture = fixture("generated-exact-date-distance-target");
const alternateFixture = fixture("generated-target-window-duration-target");
const commandId = "approve-plan-command-0001";

function approved(id = commandId): PlanApprovalReceiptResult {
  return {
    status: "plan_approved",
    commandId: id,
    planId: "plan-generated-0001",
    activePlanRevision: 1,
    approvedAt: "2026-10-08T00:00:00.000Z",
  };
}

function client(
  submitResult: PlanApprovalClientResult = approved(),
  resolveResult: PlanApprovalClientResult = approved(),
): PlanApprovalClient {
  return {
    submit: vi.fn().mockResolvedValue(submitResult),
    resolve: vi.fn().mockResolvedValue(resolveResult),
  };
}

function baseProps(
  approvalClient: PlanApprovalClient = client(),
): PlanApprovalReviewProps {
  return {
    input: reviewedFixture.input,
    result: reviewedFixture.result,
    expectedActivePlanRevision: null,
    approvalClient,
    reloadTrainingData: vi.fn().mockResolvedValue(undefined),
    onReviewInputs: vi.fn(),
    onApproved: vi.fn(),
    createCommandId: () => commandId,
  };
}

async function continueToConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continue review" }));
}

describe("PlanApprovalReview", () => {
  it("explains activation, moves focus, and allows backing out without submitting", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<PlanApprovalReview {...props} />);

    await continueToConfirmation(user);

    expect(
      screen.getByRole("heading", { name: "Activate Synthetic contract plan?" }),
    ).toHaveFocus();
    expect(screen.getByText(/exact reviewed proposal/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Plan being activated")).toHaveTextContent(
      "Jan 7, 2030",
    );
    expect(screen.getByLabelText("Plan being activated")).toHaveTextContent(
      "1 week · 2 workouts",
    );

    await user.click(screen.getByRole("button", { name: "Back to plan details" }));
    expect(
      screen.getByRole("heading", { name: "Synthetic contract plan" }),
    ).toBeInTheDocument();
    await continueToConfirmation(user);
    await user.click(screen.getByRole("button", { name: "Review inputs" }));

    expect(props.onReviewInputs).toHaveBeenCalledOnce();
    expect(props.approvalClient.submit).not.toHaveBeenCalled();
  });

  it("submits one retained command with the exact reviewed snapshot and blocks repeated clicks", async () => {
    const user = userEvent.setup();
    let finishSubmission: ((result: PlanApprovalClientResult) => void) | undefined;
    const approvalClient = client();
    vi.mocked(approvalClient.submit).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSubmission = resolve;
        }),
    );
    const props = baseProps(approvalClient);
    const view = render(<PlanApprovalReview {...props} />);
    await continueToConfirmation(user);

    view.rerender(
      <PlanApprovalReview
        {...props}
        input={alternateFixture.input}
        result={alternateFixture.result}
      />,
    );
    const approveButton = screen.getByRole("button", {
      name: "Approve and activate",
    });
    await user.click(approveButton);
    await user.click(approveButton);

    expect(approvalClient.submit).toHaveBeenCalledOnce();
    expect(approvalClient.submit).toHaveBeenCalledWith({
      commandId,
      expectedActivePlanRevision: null,
      input: reviewedFixture.input,
      proposal: reviewedFixture.result.plan,
    });
    expect(approveButton).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Approving this plan");

    finishSubmission?.(approved());
    await screen.findByRole("heading", { name: "Synthetic contract plan is active" });
  });

  it("reloads owned training data before completing the approved journey", async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const approvalClient = client();
    vi.mocked(approvalClient.submit).mockImplementation(async () => {
      events.push("approved");
      return approved();
    });
    const props = {
      ...baseProps(approvalClient),
      reloadTrainingData: vi.fn().mockImplementation(async () => {
        events.push("reloaded");
      }),
      onApproved: vi.fn().mockImplementation(() => events.push("shown")),
    };
    render(<PlanApprovalReview {...props} />);

    await continueToConfirmation(user);
    await user.click(screen.getByRole("button", { name: "Approve and activate" }));

    expect(
      await screen.findByRole("heading", { name: "Synthetic contract plan is active" }),
    ).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "active plan and next workout are now available",
    );
    expect(events).toEqual(["approved", "reloaded", "shown"]);
    expect(props.onApproved).toHaveBeenCalledWith(approved());
  });

  it("shows a stale revision as a distinct no-retry state", async () => {
    const user = userEvent.setup();
    const stale: MaterialCommandResult = {
      status: "stale_revision",
      commandId,
      code: "active-plan-revision-changed",
      message: "The active plan changed.",
      expectedActivePlanRevision: null,
      actualActivePlanRevision: 2,
    };
    const props = baseProps(client(stale));
    render(<PlanApprovalReview {...props} />);

    await continueToConfirmation(user);
    await user.click(screen.getByRole("button", { name: "Approve and activate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The active plan changed",
    );
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(
      screen.queryByRole("button", { name: "Try approval again" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review inputs" })).toBeEnabled();
  });

  it("retries an offline or temporary failure with the same command ID", async () => {
    const user = userEvent.setup();
    const retryable: MaterialCommandResult = {
      status: "retryable_error",
      commandId,
      code: "temporarily-unavailable",
      message: "You are offline. This command was not queued; reconnect and try again.",
    };
    const approvalClient = client(retryable);
    vi.mocked(approvalClient.submit)
      .mockResolvedValueOnce(retryable)
      .mockResolvedValueOnce(approved());
    const props = baseProps(approvalClient);
    render(<PlanApprovalReview {...props} />);

    await continueToConfirmation(user);
    await user.click(screen.getByRole("button", { name: "Approve and activate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not queued");
    await user.click(screen.getByRole("button", { name: "Try approval again" }));

    await screen.findByRole("heading", { name: "Synthetic contract plan is active" });
    expect(approvalClient.submit).toHaveBeenCalledTimes(2);
    expect(vi.mocked(approvalClient.submit).mock.calls[0]?.[0].commandId).toBe(
      commandId,
    );
    expect(vi.mocked(approvalClient.submit).mock.calls[1]?.[0].commandId).toBe(
      commandId,
    );
  });

  it.each([
    [
      "authentication",
      {
        status: "authentication_error",
        commandId,
        code: "verified-email-required",
        message: "Verify the account email.",
      } satisfies PlanApprovalClientResult,
      "Verify your account email",
    ],
    [
      "authorization",
      {
        status: "authorization_error",
        commandId,
        code: "plan-artifact-not-approved",
        message: "The artifact is not approved.",
      } satisfies PlanApprovalClientResult,
      "not created from an approved Marathoner methodology",
    ],
  ])("shows a calm, distinct %s state", async (_, result, message) => {
    const user = userEvent.setup();
    render(<PlanApprovalReview {...baseProps(client(result))} />);

    await continueToConfirmation(user);
    await user.click(screen.getByRole("button", { name: "Approve and activate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("resolves an unknown outcome by the original ID without another submission", async () => {
    const user = userEvent.setup();
    const unknown: PlanApprovalClientResult = {
      status: "outcome_unknown",
      commandId,
      code: "resolve-by-command-id",
      message: "Resolve the original command.",
    };
    const approvalClient = client(unknown, approved());
    const props = baseProps(approvalClient);
    render(<PlanApprovalReview {...props} />);

    await continueToConfirmation(user);
    await user.click(screen.getByRole("button", { name: "Approve and activate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Approval status needs checking",
    );
    expect(
      screen.queryByRole("button", { name: /approve/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check original approval" }));

    await screen.findByRole("heading", { name: "Synthetic contract plan is active" });
    expect(approvalClient.submit).toHaveBeenCalledOnce();
    expect(approvalClient.resolve).toHaveBeenCalledWith(commandId);
    expect(props.reloadTrainingData).toHaveBeenCalledOnce();
  });

  it("keeps resolution mandatory when checking the original approval is retryable", async () => {
    const user = userEvent.setup();
    const unknown: PlanApprovalClientResult = {
      status: "outcome_unknown",
      commandId,
      code: "resolve-by-command-id",
      message: "Resolve the original command.",
    };
    const retryable: PlanApprovalClientResult = {
      status: "retryable_error",
      commandId,
      code: "temporarily-unavailable",
      message: "Offline.",
    };
    const approvalClient = client(unknown, retryable);
    render(<PlanApprovalReview {...baseProps(approvalClient)} />);

    await continueToConfirmation(user);
    await user.click(screen.getByRole("button", { name: "Approve and activate" }));
    await user.click(
      await screen.findByRole("button", { name: "Check original approval" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not reach the original approval",
    );
    expect(
      screen.getByRole("button", { name: "Check original approval" }),
    ).toBeEnabled();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(approvalClient.submit).toHaveBeenCalledOnce();
  });

  it("retries only the data reload after an approval receipt", async () => {
    const user = userEvent.setup();
    const approvalClient = client();
    const reloadTrainingData = vi
      .fn()
      .mockRejectedValueOnce(new Error("read failed"))
      .mockResolvedValueOnce(undefined);
    const props = {
      ...baseProps(approvalClient),
      reloadTrainingData,
    };
    render(<PlanApprovalReview {...props} />);

    await continueToConfirmation(user);
    await user.click(screen.getByRole("button", { name: "Approve and activate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "plan is active, but this screen is out of date",
    );
    expect(
      screen.queryByRole("button", { name: /approve/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reload training data" }));

    await screen.findByRole("heading", { name: "Synthetic contract plan is active" });
    expect(approvalClient.submit).toHaveBeenCalledOnce();
    expect(reloadTrainingData).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(props.onApproved).toHaveBeenCalledOnce());
  });
});
