import { describe, expect, it } from "vitest";

import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
  createAdaptationArtifactVersion,
  createAdaptationExplanationKey,
  createAdaptationReasonCode,
  type AdaptationEvaluationInputV1,
  type DecidedAdaptationEvaluationResultV1,
} from "../training/adaptationEvaluation";
import { createUtcDateTime } from "../training/dates";
import { createTrainingPlanId } from "../training/identifiers";
import {
  OPERATOR_ACTIVATION_CONTROL_SCHEMA_VERSION,
  RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
  createRecommendationId,
  evaluateActivation,
  validateActivationRequest,
  validateOperatorActivationControl,
  validateRecommendationEvidence,
  type OperatorActivationControlV1,
  type RecommendationEvidenceV1,
} from "./recommendationEvidence";

const basePlanArtifactVersion = "beta-rules@0.1.0-draft";
const adaptationArtifactVersion = "beta-adaptation@0.1.0-draft";

function evaluationInput(): AdaptationEvaluationInputV1 {
  return {
    schemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
    basePlanArtifactVersion,
    adaptationArtifactVersion,
    activePlanStatus: "active",
    activePlanRevision: 3,
    evaluatedPlanRevision: 3,
    safetyGateState: "none_reported",
    inputCompletenessConfirmed: true,
    triggerKind: "planned_run_completed",
    currentCoreWeek: 4,
    currentWeekKind: "load",
    nextWeekKind: "load",
    nextWeekIntroducesProgression: true,
    daysUntilRace: 100,
    currentWeek: {
      plannedRunCount: 4,
      completedRunCount: 4,
      skippedRunCount: 0,
      pendingRunCount: 0,
    },
    daysSinceLastCompletedPlannedRun: 1,
    recentEfforts: [
      "harder_than_expected",
      "harder_than_expected",
      "about_right",
    ],
    rescheduleCandidate: {
      present: false,
      workoutPurpose: null,
      delayCalendarDays: null,
      samePlanWeek: false,
      runnerConfirmedAvailable: false,
      targetDateEmpty: false,
      consecutiveRunDatesAfterMove: 0,
    },
  };
}

function evaluationResult(): DecidedAdaptationEvaluationResultV1 & {
  readonly kind: "recommendation";
  readonly action: "hold_progression";
  readonly runnerApprovalRequired: true;
} {
  return {
    schemaVersion: ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
    kind: "recommendation",
    action: "hold_progression",
    reasonCode: createAdaptationReasonCode(
      "ADAPT-HOLD-REPEATED-HARD-EFFORT",
    ),
    explanationKey: createAdaptationExplanationKey(
      "adaptation.hold.repeated_hard_effort",
    ),
    runnerApprovalRequired: true,
    provenance: {
      inputSchemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
      evaluatorVersion: createAdaptationArtifactVersion(
        "adaptation-evaluator@0.1.0-draft",
      ),
      basePlanArtifactVersion:
        createAdaptationArtifactVersion(basePlanArtifactVersion),
      adaptationArtifactVersion:
        createAdaptationArtifactVersion(adaptationArtifactVersion),
    },
  };
}

function pendingEvidence(): RecommendationEvidenceV1 {
  return {
    schemaVersion: RECOMMENDATION_EVIDENCE_SCHEMA_VERSION,
    recommendationId: createRecommendationId("recommendation-0001"),
    evaluatedPlanId: createTrainingPlanId("plan-0001"),
    evaluationInput: evaluationInput(),
    evaluationResult: evaluationResult(),
    decision: "pending",
    recommendedAt: createUtcDateTime("2026-10-26T18:00:00.000Z"),
    decidedAt: null,
    resultingPlanRevision: null,
  };
}

