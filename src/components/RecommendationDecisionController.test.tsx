import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  RecommendationDecisionReceiptResult,
} from "../domain/materialCommands/contract";
import { createRecommendationId } from "../domain/recommendations/recommendationEvidence";
import { createUtcDateTime } from "../domain/training/dates";
import type {
  RecommendationDecisionClient,
  RecommendationDecisionClientResult,
} from "../services/recommendationDecisionClient";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import RecommendationDecisionController, {
  type RecommendationDecisionControllerProps,
} from "./RecommendationDecisionController";
import type { RecommendationDecisionReviewModel } from "./RecommendationDecisionReview";

const commandId = "recommendation-decision-controller-0001";
const recommendationId = createRecommendationId(
  "recommendation-controller-0001",
);
const expectedEvaluatedPlanRevision = 4;

const model: RecommendationDecisionReviewModel = {
  title: "Give next week another steady pass",
  observation: "Two recent runs felt harder than planned.",
  meaning: "The next progression deserves another review.",
  recommendation: "Repeat the current targets before progressing.",
  impact: "The rest of the plan stays on its current schedule.",
  contentState: "reviewed",
};

const acceptedReceipt: RecommendationDecisionReceiptResult = {
  status: "recommendation_decided",
  commandId,
  recommendationId,
  decision: "accepted",
  evaluatedPlanRevision: expectedEvaluatedPlanRevision,
  resultingPlanRevision: 5,
  decidedAt: createUtcDateTime("2026-10-27T20:00:00.000Z"),
};

const declinedReceipt: RecommendationDecisionReceiptResult = {
  ...acceptedReceipt,
  decision: "declined",
  resultingPlanRevision: null,
};

function client(
  submitResult: RecommendationDecisionClientResult = acceptedReceipt,
  resolveResult: RecommendationDecisionClientResult = acceptedReceipt,
): RecommendationDecisionClient {
  return {
    submit: vi.fn().mockResolvedValue(submitResult),
    resolve: vi.fn().mockResolvedValue(resolveResult),
  };
}

function props(
  decisionClient: RecommendationDecisionClient,
  overrides: Partial<RecommendationDecisionControllerProps> = {},
): RecommendationDecisionControllerProps {
  return {
    model,
    recommendationId,
    expectedEvaluatedPlanRevision,
    decisionClient,
    createCommandId: () => commandId,
    ...overrides,
  };
}

