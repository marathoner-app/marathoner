export const SAFETY_ESCALATION_INPUT_SCHEMA_VERSION =
  "beta-safety-evaluation-input@1" as const;

export type SafetyArtifactVersion = string & {
  readonly __safetyArtifactVersion: unique symbol;
};

export type SafetyEmergencySignal =
  | "chest_pressure_or_pain"
  | "severe_or_sudden_breathing_trouble"
  | "fainting_or_loss_of_consciousness"
  | "new_confusion_or_slurred_speech"
  | "stroke_warning_sign"
  | "heat_illness_emergency_sign";

export type SafetyReportState = "none_reported" | "reported" | "unanswered";

export type SafetyEscalationAction =
  | "continue_without_safety_change"
  | "stop_and_call_emergency_services"
  | "stop_and_seek_qualified_help"
  | "withhold_training_recommendation";

export type SafetyEscalationResultKind =
  | "no_escalation"
  | "emergency"
  | "qualified_help"
  | "insufficient_information";

export type BlockedTrainingCapability =
  | "generate_plan"
  | "adapt_plan"
  | "present_training_guidance";

export interface SafetyEscalationInputV1 {
  readonly schemaVersion: typeof SAFETY_ESCALATION_INPUT_SCHEMA_VERSION;
  readonly artifactVersion: SafetyArtifactVersion;
  readonly reportState: SafetyReportState;
  readonly emergencySignals: readonly SafetyEmergencySignal[];
  readonly otherConcerningOrPersistentSymptoms: boolean;
}

export interface SafetyEscalationOutcomeV1 {
  readonly kind: SafetyEscalationResultKind;
  readonly action: SafetyEscalationAction;
  readonly reasonCode: string;
  readonly message: string;
  readonly limitations: readonly string[];
  readonly blockedTrainingCapabilities: readonly BlockedTrainingCapability[];
  readonly preservedCapabilities: readonly ["view_training_history"];
}

export interface SafetyEscalationRulesV1 {
  readonly artifactVersion: SafetyArtifactVersion;
  readonly outcomes: Readonly<
    Record<SafetyEscalationResultKind, SafetyEscalationOutcomeV1>
  >;
}

export function createSafetyArtifactVersion(
  value: string,
): SafetyArtifactVersion {
  if (value.trim().length === 0) {
    throw new Error("Safety artifact versions cannot be empty.");
  }
  return value as SafetyArtifactVersion;
}

export function evaluateSafetyEscalation(
  input: SafetyEscalationInputV1,
  rules: SafetyEscalationRulesV1,
): SafetyEscalationOutcomeV1 {
  if (input.artifactVersion !== rules.artifactVersion) {
    return rules.outcomes.insufficient_information;
  }

  if (input.reportState === "unanswered") {
    return rules.outcomes.insufficient_information;
  }

  if (input.emergencySignals.length > 0) {
    return rules.outcomes.emergency;
  }

  if (
    input.reportState === "reported" ||
    input.otherConcerningOrPersistentSymptoms
  ) {
    return rules.outcomes.qualified_help;
  }

  return rules.outcomes.no_escalation;
}
