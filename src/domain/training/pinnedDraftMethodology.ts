import {
  createAdaptationArtifactVersion,
  createAdaptationExplanationKey,
  createAdaptationReasonCode,
  type AdaptationAction,
  type AdaptationDecision,
  type AdaptationEvaluationRulesV1,
  type AdaptationResultKind,
  type AdaptationWeekKind,
} from "./adaptationEvaluation.js";
import {
  createPlanGenerationArtifactVersion,
  createPlanGenerationReasonCode,
  type PlanGenerationArtifactVersion,
  type PlanGenerationReasonCode,
} from "./planGeneration.js";
import type { DeterministicPlanRulesV1 } from "./deterministicPlanGenerator.js";
import { createDistanceMeters } from "./units.js";
import type {
  PerceivedEffort,
  RunPurpose,
  RunningExperienceLevel,
  TrainingPhase,
} from "./types.js";

export interface DraftPlanRuleSet {
  readonly artifactStatus: "draft_not_approved";
  readonly generatorVersion: PlanGenerationArtifactVersion;
  readonly coreWeekKinds: readonly AdaptationWeekKind[];
  readonly rules: DeterministicPlanRulesV1;
}

export interface DraftAdaptationOutcomeDetail {
  readonly decision: AdaptationDecision;
  readonly kind: AdaptationResultKind;
  readonly action: AdaptationAction | null;
  readonly reasonCode: string;
  readonly explanationKey: string;
  readonly runnerApprovalRequired: boolean;
  readonly when: string;
  readonly planMutation: string | null;
}

export interface DraftAdaptationRuleSet {
  readonly artifactStatus: "draft_not_approved";
  readonly artifactVersion: string;
  readonly evaluatorVersion: ReturnType<typeof createAdaptationArtifactVersion>;
  readonly compatibleBasePlanArtifactVersions: readonly ReturnType<
    typeof createAdaptationArtifactVersion
  >[];
  readonly rules: AdaptationEvaluationRulesV1;
  readonly outcomeDetails: readonly DraftAdaptationOutcomeDetail[];
}

interface DraftPlanWeek {
  readonly phase: TrainingPhase;
  readonly kind: AdaptationWeekKind;
  readonly distancesMetersByPosition: readonly number[];
}

interface DraftPlanPacket {
  readonly artifactVersion: string;
  readonly status: string;
  readonly runtimeUseAllowed: boolean;
  readonly eligibility: {
    readonly experienceLevel: RunningExperienceLevel;
    readonly consistentRunningWeeks: { readonly minimum: number };
    readonly currentWeeklyDistanceMeters: {
      readonly minimum: number;
    };
    readonly currentRunningFrequencyDaysPerWeek: {
      readonly minimum: number;
    };
    readonly longestRecentRunDistanceMeters: {
      readonly minimum: number;
    };
    readonly availableTrainingDays: { readonly minimum: number };
    readonly scheduleConstraints: { readonly supported: "omitted" };
    readonly safetySignal: { readonly requiredUpstreamState: "none_reported" };
  };
  readonly feasibility: {
    readonly targetRaceKind: "date";
    readonly minimumWholeWeeksFromPlanStartToRace: number;
    readonly maximumWholeWeeksFromPlanStartToRace: number;
  };
  readonly planFamily: {
    readonly name: string;
    readonly trainingDayPositionsRelativeToPreferredLongRunDay: readonly number[];
    readonly positionPurposes: readonly RunPurpose[];
    readonly leadInWeek: {
      readonly phase: TrainingPhase;
      readonly reasonCodes: readonly string[];
      readonly distancesMetersByPosition: readonly number[];
    };
    readonly coreWeeks: readonly DraftPlanWeek[];
    readonly raceWeek: {
      readonly finalPositionPurpose: "race";
      readonly raceDistanceMeters: number;
    };
    readonly recoveryWeek: {
      readonly phase: "recovery";
      readonly days: number;
      readonly reasonCodes: readonly string[];
    };
  };
  readonly unsupportedEvaluation: { readonly order: readonly string[] };
  readonly reasonCodes: readonly { readonly code: string }[];
}

