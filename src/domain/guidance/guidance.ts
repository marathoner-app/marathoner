import {
  isUtcDateTime,
  type UtcDateTime,
} from "../training/dates.js";
import { isIdentifierValue } from "../training/identifiers.js";

export const GUIDANCE_ITEM_SCHEMA_VERSION = "guidance-item@1" as const;

export const GUIDANCE_TOPICS = [
  "easy_effort",
  "shoes",
  "fueling",
  "hydration",
  "sleep",
  "recovery",
  "pain_escalation",
  "plan_change",
  "limitations",
  "unsupported_case",
] as const;

export const GUIDANCE_TRIGGER_EVENTS = [
  "plan_reviewed",
  "plan_week_started",
  "workout_upcoming",
  "shoe_added",
  "completed_run_pattern",
  "recommendation_available",
  "safety_signal_reported",
  "unsupported_result_available",
] as const;

export const GUIDANCE_REVIEW_STATES = [
  "draft",
  "ready_for_review",
  "approved",
  "conditional",
  "rejected",
  "retired",
] as const;

export const GUIDANCE_PUBLICATION_STATES = ["disabled", "published"] as const;

export const GUIDANCE_REVIEWER_ROLES = [
  "endurance_methodology",
  "clinical_safety",
  "sports_nutrition",
] as const;

declare const guidanceItemIdBrand: unique symbol;
declare const guidanceArtifactVersionBrand: unique symbol;
declare const guidanceTriggerCodeBrand: unique symbol;

export type GuidanceItemId = string & {
  readonly [guidanceItemIdBrand]: "GuidanceItemId";
};

export type GuidanceArtifactVersion = string & {
  readonly [guidanceArtifactVersionBrand]: "GuidanceArtifactVersion";
};

export type GuidanceTriggerCode = string & {
  readonly [guidanceTriggerCodeBrand]: "GuidanceTriggerCode";
};

export type GuidanceTopic = (typeof GUIDANCE_TOPICS)[number];
export type GuidanceTriggerEvent = (typeof GUIDANCE_TRIGGER_EVENTS)[number];
export type GuidanceReviewState = (typeof GUIDANCE_REVIEW_STATES)[number];
export type GuidancePublicationState =
  (typeof GUIDANCE_PUBLICATION_STATES)[number];
export type GuidanceReviewerRole = (typeof GUIDANCE_REVIEWER_ROLES)[number];

export interface GuidanceTriggerV1 {
  readonly code: GuidanceTriggerCode;
  readonly event: GuidanceTriggerEvent;
}

export interface GuidanceSuppressionV1 {
  readonly cooldownHours: number;
  readonly maxPresentationsPerVersion: number;
  readonly dismissesVersion: boolean;
  readonly expiresAt?: UtcDateTime;
}

export interface GuidanceReviewEvidenceV1 {
  readonly reviewedVersion: GuidanceArtifactVersion;
  readonly decidedAt: UtcDateTime;
  readonly recordId: string;
  readonly reviewerRoles: readonly GuidanceReviewerRole[];
}

export interface GuidanceReplacementV1 {
  readonly guidanceId: GuidanceItemId;
  readonly contentVersion: GuidanceArtifactVersion;
}

export interface GuidanceItemV1 {
  readonly schemaVersion: typeof GUIDANCE_ITEM_SCHEMA_VERSION;
  readonly id: GuidanceItemId;
  readonly contentVersion: GuidanceArtifactVersion;
  readonly topic: GuidanceTopic;
  readonly title: string;
  readonly body: string;
  readonly limitations: readonly string[];
  readonly contentOwner: string;
  readonly correctionOwner: string;
  readonly correctionChannel: string;
  readonly requiredReviewerRoles: readonly GuidanceReviewerRole[];
  readonly reviewState: GuidanceReviewState;
  readonly reviewEvidence?: GuidanceReviewEvidenceV1;
  readonly publicationState: GuidancePublicationState;
  readonly triggers: readonly GuidanceTriggerV1[];
  readonly suppression: GuidanceSuppressionV1;
  readonly replaces?: GuidanceReplacementV1;
}

export type GuidanceValidationCode =
  | "invalid_schema_version"
  | "required"
  | "invalid_value"
  | "duplicate"
  | "inconsistent";

export interface GuidanceValidationIssue {
  readonly code: GuidanceValidationCode;
  readonly field: string;
  readonly message: string;
}

export interface GuidancePresentationRecordV1 {
  readonly guidanceId: GuidanceItemId;
  readonly contentVersion: GuidanceArtifactVersion;
  readonly presentedAt: UtcDateTime;
  readonly dismissedAt?: UtcDateTime;
}

