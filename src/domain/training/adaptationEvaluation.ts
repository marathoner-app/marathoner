import type { PerceivedEffort, RunPurpose, TrainingPlanStatus } from "./types.js";

export const ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION =
  "adaptation-evaluation-input@1" as const;
export const ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION =
  "adaptation-evaluation-result@1" as const;

declare const adaptationArtifactVersionBrand: unique symbol;
declare const adaptationReasonCodeBrand: unique symbol;
declare const adaptationExplanationKeyBrand: unique symbol;

export type AdaptationArtifactVersion = string & {
  readonly [adaptationArtifactVersionBrand]: "AdaptationArtifactVersion";
};

export type AdaptationReasonCode = string & {
  readonly [adaptationReasonCodeBrand]: "AdaptationReasonCode";
};

export type AdaptationExplanationKey = string & {
  readonly [adaptationExplanationKeyBrand]: "AdaptationExplanationKey";
};

export type AdaptationWeekKind = "load" | "cutback" | "peak" | "taper" | "race";
export type AdaptationTriggerKind =
  | "planned_run_completed"
  | "planned_run_skipped";
export type AdaptationSafetyGateState =
  | "none_reported"
  | "requires_review"
  | "not_answered";
export type AdaptationDecision =
  | "refuse_unsupported_ruleset"
  | "refuse_safety_gate"
  | "refuse_stale_plan"
  | "refuse_incomplete_evidence"
  | "refuse_long_disruption"
  | "refuse_excessive_disruption"
  | "refuse_late_disruption"
  | "refuse_conflicting_signals"
  | "repeat_period"
  | "hold_progression"
  | "reschedule"
  | "no_change_recovery_already_scheduled"
  | "no_change_insufficient_pattern"
  | "no_change_single_hard_effort"
  | "no_change_wait_for_week_completion"
  | "no_change_do_not_stack"
  | "no_change_on_track";
export type AdaptationResultKind = "refused" | "recommendation" | "no_change";
export type AdaptationAction =
  | "repeat_period"
  | "hold_progression"
  | "reschedule"
  | "no_change";

export interface AdaptationWeekEvidenceV1 {
  readonly plannedRunCount: number;
  readonly completedRunCount: number;
  readonly skippedRunCount: number;
  readonly pendingRunCount: number;
}

export interface AdaptationRescheduleCandidateV1 {
  readonly present: boolean;
  readonly workoutPurpose: RunPurpose | null;
  readonly delayCalendarDays: number | null;
  readonly samePlanWeek: boolean;
  readonly runnerConfirmedAvailable: boolean;
  readonly targetDateEmpty: boolean;
  readonly consecutiveRunDatesAfterMove: number;
}

export interface AdaptationEvaluationInputV1 {
  readonly schemaVersion: typeof ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION;
  readonly basePlanArtifactVersion: string;
  readonly adaptationArtifactVersion: string;
  readonly activePlanStatus: TrainingPlanStatus;
  readonly activePlanRevision: number;
  readonly evaluatedPlanRevision: number;
  readonly safetyGateState: AdaptationSafetyGateState;
  readonly inputCompletenessConfirmed: boolean;
  readonly triggerKind: AdaptationTriggerKind;
  readonly currentCoreWeek: number;
  readonly currentWeekKind: AdaptationWeekKind;
  readonly nextWeekKind: AdaptationWeekKind;
  readonly nextWeekIntroducesProgression: boolean;
  readonly daysUntilRace: number;
  readonly currentWeek: AdaptationWeekEvidenceV1;
  readonly daysSinceLastCompletedPlannedRun: number;
  readonly recentEfforts: readonly PerceivedEffort[];
  readonly rescheduleCandidate: AdaptationRescheduleCandidateV1;
}

export interface AdaptationOutcomeRuleV1 {
  readonly decision: AdaptationDecision;
  readonly kind: AdaptationResultKind;
  readonly action: AdaptationAction | null;
  readonly reasonCode: AdaptationReasonCode;
  readonly explanationKey: AdaptationExplanationKey;
  readonly runnerApprovalRequired: boolean;
}

interface InclusiveRange {
  readonly minimum: number;
  readonly maximum: number;
}

