import {
  GUIDANCE_ITEM_SCHEMA_VERSION,
  createGuidanceArtifactVersion,
  createGuidanceItemId,
  createGuidanceTriggerCode,
  type GuidanceItemV1,
  type GuidanceReviewerRole,
  type GuidanceTopic,
  type GuidanceTriggerEvent,
} from "./guidance.js";

const draftVersion = createGuidanceArtifactVersion(
  "beta-guidance@0.1.0-draft",
);

interface DraftGuidanceDefinition {
  readonly topic: GuidanceTopic;
  readonly title: string;
  readonly triggerCode: string;
  readonly triggerEvent: GuidanceTriggerEvent;
  readonly requiredReviewerRoles: readonly GuidanceReviewerRole[];
}

const draftDefinitions: readonly DraftGuidanceDefinition[] = [
  {
    topic: "easy_effort",
    title: "Easy-effort education",
    triggerCode: "EASY-WORKOUT-UPCOMING",
    triggerEvent: "workout_upcoming",
    requiredReviewerRoles: ["endurance_methodology"],
  },
  {
    topic: "shoes",
    title: "Shoe tracking and inspection",
    triggerCode: "SHOE-TRACKING-STARTED",
    triggerEvent: "shoe_added",
    requiredReviewerRoles: ["endurance_methodology"],
  },
  {
    topic: "fueling",
    title: "General endurance-fueling education",
    triggerCode: "LONG-WORKOUT-UPCOMING-FUELING",
    triggerEvent: "workout_upcoming",
    requiredReviewerRoles: ["sports_nutrition"],
  },
  {
    topic: "hydration",
    title: "General hydration education",
    triggerCode: "LONG-WORKOUT-UPCOMING-HYDRATION",
    triggerEvent: "workout_upcoming",
    requiredReviewerRoles: ["sports_nutrition"],
  },
  {
    topic: "sleep",
    title: "Sleep education",
    triggerCode: "TRAINING-WEEK-STARTED-SLEEP",
    triggerEvent: "plan_week_started",
    requiredReviewerRoles: ["endurance_methodology"],
  },
  {
    topic: "recovery",
    title: "Recovery education",
    triggerCode: "COMPLETED-RUN-PATTERN-RECORDED",
    triggerEvent: "completed_run_pattern",
    requiredReviewerRoles: ["endurance_methodology"],
  },
  {
    topic: "pain_escalation",
    title: "Pain and unusual-symptom escalation",
    triggerCode: "PAIN-OR-UNUSUAL-SYMPTOM-REPORTED",
    triggerEvent: "safety_signal_reported",
    requiredReviewerRoles: ["clinical_safety"],
  },
  {
    topic: "plan_change",
    title: "Plan-change explanation",
    triggerCode: "RECOMMENDATION-AVAILABLE",
    triggerEvent: "recommendation_available",
    requiredReviewerRoles: ["endurance_methodology"],
  },
  {
    topic: "limitations",
    title: "Product and guidance limitations",
    triggerCode: "PLAN-REVIEWED-LIMITATIONS",
    triggerEvent: "plan_reviewed",
    requiredReviewerRoles: [
      "endurance_methodology",
      "clinical_safety",
      "sports_nutrition",
    ],
  },
  {
    topic: "unsupported_case",
    title: "Unsupported-result explanation",
    triggerCode: "UNSUPPORTED-RESULT-AVAILABLE",
    triggerEvent: "unsupported_result_available",
    requiredReviewerRoles: ["endurance_methodology"],
  },
];

function createDraftManifestItem(
  definition: DraftGuidanceDefinition,
): GuidanceItemV1 {
  return {
    schemaVersion: GUIDANCE_ITEM_SCHEMA_VERSION,
    id: createGuidanceItemId(
      `founding-beta.${definition.topic.replace(/_/g, "-")}`,
    ),
    contentVersion: draftVersion,
    topic: definition.topic,
    title: definition.title,
    body: "Draft manifest placeholder only. Issue #135 owns the reviewed participant-facing content for this topic.",
    limitations: [
      "This draft entry is not approved guidance and must never be presented to a participant.",
    ],
    contentOwner: "Marathoner product and claims owner",
    correctionOwner: "Marathoner product and claims owner",
    correctionChannel: "Repository issue #135 and its qualified-review record",
    requiredReviewerRoles: definition.requiredReviewerRoles,
    reviewState: "draft",
    publicationState: "disabled",
    triggers: [
      {
        code: createGuidanceTriggerCode(definition.triggerCode),
        event: definition.triggerEvent,
      },
    ],
    suppression: {
      cooldownHours: 24,
      maxPresentationsPerVersion: 1,
      dismissesVersion: true,
    },
  };
}

/**
 * Completeness manifest for #114 and #135. Every entry is deliberately draft
 * and disabled; the text and suppression values are contract fixtures, not
 * participant-facing guidance or approved product configuration.
 */
export const foundingBetaGuidanceManifest: readonly GuidanceItemV1[] =
  draftDefinitions.map(createDraftManifestItem);
