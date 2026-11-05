import { describe, expect, it } from "vitest";
import { createAdaptationArtifactVersion } from "./adaptationEvaluation";
import {
  ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
  type AdaptationHistoryEvidenceV1,
} from "./adaptationHistoryNormalization";
import { assembleAdaptationEvaluationInput } from "./adaptationInputAssembly";
import { createDateOnly } from "./dates";
import {
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
} from "./identifiers";

const evidence: AdaptationHistoryEvidenceV1 = {
  schemaVersion: ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
  ownerId: createUserId("runner-1"),
  activePlanId: createTrainingPlanId("plan-1"),
  activePlanRevision: 7,
  evaluatedPlanRevision: 7,
  activePlanStatus: "active",
  evaluationDate: createDateOnly("2030-01-05"),
  currentWeekStartDate: createDateOnly("2030-01-01"),
  currentWeekEndDate: createDateOnly("2030-01-07"),
  triggerWorkoutId: createPlannedWorkoutId("trigger-1"),
  triggerKind: "planned_run_skipped",
  currentWeek: {
    plannedRunCount: 4,
    completedRunCount: 2,
    skippedRunCount: 1,
    pendingRunCount: 1,
  },
  daysUntilRace: 120,
  daysSinceLastCompletedPlannedRun: 2,
  recentRunCount: 2,
  recentEfforts: ["about_right", "harder_than_expected"],
  recentRunsMissingPerceivedEffort: 0,
  safetyGateState: "none_reported",
};

describe("assembleAdaptationEvaluationInput", () => {
  it("combines normalized history with only the explicitly trusted plan facts", () => {
    const input = assembleAdaptationEvaluationInput(
      evidence,
      {
        basePlanArtifactVersion:
          createAdaptationArtifactVersion("base-plan@1.0.0"),
        adaptationArtifactVersion:
          createAdaptationArtifactVersion("adaptation@1.0.0"),
      },
      {
        currentCoreWeek: 6,
        currentWeekKind: "load",
        nextWeekKind: "cutback",
        nextWeekIntroducesProgression: false,
        inputCompletenessConfirmed: true,
        rescheduleCandidate: {
          present: true,
          workoutPurpose: "easy",
          delayCalendarDays: 1,
          samePlanWeek: true,
          runnerConfirmedAvailable: true,
          targetDateEmpty: true,
          consecutiveRunDatesAfterMove: 1,
        },
      },
    );

    expect(input).toEqual({
      schemaVersion: "adaptation-evaluation-input@1",
      basePlanArtifactVersion: "base-plan@1.0.0",
      adaptationArtifactVersion: "adaptation@1.0.0",
      activePlanStatus: "active",
      activePlanRevision: 7,
      evaluatedPlanRevision: 7,
      safetyGateState: "none_reported",
      inputCompletenessConfirmed: true,
      triggerKind: "planned_run_skipped",
      currentCoreWeek: 6,
      currentWeekKind: "load",
      nextWeekKind: "cutback",
      nextWeekIntroducesProgression: false,
      daysUntilRace: 120,
      currentWeek: evidence.currentWeek,
      daysSinceLastCompletedPlannedRun: 2,
      recentEfforts: evidence.recentEfforts,
      rescheduleCandidate: {
        present: true,
        workoutPurpose: "easy",
        delayCalendarDays: 1,
        samePlanWeek: true,
        runnerConfirmedAvailable: true,
        targetDateEmpty: true,
        consecutiveRunDatesAfterMove: 1,
      },
    });
  });
});