describe("RecommendationDecisionController", () => {
  it("applies an explicit choice only after the matching server receipt", async () => {
    const user = userEvent.setup();
    const decisionClient = client();
    const onConfirmed = vi.fn();
    render(
      <RecommendationDecisionController
        {...props(decisionClient, { onConfirmed })}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );

    expect(decisionClient.submit).toHaveBeenCalledWith({
      commandId,
      recommendationId,
      decision: "accepted",
      expectedEvaluatedPlanRevision,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Recommendation applied",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "activated plan revision 5",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(onConfirmed).toHaveBeenCalledOnce();
    expect(onConfirmed).toHaveBeenCalledWith(acceptedReceipt);
  });

  it("records Keep current plan as a declined decision without implying a mutation", async () => {
    const user = userEvent.setup();
    const decisionClient = client(declinedReceipt);
    render(<RecommendationDecisionController {...props(decisionClient)} />);

    await user.click(
      screen.getByRole("button", { name: "Keep current plan" }),
    );

    expect(decisionClient.submit).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "declined" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Current plan kept",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "did not change your active plan",
    );
  });

  it("blocks repeated choices while the original command is pending", async () => {
    const user = userEvent.setup();
    let completeSubmission: (
      result: RecommendationDecisionClientResult,
    ) => void = () => undefined;
    const pendingResult = new Promise<RecommendationDecisionClientResult>(
      (resolve) => {
        completeSubmission = resolve;
      },
    );
    const decisionClient: RecommendationDecisionClient = {
      submit: vi.fn().mockReturnValue(pendingResult),
      resolve: vi.fn(),
    };
    const createCommandId = vi.fn(() => commandId);
    render(
      <RecommendationDecisionController
        {...props(decisionClient, { createCommandId })}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );
    expect(
      screen.getByRole("button", { name: "Applying change…" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Keep current plan" }));

    expect(decisionClient.submit).toHaveBeenCalledOnce();
    expect(createCommandId).toHaveBeenCalledOnce();

    completeSubmission(acceptedReceipt);
    expect(await screen.findByText("Recommendation applied")).toBeInTheDocument();
  });

  it("retries a retryable decision with the exact same submission", async () => {
    const user = userEvent.setup();
    const decisionClient = client();
    vi.mocked(decisionClient.submit)
      .mockResolvedValueOnce({
        status: "retryable_error",
        commandId,
        code: "temporarily-unavailable",
        message: "Temporarily unavailable.",
      })
      .mockResolvedValueOnce(acceptedReceipt);
    render(<RecommendationDecisionController {...props(decisionClient)} />);

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Try decision again" }),
    );

    expect(decisionClient.submit).toHaveBeenCalledTimes(2);
    expect(vi.mocked(decisionClient.submit).mock.calls[0]?.[0]).toEqual(
      vi.mocked(decisionClient.submit).mock.calls[1]?.[0],
    );
    expect(await screen.findByText("Recommendation applied")).toBeInTheDocument();
  });

  it("resolves an ambiguous result by command ID without resubmitting", async () => {
    const user = userEvent.setup();
    const decisionClient = client(
      {
        status: "outcome_unknown",
        commandId,
        code: "resolve-by-command-id",
        message: "Check this command.",
      },
      acceptedReceipt,
    );
    render(<RecommendationDecisionController {...props(decisionClient)} />);

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Check original decision" }),
    );

    expect(decisionClient.submit).toHaveBeenCalledOnce();
    expect(decisionClient.resolve).toHaveBeenCalledWith(commandId);
    expect(await screen.findByText("Recommendation applied")).toBeInTheDocument();
  });

  it("treats a thrown submission as ambiguous instead of sending a new decision", async () => {
    const user = userEvent.setup();
    const decisionClient = client();
    vi.mocked(decisionClient.submit).mockRejectedValueOnce(
      new Error("Response was lost"),
    );
    render(<RecommendationDecisionController {...props(decisionClient)} />);

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Check original decision" }),
    );

    expect(decisionClient.submit).toHaveBeenCalledOnce();
    expect(decisionClient.resolve).toHaveBeenCalledWith(commandId);
    expect(await screen.findByText("Recommendation applied")).toBeInTheDocument();
  });

  it("preserves an unresolved command when status resolution is still unavailable", async () => {
    const user = userEvent.setup();
    const unknown: RecommendationDecisionClientResult = {
      status: "outcome_unknown",
      commandId,
      code: "resolve-by-command-id",
      message: "Check this command.",
    };
    const decisionClient = client(unknown, unknown);
    render(<RecommendationDecisionController {...props(decisionClient)} />);

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Check original decision" }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Check original decision again",
      }),
    ).toBeEnabled();
    expect(decisionClient.submit).toHaveBeenCalledOnce();
    expect(decisionClient.resolve).toHaveBeenCalledOnce();
  });

  it("fails closed when the active plan revision is stale", async () => {
    const user = userEvent.setup();
    const decisionClient = client({
      status: "stale_revision",
      commandId,
      code: "active-plan-revision-changed",
      message: "The active plan changed.",
      expectedActivePlanRevision: expectedEvaluatedPlanRevision,
      actualActivePlanRevision: 5,
    });
    render(<RecommendationDecisionController {...props(decisionClient)} />);

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "needs a fresh review",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("did not apply");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("fails closed while recommendation decisions remain disabled", async () => {
    const user = userEvent.setup();
    const decisionClient = client({
      status: "authorization_error",
      commandId,
      code: "recommendation-decisions-not-enabled",
      message: "Recommendation decisions are disabled.",
    });
    render(<RecommendationDecisionController {...props(decisionClient)} />);

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Recommendation choices are paused",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "active plan was not changed",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    [
      {
        status: "authentication_error",
        commandId,
        code: "authentication-required",
        message: "Sign in.",
      } as const,
      "Your account needs attention",
    ],
    [
      {
        status: "authorization_error",
        commandId,
        code: "app-check-required",
        message: "App Check required.",
      } as const,
      "could not verify this app session",
    ],
    [
      {
        status: "unsupported_version",
        commandId,
        code: "unsupported-command-schema-version",
        message: "Update required.",
        supportedVersion: 1,
      } as const,
      "Update Marathoner before deciding",
    ],
    [
      {
        status: "validation_error",
        commandId,
        code: "invalid-recommendation-decision",
        message: "Invalid decision.",
      } as const,
      "cannot be decided safely",
    ],
    [
      {
        status: "conflict",
        commandId,
        code: "command-id-reused",
        message: "Command ID reused.",
      } as const,
      "could not be safely repeated",
    ],
  ])("removes actions after a definitive fail-closed result", async (result, copy) => {
    const user = userEvent.setup();
    render(
      <RecommendationDecisionController
        {...props(client(result as RecommendationDecisionClientResult))}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not confirm a valid receipt that belongs to another review", async () => {
    const user = userEvent.setup();
    const onConfirmed = vi.fn();
    const mismatchedReceipt: RecommendationDecisionReceiptResult = {
      ...acceptedReceipt,
      recommendationId: createRecommendationId("another-recommendation-0001"),
    };
    render(
      <RecommendationDecisionController
        {...props(client(mismatchedReceipt), { onConfirmed })}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "did not match this review",
    );
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("has no beta-blocking accessibility violations before and after a decision", async () => {
    const user = userEvent.setup();
    const decisionClient = client(declinedReceipt);
    render(<RecommendationDecisionController {...props(decisionClient)} />);

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
    await user.click(
      screen.getByRole("button", { name: "Keep current plan" }),
    );
    expect(await screen.findByText("Current plan kept")).toBeInTheDocument();
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });
});
