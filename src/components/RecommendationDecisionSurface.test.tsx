import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createRecommendationId,
  type RecommendationEvidenceV2,
} from "../domain/recommendations";
import {
  RecommendationEvidenceContext,
  type RecommendationEvidenceContextValue,
} from "../recommendations/RecommendationEvidenceContext";
import RecommendationDecisionSurface from "./RecommendationDecisionSurface";

const pendingEvidence = {
  recommendationId: createRecommendationId("surface-recommendation-0001"),
  decision: "pending",
  evaluationInput: { evaluatedPlanRevision: 3 },
} as unknown as RecommendationEvidenceV2;
const acceptedEvidence = {
  ...pendingEvidence,
  decision: "accepted" as const,
};

const submitDecision = vi.hoisted(() => vi.fn());

vi.mock("../services/firebaseRecommendationDecisionClient", () => ({
  firebaseRecommendationDecisionClient: {
    submit: submitDecision,
    resolve: vi.fn(),
  },
}));

function value(
  overrides: Partial<RecommendationEvidenceContextValue> = {},
): RecommendationEvidenceContextValue {
  return {
    status: "ready",
    evidence: [],
    origin: "server",
    hasPendingWrites: false,
    error: null,
    retry: vi.fn(),
    ...overrides,
  };
}

function renderSurface(context: RecommendationEvidenceContextValue) {
  return render(
    <RecommendationEvidenceContext.Provider value={context}>
      <RecommendationDecisionSurface />
    </RecommendationEvidenceContext.Provider>,
  );
}

describe("RecommendationDecisionSurface", () => {
  it.each(["loading", "ready", "error"] as const)(
    "stays silent with no known evidence while the provider is %s",
    (status) => {
      const rendered = renderSurface(value({ status }));

      expect(rendered.container).toBeEmptyDOMElement();
    },
  );

  it.each(["loading", "ready", "error"] as const)(
    "stays silent for decided history while the provider is %s",
    (status) => {
      const rendered = renderSurface(
        value({ status, evidence: [acceptedEvidence] }),
      );

      expect(rendered.container).toBeEmptyDOMElement();
    },
  );

  it("fails closed when known pending evidence has no reviewed copy", async () => {
    renderSurface(value({ evidence: [pendingEvidence] }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Recommendation explanation is not ready",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(submitDecision).not.toHaveBeenCalled();
  });
});
