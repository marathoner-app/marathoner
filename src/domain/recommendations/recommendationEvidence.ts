import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
  validateAdaptationEvaluationInput,
  type AdaptationAction,
  type AdaptationEvaluationInputV1,
  type DecidedAdaptationEvaluationResultV1,
} from "../training/adaptationEvaluation.js";
import { isUtcDateTime, type UtcDateTime } from "../training/dates.js";
import {
  isIdentifierValue,
  type TrainingPlanId,
} from "../training/identifiers.js";
import {
  AdaptationPlanProjectionError,
  parseAdaptationPlanAdjustment,
  type AdaptationPlanAdjustmentV1,
} from "../training/adaptationPlanProjection.js";

export const RECOMMENDATION_EVIDENCE_SCHEMA_VERSION =
  "recommendation-evidence@2" as const;
export const OPERATOR_ACTIVATION_CONTROL_SCHEMA_VERSION =
  "operator-activation-control@1" as const;

export const RECOMMENDATION_DECISIONS = [
  "pending",
  "accepted",
  "declined",
] as const;
export const CONTROLLED_CAPABILITIES = [
  "generation",
  "guidance",
  "adaptation",
] as const;

const RECOMMENDATION_ACTIONS = [
  "repeat_period",
  "hold_progression",
  "reschedule",
] as const satisfies readonly Exclude<AdaptationAction, "no_change">[];
const RECOMMENDATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const ARTIFACT_VERSION_PATTERN =
  /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const STABLE_ARTIFACT_VERSION_PATTERN =
  /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/;
const REASON_CODE_PATTERN = /^ADAPT-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const EXPLANATION_KEY_PATTERN =
  /^adaptation\.[a-z0-9_]+(?:\.[a-z0-9_]+)*$/;
const MAX_RECORDED_RECENT_EFFORTS = 64;

declare const recommendationIdBrand: unique symbol;

export type RecommendationId = string & {
  readonly [recommendationIdBrand]: "RecommendationId";
};
export type RecommendationDecision =
  (typeof RECOMMENDATION_DECISIONS)[number];
export type ControlledCapability =
  (typeof CONTROLLED_CAPABILITIES)[number];
export type RecommendationAction = (typeof RECOMMENDATION_ACTIONS)[number];

export interface RecommendationEvidenceV2 {
  readonly schemaVersion: typeof RECOMMENDATION_EVIDENCE_SCHEMA_VERSION;
  readonly recommendationId: RecommendationId;
  readonly evaluatedPlanId: TrainingPlanId;
  readonly evaluationInput: AdaptationEvaluationInputV1;
  readonly evaluationResult: DecidedAdaptationEvaluationResultV1 & {
    readonly kind: "recommendation";
    readonly action: RecommendationAction;
    readonly runnerApprovalRequired: true;
  };
  readonly planAdjustment: AdaptationPlanAdjustmentV1;
  readonly decision: RecommendationDecision;
  readonly recommendedAt: UtcDateTime;
  readonly decidedAt: UtcDateTime | null;
  readonly resultingPlanRevision: number | null;
}

export interface CapabilityActivationControlV1 {
  readonly enabled: boolean;
  readonly approvedArtifactVersions: readonly string[];
}

export interface OperatorActivationControlV1 {
  readonly schemaVersion: typeof OPERATOR_ACTIVATION_CONTROL_SCHEMA_VERSION;
  readonly revision: number;
  readonly updatedAt: UtcDateTime;
  readonly minimumAppProtocolVersion: number;
  readonly minimumCommandProtocolVersion: number;
  readonly capabilities: Readonly<
    Record<ControlledCapability, CapabilityActivationControlV1>
  >;
}

export interface ActivationRequestV1 {
  readonly capability: ControlledCapability;
  readonly artifactVersion: string;
  readonly appProtocolVersion: number;
  readonly commandProtocolVersion: number;
}

export type RecommendationContractValidationCode =
  | "invalid_schema_version"
  | "required"
  | "invalid_value"
  | "unexpected_field"
  | "duplicate"
  | "inconsistent";

