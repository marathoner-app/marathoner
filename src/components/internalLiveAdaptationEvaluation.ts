import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  type AdaptationEvaluationInputV1,
  type AdaptationHistoryEvidenceV1,
  type AdaptationRescheduleCandidateV1,
  type AdaptationWeekKind,
} from "../domain/training";
import type { InternalAdaptationScenarioPacket } from "./internalAdaptationScenarioPacket";

export interface InternalLiveAdaptationTrustedFacts {
  readonly currentCoreWeek: number;
  readonly currentWeekKind: AdaptationWeekKind;
  readonly nextWeekKind: AdaptationWeekKind;
  readonly nextWeekIntroducesProgression: boolean;
  readonly rescheduleCandidate: AdaptationRescheduleCandidateV1;
  readonly inputCompletenessConfirmed: boolean;
}

export function inputForInternalLiveAdaptation(
  evidence: AdaptationHistoryEvidenceV1,
  packet: InternalAdaptationScenarioPacket,
  trustedFacts: InternalLiveAdaptationTrustedFacts,
): AdaptationEvaluationInputV1 {
  return {
    schemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
    basePlanArtifactVersion: packet.rules.basePlanArtifactVersion,
    adaptationArtifactVersion: packet.rules.adaptationArtifactVersion,
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
