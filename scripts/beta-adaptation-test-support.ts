import draftFixturesText from "../docs/methodology/artifacts/beta-adaptation/0.1.0-draft/fixtures.json?raw";
import draftRulesText from "../docs/methodology/artifacts/beta-adaptation/0.1.0-draft/beta-adaptation.json?raw";
import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  createAdaptationArtifactVersion,
  createAdaptationExplanationKey,
  createAdaptationReasonCode,
  type AdaptationAction,
  type AdaptationDecision,
  type AdaptationEvaluationInputV1,
  type AdaptationEvaluationRulesV1,
  type AdaptationResultKind,
  type AdaptationSafetyGateState,
  type AdaptationTriggerKind,
  type AdaptationWeekEvidenceV1,
  type AdaptationWeekKind,
  type PerceivedEffort,
  type RunPurpose,
  type TrainingPlanStatus,
} from "../src/domain/training";

interface DraftOutcome {
  readonly decision: AdaptationDecision;
  readonly kind: AdaptationResultKind;
  readonly action: AdaptationAction | null;
  readonly reasonCode: string;
  readonly explanationKey: string;
  readonly runnerApprovalRequired: boolean;
}

interface DraftRulesPacket {
  readonly artifactVersion: string;
  readonly basePlanArtifactVersion: string;
  readonly scope: {
    readonly supportedPlanStatus: "active";
    readonly supportedCoreWeeks: {
      readonly minimum: number;
      readonly maximum: number;
    };
    readonly safetyGate: { readonly requiredState: "none_reported" };
  };
  readonly inputContract: {
    readonly recentEffortWindow: {
      readonly maximumAssociatedCompletedRuns: number;
      readonly hardValues: readonly PerceivedEffort[];
    };
    readonly weekEvidence: { readonly plannedRunCount: number };
    readonly rescheduleCandidate: {
      readonly allowedPurposes: readonly RunPurpose[];
    };
  };
  readonly thresholds: {
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
  };
  readonly outcomes: readonly DraftOutcome[];
}

interface DraftRescheduleCandidate {
  readonly present: boolean;
  readonly workoutPurpose: RunPurpose | null;
  readonly delayCalendarDays: number | null;
  readonly samePlanWeek: boolean;
  readonly runnerConfirmedAvailable: boolean;
  readonly targetDateEmpty: boolean;
  readonly consecutiveRunDatesAfterMove: number;
}

export interface DraftAdaptationFixtureValues {
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
  readonly rescheduleCandidate: DraftRescheduleCandidate;
}

interface DraftAdaptationFixtureChanges
  extends Partial<
    Omit<
      DraftAdaptationFixtureValues,
      "currentWeek" | "rescheduleCandidate"
    >
  > {
  readonly currentWeek?: Partial<AdaptationWeekEvidenceV1>;
  readonly rescheduleCandidate?: Partial<DraftRescheduleCandidate>;
}

export interface DraftAdaptationFixture {
  readonly id: string;
  readonly changes: DraftAdaptationFixtureChanges;
  readonly expected: {
    readonly kind: AdaptationResultKind;
    readonly action: AdaptationAction | null;
    readonly reasonCode: string;
    readonly runnerApprovalRequired: boolean;
  };
}

interface DraftFixturesPacket {
  readonly artifactVersion: string;
  readonly defaults: DraftAdaptationFixtureValues;
  readonly cases: readonly DraftAdaptationFixture[];
}

export const draftAdaptationRules = JSON.parse(
  draftRulesText,
) as DraftRulesPacket;
export const draftAdaptationFixtures = JSON.parse(
  draftFixturesText,
) as DraftFixturesPacket;

export const adaptationRules: AdaptationEvaluationRulesV1 = {
  basePlanArtifactVersion: createAdaptationArtifactVersion(
    draftAdaptationRules.basePlanArtifactVersion,
  ),
  adaptationArtifactVersion: createAdaptationArtifactVersion(
    draftAdaptationRules.artifactVersion,
  ),
  supportedPlanStatus: draftAdaptationRules.scope.supportedPlanStatus,
  supportedCoreWeeks: draftAdaptationRules.scope.supportedCoreWeeks,
  requiredSafetyGateState:
    draftAdaptationRules.scope.safetyGate.requiredState,
  maximumRecentEfforts:
    draftAdaptationRules.inputContract.recentEffortWindow
      .maximumAssociatedCompletedRuns,
  hardEffortValues:
    draftAdaptationRules.inputContract.recentEffortWindow.hardValues,
  plannedRunsPerWeek:
    draftAdaptationRules.inputContract.weekEvidence.plannedRunCount,
  allowedReschedulePurposes:
    draftAdaptationRules.inputContract.rescheduleCandidate.allowedPurposes,
  ...draftAdaptationRules.thresholds,
  outcomes: draftAdaptationRules.outcomes.map((outcome) => ({
    decision: outcome.decision,
    kind: outcome.kind,
    action: outcome.action,
    reasonCode: createAdaptationReasonCode(outcome.reasonCode),
    explanationKey: createAdaptationExplanationKey(outcome.explanationKey),
    runnerApprovalRequired: outcome.runnerApprovalRequired,
  })),
};

function deepMerge<T>(base: T, changes: unknown): T {
  if (
    base === null ||
    changes === null ||
    Array.isArray(base) ||
    Array.isArray(changes) ||
    typeof base !== "object" ||
    typeof changes !== "object"
  ) {
    return changes as T;
  }

  const baseRecord = base as Record<string, unknown>;
  const changesRecord = changes as Record<string, unknown>;
  return Object.fromEntries(
    [...new Set([...Object.keys(baseRecord), ...Object.keys(changesRecord)])].map(
      (key) => [
        key,
        key in changesRecord
          ? deepMerge(baseRecord[key], changesRecord[key])
          : baseRecord[key],
      ],
    ),
  ) as T;
}

export function fixtureValues(
  fixture: DraftAdaptationFixture,
): DraftAdaptationFixtureValues {
  return deepMerge(draftAdaptationFixtures.defaults, fixture.changes);
}

export function adaptationInput(
  values: DraftAdaptationFixtureValues,
): AdaptationEvaluationInputV1 {
  return {
    schemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
    ...values,
  };
}