export interface AdaptationEvaluationRulesV1 {
  readonly basePlanArtifactVersion: AdaptationArtifactVersion;
  readonly adaptationArtifactVersion: AdaptationArtifactVersion;
  readonly supportedPlanStatus: Extract<TrainingPlanStatus, "active">;
  readonly supportedCoreWeeks: InclusiveRange;
  readonly requiredSafetyGateState: Extract<
    AdaptationSafetyGateState,
    "none_reported"
  >;
  readonly maximumRecentEfforts: number;
  readonly hardEffortValues: readonly PerceivedEffort[];
  readonly plannedRunsPerWeek: number;
  readonly allowedReschedulePurposes: readonly RunPurpose[];
  readonly minimumHardEffortsForHold: number;
  readonly requiredRecordedEffortsForHold: number;
  readonly missedRunsForRepeat: number;
  readonly maximumMissedRunsForAutomaticDecision: number;
  readonly longDisruptionDays: number;
  readonly minimumDaysUntilRaceForRepeat: number;
  readonly minimumDaysUntilRaceForHold: number;
  readonly minimumDaysUntilRaceForReschedule: number;
  readonly maximumRescheduleDelayDays: number;
  readonly maximumConsecutiveRunDatesAfterReschedule: number;
  readonly repeatEligibleCurrentWeekKinds: readonly AdaptationWeekKind[];
  readonly repeatEligibleNextWeekKinds: readonly AdaptationWeekKind[];
  readonly holdEligibleNextWeekKinds: readonly AdaptationWeekKind[];
  readonly protectedRecoveryWeekKinds: readonly AdaptationWeekKind[];
  readonly outcomes: readonly AdaptationOutcomeRuleV1[];
}

export interface AdaptationEvaluationProvenanceV1 {
  readonly inputSchemaVersion: typeof ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION;
  readonly evaluatorVersion: AdaptationArtifactVersion;
  readonly basePlanArtifactVersion: AdaptationArtifactVersion;
  readonly adaptationArtifactVersion: AdaptationArtifactVersion;
}

export type AdaptationValidationCode =
  | "invalid_schema_version"
  | "required"
  | "invalid_value"
  | "inconsistent";

export interface AdaptationValidationIssue {
  readonly code: AdaptationValidationCode;
  readonly field: string;
  readonly message: string;
}

export interface InvalidAdaptationEvaluationResultV1 {
  readonly schemaVersion: typeof ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION;
  readonly kind: "invalid_input";
  readonly issues: readonly AdaptationValidationIssue[];
}

export interface DecidedAdaptationEvaluationResultV1 {
  readonly schemaVersion: typeof ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION;
  readonly kind: AdaptationResultKind;
  readonly action: AdaptationAction | null;
  readonly reasonCode: AdaptationReasonCode;
  readonly explanationKey: AdaptationExplanationKey;
  readonly runnerApprovalRequired: boolean;
  readonly provenance: AdaptationEvaluationProvenanceV1;
}

export type AdaptationEvaluationResultV1 =
  | InvalidAdaptationEvaluationResultV1
  | DecidedAdaptationEvaluationResultV1;

export interface AdaptationEvaluationRequestV1 {
  readonly input: AdaptationEvaluationInputV1;
  readonly evaluatorVersion: AdaptationArtifactVersion;
  readonly rules: AdaptationEvaluationRulesV1;
}

const ARTIFACT_VERSION_PATTERN =
  /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const REASON_CODE_PATTERN = /^ADAPT-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const EXPLANATION_KEY_PATTERN = /^adaptation\.[a-z0-9_]+(?:\.[a-z0-9_]+)*$/;
const perceivedEfforts: readonly PerceivedEffort[] = [
  "much_easier_than_expected",
  "easier_than_expected",
  "about_right",
  "harder_than_expected",
  "much_harder_than_expected",
];
const runPurposes: readonly RunPurpose[] = [
  "easy",
  "recovery",
  "long",
  "tempo",
  "intervals",
  "race",
];
const planStatuses: readonly TrainingPlanStatus[] = [
  "draft",
  "active",
  "completed",
  "archived",
];
const safetyGateStates: readonly AdaptationSafetyGateState[] = [
  "none_reported",
  "requires_review",
  "not_answered",
];
const triggerKinds: readonly AdaptationTriggerKind[] = [
  "planned_run_completed",
  "planned_run_skipped",
];
const weekKinds: readonly AdaptationWeekKind[] = [
  "load",
  "cutback",
  "peak",
  "taper",
  "race",
];

