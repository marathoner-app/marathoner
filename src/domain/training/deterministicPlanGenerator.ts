import { createDateOnly, type DateOnly } from "./dates.js";
import { createPlannedWorkoutId } from "./identifiers.js";
import {
  GENERATED_PLAN_SCHEMA_VERSION,
  PLAN_GENERATION_INPUT_SCHEMA_VERSION,
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  type GeneratedPhaseV1,
  type GeneratedPlanProvenanceV1,
  type GeneratedRestWorkoutV1,
  type GeneratedRunWorkoutV1,
  type GeneratedWeekV1,
  type PlanGenerationArtifactVersion,
  type PlanGenerationInputV1,
  type PlanGenerationReasonCode,
  type PlanGenerationResultV1,
} from "./planGeneration.js";
import {
  evaluatePlanSupport,
  type PlanSupportRulesV1,
} from "./planSupportEvaluation.js";
import type { RunPurpose, TrainingPhase, Weekday } from "./types.js";
import { createDistanceMeters, type DistanceMeters } from "./units.js";

export interface GeneratedTrainingWeekRuleV1 {
  readonly phase: TrainingPhase;
  readonly distancesMetersByPosition: readonly DistanceMeters[];
  readonly reasonCodes: readonly PlanGenerationReasonCode[];
}

export interface DeterministicPlanRulesV1 extends PlanSupportRulesV1 {
  readonly planName: string;
  readonly planReasonCodes: readonly PlanGenerationReasonCode[];
  readonly positionPurposes: readonly RunPurpose[];
  readonly leadInWeek: GeneratedTrainingWeekRuleV1;
  readonly coreWeeks: readonly GeneratedTrainingWeekRuleV1[];
  readonly raceWeek: {
    readonly finalPositionPurpose: Extract<RunPurpose, "race">;
    readonly raceDistanceMeters: DistanceMeters;
  };
  readonly recoveryWeek: {
    readonly phase: Extract<TrainingPhase, "recovery">;
    readonly days: number;
    readonly reasonCodes: readonly PlanGenerationReasonCode[];
  };
}

export interface DeterministicPlanGenerationRequestV1 {
  readonly input: PlanGenerationInputV1;
  readonly cohortEligibilityConfirmed: boolean;
  readonly generatorVersion: PlanGenerationArtifactVersion;
  readonly rules: DeterministicPlanRulesV1;
}

const weekdays: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function addDays(value: DateOnly, days: number): DateOnly {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return createDateOnly(date.toISOString().slice(0, 10));
}

function inclusiveDayCount(startDate: DateOnly, endDate: DateOnly): number {
  return (
    (Date.parse(`${endDate}T00:00:00.000Z`) -
      Date.parse(`${startDate}T00:00:00.000Z`)) /
      (24 * 60 * 60 * 1_000) +
    1
  );
}

function weekdayForDate(value: DateOnly): Weekday {
  const sundayFirstIndex = new Date(`${value}T00:00:00.000Z`).getUTCDay();
  return weekdays[(sundayFirstIndex + 6) % weekdays.length];
}

function scheduledDayOffset(
  preferredLongRunDay: Weekday,
  positionRelativeToLongRunDay: number,
): number {
  const preferredDayIndex = weekdays.indexOf(preferredLongRunDay);
  const weekStartDayIndex = (preferredDayIndex + 1) % weekdays.length;
  const scheduledDayIndex =
    (preferredDayIndex + positionRelativeToLongRunDay) % weekdays.length;
  return (
    (scheduledDayIndex - weekStartDayIndex + weekdays.length) % weekdays.length
  );
}

function workoutId(
  planStartDate: DateOnly,
  weekNumber: number,
  position: number,
): string {
  return `generated-${planStartDate}-w${String(weekNumber).padStart(3, "0")}-p${String(position).padStart(2, "0")}`;
}

function recoveryWorkoutId(
  planStartDate: DateOnly,
  weekNumber: number,
  day: number,
): string {
  return `generated-${planStartDate}-w${String(weekNumber).padStart(3, "0")}-rest-${String(day).padStart(2, "0")}`;
}

function createTrainingWeek(
  input: PlanGenerationInputV1,
  rules: DeterministicPlanRulesV1,
  weekRule: GeneratedTrainingWeekRuleV1,
  weekNumber: number,
  isRaceWeek: boolean,
  targetRaceDate: DateOnly,
): GeneratedWeekV1 {
  const startDate = addDays(input.planStartDate, (weekNumber - 1) * 7);
  const endDate = addDays(startDate, 6);
  const workouts = rules.requiredTrainingDayPositionsRelativeToPreferredLongRunDay
    .map((position, positionIndex): GeneratedRunWorkoutV1 => {
      const isRacePosition =
        isRaceWeek &&
        positionIndex ===
          rules.requiredTrainingDayPositionsRelativeToPreferredLongRunDay.length - 1;
      const scheduledDate = isRacePosition
        ? targetRaceDate
        : addDays(
            startDate,
            scheduledDayOffset(input.runner.preferredLongRunDay, position),
          );
      const purpose = isRacePosition
        ? rules.raceWeek.finalPositionPurpose
        : rules.positionPurposes[positionIndex];
      const distance = isRacePosition
        ? rules.raceWeek.raceDistanceMeters
        : weekRule.distancesMetersByPosition[positionIndex];

      return {
        id: createPlannedWorkoutId(
          workoutId(input.planStartDate, weekNumber, positionIndex + 1),
        ),
        kind: "run",
        purpose,
        scheduledDate,
        target: {
          kind: "distance",
          distance: createDistanceMeters(distance),
        },
        reasonCodes: weekRule.reasonCodes,
      };
    })
    .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));

  return {
    weekNumber,
    startDate,
    endDate,
    phase: weekRule.phase,
    reasonCodes: weekRule.reasonCodes,
    workouts,
  };
}