export interface RecommendationContractValidationIssue {
  readonly code: RecommendationContractValidationCode;
  readonly field: string;
  readonly message: string;
}

export type ActivationDecision =
  | { readonly allowed: true; readonly reason: "allowed" }
  | {
      readonly allowed: false;
      readonly reason:
        | "invalid_control"
        | "invalid_request"
        | "capability_disabled"
        | "stale_app_protocol"
        | "stale_command_protocol"
        | "draft_artifact"
        | "artifact_not_approved";
      readonly issues?: readonly RecommendationContractValidationIssue[];
    };

type UnknownRecord = Readonly<Record<string, unknown>>;

function issue(
  code: RecommendationContractValidationCode,
  field: string,
  message: string,
): RecommendationContractValidationIssue {
  return { code, field, message };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(
  value: UnknownRecord,
  expectedKeys: readonly string[],
  field: string,
): RecommendationContractValidationIssue[] {
  const expected = new Set(expectedKeys);
  return Object.keys(value)
    .filter((key) => !expected.has(key))
    .sort()
    .map((key) =>
      issue(
        "unexpected_field",
        field.length === 0 ? key : `${field}.${key}`,
        "Remove fields that are not part of this contract version.",
      ),
    );
}

function isPositiveWholeNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function hasArtifactVersionFormat(value: unknown): value is string {
  return typeof value === "string" && ARTIFACT_VERSION_PATTERN.test(value);
}

function isDraftArtifactVersion(value: string): boolean {
  const prerelease = /@\d+\.\d+\.\d+-(.+)$/.exec(value)?.[1];
  return prerelease?.split(".").includes("draft") ?? false;
}

export function createRecommendationId(value: string): RecommendationId {
  if (!RECOMMENDATION_ID_PATTERN.test(value)) {
    throw new Error(
      "Recommendation ID must be 8 to 128 URL-safe identifier characters.",
    );
  }
  return value as RecommendationId;
}

function validateEvaluationInput(
  value: unknown,
): RecommendationContractValidationIssue[] {
  if (!isRecord(value)) {
    return [
      issue(
        "required",
        "evaluationInput",
        "Record the exact evaluated adaptation input.",
      ),
    ];
  }

  const issues = unexpectedKeys(
    value,
    [
      "schemaVersion",
      "basePlanArtifactVersion",
      "adaptationArtifactVersion",
      "activePlanStatus",
      "activePlanRevision",
      "evaluatedPlanRevision",
      "safetyGateState",
      "inputCompletenessConfirmed",
      "triggerKind",
      "currentCoreWeek",
      "currentWeekKind",
      "nextWeekKind",
      "nextWeekIntroducesProgression",
      "daysUntilRace",
      "currentWeek",
      "daysSinceLastCompletedPlannedRun",
      "recentEfforts",
      "rescheduleCandidate",
    ],
    "evaluationInput",
  );

  if (isRecord(value.currentWeek)) {
    issues.push(
      ...unexpectedKeys(
        value.currentWeek,
        [
          "plannedRunCount",
          "completedRunCount",
          "skippedRunCount",
          "pendingRunCount",
        ],
        "evaluationInput.currentWeek",
      ),
    );
  }
  if (isRecord(value.rescheduleCandidate)) {
    issues.push(
      ...unexpectedKeys(
        value.rescheduleCandidate,
        [
          "present",
          "workoutPurpose",
          "delayCalendarDays",
          "samePlanWeek",
          "runnerConfirmedAvailable",
          "targetDateEmpty",
          "consecutiveRunDatesAfterMove",
        ],
        "evaluationInput.rescheduleCandidate",
      ),
    );
  }

  const input = value as unknown as AdaptationEvaluationInputV1;
  issues.push(
    ...validateAdaptationEvaluationInput(
      input,
      MAX_RECORDED_RECENT_EFFORTS,
    ).map((inputIssue) =>
      issue(
        inputIssue.code === "invalid_schema_version"
          ? "invalid_schema_version"
          : inputIssue.code,
        `evaluationInput.${inputIssue.field}`,
        inputIssue.message,
      ),
    ),
  );

  if (
    value.schemaVersion === ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION &&
    !hasArtifactVersionFormat(value.basePlanArtifactVersion)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "evaluationInput.basePlanArtifactVersion",
        "Use a semantic artifact version.",
      ),
    );
  }
  if (
    value.schemaVersion === ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION &&
    !hasArtifactVersionFormat(value.adaptationArtifactVersion)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "evaluationInput.adaptationArtifactVersion",
        "Use a semantic artifact version.",
      ),
    );
  }
  if (!isPositiveWholeNumber(value.activePlanRevision)) {
    issues.push(
      issue(
        "invalid_value",
        "evaluationInput.activePlanRevision",
        "Use a positive active-plan revision.",
      ),
    );
  }
  if (!isPositiveWholeNumber(value.evaluatedPlanRevision)) {
    issues.push(
      issue(
        "invalid_value",
        "evaluationInput.evaluatedPlanRevision",
        "Use a positive evaluated-plan revision.",
      ),
    );
  }

  return issues;
}

