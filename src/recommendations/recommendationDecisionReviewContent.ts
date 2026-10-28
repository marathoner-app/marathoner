import type {
  GuidanceArtifactVersion,
  GuidanceReviewEvidenceV1,
  GuidanceReviewerRole,
  GuidanceReviewState,
} from "../domain/guidance";
import type {
  RecommendationAction,
  RecommendationEvidenceV2,
} from "../domain/recommendations";
import { isUtcDateTime } from "../domain/training";
import { isIdentifierValue } from "../domain/training/identifiers";
import type { RecommendationDecisionReviewModel } from "../components/RecommendationDecisionReview";

const STABLE_ARTIFACT_VERSION_PATTERN =
  /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/;

export interface RecommendationDecisionContentKey {
  readonly action: RecommendationAction;
  readonly reasonCode: string;
  readonly explanationKey: string;
  readonly basePlanArtifactVersion: string;
  readonly adaptationArtifactVersion: string;
}

export interface VersionedRecommendationDecisionContent {
  readonly contentVersion: GuidanceArtifactVersion;
  readonly reviewState: GuidanceReviewState;
  readonly requiredReviewerRoles: readonly GuidanceReviewerRole[];
  readonly reviewEvidence?: GuidanceReviewEvidenceV1;
  readonly key: RecommendationDecisionContentKey;
  readonly model: Omit<RecommendationDecisionReviewModel, "contentState">;
}

export const productionRecommendationDecisionContent:
  readonly VersionedRecommendationDecisionContent[] = [];

function hasExactApprovedReview(
  content: VersionedRecommendationDecisionContent,
): boolean {
  const evidence = content.reviewEvidence;

  return (
    content.reviewState === "approved" &&
    STABLE_ARTIFACT_VERSION_PATTERN.test(content.contentVersion) &&
    content.requiredReviewerRoles.length > 0 &&
    evidence !== undefined &&
    evidence.reviewedVersion === content.contentVersion &&
    isUtcDateTime(evidence.decidedAt) &&
    isIdentifierValue(evidence.recordId) &&
    content.requiredReviewerRoles.every((role) =>
      evidence.reviewerRoles.includes(role),
    )
  );
}

function hasCompleteModel(
  model: VersionedRecommendationDecisionContent["model"],
): boolean {
  return Object.values(model).every(
    (value) => value.trim().length > 0 && value.trim() === value,
  );
}

function matchesEvidence(
  content: VersionedRecommendationDecisionContent,
  evidence: RecommendationEvidenceV2,
): boolean {
  const { evaluationInput, evaluationResult } = evidence;
  const { key } = content;

  return (
    key.action === evaluationResult.action &&
    key.reasonCode === evaluationResult.reasonCode &&
    key.explanationKey === evaluationResult.explanationKey &&
    key.basePlanArtifactVersion === evaluationInput.basePlanArtifactVersion &&
    key.basePlanArtifactVersion ===
      evaluationResult.provenance.basePlanArtifactVersion &&
    key.adaptationArtifactVersion ===
      evaluationInput.adaptationArtifactVersion &&
    key.adaptationArtifactVersion ===
      evaluationResult.provenance.adaptationArtifactVersion
  );
}

export function resolveRecommendationDecisionReviewModel(
  evidence: RecommendationEvidenceV2,
  contentRegistry: readonly VersionedRecommendationDecisionContent[] =
    productionRecommendationDecisionContent,
): RecommendationDecisionReviewModel | null {
  const matches = contentRegistry.filter(
    (content) =>
      hasExactApprovedReview(content) &&
      hasCompleteModel(content.model) &&
      matchesEvidence(content, evidence),
  );

  if (matches.length !== 1) return null;

  return {
    ...matches[0]!.model,
    contentState: "reviewed",
  };
}
