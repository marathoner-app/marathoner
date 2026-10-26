import type { RunningExperienceLevel, Weekday } from "./types.js";
import {
  validatePlanGenerationInput,
  type PlanGenerationArtifactVersion,
  type PlanGenerationInputV1,
  type PlanGenerationReasonCode,
  type PlanGenerationSafetySignal,
  type PlanGenerationValidationIssue,
} from "./planGeneration.js";

export const PLAN_SUPPORT_EVALUATION_SCHEMA_VERSION =
  "plan-support-evaluation@1" as const;

interface InclusiveRange {
  readonly minimum: number;
  readonly maximum: number;
}

export interface PlanSupportReasonCodesV1 {
  readonly cohortGate: PlanGenerationReasonCode;
  readonly experience: PlanGenerationReasonCode;
  readonly consistencyDuration: PlanGenerationReasonCode;
  readonly weeklyDistance: PlanGenerationReasonCode;
  readonly runFrequency: PlanGenerationReasonCode;
  readonly longestRun: PlanGenerationReasonCode;
  readonly raceDateRequired: PlanGenerationReasonCode;
  readonly raceHorizon: PlanGenerationReasonCode;
  readonly raceAlignment: PlanGenerationReasonCode;
  readonly availability: PlanGenerationReasonCode;
  readonly scheduleConstraint: PlanGenerationReasonCode;
}

export interface PlanSupportRulesV1 {
  readonly rulesetVersion: PlanGenerationArtifactVersion;
  readonly eligibleExperienceLevel: RunningExperienceLevel;
  readonly minimumConsistentRunningWeeks: number;
  readonly currentWeeklyDistanceMeters: InclusiveRange;
  readonly currentRunningFrequencyDaysPerWeek: InclusiveRange;
  readonly longestRecentRunDistanceMeters: InclusiveRange;
  readonly minimumAvailableTrainingDays: number;
  readonly requiredTrainingDayPositionsRelativeToPreferredLongRunDay: readonly number[];
  readonly scheduleConstraintsSupported: "omitted";
  readonly requiredSafetySignal: Extract<
    PlanGenerationSafetySignal,
    "none_reported"
  >;
  readonly targetRaceKind: "date";
  readonly wholeWeeksFromPlanStartToRace: InclusiveRange;
  readonly reasonCodes: PlanSupportReasonCodesV1;
  readonly unsupportedReasonCodeOrder: readonly PlanGenerationReasonCode[];
}

export interface PlanSupportEvaluationRequestV1 {
  readonly input: PlanGenerationInputV1;
  readonly cohortEligibilityConfirmed: boolean;
  readonly rules: PlanSupportRulesV1;
}

interface PlanSupportEvaluationBaseV1 {
  readonly schemaVersion: typeof PLAN_SUPPORT_EVALUATION_SCHEMA_VERSION;
}

export interface SupportedPlanSupportEvaluationV1
  extends PlanSupportEvaluationBaseV1 {
  readonly kind: "supported";
  readonly rulesetVersion: PlanGenerationArtifactVersion;
  readonly reasonCodes: readonly [];
}

export interface UnsupportedPlanSupportEvaluationV1
  extends PlanSupportEvaluationBaseV1 {
  readonly kind: "unsupported";
  readonly rulesetVersion: PlanGenerationArtifactVersion;
  readonly reasonCodes: readonly PlanGenerationReasonCode[];
}

export interface InvalidPlanSupportEvaluationV1
  extends PlanSupportEvaluationBaseV1 {
  readonly kind: "invalid_input";
  readonly issues: readonly PlanGenerationValidationIssue[];
}

export type PlanSupportEvaluationResultV1 =
  | SupportedPlanSupportEvaluationV1
  | UnsupportedPlanSupportEvaluationV1
  | InvalidPlanSupportEvaluationV1;

const weekdays: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

function isOutside(value: number, range: InclusiveRange): boolean {
  return value < range.minimum || value > range.maximum;
}

function inclusiveDayCount(startDate: string, endDate: string): number {
  const elapsedDays =
    (Date.parse(`${endDate}T00:00:00.000Z`) -
      Date.parse(`${startDate}T00:00:00.000Z`)) /
    MILLISECONDS_PER_DAY;
  return elapsedDays + 1;
}

function hasRequiredAvailabilityPattern(
  availableTrainingDays: readonly Weekday[],
  preferredLongRunDay: Weekday,
  requiredPositions: readonly number[],
): boolean {
  const preferredDayIndex = weekdays.indexOf(preferredLongRunDay);
  const availableDays = new Set(availableTrainingDays);

  return requiredPositions.every((position) => {
    const requiredDayIndex = (preferredDayIndex + position) % weekdays.length;
    return availableDays.has(weekdays[requiredDayIndex]);
  });
}