export interface GuidanceDisableRuleV1 {
  readonly guidanceId: GuidanceItemId;
  readonly contentVersion?: GuidanceArtifactVersion;
}

export interface GuidancePresentationContextV1 {
  readonly now: UtcDateTime;
  readonly activeTriggerCodes: readonly GuidanceTriggerCode[];
  readonly presentationHistory: readonly GuidancePresentationRecordV1[];
  readonly remoteDisableRules: readonly GuidanceDisableRuleV1[];
}

export type GuidanceSuppressionReason =
  | "invalid_contract"
  | "review_not_approved"
  | "retired"
  | "publication_disabled"
  | "remotely_disabled"
  | "trigger_not_active"
  | "expired"
  | "dismissed_for_version"
  | "presentation_limit_reached"
  | "cooldown_active";

export type GuidancePresentationDecision =
  | { readonly eligible: true }
  | {
      readonly eligible: false;
      readonly reason: GuidanceSuppressionReason;
      readonly validationIssues?: readonly GuidanceValidationIssue[];
    };

const ITEM_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const ARTIFACT_VERSION_PATTERN =
  /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const TRIGGER_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;

export function createGuidanceItemId(value: string): GuidanceItemId {
  if (!ITEM_ID_PATTERN.test(value) || value.length > 100) {
    throw new Error(
      "Guidance item ID must be a lowercase dotted or hyphenated identifier of 100 characters or fewer.",
    );
  }

  return value as GuidanceItemId;
}

export function createGuidanceArtifactVersion(
  value: string,
): GuidanceArtifactVersion {
  if (!ARTIFACT_VERSION_PATTERN.test(value)) {
    throw new Error(
      "Guidance artifact version must use a lowercase name and semantic version, such as beta-guidance@1.0.0.",
    );
  }

  return value as GuidanceArtifactVersion;
}

export function createGuidanceTriggerCode(value: string): GuidanceTriggerCode {
  if (!TRIGGER_CODE_PATTERN.test(value) || value.length > 100) {
    throw new Error(
      "Guidance trigger code must be an uppercase, hyphen-separated identifier of 100 characters or fewer.",
    );
  }

  return value as GuidanceTriggerCode;
}

function issue(
  code: GuidanceValidationCode,
  field: string,
  message: string,
): GuidanceValidationIssue {
  return { code, field, message };
}

function isNonBlankText(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maximumLength
  );
}

function validateUniqueValues<T extends string>(
  values: readonly T[],
  field: string,
): GuidanceValidationIssue[] {
  return new Set(values).size === values.length
    ? []
    : [issue("duplicate", field, "Values must be unique.")];
}

function validateReviewEvidence(
  item: GuidanceItemV1,
): GuidanceValidationIssue[] {
  const issues: GuidanceValidationIssue[] = [];
  const decisionStates: readonly GuidanceReviewState[] = [
    "approved",
    "conditional",
    "rejected",
    "retired",
  ];
  const evidence = item.reviewEvidence;

  if (decisionStates.includes(item.reviewState) && evidence === undefined) {
    issues.push(
      issue(
        "required",
        "reviewEvidence",
        "A decided or retired guidance item needs review evidence.",
      ),
    );
    return issues;
  }

  if (
    (item.reviewState === "draft" || item.reviewState === "ready_for_review") &&
    evidence !== undefined
  ) {
    issues.push(
      issue(
        "inconsistent",
        "reviewEvidence",
        "Draft or ready-for-review guidance cannot contain a review decision.",
      ),
    );
    return issues;
  }

  if (evidence === undefined) return issues;

  if (evidence.reviewedVersion !== item.contentVersion) {
    issues.push(
      issue(
        "inconsistent",
        "reviewEvidence.reviewedVersion",
        "Review evidence must name the exact content version.",
      ),
    );
  }
  if (!isUtcDateTime(evidence.decidedAt)) {
    issues.push(
      issue(
        "invalid_value",
        "reviewEvidence.decidedAt",
        "Review time must be a valid UTC timestamp.",
      ),
    );
  }
  if (!isIdentifierValue(evidence.recordId)) {
    issues.push(
      issue(
        "invalid_value",
        "reviewEvidence.recordId",
        "Review record ID must be a non-empty identifier without slashes.",
      ),
    );
  }
  if (
    !Array.isArray(evidence.reviewerRoles) ||
    evidence.reviewerRoles.length === 0 ||
    evidence.reviewerRoles.some(
      (role) => !GUIDANCE_REVIEWER_ROLES.includes(role),
    )
  ) {
    issues.push(
      issue(
        "invalid_value",
        "reviewEvidence.reviewerRoles",
        "Review evidence needs at least one supported reviewer role.",
      ),
    );
  } else {
    issues.push(
      ...validateUniqueValues(
        evidence.reviewerRoles,
        "reviewEvidence.reviewerRoles",
      ),
    );
  }

  if (
    item.reviewState === "approved" &&
    item.requiredReviewerRoles.some(
      (role) => !evidence.reviewerRoles.includes(role),
    )
  ) {
    issues.push(
      issue(
        "inconsistent",
        "reviewEvidence.reviewerRoles",
        "Approved guidance needs evidence from every required reviewer role.",
      ),
    );
  }

  return issues;
}

