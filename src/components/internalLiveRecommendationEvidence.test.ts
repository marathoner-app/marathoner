import { describe, expect, it } from "vitest";
import {
  createRecommendationId,
  validateRecommendationEvidence,
  type RecommendationEvidenceV2,
} from "../domain/recommendations";
import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
  ADAPTATION_PLAN_PROJECTION_SCHEMA_VERSION,
  createAdaptationArtifactVersion,
  createAdaptationExplanationKey,
  createAdaptationReasonCode,
  createDateOnly,
  createDistanceMeters,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type AdaptationAction,
  type AdaptationEvaluationInputV1,
  type AdaptationEvaluationResultV1,
  type AdaptationPlanAdjustmentV1,
  type AdaptationPlanProjectionV1,
  type AdaptationPlanWorkoutV1,
  type TrainingPlan,
} from "../domain/training";
import { assembleInternalLiveRecommendationEvidence } from "./internalLiveRecommendationEvidence";

const planId = createTrainingPlanId("plan-active");
const recommendedAt = createUtcDateTime("2026-10-27T18:00:00.000Z");
const timestamp = createUtcDateTime("2026-10-01T12:00:00.000Z");
const plan: TrainingPlan = {
  id: planId,
  userId: createUserId("runner-owner"),
  name: "Internal draft plan",
  startDate: createDateOnly("2026-10-05"),
  targetRaceDate: createDateOnly("2027-04-18"),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const evaluationInput: AdaptationEvaluationInputV1 = {
  schemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  basePlanArtifactVersion: "beta-plan@0.1.0-draft",
  adaptationArtifactVersion: "beta-adaptation@0.2.0-draft",
  activePlanStatus: "active",
  activePlanRevision: 7,
  evaluatedPlanRevision: 7,
  safetyGateState: "none_reported",
  inputCompletenessConfirmed: true,
  triggerKind: "planned_run_completed",
  currentCoreWeek: 4,
  currentWeekKind: "load",
  nextWeekKind: "load",
  nextWeekIntroducesProgression: true,
  daysUntilRace: 150,
  currentWeek: {
    plannedRunCount: 4,
    completedRunCount: 4,
    skippedRunCount: 0,
    pendingRunCount: 0,
  },
  daysSinceLastCompletedPlannedRun: 1,
  recentEfforts: ["harder_than_expected", "much_harder_than_expected"],
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

function evaluationResult(
  action: Exclude<AdaptationAction, "no_change">,
): RecommendationEvidenceV2["evaluationResult"] {
  return {
    schemaVersion: ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
    kind: "recommendation",
    action,
    reasonCode: createAdaptationReasonCode(
      `ADAPT-${action.replace(/_/gu, "-").toUpperCase()}`,
    ),
    explanationKey: createAdaptationExplanationKey(
      `adaptation.${action}.internal_preview`,
    ),
    runnerApprovalRequired: true,
    provenance: {
      inputSchemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
      evaluatorVersion: createAdaptationArtifactVersion(
        "adaptation-evaluator@0.1.0-draft",
      ),
      basePlanArtifactVersion: createAdaptationArtifactVersion(
        evaluationInput.basePlanArtifactVersion,
      ),
      adaptationArtifactVersion: createAdaptationArtifactVersion(
        evaluationInput.adaptationArtifactVersion,
      ),
    },
  };
}

function workout(
  id: string,
  weekNumber: number,
  scheduledDate: string,
  distance: number,
): AdaptationPlanWorkoutV1 {
  return {
    id: createPlannedWorkoutId(id),
    weekNumber,
    scheduledDate: createDateOnly(scheduledDate),
    phase: "base_building",
    kind: "run",
    purpose: "easy",
    target: { kind: "distance", distance: createDistanceMeters(distance) },
  };
}

const before = workout("workout-1", 5, "2026-11-02", 5_000);
const after = workout("workout-1", 5, "2026-11-02", 4_000);

function projection(
  action: Exclude<AdaptationAction, "no_change">,
  overrides: Partial<AdaptationPlanProjectionV1> = {},
): AdaptationPlanProjectionV1 {
  return {
    schemaVersion: ADAPTATION_PLAN_PROJECTION_SCHEMA_VERSION,
    action,
    planId,
    evaluatedPlanRevision: 7,
    resultingPlanRevision: 8,
    targetRaceDate: plan.targetRaceDate,
    workouts: [after],
    changes: [{ workoutId: before.id, before, after }],
    ...overrides,
  };
}

const adjustments = [
  {
    action: "repeat_period",
    sourceWeekNumber: 4,
    targetWeekNumber: 5,
  },
  {
    action: "hold_progression",
    sourceWeekNumber: 4,
    targetWeekNumber: 5,
  },
  {
    action: "reschedule",
    workoutId: before.id,
    weekNumber: 5,
    weekStartDate: createDateOnly("2026-11-02"),
    weekEndDate: createDateOnly("2026-11-08"),
    targetDate: createDateOnly("2026-11-03"),
  },
] as const satisfies readonly AdaptationPlanAdjustmentV1[];

function assemble(
  adjustment: AdaptationPlanAdjustmentV1,
  overrides: Partial<Parameters<typeof assembleInternalLiveRecommendationEvidence>[0]> = {},
) {
  return assembleInternalLiveRecommendationEvidence({
    recommendationId: createRecommendationId("internal-recommendation-1"),
    recommendedAt,
    activePlan: plan,
    evaluationInput,
    evaluationResult: evaluationResult(adjustment.action),
    adjustment,
    projection: projection(adjustment.action),
    ...overrides,
  });
}

describe("assembleInternalLiveRecommendationEvidence", () => {
  it.each(adjustments)(
    "assembles valid pending evidence for $action",
    (adjustment) => {
      const outcome = assemble(adjustment);

      expect(outcome.kind).toBe("ready");
      if (outcome.kind !== "ready") return;
      expect(outcome.evidence).toMatchObject({
        evaluatedPlanId: planId,
        evaluationInput,
        planAdjustment: adjustment,
        decision: "pending",
        recommendedAt,
        decidedAt: null,
        resultingPlanRevision: null,
      });
      expect(validateRecommendationEvidence(outcome.evidence)).toEqual([]);
    },
  );

  it.each([
    {
      name: "an invalid evaluation",
      result: {
        schemaVersion: ADAPTATION_EVALUATION_RESULT_SCHEMA_VERSION,
        kind: "invalid_input",
        issues: [],
      } satisfies AdaptationEvaluationResultV1,
    },
    {
      name: "a no-change evaluation",
      result: {
        ...evaluationResult("hold_progression"),
        kind: "no_change",
        action: "no_change",
        runnerApprovalRequired: false,
      } satisfies AdaptationEvaluationResultV1,
    },
    {
      name: "a refused evaluation",
      result: {
        ...evaluationResult("hold_progression"),
        kind: "refused",
        action: null,
        runnerApprovalRequired: false,
      } satisfies AdaptationEvaluationResultV1,
    },
  ])("refuses $name", ({ result }) => {
    expect(
      assemble(adjustments[1], { evaluationResult: result }),
    ).toMatchObject({ kind: "not_ready", code: "no_material_recommendation" });
  });

  it("refuses stale, plan-mismatched, action-mismatched, and empty projections", () => {
    expect(
      assemble(adjustments[1], {
        evaluationInput: { ...evaluationInput, evaluatedPlanRevision: 6 },
      }),
    ).toMatchObject({ kind: "not_ready", code: "revision_mismatch" });
    expect(
      assemble(adjustments[1], {
        projection: projection("hold_progression", {
          planId: createTrainingPlanId("other-plan"),
        }),
      }),
    ).toMatchObject({ kind: "not_ready", code: "plan_mismatch" });
    expect(
      assemble(adjustments[1], {
        projection: projection("repeat_period"),
      }),
    ).toMatchObject({ kind: "not_ready", code: "action_mismatch" });
    expect(
      assemble(adjustments[1], {
        projection: projection("hold_progression", { changes: [] }),
      }),
    ).toMatchObject({ kind: "not_ready", code: "no_material_change" });
  });
});
