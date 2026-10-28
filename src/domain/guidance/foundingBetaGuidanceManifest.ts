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
  readonly body: string;
  readonly limitations: readonly string[];
  readonly triggerCode: string;
  readonly triggerEvent: GuidanceTriggerEvent;
  readonly requiredReviewerRoles: readonly GuidanceReviewerRole[];
}

const draftDefinitions: readonly DraftGuidanceDefinition[] = [
  {
    topic: "easy_effort",
    title: "Keep easy running conversational",
    body:
      "An easy run should feel controlled. Use the talk test as a simple effort check: if speaking in complete sentences is no longer comfortable, slow down or take a walk break instead of forcing the planned pace.",
    limitations: [
      "The talk test is a rough effort cue, not a diagnosis or a personalized pace prescription.",
      "Heat, hills, fatigue, illness, and other conditions can change how an easy effort feels.",
    ],
    triggerCode: "EASY-WORKOUT-UPCOMING",
    triggerEvent: "workout_upcoming",
    requiredReviewerRoles: ["endurance_methodology"],
  },
  {
    topic: "shoes",
    title: "Track how your running shoes feel and wear",
    body:
      "Record which shoes you use and check their fit, comfort, and visible wear over time. When changing to a different shoe, introduce it gradually rather than making an abrupt switch for a long or important run.",
    limitations: [
      "Marathoner does not prescribe a shoe type or promise that a shoe will prevent injury.",
      "There is no universal replacement mileage; materials, use, comfort, and wear vary by shoe and runner.",
    ],
    triggerCode: "SHOE-TRACKING-STARTED",
    triggerEvent: "shoe_added",
    requiredReviewerRoles: ["endurance_methodology"],
  },
  {
    topic: "fueling",
    title: "Practice fueling before event day",
    body:
      "Longer training runs are an opportunity to practice a familiar fueling approach and notice what sits well. Build the routine during training instead of introducing an unfamiliar food, gel, or drink for the first time on event day.",
    limitations: [
      "This is general education, not a calorie, carbohydrate, supplement, or meal prescription.",
      "Fueling needs vary with the person, workout, health, and conditions; use a qualified sports dietitian for an individualized plan.",
    ],
    triggerCode: "LONG-WORKOUT-UPCOMING-FUELING",
    triggerEvent: "workout_upcoming",
    requiredReviewerRoles: ["sports_nutrition"],
  },
  {
    topic: "hydration",
    title: "Plan hydration for the conditions",
    body:
      "Start training normally hydrated and plan access to fluids for longer runs, especially in hot or humid conditions. Practice during training so you can learn what is comfortable instead of relying on a new strategy on event day.",
    limitations: [
      "There is no single fluid amount that fits every runner, route, weather condition, or sweat rate.",
      "This is not individualized fluid, sodium, or electrolyte advice; medical conditions and persistent concerns need qualified care.",
    ],
    triggerCode: "LONG-WORKOUT-UPCOMING-HYDRATION",
    triggerEvent: "workout_upcoming",
    requiredReviewerRoles: ["sports_nutrition"],
  },
  {
    topic: "sleep",
    title: "Protect a consistent sleep window",
    body:
      "Most adults need at least seven hours of sleep, and a consistent bedtime and wake time can support healthy sleep. Treat sleep as part of the week you are planning, while recognizing that one short night does not by itself explain how training will go.",
    limitations: [
      "Sleep needs vary, and Marathoner does not diagnose or treat sleep problems.",
      "Talk with a health care professional if sleep difficulty is persistent or affects daily life.",
    ],
    triggerCode: "TRAINING-WEEK-STARTED-SLEEP",
    triggerEvent: "plan_week_started",
    requiredReviewerRoles: ["endurance_methodology"],
  },
  {
    topic: "recovery",
    title: "Notice repeated changes in recovery",
    body:
      "A single difficult run can happen for many reasons. Pay closer attention when several runs in a row feel harder than expected or when fatigue is not settling between sessions, and review the week before adding more work.",
    limitations: [
      "Marathoner cannot determine why recovery feels different or diagnose illness, injury, or overtraining.",
      "Pain, unusual symptoms, or worsening concerns need the appropriate stop-and-seek-help path rather than a training adjustment alone.",
    ],
    triggerCode: "COMPLETED-RUN-PATTERN-RECORDED",
    triggerEvent: "completed_run_pattern",
    requiredReviewerRoles: ["endurance_methodology"],
  },
  {
    topic: "pain_escalation",
    title: "Stop when symptoms may need urgent attention",
    body:
      "Marathoner cannot assess symptoms. Stop the workout and call 911 for chest pressure or pain, severe or sudden trouble breathing, fainting, new confusion, or sudden face drooping, arm weakness, or speech difficulty. For other concerning or persistent pain or symptoms, stop and seek qualified medical advice before resuming training.",
    limitations: [
      "This draft is not a complete emergency checklist and cannot decide whether a symptom is safe.",
      "Do not delay emergency help while using Marathoner or wait for the app to classify a symptom.",
    ],
    triggerCode: "PAIN-OR-UNUSUAL-SYMPTOM-REPORTED",
    triggerEvent: "safety_signal_reported",
    requiredReviewerRoles: ["clinical_safety"],
  },
  {
    topic: "plan_change",
    title: "Review what changed before accepting it",
    body:
      "A plan-change recommendation should identify the observation that led to it, the proposed change, and what stays unchanged. Review those details before choosing whether to keep your current plan or accept the draft change.",
    limitations: [
      "A recommendation is not applied automatically and may be declined.",
      "Draft or unsupported rules cannot produce a participant-facing plan change.",
    ],
    triggerCode: "RECOMMENDATION-AVAILABLE",
    triggerEvent: "recommendation_available",
    requiredReviewerRoles: ["endurance_methodology"],
  },
  {
    topic: "limitations",
    title: "Know what Marathoner can and cannot do",
    body:
      "Marathoner organizes the information you enter and can explain supported training-plan suggestions. It is not a clinician or an individual coach, and it does not diagnose conditions, provide medical treatment, guarantee an outcome, or promise to prevent injury.",
    limitations: [
      "Suggestions can be incomplete or unsuitable when the information entered is missing, outdated, or outside the supported beta boundary.",
      "Use qualified medical, coaching, or nutrition help when your needs go beyond the app's reviewed scope.",
    ],
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
    title: "Marathoner does not have a supported answer yet",
    body:
      "The available information does not match a reviewed rule Marathoner can use. Your current plan stays unchanged. Review any missing or conflicting details and use qualified help when the question involves health, nutrition, or a situation outside the supported beta.",
    limitations: [
      "Marathoner will not invent a recommendation or silently widen a rule to produce an answer.",
      "Adding information may not make the case supported if it remains outside the reviewed product boundary.",
    ],
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
    body: definition.body,
    limitations: definition.limitations,
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
 * Complete internal draft set for #114, #135, and #544. Every entry is
 * deliberately draft and disabled. The copy is review input, while the
 * triggers and suppression values remain contract fixtures rather than live
 * participant configuration.
 */
export const foundingBetaGuidanceManifest: readonly GuidanceItemV1[] =
  draftDefinitions.map(createDraftManifestItem);