export function createAdaptationArtifactVersion(
  value: string,
): AdaptationArtifactVersion {
  if (!ARTIFACT_VERSION_PATTERN.test(value)) {
    throw new Error(
      "Adaptation artifact versions must use a lowercase name and semantic version.",
    );
  }
  return value as AdaptationArtifactVersion;
}

export function createAdaptationReasonCode(value: string): AdaptationReasonCode {
  if (!REASON_CODE_PATTERN.test(value) || value.length > 100) {
    throw new Error(
      "Adaptation reason codes must be uppercase ADAPT identifiers of 100 characters or fewer.",
    );
  }
  return value as AdaptationReasonCode;
}

export function createAdaptationExplanationKey(
  value: string,
): AdaptationExplanationKey {
  if (!EXPLANATION_KEY_PATTERN.test(value) || value.length > 120) {
    throw new Error(
      "Adaptation explanation keys must use lowercase dot-separated identifiers.",
    );
  }
  return value as AdaptationExplanationKey;
}

function issue(
  code: AdaptationValidationCode,
  field: string,
  message: string,
): AdaptationValidationIssue {
  return { code, field, message };
}

function isNonNegativeWholeNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

export function validateAdaptationEvaluationInput(
  input: AdaptationEvaluationInputV1,
  maximumRecentEfforts: number,
): AdaptationValidationIssue[] {
  const issues: AdaptationValidationIssue[] = [];
  if (input.schemaVersion !== ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        "schemaVersion",
        `Use ${ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (typeof input.basePlanArtifactVersion !== "string" || input.basePlanArtifactVersion.length === 0) {
    issues.push(issue("required", "basePlanArtifactVersion", "Identify the base-plan artifact."));
  }
  if (
    typeof input.adaptationArtifactVersion !== "string" ||
    input.adaptationArtifactVersion.length === 0
  ) {
    issues.push(
      issue("required", "adaptationArtifactVersion", "Identify the adaptation artifact."),
    );
  }

  const enumFields: readonly [string, unknown, readonly string[]][] = [
    ["activePlanStatus", input.activePlanStatus, planStatuses],
    ["safetyGateState", input.safetyGateState, safetyGateStates],
    ["triggerKind", input.triggerKind, triggerKinds],
    ["currentWeekKind", input.currentWeekKind, weekKinds],
    ["nextWeekKind", input.nextWeekKind, weekKinds],
  ];
  for (const [field, value, allowedValues] of enumFields) {
    if (typeof value !== "string" || !allowedValues.includes(value)) {
      issues.push(issue("invalid_value", field, "Use a supported value."));
    }
  }

  const booleanFields: readonly [string, unknown][] = [
    ["inputCompletenessConfirmed", input.inputCompletenessConfirmed],
    ["nextWeekIntroducesProgression", input.nextWeekIntroducesProgression],
    ["rescheduleCandidate.present", input.rescheduleCandidate?.present],
    ["rescheduleCandidate.samePlanWeek", input.rescheduleCandidate?.samePlanWeek],
    [
      "rescheduleCandidate.runnerConfirmedAvailable",
      input.rescheduleCandidate?.runnerConfirmedAvailable,
    ],
    ["rescheduleCandidate.targetDateEmpty", input.rescheduleCandidate?.targetDateEmpty],
  ];
  for (const [field, value] of booleanFields) {
    if (typeof value !== "boolean") {
      issues.push(issue("invalid_value", field, "Use true or false."));
    }
  }

  const wholeNumberFields: readonly [string, unknown][] = [
    ["activePlanRevision", input.activePlanRevision],
    ["evaluatedPlanRevision", input.evaluatedPlanRevision],
    ["currentCoreWeek", input.currentCoreWeek],
    ["daysUntilRace", input.daysUntilRace],
    ["currentWeek.plannedRunCount", input.currentWeek?.plannedRunCount],
    ["currentWeek.completedRunCount", input.currentWeek?.completedRunCount],
    ["currentWeek.skippedRunCount", input.currentWeek?.skippedRunCount],
    ["currentWeek.pendingRunCount", input.currentWeek?.pendingRunCount],
    [
      "daysSinceLastCompletedPlannedRun",
      input.daysSinceLastCompletedPlannedRun,
    ],
    [
      "rescheduleCandidate.consecutiveRunDatesAfterMove",
      input.rescheduleCandidate?.consecutiveRunDatesAfterMove,
    ],
  ];
  for (const [field, value] of wholeNumberFields) {
    if (!isNonNegativeWholeNumber(value)) {
      issues.push(issue("invalid_value", field, "Use a non-negative whole number."));
    }
  }

  if (!Array.isArray(input.recentEfforts)) {
    issues.push(issue("required", "recentEfforts", "Recent effort evidence is required."));
  } else {
    if (input.recentEfforts.length > maximumRecentEfforts) {
      issues.push(
        issue(
          "invalid_value",
          "recentEfforts",
          `Supply no more than ${maximumRecentEfforts} recent effort values.`,
        ),
      );
    }
    input.recentEfforts.forEach((effort, index) => {
      if (!perceivedEfforts.includes(effort)) {
        issues.push(
          issue(
            "invalid_value",
            `recentEfforts.${index}`,
            "Use a supported perceived-effort value.",
          ),
        );
      }
    });
  }

  const candidate = input.rescheduleCandidate;
  if (candidate === undefined || candidate === null) {
    issues.push(
      issue("required", "rescheduleCandidate", "Describe the reschedule candidate state."),
    );
  } else if (candidate.present) {
    if (candidate.workoutPurpose === null || !runPurposes.includes(candidate.workoutPurpose)) {
      issues.push(
        issue(
          "invalid_value",
          "rescheduleCandidate.workoutPurpose",
          "A present candidate requires a supported run purpose.",
        ),
      );
    }
    if (!isNonNegativeWholeNumber(candidate.delayCalendarDays)) {
      issues.push(
        issue(
          "invalid_value",
          "rescheduleCandidate.delayCalendarDays",
          "A present candidate requires a non-negative whole-day delay.",
        ),
      );
    }
  }

  return issues;
}

function outcomeFor(
  rules: AdaptationEvaluationRulesV1,
  decision: AdaptationDecision,
): AdaptationOutcomeRuleV1 {
  const outcome = rules.outcomes.find((candidate) => candidate.decision === decision);
  if (outcome === undefined) {
    throw new Error(`Missing injected adaptation outcome: ${decision}`);
  }
  return outcome;
}

export function evaluateAdaptation(
  request: AdaptationEvaluationRequestV1,
): AdaptationEvaluationResultV1 {
  const { evaluatorVersion, input, rules } = request;
  const issues = validateAdaptationEvaluationInput(
    input,
    rules.maximumRecentEfforts,
  );
  if (issues.length > 0) {
    return {
      schemaVersion: ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
      kind: "invalid_input",
      issues,
    };
  }

  const provenance: AdaptationEvaluationProvenanceV1 = {
    inputSchemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
    evaluatorVersion,
    basePlanArtifactVersion: rules.basePlanArtifactVersion,
    adaptationArtifactVersion: rules.adaptationArtifactVersion,
  };
  const choose = (decision: AdaptationDecision): DecidedAdaptationEvaluationResultV1 => {
    const outcome = outcomeFor(rules, decision);
    return {
      schemaVersion: ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
      kind: outcome.kind,
      action: outcome.action,
      reasonCode: outcome.reasonCode,
      explanationKey: outcome.explanationKey,
      runnerApprovalRequired: outcome.runnerApprovalRequired,
      provenance,
    };
  };
  const hardEffortValues = new Set(rules.hardEffortValues);
  const hardEffortCount = input.recentEfforts.filter((effort) =>
    hardEffortValues.has(effort),
  ).length;
  const skippedRuns = input.currentWeek.skippedRunCount;
  const pendingRuns = input.currentWeek.pendingRunCount;

  if (
    input.basePlanArtifactVersion !== rules.basePlanArtifactVersion ||
    input.adaptationArtifactVersion !== rules.adaptationArtifactVersion
  ) {
    return choose("refuse_unsupported_ruleset");
  }
  if (input.safetyGateState !== rules.requiredSafetyGateState) {
    return choose("refuse_safety_gate");
  }
  if (input.evaluatedPlanRevision !== input.activePlanRevision) {
    return choose("refuse_stale_plan");
  }
  if (
    !input.inputCompletenessConfirmed ||
    input.activePlanStatus !== rules.supportedPlanStatus ||
    input.currentCoreWeek < rules.supportedCoreWeeks.minimum ||
    input.currentCoreWeek > rules.supportedCoreWeeks.maximum ||
    input.currentWeek.plannedRunCount !== rules.plannedRunsPerWeek ||
    input.currentWeek.completedRunCount + skippedRuns + pendingRuns !==
      input.currentWeek.plannedRunCount
  ) {
    return choose("refuse_incomplete_evidence");
  }
  if (input.daysSinceLastCompletedPlannedRun >= rules.longDisruptionDays) {
    return choose("refuse_long_disruption");
  }
  if (skippedRuns > rules.maximumMissedRunsForAutomaticDecision) {
    return choose("refuse_excessive_disruption");
  }
  if (
    skippedRuns === rules.missedRunsForRepeat &&
    input.daysUntilRace < rules.minimumDaysUntilRaceForRepeat
  ) {
    return choose("refuse_late_disruption");
  }
  if (skippedRuns > 0 && hardEffortCount >= rules.minimumHardEffortsForHold) {
    return choose("refuse_conflicting_signals");
  }
  if (
    skippedRuns === rules.missedRunsForRepeat &&
    pendingRuns === 0 &&
    rules.repeatEligibleCurrentWeekKinds.includes(input.currentWeekKind) &&
    rules.repeatEligibleNextWeekKinds.includes(input.nextWeekKind) &&
    input.daysUntilRace >= rules.minimumDaysUntilRaceForRepeat
  ) {
    return choose("repeat_period");
  }
  if (
    skippedRuns === 0 &&
    input.recentEfforts.length === rules.requiredRecordedEffortsForHold &&
    hardEffortCount >= rules.minimumHardEffortsForHold &&
    input.nextWeekIntroducesProgression &&
    rules.holdEligibleNextWeekKinds.includes(input.nextWeekKind) &&
    input.daysUntilRace >= rules.minimumDaysUntilRaceForHold
  ) {
    return choose("hold_progression");
  }

  const candidate = input.rescheduleCandidate;
  const rescheduleAllowed =
    skippedRuns === 1 &&
    candidate.present &&
    candidate.workoutPurpose !== null &&
    rules.allowedReschedulePurposes.includes(candidate.workoutPurpose) &&
    candidate.delayCalendarDays !== null &&
    candidate.delayCalendarDays <= rules.maximumRescheduleDelayDays &&
    candidate.samePlanWeek &&
    candidate.runnerConfirmedAvailable &&
    candidate.targetDateEmpty &&
    candidate.consecutiveRunDatesAfterMove <=
      rules.maximumConsecutiveRunDatesAfterReschedule &&
    input.daysUntilRace >= rules.minimumDaysUntilRaceForReschedule &&
    !rules.protectedRecoveryWeekKinds.includes(input.nextWeekKind);
  if (rescheduleAllowed) return choose("reschedule");

  if (
    (hardEffortCount >= rules.minimumHardEffortsForHold || skippedRuns > 0) &&
    rules.protectedRecoveryWeekKinds.includes(input.nextWeekKind)
  ) {
    return choose("no_change_recovery_already_scheduled");
  }
  if (
    skippedRuns === 0 &&
    input.recentEfforts.length < rules.requiredRecordedEffortsForHold
  ) {
    return choose("no_change_insufficient_pattern");
  }
  if (skippedRuns === 0 && hardEffortCount === 1) {
    return choose("no_change_single_hard_effort");
  }
  if (skippedRuns === rules.missedRunsForRepeat && pendingRuns > 0) {
    return choose("no_change_wait_for_week_completion");
  }
  if (skippedRuns > 0) return choose("no_change_do_not_stack");
  return choose("no_change_on_track");
}
