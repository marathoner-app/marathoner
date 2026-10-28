import { describe, expect, it } from "vitest";

import {
  SAFETY_ESCALATION_INPUT_SCHEMA_VERSION,
  createSafetyArtifactVersion,
  evaluateSafetyEscalation,
  type SafetyEscalationInputV1,
  type SafetyEscalationOutcomeV1,
  type SafetyEscalationResultKind,
  type SafetyEscalationRulesV1,
} from "./safetyEscalation";

const artifactVersion = createSafetyArtifactVersion(
  "beta-safety@0.1.0-draft",
);
const blockedCapabilities = [
  "generate_plan",
  "adapt_plan",
  "present_training_guidance",
] as const;

function outcome(
  kind: SafetyEscalationResultKind,
  action: SafetyEscalationOutcomeV1["action"],
): SafetyEscalationOutcomeV1 {
  return {
    kind,
    action,
    reasonCode: `reason-${kind}`,
    message: `message-${kind}`,
    limitations: [`limitation-${kind}`],
    blockedTrainingCapabilities:
      kind === "no_escalation" ? [] : blockedCapabilities,
    preservedCapabilities: ["view_training_history"],
  };
}

const rules: SafetyEscalationRulesV1 = {
  artifactVersion,
  outcomes: {
    no_escalation: outcome(
      "no_escalation",
      "continue_without_safety_change",
    ),
    emergency: outcome("emergency", "stop_and_call_emergency_services"),
    qualified_help: outcome(
      "qualified_help",
      "stop_and_seek_qualified_help",
    ),
    insufficient_information: outcome(
      "insufficient_information",
      "withhold_training_recommendation",
    ),
  },
};

function input(
  changes: Partial<SafetyEscalationInputV1> = {},
): SafetyEscalationInputV1 {
  return {
    schemaVersion: SAFETY_ESCALATION_INPUT_SCHEMA_VERSION,
    artifactVersion,
    reportState: "none_reported",
    emergencySignals: [],
    otherConcerningOrPersistentSymptoms: false,
    ...changes,
  };
}

describe("evaluateSafetyEscalation", () => {
  it("always gives an emergency signal first priority", () => {
    expect(
      evaluateSafetyEscalation(
        input({
          reportState: "reported",
          emergencySignals: ["chest_pressure_or_pain"],
          otherConcerningOrPersistentSymptoms: true,
        }),
        rules,
      ),
    ).toBe(rules.outcomes.emergency);
  });

  it("uses qualified help for another concern or an ambiguous report", () => {
    expect(
      evaluateSafetyEscalation(
        input({
          reportState: "reported",
          otherConcerningOrPersistentSymptoms: true,
        }),
        rules,
      ),
    ).toBe(rules.outcomes.qualified_help);
    expect(
      evaluateSafetyEscalation(input({ reportState: "reported" }), rules),
    ).toBe(rules.outcomes.qualified_help);
  });

  it("withholds a result for unanswered input or an unknown version", () => {
    expect(
      evaluateSafetyEscalation(input({ reportState: "unanswered" }), rules),
    ).toBe(rules.outcomes.insufficient_information);
    expect(
      evaluateSafetyEscalation(
        input({
          artifactVersion: createSafetyArtifactVersion("beta-safety@unknown"),
          emergencySignals: ["stroke_warning_sign"],
        }),
        rules,
      ),
    ).toBe(rules.outcomes.insufficient_information);
  });

  it("does not imply safety when no concern was reported", () => {
    const result = evaluateSafetyEscalation(input(), rules);
    expect(result).toBe(rules.outcomes.no_escalation);
    expect(result.blockedTrainingCapabilities).toEqual([]);
    expect(result.preservedCapabilities).toEqual(["view_training_history"]);
  });

  it("is deterministic for identical enumerated input", () => {
    const evaluationInput = input({
      reportState: "reported",
      emergencySignals: ["new_confusion_or_slurred_speech"],
    });
    expect(evaluateSafetyEscalation(evaluationInput, rules)).toEqual(
      evaluateSafetyEscalation(evaluationInput, rules),
    );
  });
});