function validateEvaluationResult(
  value: unknown,
): RecommendationContractValidationIssue[] {
  if (!isRecord(value)) {
    return [
      issue(
        "required",
        "evaluationResult",
        "Record the exact recommendation result.",
      ),
    ];
  }

  const issues = unexpectedKeys(
    value,
    [
      "schemaVersion",
      "kind",
      "action",
      "reasonCode",
      "explanationKey",
      "runnerApprovalRequired",
      "provenance",
    ],
    "evaluationResult",
  );

  if (value.schemaVersion !== ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        "evaluationResult.schemaVersion",
        `Use ${ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (value.kind !== "recommendation") {
    issues.push(
      issue(
        "invalid_value",
        "evaluationResult.kind",
        "Recommendation evidence must record a recommendation result.",
      ),
    );
  }
  if (!RECOMMENDATION_ACTIONS.includes(value.action as RecommendationAction)) {
    issues.push(
      issue(
        "invalid_value",
        "evaluationResult.action",
        "Use a supported bounded recommendation action.",
      ),
    );
  }
  if (
    typeof value.reasonCode !== "string" ||
    !REASON_CODE_PATTERN.test(value.reasonCode)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "evaluationResult.reasonCode",
        "Use a stable adaptation reason code.",
      ),
    );
  }
  if (
    typeof value.explanationKey !== "string" ||
    !EXPLANATION_KEY_PATTERN.test(value.explanationKey)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "evaluationResult.explanationKey",
        "Use a stable adaptation explanation key.",
      ),
    );
  }
  if (value.runnerApprovalRequired !== true) {
    issues.push(
      issue(
        "inconsistent",
        "evaluationResult.runnerApprovalRequired",
        "Every bounded adaptation recommendation requires runner approval.",
      ),
    );
  }

  if (!isRecord(value.provenance)) {
    issues.push(
      issue(
        "required",
        "evaluationResult.provenance",
        "Record evaluator and artifact provenance.",
      ),
    );
    return issues;
  }

  issues.push(
    ...unexpectedKeys(
      value.provenance,
      [
        "inputSchemaVersion",
        "evaluatorVersion",
        "basePlanArtifactVersion",
        "adaptationArtifactVersion",
      ],
      "evaluationResult.provenance",
    ),
  );
  if (
    value.provenance.inputSchemaVersion !==
    ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION
  ) {
    issues.push(
      issue(
        "invalid_schema_version",
        "evaluationResult.provenance.inputSchemaVersion",
        `Use ${ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION}.`,
      ),
    );
  }
  for (const field of [
    "evaluatorVersion",
    "basePlanArtifactVersion",
    "adaptationArtifactVersion",
  ] as const) {
    if (!hasArtifactVersionFormat(value.provenance[field])) {
      issues.push(
        issue(
          "invalid_value",
          `evaluationResult.provenance.${field}`,
          "Use a semantic artifact version.",
        ),
      );
    }
  }

  return issues;
}

function validatePlanAdjustment(
  value: unknown,
): RecommendationContractValidationIssue[] {
  try {
    const adjustment = parseAdaptationPlanAdjustment(value);
    if (
      adjustment.action !== "reschedule" &&
      adjustment.targetWeekNumber !== adjustment.sourceWeekNumber + 1
    ) {
      return [
        issue(
          "invalid_value",
          "planAdjustment",
          "The target week must immediately follow the source week.",
        ),
      ];
    }
    if (
      adjustment.action === "reschedule" &&
      (adjustment.weekStartDate > adjustment.weekEndDate ||
        adjustment.targetDate < adjustment.weekStartDate ||
        adjustment.targetDate > adjustment.weekEndDate)
    ) {
      return [
        issue(
          "invalid_value",
          "planAdjustment",
          "The reschedule target must stay inside a valid supplied plan week.",
        ),
      ];
    }
    return [];
  } catch (error) {
    return [
      issue(
        "invalid_value",
        "planAdjustment",
        error instanceof AdaptationPlanProjectionError
          ? error.message
          : "Record the exact bounded plan adjustment.",
      ),
    ];
  }
}

export function validateRecommendationEvidence(
  value: unknown,
): RecommendationContractValidationIssue[] {
  if (!isRecord(value)) {
    return [
      issue(
        "required",
        "recommendationEvidence",
        "Recommendation evidence must be an object.",
      ),
    ];
  }

  const issues = unexpectedKeys(
    value,
    [
      "schemaVersion",
      "recommendationId",
      "evaluatedPlanId",
      "evaluationInput",
      "evaluationResult",
      "planAdjustment",
      "decision",
      "recommendedAt",
      "decidedAt",
      "resultingPlanRevision",
    ],
    "",
  );

  if (value.schemaVersion !== RECOMMENDATION_EVIDENCE_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        "schemaVersion",
        `Use ${RECOMMENDATION_EVIDENCE_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (
    typeof value.recommendationId !== "string" ||
    !RECOMMENDATION_ID_PATTERN.test(value.recommendationId)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "recommendationId",
        "Use a valid recommendation identifier.",
      ),
    );
  }
  if (!isIdentifierValue(value.evaluatedPlanId)) {
    issues.push(
      issue(
        "invalid_value",
        "evaluatedPlanId",
        "Use a valid training-plan identifier.",
      ),
    );
  }

  issues.push(...validateEvaluationInput(value.evaluationInput));
  issues.push(...validateEvaluationResult(value.evaluationResult));
  issues.push(...validatePlanAdjustment(value.planAdjustment));

  if (
    !RECOMMENDATION_DECISIONS.includes(value.decision as RecommendationDecision)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "decision",
        "Use pending, accepted, or declined.",
      ),
    );
  }
  if (!isUtcDateTime(value.recommendedAt)) {
    issues.push(
      issue(
        "invalid_value",
        "recommendedAt",
        "Use a valid UTC recommendation timestamp.",
      ),
    );
  }
  if (value.decidedAt !== null && !isUtcDateTime(value.decidedAt)) {
    issues.push(
      issue(
        "invalid_value",
        "decidedAt",
        "Use a valid UTC decision timestamp or null.",
      ),
    );
  }
  if (
    value.resultingPlanRevision !== null &&
    !isPositiveWholeNumber(value.resultingPlanRevision)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "resultingPlanRevision",
        "Use a positive resulting plan revision or null.",
      ),
    );
  }

  if (isRecord(value.evaluationInput) && isRecord(value.evaluationResult)) {
    const input = value.evaluationInput;
    const result = value.evaluationResult;
    if (input.activePlanRevision !== input.evaluatedPlanRevision) {
      issues.push(
        issue(
          "inconsistent",
          "evaluationInput.evaluatedPlanRevision",
          "A recommendation cannot be recorded from a stale plan revision.",
        ),
      );
    }
    if (isRecord(result.provenance)) {
      if (
        result.provenance.basePlanArtifactVersion !==
        input.basePlanArtifactVersion
      ) {
        issues.push(
          issue(
            "inconsistent",
            "evaluationResult.provenance.basePlanArtifactVersion",
            "Base-plan provenance must match the evaluated input.",
          ),
        );
      }
      if (
        result.provenance.adaptationArtifactVersion !==
        input.adaptationArtifactVersion
      ) {
        issues.push(
          issue(
            "inconsistent",
            "evaluationResult.provenance.adaptationArtifactVersion",
            "Adaptation provenance must match the evaluated input.",
          ),
        );
      }
    }

    if (
      isPositiveWholeNumber(input.evaluatedPlanRevision) &&
      value.resultingPlanRevision !== null &&
      isPositiveWholeNumber(value.resultingPlanRevision) &&
      value.resultingPlanRevision <= input.evaluatedPlanRevision
    ) {
      issues.push(
        issue(
          "inconsistent",
          "resultingPlanRevision",
          "An accepted recommendation must create a newer plan revision.",
        ),
      );
    }
  }

  if (isRecord(value.evaluationResult) && isRecord(value.planAdjustment)) {
    if (value.evaluationResult.action !== value.planAdjustment.action) {
      issues.push(
        issue(
          "inconsistent",
          "planAdjustment.action",
          "The exact plan adjustment must match the recommended action.",
        ),
      );
    }
  }

  if (value.decision === "pending") {
    if (value.decidedAt !== null || value.resultingPlanRevision !== null) {
      issues.push(
        issue(
          "inconsistent",
          "decision",
          "Pending evidence cannot contain a decision time or resulting revision.",
        ),
      );
    }
  } else if (value.decision === "accepted") {
    if (value.decidedAt === null || value.resultingPlanRevision === null) {
      issues.push(
        issue(
          "inconsistent",
          "decision",
          "Accepted evidence requires a decision time and resulting revision.",
        ),
      );
    }
  } else if (value.decision === "declined") {
    if (value.decidedAt === null || value.resultingPlanRevision !== null) {
      issues.push(
        issue(
          "inconsistent",
          "decision",
          "Declined evidence requires a decision time and no resulting revision.",
        ),
      );
    }
  }

  if (
    isUtcDateTime(value.recommendedAt) &&
    isUtcDateTime(value.decidedAt) &&
    Date.parse(value.decidedAt) < Date.parse(value.recommendedAt)
  ) {
    issues.push(
      issue(
        "inconsistent",
        "decidedAt",
        "The decision cannot predate the recommendation.",
      ),
    );
  }

  return issues;
}

