import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  type AdaptationEvaluationInputV1,
  type AdaptationEvaluationRulesV1,
  type AdaptationRescheduleCandidateV1,
  type AdaptationWeekKind,
} from "./adaptationEvaluation.js";
import type { AdaptationHistoryEvidenceV1 } from "./adaptationHistoryNormalization.js";

export interface AdaptationInputTrustedFacts {
  readonly currentCoreWeek: number;
  readonly currentWeekKind: AdaptationWeekKind;
  readonly nextWeekKind: AdaptationWeekKind;
  readonly nextWeekIntroducesProgression: boolean;
  readonly rescheduleCandidate: AdaptationRescheduleCandidateV1;
  readonly inputCompletenessConfirmed: boolean;
}

export function assembleAdaptationEvaluationInput(
  evidence: AdaptationHistoryEvidenceV1,
  rules: Pick<
    AdaptationEvaluationRulesV1,
    "basePlanArtifactVersion" | "adaptationArtifactVersion"
  >,
  trustedFacts: AdaptationInputTrustedFacts,
): AdaptationEvaluationInputV1 {
  return {
    schemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
    basePlanArtifactVersion: rules.basePlanArtifactVersion,
    adaptationArtifactVersion: rules.adaptationArtifactVersion,
    activePlanStatus: evidence.activePlanStatus,
    activePlanRevision: evidence.activePlanRevision,
    evaluatedPlanRevision: evidence.evaluatedPlanRevision,
    safetyGateState: evidence.safetyGateState,
    inputCompletenessConfirmed: trustedFacts.inputCompletenessConfirmed,
    triggerKind: evidence.triggerKind,
    currentCoreWeek: trustedFacts.currentCoreWeek,
    currentWeekKind: trustedFacts.currentWeekKind,
    nextWeekKind: trustedFacts.nextWeekKind,
    nextWeekIntroducesProgression:
      trustedFacts.nextWeekIntroducesProgression,
    daysUntilRace: evidence.daysUntilRace,
    currentWeek: evidence.currentWeek,
    daysSinceLastCompletedPlannedRun:
      evidence.daysSinceLastCompletedPlannedRun,
    recentEfforts: evidence.recentEfforts,
    rescheduleCandidate: trustedFacts.rescheduleCandidate,
  };
}
