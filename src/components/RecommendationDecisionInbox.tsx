import { useId } from "react";

import type { RecommendationDecisionReceiptResult } from "../domain/materialCommands/contract";
import type { RecommendationEvidenceV2 } from "../domain/recommendations/recommendationEvidence";
import type { RecommendationDecisionClient } from "../services/recommendationDecisionClient";
import { useRecommendationEvidence } from "../recommendations/useRecommendationEvidence";
import RecommendationDecisionController from "./RecommendationDecisionController";
import type { RecommendationDecisionReviewModel } from "./RecommendationDecisionReview";

import "./RecommendationDecisionInbox.css";

export type RecommendationReviewModelResolver = (
  evidence: RecommendationEvidenceV2,
) => RecommendationDecisionReviewModel | null;

export interface RecommendationDecisionInboxProps {
  readonly decisionClient: RecommendationDecisionClient;
  readonly resolveReviewModel: RecommendationReviewModelResolver;
  readonly onConfirmed?: (receipt: RecommendationDecisionReceiptResult) => void;
  readonly createCommandId?: () => string;
}

interface InboxStateProps {
  readonly title: string;
  readonly message: string;
  readonly kind: "status" | "alert";
  readonly onRetry?: () => void;
}

function InboxState({
  title,
  message,
  kind,
  onRetry,
}: InboxStateProps) {
  const titleId = useId();

  return (
    <section
      className="recommendation-decision-inbox-state"
      aria-labelledby={titleId}
      role={kind}
      aria-live={kind === "status" ? "polite" : undefined}
    >
      <p className="recommendation-decision-inbox-eyebrow">
        Plan recommendation
      </p>
      <h2 id={titleId}>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="secondary" onClick={onRetry}>
          Try loading again
        </button>
      )}
    </section>
  );
}

export default function RecommendationDecisionInbox({
  decisionClient,
  resolveReviewModel,
  onConfirmed,
  createCommandId,
}: RecommendationDecisionInboxProps) {
  const recommendationState = useRecommendationEvidence();
  const pendingEvidence = recommendationState.evidence.filter(
    ({ decision }) => decision === "pending",
  );

  if (recommendationState.status === "loading") {
    return (
      <InboxState
        kind="status"
        title="Checking for a plan recommendation"
        message="Marathoner is confirming the latest recommendation history before offering any choice."
      />
    );
  }

  if (recommendationState.status === "error") {
    return (
      <InboxState
        kind="alert"
        title="Recommendation history is unavailable"
        message="Marathoner could not confirm the latest recommendation history. No plan choice is available until the connection returns."
        onRetry={recommendationState.retry}
      />
    );
  }

  if (pendingEvidence.length === 0) return null;

  if (
    recommendationState.origin !== "server" ||
    recommendationState.hasPendingWrites
  ) {
    return (
      <InboxState
        kind="status"
        title="Recommendation is syncing"
        message="Marathoner is waiting for server confirmation before offering a plan choice."
      />
    );
  }

  if (pendingEvidence.length !== 1) {
    return (
      <InboxState
        kind="alert"
        title="Recommendation review is unavailable"
        message="Marathoner found recommendation history that needs to be reconciled before any plan choice can be made. Your current plan is unchanged."
      />
    );
  }

  const pending = pendingEvidence[0];
  if (pending === undefined) return null;

  let model: RecommendationDecisionReviewModel | null = null;
  try {
    model = resolveReviewModel(pending);
  } catch {
    model = null;
  }

  if (model?.contentState !== "reviewed") {
    return (
      <InboxState
        kind="alert"
        title="Recommendation explanation is not ready"
        message="Marathoner will not offer this plan choice until its complete explanation is available and reviewed. Your current plan is unchanged."
      />
    );
  }

  return (
    <RecommendationDecisionController
      key={pending.recommendationId}
      model={model}
      recommendationId={pending.recommendationId}
      expectedEvaluatedPlanRevision={
        pending.evaluationInput.evaluatedPlanRevision
      }
      decisionClient={decisionClient}
      onConfirmed={onConfirmed}
      createCommandId={createCommandId}
    />
  );
}
