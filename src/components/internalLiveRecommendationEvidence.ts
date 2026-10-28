import {
  RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
  validateRecommendationEvidence,
  type RecommendationEvidenceV2,
  type RecommendationId,
} from "../domain/recommendations";
import type {
  AdaptationEvaluationInputV1,
  AdaptationEvaluationResultV1,
  AdaptationPlanAdjustmentV1,
  AdaptationPlanProjectionV1,
  TrainingPlan,
  UtcDateTime,
} from "../domain/training";

export interface InternalLiveRecommendationEvidenceRequest {
  readonly recommendationId: RecommendationId;
  readonly recommendedAt: UtcDateTime;
  readonly activePlan: TrainingPlan;
  readonly evaluationInput: AdaptationEvaluationInputV1;
  readonly evaluationResult: AdaptationEvaluationResultV1;
  readonly adjustment: AdaptationPlanAdjustmentV1;
  readonly projection: AdaptationPlanProjectionV1;
}

export type InternalLiveRecommendationEvidenceResult =
  | {
      readonly kind: "ready";
      readonly evidence: RecommendationEvidenceV2;
    }
  | {
      readonly kind: "not_ready";
      readonly code:
        | "no_material_recommendation"
        | "inactive_plan"
        | "plan_mismatch"
        | "revision_mismatch"
        | "action_mismatch"
        | "no_material_change"
        | "invalid_evidence";
      readonly message: string;
    };

function notReady(
  code: Extract<
    InternalLiveRecommendationEvidenceResult,
    { readonly kind: "not_ready" }
  >["code"],
  message: string,
): InternalLiveRecommendationEvidenceResult {
  return { kind: "not_ready", code, message };
}

function isMaterialRecommendation(
  result: AdaptationEvaluationResultV1,
): result is RecommendationEvidenceV2["evaluationResult"] {
  return (
    result.kind === "recommendation" &&
    result.action !== null &&
    result.action !== "no_change" &&
    result.runnerApprovalRequired
  );
}

export function assembleInternalLiveRecommendationEvidence(
  request: InternalLiveRecommendationEvidenceRequest,
): InternalLiveRecommendationEvidenceResult {
  const {
    activePlan,
    adjustment,
    evaluationInput,
    evaluationResult,
    projection,
  } = request;

  if (!isMaterialRecommendation(evaluationResult)) {
    return notReady(
      "no_material_recommendation",
      "Only a material recommendation that requires runner approval can produce evidence.",
    );
  }
  if (activePlan.status !== "active" || evaluationInput.activePlanStatus !== "active") {
    return notReady(
      "inactive_plan",
      "Recommendation evidence requires the synchronized active plan.",
    );
  }
  if (projection.planId !== activePlan.id) {
    return notReady(
      "plan_mismatch",
      "The projected change does not belong to the synchronized active plan.",
    );
  }
  if (
    evaluationInput.activePlanRevision !==
      evaluationInput.evaluatedPlanRevision ||
    projection.evaluatedPlanRevision !==
      evaluationInput.evaluatedPlanRevision ||
    projection.resultingPlanRevision !==
      evaluationInput.evaluatedPlanRevision + 1
  ) {
    return notReady(
      "revision_mismatch",
      "The evaluated and projected plan revisions no longer form one safe transition.",
    );
  }
  if (
    evaluationResult.action !== adjustment.action ||
    evaluationResult.action !== projection.action
  ) {
    return notReady(
      "action_mismatch",
      "The evaluated action, exact adjustment, and projected action must match.",
    );
  }
  if (projection.changes.length === 0) {
    return notReady(
      "no_material_change",
      "The projection must contain at least one material workout change.",
    );
  }

  const evidence: RecommendationEvidenceV2 = {
    schemaVersion: RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
    recommendationId: request.recommendationId,
    evaluatedPlanId: activePlan.id,
    evaluationInput,
    evaluationResult,
    planAdjustment: adjustment,
    decision: "pending",
    recommendedAt: request.recommendedAt,
    decidedAt: null,
    resultingPlanRevision: null,
  };
  const issues = validateRecommendationEvidence(evidence);
  if (issues.length > 0) {
    const firstIssue = issues[0];
    return notReady(
      "invalid_evidence",
      `${firstIssue.field}: ${firstIssue.message}`,
    );
  }

  return { kind: "ready", evidence };
}