function activationControl(): OperatorActivationControlV1 {
  return {
    schemaVersion: OPERATOR_ACTIVATION_CONTROL_SCHEMA_VERSION,
    revision: 2,
    updatedAt: createUtcDateTime("2026-10-26T18:00:00.000Z"),
    minimumAppProtocolVersion: 3,
    minimumCommandProtocolVersion: 2,
    capabilities: {
      generation: {
        enabled: true,
        approvedArtifactVersions: ["beta-rules@1.0.0"],
      },
      guidance: {
        enabled: false,
        approvedArtifactVersions: ["beta-guidance@1.0.0"],
      },
      adaptation: {
        enabled: true,
        approvedArtifactVersions: ["beta-adaptation@1.0.0"],
      },
    },
  };
}

describe("recommendation evidence contract", () => {
  it("accepts coherent pending, accepted, and declined evidence", () => {
    const pending = pendingEvidence();
    const accepted = {
      ...pending,
      decision: "accepted",
      decidedAt: "2026-10-26T18:05:00.000Z",
      resultingPlanRevision: 4,
    };
    const declined = {
      ...pending,
      decision: "declined",
      decidedAt: "2026-10-26T18:05:00.000Z",
    };

    expect(validateRecommendationEvidence(pending)).toEqual([]);
    expect(validateRecommendationEvidence(accepted)).toEqual([]);
    expect(validateRecommendationEvidence(declined)).toEqual([]);
  });

  it.each([
    [
      "pending evidence with a decision time",
      { ...pendingEvidence(), decidedAt: "2026-10-26T18:05:00.000Z" },
    ],
    [
      "accepted evidence without a resulting revision",
      {
        ...pendingEvidence(),
        decision: "accepted",
        decidedAt: "2026-10-26T18:05:00.000Z",
      },
    ],
    [
      "declined evidence with a resulting revision",
      {
        ...pendingEvidence(),
        decision: "declined",
        decidedAt: "2026-10-26T18:05:00.000Z",
        resultingPlanRevision: 4,
      },
    ],
    [
      "an accepted revision that does not advance the plan",
      {
        ...pendingEvidence(),
        decision: "accepted",
        decidedAt: "2026-10-26T18:05:00.000Z",
        resultingPlanRevision: 3,
      },
    ],
    [
      "a decision that predates the recommendation",
      {
        ...pendingEvidence(),
        decision: "declined",
        decidedAt: "2026-10-26T17:59:59.000Z",
      },
    ],
  ])("rejects %s", (_name, evidence) => {
    expect(validateRecommendationEvidence(evidence)).not.toEqual([]);
  });

  it("rejects stale-plan evidence and mismatched provenance", () => {
    const evidence = pendingEvidence();
    const invalid = {
      ...evidence,
      evaluationInput: {
        ...evidence.evaluationInput,
        evaluatedPlanRevision: 2,
      },
      evaluationResult: {
        ...evidence.evaluationResult,
        provenance: {
          ...evidence.evaluationResult.provenance,
          adaptationArtifactVersion: "beta-adaptation@0.2.0-draft",
        },
      },
    };

    const issues = validateRecommendationEvidence(invalid);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "inconsistent",
          field: "evaluationInput.evaluatedPlanRevision",
        }),
        expect.objectContaining({
          code: "inconsistent",
          field:
            "evaluationResult.provenance.adaptationArtifactVersion",
        }),
      ]),
    );
  });

  it.each([
    ["unknown decision", { decision: "ignored" }],
    [
      "unknown action",
      {
        evaluationResult: {
          ...evaluationResult(),
          action: "increase_intensity",
        },
      },
    ],
    [
      "invalid reason code",
      {
        evaluationResult: {
          ...evaluationResult(),
          reasonCode: "hold-because-hard",
        },
      },
    ],
    [
      "invalid explanation key",
      {
        evaluationResult: {
          ...evaluationResult(),
          explanationKey: "Hold Because Hard",
        },
      },
    ],
    ["invalid timestamp", { recommendedAt: "tomorrow" }],
    ["unknown schema", { schemaVersion: "recommendation-evidence@2" }],
  ])("rejects an %s", (_name, override) => {
    expect(
      validateRecommendationEvidence({ ...pendingEvidence(), ...override }),
    ).not.toEqual([]);
  });

  it("rejects extra top-level and nested fields", () => {
    const evidence = pendingEvidence();
    const issues = validateRecommendationEvidence({
      ...evidence,
      extra: true,
      evaluationInput: {
        ...evidence.evaluationInput,
        currentWeek: {
          ...evidence.evaluationInput.currentWeek,
          privateNote: "not contract evidence",
        },
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unexpected_field",
          field: "extra",
        }),
        expect.objectContaining({
          code: "unexpected_field",
          field: "evaluationInput.currentWeek.privateNote",
        }),
      ]),
    );
  });
});

