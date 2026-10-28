import { useRef, useState } from "react";

import type {
  RecommendationDecisionReceiptResult,
} from "../domain/materialCommands/contract";
import type { RecommendationId } from "../domain/recommendations/recommendationEvidence";
import type {
  RecommendationDecisionClient,
  RecommendationDecisionClientResult,
  RecommendationDecisionSubmission,
} from "../services/recommendationDecisionClient";
import RecommendationDecisionReview, {
  type RecommendationDecisionReviewModel,
  type RecommendationDecisionReviewState,
} from "./RecommendationDecisionReview";

type DecisionChoice = "keep" | "apply";
type RetryMode = "submit" | "resolve" | null;

interface DecisionAttempt {
  readonly choice: DecisionChoice;
  readonly submission: RecommendationDecisionSubmission;
}

interface FailurePresentation {
  readonly state: RecommendationDecisionReviewState;
  readonly retryMode: RetryMode;
}

export interface RecommendationDecisionControllerProps {
  readonly model: RecommendationDecisionReviewModel;
  readonly recommendationId: RecommendationId;
  readonly expectedEvaluatedPlanRevision: number;
  readonly decisionClient: RecommendationDecisionClient;
  readonly onConfirmed?: (receipt: RecommendationDecisionReceiptResult) => void;
  readonly createCommandId?: () => string;
}

function defaultCommandId(): string {
  return `recommendation-decision-${globalThis.crypto.randomUUID()}`;
}

function unavailable(
  title: string,
  message: string,
): FailurePresentation {
  return {
    state: { kind: "unavailable", title, message },
    retryMode: null,
  };
}

function failurePresentation(
  result: Exclude<
    RecommendationDecisionClientResult,
    RecommendationDecisionReceiptResult
  >,
): FailurePresentation {
  switch (result.status) {
    case "stale_revision":
      return unavailable(
        "This recommendation needs a fresh review",
        "Your active plan changed after this recommendation was prepared. Marathoner did not apply this choice. Load the latest plan before reviewing another recommendation.",
      );
    case "retryable_error":
      return {
        state: {
          kind: "error",
          title: "The decision was not completed",
          message:
            "Marathoner could not complete this choice. Your plan is unchanged. Reconnect, then try the same decision again.",
          retryLabel: "Try decision again",
        },
        retryMode: "submit",
      };
    case "outcome_unknown":
      return {
        state: {
          kind: "error",
          title: "Decision status needs checking",
          message:
            "Marathoner could not confirm the result. Do not make another choice; check the original decision instead.",
          retryLabel: "Check original decision",
        },
        retryMode: "resolve",
      };
    case "authentication_error":
      return unavailable(
        "Your account needs attention",
        result.code === "verified-email-required"
          ? "Verify your account email before deciding on a recommendation. Marathoner did not apply this choice."
          : "Sign in again before deciding on a recommendation. Marathoner did not apply this choice.",
      );
    case "authorization_error":
      if (result.code === "recommendation-decisions-not-enabled") {
        return unavailable(
          "Recommendation choices are paused",
          "Marathoner has not enabled plan-changing recommendation decisions. Your active plan was not changed.",
        );
      }
      if (result.code === "approved-beta-membership-required") {
        return unavailable(
          "Recommendation choices are not available for this account",
          "This account is not currently approved to make beta recommendation decisions. Your active plan was not changed.",
        );
      }
      return unavailable(
        "Marathoner could not verify this app session",
        "Reopen the supported app before reviewing another recommendation. Your active plan was not changed.",
      );
    case "unsupported_version":
      return unavailable(
        "Update Marathoner before deciding",
        "This version cannot safely record the recommendation choice. Your active plan was not changed.",
      );
    case "validation_error":
      return unavailable(
        "This recommendation cannot be decided safely",
        "The recommendation or decision request did not pass Marathoner's safety checks. Your active plan was not changed.",
      );
    case "conflict":
      return unavailable(
        "This decision could not be safely repeated",
        "Marathoner found a different request using this decision identifier. Your active plan was not changed; review the latest recommendation before continuing.",
      );
  }
}

function unresolvedPresentation(): FailurePresentation {
  return {
    state: {
      kind: "error",
      title: "Decision status still needs checking",
      message:
        "Marathoner still cannot confirm the original decision. No new choice was sent. Reconnect and check the original decision again.",
      retryLabel: "Check original decision again",
    },
    retryMode: "resolve",
  };
}