export function validateGuidanceItem(
  item: GuidanceItemV1,
): GuidanceValidationIssue[] {
  const issues: GuidanceValidationIssue[] = [];

  if (item.schemaVersion !== GUIDANCE_ITEM_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        "schemaVersion",
        `Use ${GUIDANCE_ITEM_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (!ITEM_ID_PATTERN.test(item.id) || item.id.length > 100) {
    issues.push(
      issue("invalid_value", "id", "Use a valid lowercase guidance item ID."),
    );
  }
  if (!ARTIFACT_VERSION_PATTERN.test(item.contentVersion)) {
    issues.push(
      issue(
        "invalid_value",
        "contentVersion",
        "Use a named semantic artifact version.",
      ),
    );
  }
  if (!GUIDANCE_TOPICS.includes(item.topic)) {
    issues.push(issue("invalid_value", "topic", "Use a supported guidance topic."));
  }

  const textFields: readonly [keyof GuidanceItemV1, number][] = [
    ["title", 160],
    ["body", 4_000],
    ["contentOwner", 200],
    ["correctionOwner", 200],
    ["correctionChannel", 500],
  ];
  for (const [field, maximumLength] of textFields) {
    if (!isNonBlankText(item[field], maximumLength)) {
      issues.push(
        issue(
          "invalid_value",
          field,
          `Use nonblank text of ${maximumLength} characters or fewer.`,
        ),
      );
    }
  }

  if (
    !Array.isArray(item.limitations) ||
    item.limitations.length === 0 ||
    item.limitations.some((limitation) => !isNonBlankText(limitation, 500))
  ) {
    issues.push(
      issue(
        "required",
        "limitations",
        "Guidance needs at least one explicit, nonblank limitation.",
      ),
    );
  }

  if (
    !Array.isArray(item.requiredReviewerRoles) ||
    item.requiredReviewerRoles.length === 0 ||
    item.requiredReviewerRoles.some(
      (role) => !GUIDANCE_REVIEWER_ROLES.includes(role),
    )
  ) {
    issues.push(
      issue(
        "required",
        "requiredReviewerRoles",
        "Guidance needs at least one supported reviewer role.",
      ),
    );
  } else {
    issues.push(
      ...validateUniqueValues(
        item.requiredReviewerRoles,
        "requiredReviewerRoles",
      ),
    );
  }

  if (!GUIDANCE_REVIEW_STATES.includes(item.reviewState)) {
    issues.push(
      issue("invalid_value", "reviewState", "Use a supported review state."),
    );
  }
  if (!GUIDANCE_PUBLICATION_STATES.includes(item.publicationState)) {
    issues.push(
      issue(
        "invalid_value",
        "publicationState",
        "Use a supported publication state.",
      ),
    );
  }

  if (!Array.isArray(item.triggers) || item.triggers.length === 0) {
    issues.push(
      issue("required", "triggers", "Guidance needs at least one explicit trigger."),
    );
  } else {
    for (const [index, trigger] of item.triggers.entries()) {
      if (
        !TRIGGER_CODE_PATTERN.test(trigger.code) ||
        trigger.code.length > 100
      ) {
        issues.push(
          issue(
            "invalid_value",
            `triggers.${index}.code`,
            "Use a valid uppercase trigger code.",
          ),
        );
      }
      if (!GUIDANCE_TRIGGER_EVENTS.includes(trigger.event)) {
        issues.push(
          issue(
            "invalid_value",
            `triggers.${index}.event`,
            "Use a supported trigger event.",
          ),
        );
      }
    }
    issues.push(
      ...validateUniqueValues(
        item.triggers.map((trigger) => trigger.code),
        "triggers",
      ),
    );
  }

  if (
    !Number.isInteger(item.suppression.cooldownHours) ||
    item.suppression.cooldownHours < 0 ||
    item.suppression.cooldownHours > 8_760
  ) {
    issues.push(
      issue(
        "invalid_value",
        "suppression.cooldownHours",
        "Cooldown must be a whole number from 0 through 8760 hours.",
      ),
    );
  }
  if (
    !Number.isInteger(item.suppression.maxPresentationsPerVersion) ||
    item.suppression.maxPresentationsPerVersion < 1 ||
    item.suppression.maxPresentationsPerVersion > 100
  ) {
    issues.push(
      issue(
        "invalid_value",
        "suppression.maxPresentationsPerVersion",
        "Presentation limit must be a whole number from 1 through 100.",
      ),
    );
  }
  if (typeof item.suppression.dismissesVersion !== "boolean") {
    issues.push(
      issue(
        "invalid_value",
        "suppression.dismissesVersion",
        "Dismissal behavior must be explicit.",
      ),
    );
  }
  if (
    item.suppression.expiresAt !== undefined &&
    !isUtcDateTime(item.suppression.expiresAt)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "suppression.expiresAt",
        "Expiration must be a valid UTC timestamp.",
      ),
    );
  }

  if (item.replaces !== undefined) {
    if (
      !ITEM_ID_PATTERN.test(item.replaces.guidanceId) ||
      !ARTIFACT_VERSION_PATTERN.test(item.replaces.contentVersion)
    ) {
      issues.push(
        issue(
          "invalid_value",
          "replaces",
          "Replacement metadata must name a valid item and content version.",
        ),
      );
    } else if (
      item.replaces.guidanceId === item.id &&
      item.replaces.contentVersion === item.contentVersion
    ) {
      issues.push(
        issue(
          "inconsistent",
          "replaces",
          "A guidance version cannot replace itself.",
        ),
      );
    }
  }

  issues.push(...validateReviewEvidence(item));

  if (
    item.publicationState === "published" &&
    item.reviewState !== "approved"
  ) {
    issues.push(
      issue(
        "inconsistent",
        "publicationState",
        "Only approved guidance can be published.",
      ),
    );
  }
  if (
    item.publicationState === "published" &&
    item.contentVersion.includes("-draft")
  ) {
    issues.push(
      issue(
        "inconsistent",
        "contentVersion",
        "Draft artifact versions cannot be published.",
      ),
    );
  }

  return issues;
}

function isRemotelyDisabled(
  item: GuidanceItemV1,
  rules: readonly GuidanceDisableRuleV1[],
): boolean {
  return rules.some(
    (rule) =>
      rule.guidanceId === item.id &&
      (rule.contentVersion === undefined ||
        rule.contentVersion === item.contentVersion),
  );
}

export function evaluateGuidancePresentation(
  item: GuidanceItemV1,
  context: GuidancePresentationContextV1,
): GuidancePresentationDecision {
  const validationIssues = validateGuidanceItem(item);
  if (validationIssues.length > 0) {
    return { eligible: false, reason: "invalid_contract", validationIssues };
  }
  if (item.reviewState === "retired") {
    return { eligible: false, reason: "retired" };
  }
  if (item.reviewState !== "approved") {
    return { eligible: false, reason: "review_not_approved" };
  }
  if (item.publicationState !== "published") {
    return { eligible: false, reason: "publication_disabled" };
  }
  if (isRemotelyDisabled(item, context.remoteDisableRules)) {
    return { eligible: false, reason: "remotely_disabled" };
  }

  const activeTriggerCodes = new Set(context.activeTriggerCodes);
  if (!item.triggers.some((trigger) => activeTriggerCodes.has(trigger.code))) {
    return { eligible: false, reason: "trigger_not_active" };
  }
  if (
    item.suppression.expiresAt !== undefined &&
    Date.parse(context.now) >= Date.parse(item.suppression.expiresAt)
  ) {
    return { eligible: false, reason: "expired" };
  }

  const matchingHistory = context.presentationHistory
    .filter(
      (record) =>
        record.guidanceId === item.id &&
        record.contentVersion === item.contentVersion,
    )
    .sort(
      (left, right) =>
        Date.parse(right.presentedAt) - Date.parse(left.presentedAt),
    );

  if (
    item.suppression.dismissesVersion &&
    matchingHistory.some((record) => record.dismissedAt !== undefined)
  ) {
    return { eligible: false, reason: "dismissed_for_version" };
  }
  if (
    matchingHistory.length >= item.suppression.maxPresentationsPerVersion
  ) {
    return { eligible: false, reason: "presentation_limit_reached" };
  }

  const latestPresentation = matchingHistory[0];
  if (latestPresentation !== undefined) {
    const cooldownMilliseconds = item.suppression.cooldownHours * 60 * 60 * 1_000;
    if (
      Date.parse(context.now) - Date.parse(latestPresentation.presentedAt) <
      cooldownMilliseconds
    ) {
      return { eligible: false, reason: "cooldown_active" };
    }
  }

  return { eligible: true };
}