function validateCapabilityControl(
  value: unknown,
  field: string,
): RecommendationContractValidationIssue[] {
  if (!isRecord(value)) {
    return [
      issue(
        "required",
        field,
        "Record whether the capability is enabled and its approved artifacts.",
      ),
    ];
  }

  const issues = unexpectedKeys(
    value,
    ["enabled", "approvedArtifactVersions"],
    field,
  );
  if (typeof value.enabled !== "boolean") {
    issues.push(
      issue("invalid_value", `${field}.enabled`, "Use true or false."),
    );
  }
  if (!Array.isArray(value.approvedArtifactVersions)) {
    issues.push(
      issue(
        "required",
        `${field}.approvedArtifactVersions`,
        "Provide the exact approved stable artifact versions.",
      ),
    );
    return issues;
  }

  const versions = value.approvedArtifactVersions;
  const seen = new Set<string>();
  versions.forEach((version, index) => {
    if (
      typeof version !== "string" ||
      !STABLE_ARTIFACT_VERSION_PATTERN.test(version)
    ) {
      issues.push(
        issue(
          "invalid_value",
          `${field}.approvedArtifactVersions.${index}`,
          "Only exact stable non-draft semantic artifact versions may be approved.",
        ),
      );
      return;
    }
    if (seen.has(version)) {
      issues.push(
        issue(
          "duplicate",
          `${field}.approvedArtifactVersions.${index}`,
          "List each approved artifact version once.",
        ),
      );
    }
    seen.add(version);
  });
  return issues;
}

