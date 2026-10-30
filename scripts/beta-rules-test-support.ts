import draftFixturesText from "../docs/methodology/artifacts/beta-rules/0.2.0-draft/fixtures.json?raw";
import draftRulesText from "../docs/methodology/artifacts/beta-rules/0.2.0-draft/beta-rules.json?raw";
import {
  PLAN_GENERATION_INPUT_SCHEMA_VERSION,
  createDateOnly,
  createDistanceMeters,
  createPlanGenerationArtifactVersion,
  createPlanGenerationReasonCode,
  type PlanGenerationInputV1,
  type PlanGenerationSafetySignal,
  type PlanSupportRulesV1,
  type RunPurpose,
  type RunningExperienceLevel,
  type TrainingPhase,
  type Weekday,
} from "../src/domain/training";

export type DraftWeekKind = "load" | "cutback" | "peak" | "taper" | "race";

interface DraftTrainingWeek {
  readonly week: number;
  readonly phase: TrainingPhase;
  readonly kind: DraftWeekKind;
  readonly distancesMetersByPosition: readonly number[];
}

export interface DraftRulesPacket {
  readonly artifactVersion: string;
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
    readonly coreTrainingWeeks: number;
    readonly postRaceRecoveryDays: number;
    readonly trainingRunsPerWeek: number;
    readonly trainingDayPositionsRelativeToPreferredLongRunDay: readonly number[];
    readonly positionPurposes: readonly RunPurpose[];
    readonly leadInWeek: {
      readonly phase: TrainingPhase;
      readonly reasonCodes: readonly string[];
      readonly distancesMetersByPosition: readonly number[];
    };
    readonly coreWeeks: readonly DraftTrainingWeek[];
    readonly raceWeek: {
      readonly finalPositionPurpose: "race";
      readonly finalPositionDate: "targetRaceDate";
      readonly raceDistanceMeters: number;
      readonly paceTarget: null;
      readonly finishTimeTarget: null;
    };
    readonly recoveryWeek: {
      readonly phase: "recovery";
      readonly days: number;
      readonly workouts: "one rest assignment on each day";
      readonly runningPrescription: null;
      readonly reasonCodes: readonly string[];
    };
  };
  readonly unsupportedEvaluation: { readonly order: readonly string[] };
  readonly reasonCodes: readonly {
    readonly code: string;
    readonly kind: "generated" | "unsupported";
  }[];
}

export interface DraftFixtureValues {
  readonly cohortEligibilityConfirmed: boolean;
  readonly experienceLevel: RunningExperienceLevel;
  readonly consistentRunningWeeks: number;
  readonly currentWeeklyDistanceMeters: number;
  readonly currentRunningFrequencyDaysPerWeek: number;
  readonly longestRecentRunDistanceMeters: number;
  readonly targetRaceKind: "date" | "window";
  readonly wholeWeeksFromPlanStartToRace: number;
  readonly raceAlignmentValid: boolean;
  readonly availablePatternValid: boolean;
  readonly scheduleConstraints: string | null;
  readonly safetySignal: PlanGenerationSafetySignal;
}

export interface DraftFixtureCase {
  readonly id: string;
  readonly changes: Partial<DraftFixtureValues>;
  readonly expectedKind: "generated" | "unsupported";
  readonly expectedReasonCodes: readonly string[];
  readonly expectedPlan?: {
    readonly leadInWeeks: number;
    readonly raceWeek: number;
    readonly recoveryWeek: number;
    readonly totalGeneratedWeeks: number;
    readonly peakTrainingWeekDistanceMeters: number;
    readonly peakLongRunDistanceMeters: number;
  };
}

export interface DraftFixturesPacket {
  readonly artifactVersion: string;
  readonly defaults: DraftFixtureValues;
  readonly cases: readonly DraftFixtureCase[];
}

export const draftRules = JSON.parse(draftRulesText) as DraftRulesPacket;
export const draftFixtures = JSON.parse(
  draftFixturesText,
) as DraftFixturesPacket;
export const planStartDate = createDateOnly("2030-01-07");

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function packetReasonCode(value: string) {
  if (!draftRules.reasonCodes.some((entry) => entry.code === value)) {
    throw new Error(`Unknown packet reason code: ${value}`);
  }
  return createPlanGenerationReasonCode(value);
}