interface DraftAdaptationPacket {
  readonly artifactVersion: string;
  readonly status: string;
  readonly runtimeUseAllowed: boolean;
  readonly basePlanArtifactVersion: string;
  readonly compatibleBasePlanArtifactVersions: readonly string[];
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
  readonly thresholds: Omit<
    AdaptationEvaluationRulesV1,
    | "basePlanArtifactVersion"
    | "adaptationArtifactVersion"
    | "supportedPlanStatus"
    | "supportedCoreWeeks"
    | "requiredSafetyGateState"
    | "maximumRecentEfforts"
    | "hardEffortValues"
    | "plannedRunsPerWeek"
    | "allowedReschedulePurposes"
    | "outcomes"
  >;
  readonly outcomes: readonly DraftAdaptationOutcomeDetail[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDraftPacket<T>(
  raw: string,
  label: string,
  boundaryError = `The pinned ${label} boundary accepts only a runtime-ineligible draft packet.`,
): T {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`The pinned ${label} packet must be a JSON object.`);
  }
  if (
    parsed.status !== "draft_not_approved" ||
    parsed.runtimeUseAllowed !== false
  ) {
    throw new Error(boundaryError);
  }
  return parsed as T;
}

function planReasonCode(
  packet: DraftPlanPacket,
  value: string,
): PlanGenerationReasonCode {
  if (!packet.reasonCodes.some((entry) => entry.code === value)) {
    throw new Error(`Unknown pinned draft plan reason code: ${value}`);
  }
  return createPlanGenerationReasonCode(value);
}

function unsupportedReasonAt(
  packet: DraftPlanPacket,
  index: number,
): PlanGenerationReasonCode {
  const value = packet.unsupportedEvaluation.order[index];
  if (value === undefined) {
    throw new Error(`Missing unsupported plan reason at index ${index}.`);
  }
  return planReasonCode(packet, value);
}