function receiptMatchesAttempt(
  receipt: RecommendationDecisionReceiptResult,
  attempt: DecisionAttempt,
): boolean {
  const expectedDecision = attempt.choice === "apply" ? "accepted" : "declined";
  return (
    receipt.commandId === attempt.submission.commandId &&
    receipt.recommendationId === attempt.submission.recommendationId &&
    receipt.decision === expectedDecision &&
    receipt.evaluatedPlanRevision ===
      attempt.submission.expectedEvaluatedPlanRevision &&
    (expectedDecision === "accepted"
      ? receipt.resultingPlanRevision !== null
      : receipt.resultingPlanRevision === null)
  );
}

function confirmedState(
  receipt: RecommendationDecisionReceiptResult,
  choice: DecisionChoice,
): RecommendationDecisionReviewState {
  return choice === "apply"
    ? {
        kind: "confirmed",
        decision: choice,
        title: "Recommendation applied",
        message: `Marathoner confirmed the change and activated plan revision ${receipt.resultingPlanRevision}.`,
      }
    : {
        kind: "confirmed",
        decision: choice,
        title: "Current plan kept",
        message:
          "Marathoner confirmed your choice. This recommendation did not change your active plan.",
      };
}

export default function RecommendationDecisionController({
  model,
  recommendationId,
  expectedEvaluatedPlanRevision,
  decisionClient,
  onConfirmed,
  createCommandId = defaultCommandId,
}: RecommendationDecisionControllerProps) {
  const operationRef = useRef(false);
  const attemptRef = useRef<DecisionAttempt | null>(null);
  const retryModeRef = useRef<RetryMode>(null);
  const [reviewState, setReviewState] =
    useState<RecommendationDecisionReviewState>({ kind: "ready" });

  const showFailure = (presentation: FailurePresentation) => {
    retryModeRef.current = presentation.retryMode;
    setReviewState(presentation.state);
  };

  const confirm = (
    receipt: RecommendationDecisionReceiptResult,
    attempt: DecisionAttempt,
  ) => {
    if (!receiptMatchesAttempt(receipt, attempt)) {
      showFailure(
        unavailable(
          "Decision confirmation did not match this review",
          "Marathoner did not receive a matching confirmation for this recommendation. Do not assume the plan changed; load the latest plan before continuing.",
        ),
      );
      return;
    }

    retryModeRef.current = null;
    setReviewState(confirmedState(receipt, attempt.choice));
    onConfirmed?.(receipt);
  };

  const submitAttempt = async (attempt: DecisionAttempt) => {
    if (operationRef.current) return;
    operationRef.current = true;
    retryModeRef.current = null;
    setReviewState({ kind: "pending", decision: attempt.choice });

    try {
      const result = await decisionClient.submit(attempt.submission);
      if (result.status === "recommendation_decided") {
        confirm(result, attempt);
      } else {
        showFailure(failurePresentation(result));
      }
    } catch {
      showFailure(failurePresentation({
        status: "outcome_unknown",
        commandId: attempt.submission.commandId,
        code: "resolve-by-command-id",
        message: "The decision outcome is unknown.",
      }));
    } finally {
      operationRef.current = false;
    }
  };

  const resolveAttempt = async (attempt: DecisionAttempt) => {
    if (operationRef.current) return;
    operationRef.current = true;
    retryModeRef.current = null;
    setReviewState({ kind: "pending", decision: attempt.choice });

    try {
      const result = await decisionClient.resolve(attempt.submission.commandId);
      if (result.status === "recommendation_decided") {
        confirm(result, attempt);
      } else {
        showFailure(unresolvedPresentation());
      }
    } catch {
      showFailure(unresolvedPresentation());
    } finally {
      operationRef.current = false;
    }
  };

  const startDecision = (choice: DecisionChoice) => {
    if (operationRef.current || attemptRef.current !== null) return;
    const attempt: DecisionAttempt = {
      choice,
      submission: {
        commandId: createCommandId(),
        recommendationId,
        decision: choice === "apply" ? "accepted" : "declined",
        expectedEvaluatedPlanRevision,
      },
    };
    attemptRef.current = attempt;
    void submitAttempt(attempt);
  };

  const retry = () => {
    const attempt = attemptRef.current;
    if (attempt === null || operationRef.current) return;
    if (retryModeRef.current === "submit") void submitAttempt(attempt);
    if (retryModeRef.current === "resolve") void resolveAttempt(attempt);
  };

  return (
    <RecommendationDecisionReview
      model={model}
      state={reviewState}
      onKeep={() => startDecision("keep")}
      onApply={() => startDecision("apply")}
      onRetry={retry}
    />
  );
}