function unsupportedReasonAt(index: number) {
  return packetReasonCode(draftRules.unsupportedEvaluation.order[index]);
}

export const planSupportRules: PlanSupportRulesV1 = {
  rulesetVersion: createPlanGenerationArtifactVersion(
    draftRules.artifactVersion,
  ),
  eligibleExperienceLevel: draftRules.eligibility.experienceLevel,
  minimumConsistentRunningWeeks:
    draftRules.eligibility.consistentRunningWeeks.minimum,
  currentWeeklyDistanceMeters:
    draftRules.eligibility.currentWeeklyDistanceMeters,
  currentRunningFrequencyDaysPerWeek:
    draftRules.eligibility.currentRunningFrequencyDaysPerWeek,
  longestRecentRunDistanceMeters:
    draftRules.eligibility.longestRecentRunDistanceMeters,
  minimumAvailableTrainingDays:
    draftRules.eligibility.availableTrainingDays.minimum,
  requiredTrainingDayPositionsRelativeToPreferredLongRunDay:
    draftRules.planFamily.trainingDayPositionsRelativeToPreferredLongRunDay,
  scheduleConstraintsSupported:
    draftRules.eligibility.scheduleConstraints.supported,
  requiredSafetySignal:
    draftRules.eligibility.safetySignal.requiredUpstreamState,
  targetRaceKind: draftRules.feasibility.targetRaceKind,
  wholeWeeksFromPlanStartToRace: {
    minimum: draftRules.feasibility.minimumWholeWeeksFromPlanStartToRace,
    maximum: draftRules.feasibility.maximumWholeWeeksFromPlanStartToRace,
  },
  reasonCodes: {
    cohortGate: unsupportedReasonAt(0),
    experience: unsupportedReasonAt(1),
    consistencyDuration: unsupportedReasonAt(2),
    weeklyDistance: unsupportedReasonAt(3),
    runFrequency: unsupportedReasonAt(4),
    longestRun: unsupportedReasonAt(5),
    raceDateRequired: unsupportedReasonAt(6),
    raceHorizon: unsupportedReasonAt(7),
    raceAlignment: unsupportedReasonAt(8),
    availability: unsupportedReasonAt(9),
    scheduleConstraint: unsupportedReasonAt(10),
  },
  unsupportedReasonCodeOrder: draftRules.unsupportedEvaluation.order.map(
    packetReasonCode,
  ),
};

export function inputFromValues(
  values: DraftFixtureValues,
): PlanGenerationInputV1 {
  const alignedRaceDate = addDays(
    planStartDate,
    values.wholeWeeksFromPlanStartToRace * 7 - 1,
  );
  const raceDate = createDateOnly(
    values.raceAlignmentValid ? alignedRaceDate : addDays(alignedRaceDate, 1),
  );
  const targetRace =
    values.targetRaceKind === "date"
      ? ({ kind: "date", date: raceDate } as const)
      : ({
          kind: "window",
          startDate: raceDate,
          endDate: createDateOnly(addDays(raceDate, 7)),
        } as const);
  const availableTrainingDays: readonly Weekday[] = values.availablePatternValid
    ? ["tuesday", "thursday", "saturday", "sunday"]
    : ["monday", "tuesday", "thursday", "sunday"];

  return {
    schemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
    rulesetVersion: createPlanGenerationArtifactVersion(
      draftFixtures.artifactVersion,
    ),
    planStartDate,
    runner: {
      experienceLevel: values.experienceLevel,
      consistentRunningWeeks: values.consistentRunningWeeks,
      targetRace,
      currentWeeklyDistance: createDistanceMeters(
        values.currentWeeklyDistanceMeters,
      ),
      currentRunningFrequencyDaysPerWeek:
        values.currentRunningFrequencyDaysPerWeek,
      longestRecentRunDistance: createDistanceMeters(
        values.longestRecentRunDistanceMeters,
      ),
      availableTrainingDays,
      preferredLongRunDay: "sunday",
      ...(values.scheduleConstraints === null
        ? {}
        : { scheduleConstraints: values.scheduleConstraints }),
      completionGoal: "complete_first_marathon",
      safetySignal: values.safetySignal,
    },
  };
}
