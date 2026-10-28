import type {
  GuidanceArtifactVersion,
  GuidanceReviewEvidenceV1,
  GuidanceReviewerRole,
  GuidanceReviewState,
} from "../domain/guidance";
import { createGuidanceArtifactVersion } from "../domain/guidance";
import type {
  RecommendationAction,
  RecommendationEvidenceV2,
} from "../domain/recommendations";
import { isUtcDateTime } from "../domain/training";
import { isIdentifierValue } from "../domain/training/identifiers";
import type { RecommendationDecisionReviewModel } from "../components/RecommendationDecisionReview";

const STABLE_ARTIFACT_VERSION_PATTERN =
  /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/;
const DRAFT_ARTIFACT_VERSION_PATTERN =
  /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+-draft$/;

const draftContentVersion = createGuidanceArtifactVersion(
  "beta-guidance@0.1.0-draft",
);

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

export function createDraftRecommendationDecisionContent({
  basePlanArtifactVersion,
  adaptationArtifactVersion,
}: Pick<
  RecommendationDecisionContentKey,
  "basePlanArtifactVersion" | "adaptationArtifactVersion"
>): readonly VersionedRecommendationDecisionContent[] {
  if (
    !DRAFT_ARTIFACT_VERSION_PATTERN.test(basePlanArtifactVersion) ||
    !DRAFT_ARTIFACT_VERSION_PATTERN.test(adaptationArtifactVersion)
  ) {
    return [];
  }

  return [
    {
      contentVersion: draftContentVersion,
      reviewState: "draft",
      requiredReviewerRoles: ["endurance_methodology"],
      key: {
        action: "repeat_period",
        reasonCode: "ADAPT-REPEAT-MISSED-WEEK",
        explanationKey: "adaptation.repeat.missed_week",
        basePlanArtifactVersion,
        adaptationArtifactVersion,
      },
      model: {
        title: "Repeat this training week before progressing",
        observation:
          "Two of the four planned runs in the completed week were skipped.",
        meaning:
          "The week was not completed as planned, and the draft rules found enough time before race day to repeat it without moving later weeks.",
        recommendation:
          "Use this week's four workout targets on next week's existing dates.",
        impact:
          "Only next week's targets would repeat. Later weeks and the race date would stay unchanged, and no target would increase.",
      },
    },
    {
      contentVersion: draftContentVersion,
      reviewState: "draft",
      requiredReviewerRoles: ["endurance_methodology"],
      key: {
        action: "hold_progression",
        reasonCode: "ADAPT-HOLD-REPEATED-HARD-EFFORT",
        explanationKey: "adaptation.hold.repeated_hard_effort",
        basePlanArtifactVersion,
        adaptationArtifactVersion,
      },
      model: {
        title: "Give next week another steady pass",
        observation:
          "At least two of the four most recent planned runs felt harder than expected.",
        meaning:
          "The pattern appeared across more than one run, and the next week would otherwise progress.",
        recommendation:
          "Keep next week's dates and purposes, but cap each target at the matching target from your latest fully completed week.",
        impact:
          "Only next week's targets would be held. Later weeks and the race date would stay unchanged, and no target would increase.",
      },
    },
    {
      contentVersion: draftContentVersion,
      reviewState: "draft",
      requiredReviewerRoles: ["endurance_methodology"],
      key: {
        action: "reschedule",
        reasonCode: "ADAPT-RESCHEDULE-SINGLE-MISS",
        explanationKey: "adaptation.reschedule.single_miss",
        basePlanArtifactVersion,
        adaptationArtifactVersion,
      },
      model: {
        title: "Move the missed run within this week",
        observation:
          "One easy or recovery run was skipped, and the draft rules found a confirmed open date within two days.",
        meaning:
          "The run can move without changing its purpose or target or creating an unsupported schedule.",
        recommendation:
          "Move only the missed workout to the confirmed open date.",
        impact:
          "Every other workout and the race date would stay unchanged. The moved workout would keep the same purpose and target.",
      },
    },
  ];
}

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

function isInternalDraftContent(
  content: VersionedRecommendationDecisionContent,
): boolean {
  return (
    content.reviewState === "draft" &&
    DRAFT_ARTIFACT_VERSION_PATTERN.test(content.contentVersion) &&
    content.requiredReviewerRoles.length > 0 &&
    content.reviewEvidence === undefined
  );
}

function hasCompleteModel(
  model: VersionedRecommendationDecisionContent["model"],
): boolean {
  return Object.values(model).every(
    (value) => value.trim().length > 0 && value.trim() === value,
  );
}

function contentKeysMatch(
  content: VersionedRecommendationDecisionContent,
  key: RecommendationDecisionContentKey,
): boolean {
  const contentKey = content.key;

  return (
    contentKey.action === key.action &&
    contentKey.reasonCode === key.reasonCode &&
    contentKey.explanationKey === key.explanationKey &&
    contentKey.basePlanArtifactVersion === key.basePlanArtifactVersion &&
    contentKey.adaptationArtifactVersion === key.adaptationArtifactVersion
  );
}

function contentKeyFromEvidence(
  evidence: RecommendationEvidenceV2,
): RecommendationDecisionContentKey | null {
  const { evaluationInput, evaluationResult } = evidence;

  if (
    evaluationInput.basePlanArtifactVersion !==
      evaluationResult.provenance.basePlanArtifactVersion ||
    evaluationInput.adaptationArtifactVersion !==
      evaluationResult.provenance.adaptationArtifactVersion
  ) {
    return null;
  }

  return {
    action: evaluationResult.action,
    reasonCode: evaluationResult.reasonCode,
    explanationKey: evaluationResult.explanationKey,
    basePlanArtifactVersion: evaluationInput.basePlanArtifactVersion,
    adaptationArtifactVersion: evaluationInput.adaptationArtifactVersion,
  };
}

export function resolveRecommendationDecisionReviewModel(
  evidence: RecommendationEvidenceV2,
  contentRegistry: readonly VersionedRecommendationDecisionContent[] =
    productionRecommendationDecisionContent,
): RecommendationDecisionReviewModel | null {
  const evidenceKey = contentKeyFromEvidence(evidence);
  if (evidenceKey === null) return null;

  const matches = contentRegistry.filter(
    (content) =>
      hasExactApprovedReview(content) &&
      hasCompleteModel(content.model) &&
      contentKeysMatch(content, evidenceKey),
  );

  if (matches.length !== 1) return null;

  return {
    ...matches[0]!.model,
    contentState: "reviewed",
  };
}

export function resolveInternalRecommendationDecisionReviewModel(
  key: RecommendationDecisionContentKey,
  contentRegistry: readonly VersionedRecommendationDecisionContent[],
): RecommendationDecisionReviewModel | null {
  const matches = contentRegistry.filter(
    (content) =>
      isInternalDraftContent(content) &&
      hasCompleteModel(content.model) &&
      contentKeysMatch(content, key),
  );

  if (matches.length !== 1) return null;

  return {
    ...matches[0]!.model,
    contentState: "internal_preview",
  };
}