function createRecoveryWeek(
  input: PlanGenerationInputV1,
  rules: DeterministicPlanRulesV1,
  weekNumber: number,
  targetRaceDate: DateOnly,
): GeneratedWeekV1 {
  const startDate = addDays(targetRaceDate, 1);
  const endDate = addDays(startDate, rules.recoveryWeek.days - 1);
  const workouts: GeneratedRestWorkoutV1[] = Array.from(
    { length: rules.recoveryWeek.days },
    (_, index) => ({
      id: createPlannedWorkoutId(
        recoveryWorkoutId(input.planStartDate, weekNumber, index + 1),
      ),
      kind: "rest",
      scheduledDate: addDays(startDate, index),
      reasonCodes: rules.recoveryWeek.reasonCodes,
    }),
  );

  return {
    weekNumber,
    startDate,
    endDate,
    phase: rules.recoveryWeek.phase,
    reasonCodes: rules.recoveryWeek.reasonCodes,
    workouts,
  };
}

function uniqueReasonCodes(
  reasonCodes: readonly PlanGenerationReasonCode[],
): PlanGenerationReasonCode[] {
  return [...new Set(reasonCodes)];
}

function createPhases(weeks: readonly GeneratedWeekV1[]): GeneratedPhaseV1[] {
  const phases: GeneratedPhaseV1[] = [];

  for (const week of weeks) {
    const previous = phases.at(-1);
    if (previous?.phase === week.phase) {
      phases[phases.length - 1] = {
        ...previous,
        endWeek: week.weekNumber,
        reasonCodes: uniqueReasonCodes([
          ...previous.reasonCodes,
          ...week.reasonCodes,
        ]),
      };
    } else {
      phases.push({
        phase: week.phase,
        startWeek: week.weekNumber,
        endWeek: week.weekNumber,
        reasonCodes: uniqueReasonCodes(week.reasonCodes),
      });
    }
  }

  return phases;
}

export function generateDeterministicPlan(
  request: DeterministicPlanGenerationRequestV1,
): PlanGenerationResultV1 {
  const { cohortEligibilityConfirmed, generatorVersion, input, rules } =
    request;
  const support = evaluatePlanSupport({
    input,
    cohortEligibilityConfirmed,
    rules,
  });

  if (support.kind === "invalid_input") {
    return {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: "invalid_input",
      issues: support.issues,
    };
  }

  const provenance: GeneratedPlanProvenanceV1 = {
    inputSchemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
    generatorVersion,
    rulesetVersion: rules.rulesetVersion,
  };
  if (support.kind === "unsupported") {
    return {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: "unsupported",
      provenance,
      reasonCodes: support.reasonCodes,
    };
  }

  const targetRace = input.runner.targetRace;
  if (targetRace.kind !== "date") {
    return {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: "invalid_input",
      issues: [
        {
          code: "inconsistent",
          field: "runner.targetRace",
          message: "The supported plan family requires one exact race date.",
        },
      ],
    };
  }
  if (weekdayForDate(targetRace.date) !== input.runner.preferredLongRunDay) {
    return {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: "invalid_input",
      issues: [
        {
          code: "inconsistent",
          field: "runner.preferredLongRunDay",
          message:
            "The preferred long-run day must match the exact race date weekday for this plan family.",
        },
      ],
    };
  }

  const preRaceWeekCount =
    inclusiveDayCount(input.planStartDate, targetRace.date) / 7;
  const leadInWeekCount = preRaceWeekCount - rules.coreWeeks.length;
  const trainingWeeks: GeneratedWeekV1[] = [];

  for (let index = 0; index < leadInWeekCount; index += 1) {
    trainingWeeks.push(
      createTrainingWeek(
        input,
        rules,
        rules.leadInWeek,
        index + 1,
        false,
        targetRace.date,
      ),
    );
  }

  for (const [index, weekRule] of rules.coreWeeks.entries()) {
    const weekNumber = leadInWeekCount + index + 1;
    trainingWeeks.push(
      createTrainingWeek(
        input,
        rules,
        weekRule,
        weekNumber,
        index === rules.coreWeeks.length - 1,
        targetRace.date,
      ),
    );
  }

  const recoveryWeek = createRecoveryWeek(
    input,
    rules,
    preRaceWeekCount + 1,
    targetRace.date,
  );
  const weeks = [...trainingWeeks, recoveryWeek];

  return {
    schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
    kind: "generated",
    plan: {
      schemaVersion: GENERATED_PLAN_SCHEMA_VERSION,
      name: rules.planName,
      startDate: input.planStartDate,
      targetRaceDate: targetRace.date,
      endDate: recoveryWeek.endDate,
      completionGoal: input.runner.completionGoal,
      provenance,
      reasonCodes: rules.planReasonCodes,
      phases: createPhases(weeks),
      weeks,
    },
  };
}