describe("operator activation control", () => {
  it("validates an exact control record with independent capability switches", () => {
    expect(validateOperatorActivationControl(activationControl())).toEqual([]);

    expect(
      evaluateActivation(activationControl(), {
        capability: "generation",
        artifactVersion: "beta-rules@1.0.0",
        appProtocolVersion: 3,
        commandProtocolVersion: 2,
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
    expect(
      evaluateActivation(activationControl(), {
        capability: "guidance",
        artifactVersion: "beta-guidance@1.0.0",
        appProtocolVersion: 3,
        commandProtocolVersion: 2,
      }),
    ).toEqual({ allowed: false, reason: "capability_disabled" });
  });

  it.each([
    [
      "stale_app_protocol",
      {
        capability: "adaptation",
        artifactVersion: "beta-adaptation@1.0.0",
        appProtocolVersion: 2,
        commandProtocolVersion: 2,
      },
    ],
    [
      "stale_command_protocol",
      {
        capability: "adaptation",
        artifactVersion: "beta-adaptation@1.0.0",
        appProtocolVersion: 3,
        commandProtocolVersion: 1,
      },
    ],
    [
      "draft_artifact",
      {
        capability: "adaptation",
        artifactVersion: "beta-adaptation@0.1.0-draft",
        appProtocolVersion: 3,
        commandProtocolVersion: 2,
      },
    ],
    [
      "artifact_not_approved",
      {
        capability: "adaptation",
        artifactVersion: "beta-adaptation@2.0.0",
        appProtocolVersion: 3,
        commandProtocolVersion: 2,
      },
    ],
  ] as const)("deterministically returns %s", (reason, request) => {
    expect(evaluateActivation(activationControl(), request)).toEqual({
      allowed: false,
      reason,
    });
  });

  it("rejects draft, prerelease, duplicate, and malformed control allowlists", () => {
    const control = activationControl();
    const invalid = {
      ...control,
      capabilities: {
        ...control.capabilities,
        adaptation: {
          enabled: true,
          approvedArtifactVersions: [
            "beta-adaptation@0.1.0-draft",
            "beta-adaptation@1.0.0",
            "beta-adaptation@1.0.0",
            "not-a-version",
          ],
        },
      },
    };

    expect(validateOperatorActivationControl(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_value" }),
        expect.objectContaining({ code: "duplicate" }),
      ]),
    );
    expect(evaluateActivation(invalid, {})).toEqual(
      expect.objectContaining({ allowed: false, reason: "invalid_control" }),
    );
  });

  it("rejects invalid requests and unknown request fields", () => {
    const invalidRequest = {
      capability: "coaching",
      artifactVersion: "beta-adaptation@1.0.0",
      appProtocolVersion: 0,
      commandProtocolVersion: 2,
      userId: "must-not-be-authority",
    };

    expect(validateActivationRequest(invalidRequest)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_value", field: "capability" }),
        expect.objectContaining({
          code: "invalid_value",
          field: "appProtocolVersion",
        }),
        expect.objectContaining({
          code: "unexpected_field",
          field: "userId",
        }),
      ]),
    );
    expect(evaluateActivation(activationControl(), invalidRequest)).toEqual(
      expect.objectContaining({ allowed: false, reason: "invalid_request" }),
    );
  });
});
