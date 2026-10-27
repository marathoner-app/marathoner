import {
  createDistanceMeters,
  createPlanGenerationArtifactVersion,
  createPlanGenerationReasonCode,
  type DeterministicPlanRulesV1,
  type PlanGenerationArtifactVersion,
  type PlanGenerationReasonCode,
  type RunPurpose,
  type RunningExperienceLevel,
  type TrainingPhase,
} from "../domain/training";

type DraftWeekKind = "load" | "cutback" | "peak" | "taper" | "race";

interface RehearsalTrainingWeek {
  readonly phase: TrainingPhase;
  readonly kind: DraftWeekKind;
  readonly distancesMetersByPosition: readonly number[];
}

interface RehearsalRulesPacket {
  readonly artifactVersion: string;
  readonly status: string;
  readonly runtimeUseAllowed: boolean;
  readonly eligibility: {
    readonly experienceLevel: RunningExperienceLevel;
    readonly consistentRunningWeeks: { readonly minimum: number };
    readonly currentWeeklyDistanceMeters: {
      readonly minimum: number;
      readonly maximum: number;
    };
    readonly currentRunningFrequencyDaysPerWeek: {
      readonly minimum: number;
      readonly maximum: number;
    };
    readonly longestRecentRunDistanceMeters: {
      readonly minimum: number;
      readonly maximum: number;
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
    readonly coreWeeks: readonly RehearsalTrainingWeek[];
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

export interface InternalPlanProposalRehearsalRuleSet {
  readonly artifactStatus: "draft_not_approved";
  readonly generatorVersion: PlanGenerationArtifactVersion;
  readonly rules: DeterministicPlanRulesV1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePacket(rawRules: string): RehearsalRulesPacket {
  const parsed: unknown = JSON.parse(rawRules);

  if (!isRecord(parsed)) {
    throw new Error("The internal plan rules packet must be a JSON object.");
  }
  if (
    parsed.status !== "draft_not_approved" ||
    parsed.runtimeUseAllowed !== false
  ) {
    throw new Error(
      "The internal rehearsal accepts only the pinned, unapproved draft packet.",
    );
  }

  return parsed as unknown as RehearsalRulesPacket;
}

function packetReasonCode(
  packet: RehearsalRulesPacket,
  value: string,
): PlanGenerationReasonCode {
  if (!packet.reasonCodes.some((entry) => entry.code === value)) {
    throw new Error(`Unknown internal rehearsal reason code: ${value}`);
  }
  return createPlanGenerationReasonCode(value);
}

function unsupportedReasonAt(
  packet: RehearsalRulesPacket,
  index: number,
): PlanGenerationReasonCode {
  const value = packet.unsupportedEvaluation.order[index];
  if (value === undefined) {
    throw new Error(`Missing unsupported rehearsal reason at index ${index}.`);
  }
  return packetReasonCode(packet, value);
}

export function createInternalPlanProposalRehearsalRuleSet(
  rawRules: string,
): InternalPlanProposalRehearsalRuleSet {
  const packet = parsePacket(rawRules);
  const reasonCode = (value: string) => packetReasonCode(packet, value);
  const weekReasonCodeByKind: Record<
    DraftWeekKind,
    PlanGenerationReasonCode
  > = {
    load: reasonCode("PLAN-LOAD-WEEK"),
    cutback: reasonCode("PLAN-CUTBACK-WEEK"),
    peak: reasonCode("PLAN-LOAD-WEEK"),
    taper: reasonCode("PLAN-TAPER-WEEK"),
    race: reasonCode("PLAN-RACE-WEEK"),
  };
  const rulesetVersion = createPlanGenerationArtifactVersion(
    packet.artifactVersion,
  );

  return {
    artifactStatus: "draft_not_approved",
    generatorVersion: createPlanGenerationArtifactVersion(
      "deterministic-plan-generator@1.0.0",
    ),
    rules: {
      rulesetVersion,
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
        packet.planFamily
          .trainingDayPositionsRelativeToPreferredLongRunDay,
      scheduleConstraintsSupported:
        packet.eligibility.scheduleConstraints.supported,
      requiredSafetySignal:
        packet.eligibility.safetySignal.requiredUpstreamState,
      targetRaceKind: packet.feasibility.targetRaceKind,
      wholeWeeksFromPlanStartToRace: {
        minimum:
          packet.feasibility.minimumWholeWeeksFromPlanStartToRace,
        maximum:
          packet.feasibility.maximumWholeWeeksFromPlanStartToRace,
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
        reasonCode("ELIG-BASE-WITHIN-BOUNDS"),
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
        reasonCodes:
          packet.planFamily.leadInWeek.reasonCodes.map(reasonCode),
      },
      coreWeeks: packet.planFamily.coreWeeks.map((week) => ({
        phase: week.phase,
        distancesMetersByPosition:
          week.distancesMetersByPosition.map(createDistanceMeters),
        reasonCodes: [weekReasonCodeByKind[week.kind]],
      })),
      raceWeek: {
        finalPositionPurpose:
          packet.planFamily.raceWeek.finalPositionPurpose,
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