export function validateOperatorActivationControl(
  value: unknown,
): RecommendationContractValidationIssue[] {
  if (!isRecord(value)) {
    return [
      issue(
        "required",
        "activationControl",
        "Operator activation control must be an object.",
      ),
    ];
  }

  const issues = unexpectedKeys(
    value,
    [
      "schemaVersion",
      "revision",
      "updatedAt",
      "minimumAppProtocolVersion",
      "minimumCommandProtocolVersion",
      "capabilities",
    ],
    "",
  );
  if (value.schemaVersion !== OPERATOR_ACTIVATION_CONTROL_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        "schemaVersion",
        `Use ${OPERATOR_ACTIVATION_CONTROL_SCHEMA_VERSION}.`,
      ),
    );
  }
  for (const field of [
    "revision",
    "minimumAppProtocolVersion",
    "minimumCommandProtocolVersion",
  ] as const) {
    if (!isPositiveWholeNumber(value[field])) {
      issues.push(
        issue(
          "invalid_value",
          field,
          "Use a positive whole number.",
        ),
      );
    }
  }
  if (!isUtcDateTime(value.updatedAt)) {
    issues.push(
      issue(
        "invalid_value",
        "updatedAt",
        "Use a valid UTC update timestamp.",
      ),
    );
  }
  if (!isRecord(value.capabilities)) {
    issues.push(
      issue(
        "required",
        "capabilities",
        "Record generation, guidance, and adaptation controls.",
      ),
    );
    return issues;
  }

  issues.push(
    ...unexpectedKeys(value.capabilities, CONTROLLED_CAPABILITIES, "capabilities"),
  );
  for (const capability of CONTROLLED_CAPABILITIES) {
    issues.push(
      ...validateCapabilityControl(
        value.capabilities[capability],
        `capabilities.${capability}`,
      ),
    );
  }
  return issues;
}