function orderReasonCodes(
  reasonCodes: ReadonlySet<PlanGenerationReasonCode>,
  declaredOrder: readonly PlanGenerationReasonCode[],
): PlanGenerationReasonCode[] {
  const order = new Map(
    declaredOrder.map((reasonCode, index) => [reasonCode, index]),
  );

  return [...reasonCodes].sort(
    (left, right) =>
      (order.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function evaluatePlanSupport(
  request: PlanSupportEvaluationRequestV1,
): PlanSupportEvaluationResultV1 {
  const { cohortEligibilityConfirmed, input, rules } = request;
  const issues = validatePlanGenerationInput(input);

  if (input.rulesetVersion !== rules.rulesetVersion) {
    issues.push({
      code: "inconsistent",
      field: "rulesetVersion",
      message: "The requested and evaluated ruleset versions must match.",
    });
  }
  if (input.runner?.safetySignal !== rules.requiredSafetySignal) {
    issues.push({
      code: "inconsistent",
      field: "runner.safetySignal",
      message:
        "Support evaluation requires the reviewed upstream safety state before it can run.",
    });
  }

  if (issues.length > 0) {
    return {
      schemaVersion: PLAN_SUPPORT_EVALUATION_SCHEMA_VERSION,
      kind: "invalid_input",
      issues,
    };
  }

  const { runner } = input;
  const failedRules = new Set<PlanGenerationReasonCode>();

  if (!cohortEligibilityConfirmed) {
    failedRules.add(rules.reasonCodes.cohortGate);
  }
  if (runner.experienceLevel !== rules.eligibleExperienceLevel) {
    failedRules.add(rules.reasonCodes.experience);
  }
  if (
    runner.consistentRunningWeeks !== undefined &&
    runner.consistentRunningWeeks < rules.minimumConsistentRunningWeeks
  ) {
    failedRules.add(rules.reasonCodes.consistencyDuration);
  }
  if (
    isOutside(
      runner.currentWeeklyDistance,
      rules.currentWeeklyDistanceMeters,
    )
  ) {
    failedRules.add(rules.reasonCodes.weeklyDistance);
  }
  if (
    isOutside(
      runner.currentRunningFrequencyDaysPerWeek,
      rules.currentRunningFrequencyDaysPerWeek,
    )
  ) {
    failedRules.add(rules.reasonCodes.runFrequency);
  }
  if (
    isOutside(
      runner.longestRecentRunDistance,
      rules.longestRecentRunDistanceMeters,
    )
  ) {
    failedRules.add(rules.reasonCodes.longestRun);
  }

  if (runner.targetRace.kind !== rules.targetRaceKind) {
    failedRules.add(rules.reasonCodes.raceDateRequired);
  } else {
    const raceHorizonDays = inclusiveDayCount(
      input.planStartDate,
      runner.targetRace.date,
    );
    const raceHorizonWholeWeeks = Math.floor(raceHorizonDays / 7);
    if (
      isOutside(
        raceHorizonWholeWeeks,
        rules.wholeWeeksFromPlanStartToRace,
      )
    ) {
      failedRules.add(rules.reasonCodes.raceHorizon);
    }
    if (raceHorizonDays % 7 !== 0) {
      failedRules.add(rules.reasonCodes.raceAlignment);
    }
  }

  if (
    runner.availableTrainingDays.length < rules.minimumAvailableTrainingDays ||
    !hasRequiredAvailabilityPattern(
      runner.availableTrainingDays,
      runner.preferredLongRunDay,
      rules.requiredTrainingDayPositionsRelativeToPreferredLongRunDay,
    )
  ) {
    failedRules.add(rules.reasonCodes.availability);
  }
  if (
    rules.scheduleConstraintsSupported === "omitted" &&
    runner.scheduleConstraints !== undefined
  ) {
    failedRules.add(rules.reasonCodes.scheduleConstraint);
  }

  const reasonCodes = orderReasonCodes(
    failedRules,
    rules.unsupportedReasonCodeOrder,
  );
  if (reasonCodes.length > 0) {
    return {
      schemaVersion: PLAN_SUPPORT_EVALUATION_SCHEMA_VERSION,
      kind: "unsupported",
      rulesetVersion: rules.rulesetVersion,
      reasonCodes,
    };
  }

  return {
    schemaVersion: PLAN_SUPPORT_EVALUATION_SCHEMA_VERSION,
    kind: "supported",
    rulesetVersion: rules.rulesetVersion,
    reasonCodes: [],
  };
}