export function parsePinnedDraftPlanRuleSet(rawRules: string): DraftPlanRuleSet {
  const packet = parseDraftPacket<DraftPlanPacket>(
    rawRules,
    "base-plan",
    "The internal rehearsal accepts only the pinned, unapproved draft packet.",
  );
  const reasonCode = (value: string) => planReasonCode(packet, value);
  const weekReasonCodeByKind: Record<
    AdaptationWeekKind,
    PlanGenerationReasonCode
  > = {
    load: reasonCode("PLAN-LOAD-WEEK"),
    cutback: reasonCode("PLAN-CUTBACK-WEEK"),
    peak: reasonCode("PLAN-LOAD-WEEK"),
    taper: reasonCode("PLAN-TAPER-WEEK"),
    race: reasonCode("PLAN-RACE-WEEK"),
  };

  return {
    artifactStatus: "draft_not_approved",
    generatorVersion: createPlanGenerationArtifactVersion(
      "deterministic-plan-generator@1.0.0",
    ),
    coreWeekKinds: packet.planFamily.coreWeeks.map((week) => week.kind),
    rules: {
      rulesetVersion: createPlanGenerationArtifactVersion(packet.artifactVersion),
      eligibleExperienceLevel: packet.eligibility.experienceLevel,
      minimumConsistentRunningWeeks:
        packet.eligibility.consistentRunningWeeks.minimum,
      currentWeeklyDistanceMeters:
        packet.eligibility.currentWeeklyDistanceMeters,
      currentRunningFrequencyDaysPerWeek:
        packet.eligibility.currentRunningFrequencyDaysPerWeek,
      longestRecentRunDistanceMeters:
        packet.eligibility.longestRecentRunDistanceMeters,
      minimumAvailableTrainingDays:
        packet.eligibility.availableTrainingDays.minimum,
      requiredTrainingDayPositionsRelativeToPreferredLongRunDay:
        packet.planFamily.trainingDayPositionsRelativeToPreferredLongRunDay,
      scheduleConstraintsSupported:
        packet.eligibility.scheduleConstraints.supported,
      requiredSafetySignal:
        packet.eligibility.safetySignal.requiredUpstreamState,
      targetRaceKind: packet.feasibility.targetRaceKind,
      wholeWeeksFromPlanStartToRace: {
        minimum: packet.feasibility.minimumWholeWeeksFromPlanStartToRace,
        maximum: packet.feasibility.maximumWholeWeeksFromPlanStartToRace,
      },
      reasonCodes: {
        cohortGate: unsupportedReasonAt(packet, 0),
        experience: unsupportedReasonAt(packet, 1),
        consistencyDuration: unsupportedReasonAt(packet, 2),
        weeklyDistance: unsupportedReasonAt(packet, 3),
        runFrequency: unsupportedReasonAt(packet, 4),
        longestRun: unsupportedReasonAt(packet, 5),
        raceDateRequired: unsupportedReasonAt(packet, 6),
        raceHorizon: unsupportedReasonAt(packet, 7),
        raceAlignment: unsupportedReasonAt(packet, 8),
        availability: unsupportedReasonAt(packet, 9),
        scheduleConstraint: unsupportedReasonAt(packet, 10),
      },
      unsupportedReasonCodeOrder:
        packet.unsupportedEvaluation.order.map(reasonCode),
      planName: packet.planFamily.name,
      planReasonCodes: [
        reasonCode("ELIG-CONSISTENT-RUNNER"),
        reasonCode(
          packet.reasonCodes.some(
            ({ code }) => code === "ELIG-BASE-MEETS-MINIMUMS",
          )
            ? "ELIG-BASE-MEETS-MINIMUMS"
            : "ELIG-BASE-WITHIN-BOUNDS",
        ),
        reasonCode("FEAS-RACE-HORIZON-SUPPORTED"),
        reasonCode("PLAN-COMPLETION-GOAL"),
        reasonCode("PLAN-FOUR-DAY-RHYTHM"),
      ],
      positionPurposes: packet.planFamily.positionPurposes,
      leadInWeek: {
        phase: packet.planFamily.leadInWeek.phase,
        distancesMetersByPosition:
          packet.planFamily.leadInWeek.distancesMetersByPosition.map(
            createDistanceMeters,
          ),
        reasonCodes: packet.planFamily.leadInWeek.reasonCodes.map(reasonCode),
      },
      coreWeeks: packet.planFamily.coreWeeks.map((week) => ({
        phase: week.phase,
        distancesMetersByPosition:
          week.distancesMetersByPosition.map(createDistanceMeters),
        reasonCodes: [weekReasonCodeByKind[week.kind]],
      })),
      raceWeek: {
        finalPositionPurpose: packet.planFamily.raceWeek.finalPositionPurpose,
        raceDistanceMeters: createDistanceMeters(
          packet.planFamily.raceWeek.raceDistanceMeters,
        ),
      },
      recoveryWeek: {
        phase: packet.planFamily.recoveryWeek.phase,
        days: packet.planFamily.recoveryWeek.days,
        reasonCodes:
          packet.planFamily.recoveryWeek.reasonCodes.map(reasonCode),
      },
    },
  };
}

export function parsePinnedDraftAdaptationRuleSet(
  rawRules: string,
): DraftAdaptationRuleSet {
  const packet = parseDraftPacket<DraftAdaptationPacket>(
    rawRules,
    "adaptation",
  );

  return {
    artifactStatus: "draft_not_approved",
    artifactVersion: packet.artifactVersion,
    evaluatorVersion: createAdaptationArtifactVersion(
      "deterministic-adaptation-evaluator@1.0.0",
    ),
    compatibleBasePlanArtifactVersions:
      packet.compatibleBasePlanArtifactVersions.map(
        createAdaptationArtifactVersion,
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
        explanationKey: createAdaptationExplanationKey(outcome.explanationKey),
        runnerApprovalRequired: outcome.runnerApprovalRequired,
      })),
    },
    outcomeDetails: packet.outcomes,
  };
}
