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
} from "../domain/training";

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
  readonly status: string;
  readonly runtimeUseAllowed: boolean;
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
    Omit<DraftAdaptationFixtureValues, "currentWeek" | "rescheduleCandidate">
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
  readonly status: string;
  readonly defaults: DraftAdaptationFixtureValues;
  readonly cases: readonly DraftAdaptationFixture[];
}

export interface InternalAdaptationScenarioPacket {
  readonly artifactStatus: "draft_not_approved";
  readonly artifactVersion: string;
  readonly evaluatorVersion: ReturnType<typeof createAdaptationArtifactVersion>;
  readonly rules: AdaptationEvaluationRulesV1;
  readonly defaults: DraftAdaptationFixtureValues;
  readonly cases: readonly DraftAdaptationFixture[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRules(rawRules: string): DraftRulesPacket {
  const parsed: unknown = JSON.parse(rawRules);
  if (!isRecord(parsed)) {
    throw new Error("The internal adaptation rules packet must be an object.");
  }
  if (
    parsed.status !== "draft_not_approved" ||
    parsed.runtimeUseAllowed !== false
  ) {
    throw new Error(
      "The internal adaptation rehearsal accepts only a runtime-ineligible draft packet.",
    );
  }
  return parsed as unknown as DraftRulesPacket;
}

function parseFixtures(rawFixtures: string): DraftFixturesPacket {
  const parsed: unknown = JSON.parse(rawFixtures);
  if (!isRecord(parsed) || parsed.status !== "draft_not_approved") {
    throw new Error(
      "The internal adaptation rehearsal accepts only draft fixtures.",
    );
  }
  return parsed as unknown as DraftFixturesPacket;
}

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

export function createInternalAdaptationScenarioPacket(
  rawRules: string,
  rawFixtures: string,
): InternalAdaptationScenarioPacket {
  const packet = parseRules(rawRules);
  const fixtures = parseFixtures(rawFixtures);

  if (fixtures.artifactVersion !== packet.artifactVersion) {
    throw new Error(
      "The internal adaptation rules and fixtures must use the same artifact version.",
    );
  }

  return {
    artifactStatus: "draft_not_approved",
    artifactVersion: packet.artifactVersion,
    evaluatorVersion: createAdaptationArtifactVersion(
      "deterministic-adaptation-evaluator@1.0.0",
    ),
    rules: {
      basePlanArtifactVersion: createAdaptationArtifactVersion(
        packet.basePlanArtifactVersion,
      ),
      adaptationArtifactVersion: createAdaptationArtifactVersion(
        packet.artifactVersion,
      ),
      supportedPlanStatus: packet.scope.supportedPlanStatus,
      supportedCoreWeeks: packet.scope.supportedCoreWeeks,
      requiredSafetyGateState: packet.scope.safetyGate.requiredState,
      maximumRecentEfforts:
        packet.inputContract.recentEffortWindow.maximumAssociatedCompletedRuns,
      hardEffortValues: packet.inputContract.recentEffortWindow.hardValues,
      plannedRunsPerWeek: packet.inputContract.weekEvidence.plannedRunCount,
      allowedReschedulePurposes:
        packet.inputContract.rescheduleCandidate.allowedPurposes,
      ...packet.thresholds,
      outcomes: packet.outcomes.map((outcome) => ({
        decision: outcome.decision,
        kind: outcome.kind,
        action: outcome.action,
        reasonCode: createAdaptationReasonCode(outcome.reasonCode),
        explanationKey: createAdaptationExplanationKey(
          outcome.explanationKey,
        ),
        runnerApprovalRequired: outcome.runnerApprovalRequired,
      })),
    },
    defaults: fixtures.defaults,
    cases: fixtures.cases,
  };
}

export function valuesForInternalAdaptationScenario(
  packet: InternalAdaptationScenarioPacket,
  fixture: DraftAdaptationFixture,
): DraftAdaptationFixtureValues {
  return deepMerge(packet.defaults, fixture.changes);
}

export function inputForInternalAdaptationScenario(
  values: DraftAdaptationFixtureValues,
): AdaptationEvaluationInputV1 {
  return {
    schemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
    ...values,
  };
}
