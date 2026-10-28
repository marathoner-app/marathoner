import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RecommendationDecisionReceiptResult } from "../domain/materialCommands/contract";
import {
  createRecommendationId,
  type RecommendationDecision,
  type RecommendationEvidenceV2,
} from "../domain/recommendations/recommendationEvidence";
import { createUtcDateTime } from "../domain/training";
import { RecommendationEvidenceContext } from "../recommendations/RecommendationEvidenceContext";
import type { RecommendationEvidenceContextValue } from "../recommendations/RecommendationEvidenceContext";
import type { RecommendationDecisionClient } from "../services/recommendationDecisionClient";
import RecommendationDecisionInbox, {
  type RecommendationDecisionInboxProps,
} from "./RecommendationDecisionInbox";
import type { RecommendationDecisionReviewModel } from "./RecommendationDecisionReview";

const firstRecommendationId = createRecommendationId(
  "recommendation-inbox-0001",
);
const secondRecommendationId = createRecommendationId(
  "recommendation-inbox-0002",
);
const commandId = "recommendation-inbox-command-0001";

const reviewedModel: RecommendationDecisionReviewModel = {
  title: "Give next week another steady pass",
  observation: "Two recent runs felt harder than planned.",
  meaning: "The next progression deserves another review.",
  recommendation: "Repeat the current targets before progressing.",
  impact: "The rest of the plan stays on its current schedule.",
  contentState: "reviewed",
};

function evidence(
  recommendationId = firstRecommendationId,
  decision: RecommendationDecision = "pending",
  evaluatedPlanRevision = 4,
): RecommendationEvidenceV2 {
  return {
    recommendationId,
    decision,
    evaluationInput: { evaluatedPlanRevision },
  } as unknown as RecommendationEvidenceV2;
}

function receiptFor(
  recommendationId: typeof firstRecommendationId,
  evaluatedPlanRevision: number,
): RecommendationDecisionReceiptResult {
  return {
    status: "recommendation_decided",
    commandId,
    recommendationId,
    decision: "accepted",
    evaluatedPlanRevision,
    resultingPlanRevision: evaluatedPlanRevision + 1,
    decidedAt: createUtcDateTime("2026-10-28T17:00:00.000Z"),
  };
}

function decisionClient(): RecommendationDecisionClient {
  return {
    submit: vi.fn(async (submission) =>
      receiptFor(
        submission.recommendationId,
        submission.expectedEvaluatedPlanRevision,
      ),
    ),
    resolve: vi.fn(),
  };
}

function contextValue(
  overrides: Partial<RecommendationEvidenceContextValue> = {},
): RecommendationEvidenceContextValue {
  return {
    status: "ready",
    evidence: [evidence()],
    origin: "server",
    hasPendingWrites: false,
    error: null,
    retry: vi.fn(),
    ...overrides,
  };
}

function inbox(
  value: RecommendationEvidenceContextValue,
  props: Partial<RecommendationDecisionInboxProps> = {},
) {
  const client = props.decisionClient ?? decisionClient();
  const resolveReviewModel = props.resolveReviewModel ?? vi.fn(() => reviewedModel);

  return {
    client,
    resolveReviewModel,
    element: (
      <RecommendationEvidenceContext.Provider value={value}>
        <RecommendationDecisionInbox
          decisionClient={client}
          resolveReviewModel={resolveReviewModel}
          createCommandId={() => commandId}
          {...props}
        />
      </RecommendationEvidenceContext.Provider>
    ),
  };
}