export function validateActivationRequest(
  value: unknown,
): RecommendationContractValidationIssue[] {
  if (!isRecord(value)) {
    return [
      issue(
        "required",
        "activationRequest",
        "Activation request must be an object.",
      ),
    ];
  }

  const issues = unexpectedKeys(
    value,
    [
      "capability",
      "artifactVersion",
      "appProtocolVersion",
      "commandProtocolVersion",
    ],
    "",
  );
  if (!CONTROLLED_CAPABILITIES.includes(value.capability as ControlledCapability)) {
    issues.push(
      issue(
        "invalid_value",
        "capability",
        "Use generation, guidance, or adaptation.",
      ),
    );
  }
  if (!hasArtifactVersionFormat(value.artifactVersion)) {
    issues.push(
      issue(
        "invalid_value",
        "artifactVersion",
        "Use an exact semantic artifact version.",
      ),
    );
  }
  for (const field of ["appProtocolVersion", "commandProtocolVersion"] as const) {
    if (!isPositiveWholeNumber(value[field])) {
      issues.push(
        issue(
          "invalid_value",
          field,
          "Use a positive whole number.",
        ),
      );
    }
  }
  return issues;
}

export function evaluateActivation(
  control: unknown,
  request: unknown,
): ActivationDecision {
  const controlIssues = validateOperatorActivationControl(control);
  if (controlIssues.length > 0) {
    return {
      allowed: false,
      reason: "invalid_control",
      issues: controlIssues,
    };
  }
  const requestIssues = validateActivationRequest(request);
  if (requestIssues.length > 0) {
    return {
      allowed: false,
      reason: "invalid_request",
      issues: requestIssues,
    };
  }

  const validControl = control as OperatorActivationControlV1;
  const validRequest = request as ActivationRequestV1;
  const capability = validControl.capabilities[validRequest.capability];
  if (!capability.enabled) {
    return { allowed: false, reason: "capability_disabled" };
  }
  if (
    validRequest.appProtocolVersion < validControl.minimumAppProtocolVersion
  ) {
    return { allowed: false, reason: "stale_app_protocol" };
  }
  if (
    validRequest.commandProtocolVersion <
    validControl.minimumCommandProtocolVersion
  ) {
    return { allowed: false, reason: "stale_command_protocol" };
  }
  if (isDraftArtifactVersion(validRequest.artifactVersion)) {
    return { allowed: false, reason: "draft_artifact" };
  }
  if (
    !capability.approvedArtifactVersions.includes(validRequest.artifactVersion)
  ) {
    return { allowed: false, reason: "artifact_not_approved" };
  }
  return { allowed: true, reason: "allowed" };
}