describe("RecommendationDecisionInbox", () => {
  it("routes one authoritative pending recommendation into a reviewed decision", async () => {
    const user = userEvent.setup();
    const pending = evidence(firstRecommendationId, "pending", 7);
    const onConfirmed = vi.fn();
    const view = inbox(
      contextValue({ evidence: [pending] }),
      { onConfirmed },
    );
    render(view.element);

    expect(view.resolveReviewModel).toHaveBeenCalledWith(pending);
    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );

    expect(view.client.submit).toHaveBeenCalledWith({
      commandId,
      recommendationId: firstRecommendationId,
      decision: "accepted",
      expectedEvaluatedPlanRevision: 7,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "activated plan revision 8",
    );
    expect(onConfirmed).toHaveBeenCalledOnce();
  });

  it("does not present accepted or declined evidence as a pending choice", () => {
    const view = inbox(
      contextValue({
        evidence: [
          evidence(firstRecommendationId, "accepted"),
          evidence(secondRecommendationId, "declined"),
        ],
      }),
    );
    const rendered = render(view.element);

    expect(rendered.container).toBeEmptyDOMElement();
    expect(view.resolveReviewModel).not.toHaveBeenCalled();
    expect(view.client.submit).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "the provider is loading",
      value: contextValue({ status: "loading" }),
      resolver: vi.fn(() => reviewedModel),
      role: "status" as const,
      expected: "Checking for a plan recommendation",
    },
    {
      name: "the provider reports an error",
      value: contextValue({
        status: "error",
        error: "Recommendation history could not be synchronized.",
      }),
      resolver: vi.fn(() => reviewedModel),
      role: "alert" as const,
      expected: "Recommendation history is unavailable",
    },
    {
      name: "the snapshot came from cache",
      value: contextValue({ origin: "cache" }),
      resolver: vi.fn(() => reviewedModel),
      role: "status" as const,
      expected: "Recommendation is syncing",
    },
    {
      name: "the snapshot has pending writes",
      value: contextValue({ hasPendingWrites: true }),
      resolver: vi.fn(() => reviewedModel),
      role: "status" as const,
      expected: "Recommendation is syncing",
    },
    {
      name: "more than one recommendation is pending",
      value: contextValue({
        evidence: [evidence(), evidence(secondRecommendationId)],
      }),
      resolver: vi.fn(() => reviewedModel),
      role: "alert" as const,
      expected: "Recommendation review is unavailable",
    },
    {
      name: "reviewed copy is missing",
      value: contextValue(),
      resolver: vi.fn(() => null),
      role: "alert" as const,
      expected: "Recommendation explanation is not ready",
    },
    {
      name: "the copy resolver fails",
      value: contextValue(),
      resolver: vi.fn(() => {
        throw new Error("unmapped reason code");
      }),
      role: "alert" as const,
      expected: "Recommendation explanation is not ready",
    },
    {
      name: "the resolver returns internal preview copy",
      value: contextValue(),
      resolver: vi.fn(() => ({
        ...reviewedModel,
        contentState: "internal_preview" as const,
      })),
      role: "alert" as const,
      expected: "Recommendation explanation is not ready",
    },
  ])(
    "exposes no decision controls when $name",
    ({ value, resolver, role, expected }) => {
      const view = inbox(value, { resolveReviewModel: resolver });
      render(view.element);

      expect(screen.getByRole(role)).toHaveTextContent(expected);
      expect(
        screen.queryByRole("button", { name: "Apply this change" }),
      ).not.toBeInTheDocument();
      expect(view.client.submit).not.toHaveBeenCalled();
    },
  );

  it("retries the evidence provider without submitting a decision", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const view = inbox(contextValue({ status: "error", retry }));
    render(view.element);

    await user.click(
      screen.getByRole("button", { name: "Try loading again" }),
    );

    expect(retry).toHaveBeenCalledOnce();
    expect(view.client.submit).not.toHaveBeenCalled();
  });

  it("creates a fresh controller when the pending recommendation changes", async () => {
    const user = userEvent.setup();
    const client = decisionClient();
    const first = inbox(contextValue(), { decisionClient: client });
    const rendered = render(first.element);

    await user.click(
      screen.getByRole("button", { name: "Apply this change" }),
    );
    expect(await screen.findByText("Recommendation applied")).toBeInTheDocument();

    const second = inbox(
      contextValue({
        evidence: [evidence(secondRecommendationId, "pending", 9)],
      }),
      { decisionClient: client },
    );
    rendered.rerender(second.element);

    expect(
      screen.getByRole("button", { name: "Apply this change" }),
    ).toBeEnabled();
  });
});
