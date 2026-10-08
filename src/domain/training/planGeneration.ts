import { isDateOnly, type DateOnly } from "./dates.js";
import { isIdentifierValue, type PlannedWorkoutId } from "./identifiers.js";
import type {
  CompletionGoal,
  RecentRunPerformance,
  RunPurpose,
  RunningExperienceLevel,
  TargetRaceTiming,
  TrainingPhase,
  Weekday,
} from "./types.js";
import type { DistanceMeters, DurationSeconds } from "./units.js";

export const PLAN_GENERATION_INPUT_SCHEMA_VERSION =
  "plan-generation-input@1" as const;
export const GENERATED_PLAN_SCHEMA_VERSION = "generated-plan@1" as const;
export const PLAN_GENERATION_RESULT_SCHEMA_VERSION =
  "plan-generation-result@1" as const;

declare const artifactVersionBrand: unique symbol;
declare const reasonCodeBrand: unique symbol;

export type PlanGenerationArtifactVersion = string & {
  readonly [artifactVersionBrand]: "PlanGenerationArtifactVersion";
};

export type PlanGenerationReasonCode = string & {
  readonly [reasonCodeBrand]: "PlanGenerationReasonCode";
};

export type PlanGenerationSafetySignal =
  | "none_reported"
  | "pain_or_unusual_symptoms_reported"
  | "not_answered";

export interface PlanGenerationRunnerContextV1 {
  readonly experienceLevel: RunningExperienceLevel;
  readonly targetRace: TargetRaceTiming;
  readonly currentWeeklyDistance: DistanceMeters;
  readonly currentRunningFrequencyDaysPerWeek: number;
  readonly longestRecentRunDistance: DistanceMeters;
  readonly recentPerformance?: RecentRunPerformance;
  readonly availableTrainingDays: readonly Weekday[];
  readonly preferredLongRunDay: Weekday;
  readonly scheduleConstraints?: string;
  readonly completionGoal: CompletionGoal;
  readonly safetySignal: PlanGenerationSafetySignal;
}

export interface PlanGenerationInputV1 {
  readonly schemaVersion: typeof PLAN_GENERATION_INPUT_SCHEMA_VERSION;
  readonly rulesetVersion: PlanGenerationArtifactVersion;
  readonly planStartDate: DateOnly;
  readonly runner: PlanGenerationRunnerContextV1;
}

export interface GeneratedPlanProvenanceV1 {
  readonly inputSchemaVersion: typeof PLAN_GENERATION_INPUT_SCHEMA_VERSION;
  readonly generatorVersion: PlanGenerationArtifactVersion;
  readonly rulesetVersion: PlanGenerationArtifactVersion;
}

export interface GeneratedPhaseV1 {
  readonly phase: TrainingPhase;
  readonly startWeek: number;
  readonly endWeek: number;
  readonly reasonCodes: readonly PlanGenerationReasonCode[];
}

export type GeneratedWorkoutTargetV1 =
  | {
      readonly kind: "distance";
      readonly distance: DistanceMeters;
    }
  | {
      readonly kind: "duration";
      readonly duration: DurationSeconds;
    };

interface GeneratedWorkoutBaseV1 {
  readonly id: PlannedWorkoutId;
  readonly scheduledDate: DateOnly;
  readonly reasonCodes: readonly PlanGenerationReasonCode[];
}

export interface GeneratedRestWorkoutV1 extends GeneratedWorkoutBaseV1 {
  readonly kind: "rest";
}

export interface GeneratedRunWorkoutV1 extends GeneratedWorkoutBaseV1 {
  readonly kind: "run";
  readonly purpose: RunPurpose;
  readonly target: GeneratedWorkoutTargetV1;
}

export interface GeneratedWalkRunWorkoutV1 extends GeneratedWorkoutBaseV1 {
  readonly kind: "walk_run";
  readonly target: GeneratedWorkoutTargetV1;
}

export type GeneratedWorkoutV1 =
  | GeneratedRestWorkoutV1
  | GeneratedRunWorkoutV1
  | GeneratedWalkRunWorkoutV1;

export interface GeneratedWeekV1 {
  readonly weekNumber: number;
  readonly startDate: DateOnly;
  readonly endDate: DateOnly;
  readonly phase: TrainingPhase;
  readonly reasonCodes: readonly PlanGenerationReasonCode[];
  readonly workouts: readonly GeneratedWorkoutV1[];
}

export interface GeneratedPlanV1 {
  readonly schemaVersion: typeof GENERATED_PLAN_SCHEMA_VERSION;
  readonly name: string;
  readonly startDate: DateOnly;
  readonly targetRaceDate: DateOnly;
  readonly endDate: DateOnly;
  readonly completionGoal: CompletionGoal;
  readonly provenance: GeneratedPlanProvenanceV1;
  readonly reasonCodes: readonly PlanGenerationReasonCode[];
  readonly phases: readonly GeneratedPhaseV1[];
  readonly weeks: readonly GeneratedWeekV1[];
}

export type PlanGenerationValidationCode =
  | "invalid_schema_version"
  | "required"
  | "invalid_value"
  | "out_of_order"
  | "duplicate"
  | "inconsistent";

export interface PlanGenerationValidationIssue {
  readonly code: PlanGenerationValidationCode;
  readonly field: string;
  readonly message: string;
}

interface PlanGenerationResultBaseV1 {
  readonly schemaVersion: typeof PLAN_GENERATION_RESULT_SCHEMA_VERSION;
}

export interface GeneratedPlanResultV1 extends PlanGenerationResultBaseV1 {
  readonly kind: "generated";
  readonly plan: GeneratedPlanV1;
}

export interface UnsupportedPlanGenerationResultV1
  extends PlanGenerationResultBaseV1 {
  readonly kind: "unsupported";
  readonly provenance: GeneratedPlanProvenanceV1;
  readonly reasonCodes: readonly PlanGenerationReasonCode[];
}

export interface InvalidPlanGenerationResultV1
  extends PlanGenerationResultBaseV1 {
  readonly kind: "invalid_input";
  readonly issues: readonly PlanGenerationValidationIssue[];
}

export type PlanGenerationResultV1 =
  | GeneratedPlanResultV1
  | UnsupportedPlanGenerationResultV1
  | InvalidPlanGenerationResultV1;

const ARTIFACT_VERSION_PATTERN =
  /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;
const weekdays: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const experienceLevels: readonly RunningExperienceLevel[] = [
  "not_running",
  "inconsistent",
  "returning",
  "consistent",
];
const safetySignals: readonly PlanGenerationSafetySignal[] = [
  "none_reported",
  "pain_or_unusual_symptoms_reported",
  "not_answered",
];
const phases: readonly TrainingPhase[] = [
  "learn_to_run",
  "base_building",
  "marathon_training",
  "race_preparation",
  "recovery",
];
const runPurposes: readonly RunPurpose[] = [
  "easy",
  "recovery",
  "long",
  "tempo",
  "intervals",
  "race",
];
const validationCodes: readonly PlanGenerationValidationCode[] = [
  "invalid_schema_version",
  "required",
  "invalid_value",
  "out_of_order",
  "duplicate",
  "inconsistent",
];

export function createPlanGenerationArtifactVersion(
  value: string,
): PlanGenerationArtifactVersion {
  if (!ARTIFACT_VERSION_PATTERN.test(value)) {
    throw new Error(
      "Artifact version must use a lowercase name and semantic version, such as beta-rules@1.0.0.",
    );
  }

  return value as PlanGenerationArtifactVersion;
}

export function createPlanGenerationReasonCode(
  value: string,
): PlanGenerationReasonCode {
  if (!REASON_CODE_PATTERN.test(value) || value.length > 100) {
    throw new Error(
      "Reason code must be an uppercase, hyphen-separated identifier of 100 characters or fewer.",
    );
  }

  return value as PlanGenerationReasonCode;
}

function issue(
  code: PlanGenerationValidationCode,
  field: string,
  message: string,
): PlanGenerationValidationIssue {
  return { code, field, message };
}

function isArtifactVersion(value: unknown): value is PlanGenerationArtifactVersion {
  return typeof value === "string" && ARTIFACT_VERSION_PATTERN.test(value);
}

function isPositiveWholeNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isNonNegativeWholeNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function addDays(value: DateOnly, days: number): DateOnly {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10) as DateOnly;
}

function validateReasonCodes(
  reasonCodes: readonly PlanGenerationReasonCode[],
  field: string,
): PlanGenerationValidationIssue[] {
  if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) {
    return [issue("required", field, "Add at least one explainable reason code.")];
  }

  const issues: PlanGenerationValidationIssue[] = [];
  const seen = new Set<string>();

  for (const [index, reasonCode] of reasonCodes.entries()) {
    if (
      typeof reasonCode !== "string" ||
      !REASON_CODE_PATTERN.test(reasonCode) ||
      reasonCode.length > 100
    ) {
      issues.push(
        issue(
          "invalid_value",
          `${field}.${index}`,
          "Use an uppercase, hyphen-separated reason code of 100 characters or fewer.",
        ),
      );
    } else if (seen.has(reasonCode)) {
      issues.push(
        issue("duplicate", `${field}.${index}`, "Do not repeat a reason code."),
      );
    }
    seen.add(reasonCode);
  }

  return issues;
}

function validateProvenance(
  provenance: GeneratedPlanProvenanceV1,
  field: string,
): PlanGenerationValidationIssue[] {
  if (provenance === undefined || provenance === null) {
    return [issue("required", field, "Generation provenance is required.")];
  }

  const issues: PlanGenerationValidationIssue[] = [];
  if (provenance.inputSchemaVersion !== PLAN_GENERATION_INPUT_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        `${field}.inputSchemaVersion`,
        `Use ${PLAN_GENERATION_INPUT_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (!isArtifactVersion(provenance.generatorVersion)) {
    issues.push(
      issue(
        "invalid_value",
        `${field}.generatorVersion`,
        "Use a named semantic generator version.",
      ),
    );
  }
  if (!isArtifactVersion(provenance.rulesetVersion)) {
    issues.push(
      issue(
        "invalid_value",
        `${field}.rulesetVersion`,
        "Use a named semantic ruleset version.",
      ),
    );
  }

  return issues;
}

function validateTargetRace(
  targetRace: TargetRaceTiming,
  planStartDate: DateOnly,
): PlanGenerationValidationIssue[] {
  if (targetRace === undefined || targetRace === null) {
    return [issue("required", "runner.targetRace", "Choose a target race date or window.")];
  }

  if (targetRace.kind === "date") {
    if (!isDateOnly(targetRace.date)) {
      return [issue("invalid_value", "runner.targetRace.date", "Choose a valid target race date.")];
    }
    return targetRace.date < planStartDate
      ? [
          issue(
            "out_of_order",
            "runner.targetRace.date",
            "The target race date cannot be earlier than the plan start date.",
          ),
        ]
      : [];
  }

  if (targetRace.kind === "window") {
    const issues: PlanGenerationValidationIssue[] = [];
    if (!isDateOnly(targetRace.startDate)) {
      issues.push(
        issue("invalid_value", "runner.targetRace.startDate", "Choose a valid beginning date."),
      );
    }
    if (!isDateOnly(targetRace.endDate)) {
      issues.push(
        issue("invalid_value", "runner.targetRace.endDate", "Choose a valid ending date."),
      );
    }
    if (
      isDateOnly(targetRace.startDate) &&
      isDateOnly(targetRace.endDate) &&
      targetRace.endDate < targetRace.startDate
    ) {
      issues.push(
        issue(
          "out_of_order",
          "runner.targetRace.endDate",
          "The target window cannot end before it begins.",
        ),
      );
    }
    if (isDateOnly(targetRace.endDate) && targetRace.endDate < planStartDate) {
      issues.push(
        issue(
          "out_of_order",
          "runner.targetRace.endDate",
          "The target window must include a date on or after the plan start date.",
        ),
      );
    }
    return issues;
  }

  return [
    issue(
      "invalid_value",
      "runner.targetRace.kind",
      "Choose a target race date or window.",
    ),
  ];
}

export function validatePlanGenerationInput(
  input: PlanGenerationInputV1,
): PlanGenerationValidationIssue[] {
  const issues: PlanGenerationValidationIssue[] = [];

  if (input.schemaVersion !== PLAN_GENERATION_INPUT_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        "schemaVersion",
        `Use ${PLAN_GENERATION_INPUT_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (!isArtifactVersion(input.rulesetVersion)) {
    issues.push(
      issue(
        "invalid_value",
        "rulesetVersion",
        "Use a named semantic artifact version such as beta-rules@1.0.0.",
      ),
    );
  }
  if (!isDateOnly(input.planStartDate)) {
    issues.push(
      issue("invalid_value", "planStartDate", "Choose a valid plan start date."),
    );
  }

  const runner = input.runner;
  if (runner === undefined || runner === null) {
    issues.push(issue("required", "runner", "Runner context is required."));
    return issues;
  }

  if (!experienceLevels.includes(runner.experienceLevel)) {
    issues.push(
      issue(
        "invalid_value",
        "runner.experienceLevel",
        "Choose a supported recent-running description.",
      ),
    );
  }
  if (isDateOnly(input.planStartDate)) {
    issues.push(...validateTargetRace(runner.targetRace, input.planStartDate));
  }
  if (!isNonNegativeWholeNumber(runner.currentWeeklyDistance)) {
    issues.push(
      issue(
        "invalid_value",
        "runner.currentWeeklyDistance",
        "Current weekly distance must be a non-negative whole number of meters.",
      ),
    );
  }
  if (
    !Number.isSafeInteger(runner.currentRunningFrequencyDaysPerWeek) ||
    runner.currentRunningFrequencyDaysPerWeek < 0 ||
    runner.currentRunningFrequencyDaysPerWeek > 7
  ) {
    issues.push(
      issue(
        "invalid_value",
        "runner.currentRunningFrequencyDaysPerWeek",
        "Current running frequency must be a whole number from zero through seven.",
      ),
    );
  }
  if (!isNonNegativeWholeNumber(runner.longestRecentRunDistance)) {
    issues.push(
      issue(
        "invalid_value",
        "runner.longestRecentRunDistance",
        "Longest recent run distance must be a non-negative whole number of meters.",
      ),
    );
  }

  if (runner.recentPerformance !== undefined) {
    if (!isDateOnly(runner.recentPerformance.completedOn)) {
      issues.push(
        issue(
          "invalid_value",
          "runner.recentPerformance.completedOn",
          "Choose a valid date for the recent effort.",
        ),
      );
    } else if (
      isDateOnly(input.planStartDate) &&
      runner.recentPerformance.completedOn > input.planStartDate
    ) {
      issues.push(
        issue(
          "out_of_order",
          "runner.recentPerformance.completedOn",
          "The recent effort cannot occur after the plan start date.",
        ),
      );
    }
    if (!isPositiveWholeNumber(runner.recentPerformance.distance)) {
      issues.push(
        issue(
          "invalid_value",
          "runner.recentPerformance.distance",
          "Recent effort distance must be a positive whole number of meters.",
        ),
      );
    }
    if (!isPositiveWholeNumber(runner.recentPerformance.duration)) {
      issues.push(
        issue(
          "invalid_value",
          "runner.recentPerformance.duration",
          "Recent effort duration must be a positive whole number of seconds.",
        ),
      );
    }
  }

  if (
    !Array.isArray(runner.availableTrainingDays) ||
    runner.availableTrainingDays.length === 0
  ) {
    issues.push(
      issue(
        "required",
        "runner.availableTrainingDays",
        "Choose at least one available training day.",
      ),
    );
  } else {
    const seen = new Set<Weekday>();
    for (const [index, day] of runner.availableTrainingDays.entries()) {
      if (!weekdays.includes(day)) {
        issues.push(
          issue(
            "invalid_value",
            `runner.availableTrainingDays.${index}`,
            "Choose a valid weekday.",
          ),
        );
      } else if (seen.has(day)) {
        issues.push(
          issue(
            "duplicate",
            `runner.availableTrainingDays.${index}`,
            "Do not repeat an available training day.",
          ),
        );
      }
      seen.add(day);
    }
  }
  if (!weekdays.includes(runner.preferredLongRunDay)) {
    issues.push(
      issue(
        "invalid_value",
        "runner.preferredLongRunDay",
        "Choose a valid preferred long-run day.",
      ),
    );
  } else if (!runner.availableTrainingDays?.includes(runner.preferredLongRunDay)) {
    issues.push(
      issue(
        "inconsistent",
        "runner.preferredLongRunDay",
        "Choose a preferred long-run day from the available training days.",
      ),
    );
  }
  if (
    runner.scheduleConstraints !== undefined &&
    (runner.scheduleConstraints.trim() === "" ||
      runner.scheduleConstraints.length > 500)
  ) {
    issues.push(
      issue(
        "invalid_value",
        "runner.scheduleConstraints",
        "Schedule constraints must be nonblank and no longer than 500 characters when included.",
      ),
    );
  }
  if (runner.completionGoal !== "complete_first_marathon") {
    issues.push(
      issue(
        "invalid_value",
        "runner.completionGoal",
        "The version 1 contract supports the completion-focused first-marathon goal only.",
      ),
    );
  }
  if (!safetySignals.includes(runner.safetySignal)) {
    issues.push(
      issue(
        "invalid_value",
        "runner.safetySignal",
        "Record whether pain or unusual symptoms were reported, not reported, or unanswered.",
      ),
    );
  }

  return issues;
}

function validateWorkout(
  workout: GeneratedWorkoutV1,
  field: string,
  week: GeneratedWeekV1,
): PlanGenerationValidationIssue[] {
  const issues: PlanGenerationValidationIssue[] = [];

  if (!isIdentifierValue(workout.id)) {
    issues.push(
      issue(
        "invalid_value",
        `${field}.id`,
        "Give each generated workout a nonblank identifier without slashes.",
      ),
    );
  }
  if (!isDateOnly(workout.scheduledDate)) {
    issues.push(
      issue("invalid_value", `${field}.scheduledDate`, "Choose a valid workout date."),
    );
  } else if (
    workout.scheduledDate < week.startDate ||
    workout.scheduledDate > week.endDate
  ) {
    issues.push(
      issue(
        "out_of_order",
        `${field}.scheduledDate`,
        "The workout date must fall inside its generated week.",
      ),
    );
  }
  issues.push(...validateReasonCodes(workout.reasonCodes, `${field}.reasonCodes`));

  if (workout.kind === "rest") return issues;

  if (workout.kind !== "run" && workout.kind !== "walk_run") {
    issues.push(
      issue("invalid_value", `${field}.kind`, "Use a run, walk-run, or rest workout."),
    );
    return issues;
  }
  if (workout.kind === "run" && !runPurposes.includes(workout.purpose)) {
    issues.push(
      issue("invalid_value", `${field}.purpose`, "Choose a supported run purpose."),
    );
  }

  if (workout.target === undefined || workout.target === null) {
    issues.push(
      issue("required", `${field}.target`, "Add a positive distance or duration target."),
    );
  } else if (workout.target.kind === "distance") {
    if (!isPositiveWholeNumber(workout.target.distance)) {
      issues.push(
        issue(
          "invalid_value",
          `${field}.target.distance`,
          "Workout distance must be a positive whole number of meters.",
        ),
      );
    }
  } else if (workout.target.kind === "duration") {
    if (!isPositiveWholeNumber(workout.target.duration)) {
      issues.push(
        issue(
          "invalid_value",
          `${field}.target.duration`,
          "Workout duration must be a positive whole number of seconds.",
        ),
      );
    }
  } else {
    issues.push(
      issue(
        "invalid_value",
        `${field}.target.kind`,
        "Use one distance or duration target.",
      ),
    );
  }

  return issues;
}

export function validateGeneratedPlan(
  plan: GeneratedPlanV1,
): PlanGenerationValidationIssue[] {
  const issues: PlanGenerationValidationIssue[] = [];

  if (plan.schemaVersion !== GENERATED_PLAN_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        "schemaVersion",
        `Use ${GENERATED_PLAN_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (typeof plan.name !== "string" || plan.name.trim() === "" || plan.name.length > 120) {
    issues.push(
      issue("invalid_value", "name", "Plan name must be nonblank and no longer than 120 characters."),
    );
  }
  for (const [field, value] of [
    ["startDate", plan.startDate],
    ["targetRaceDate", plan.targetRaceDate],
    ["endDate", plan.endDate],
  ] as const) {
    if (!isDateOnly(value)) {
      issues.push(issue("invalid_value", field, `Choose a valid ${field}.`));
    }
  }
  if (
    isDateOnly(plan.startDate) &&
    isDateOnly(plan.targetRaceDate) &&
    plan.targetRaceDate < plan.startDate
  ) {
    issues.push(
      issue("out_of_order", "targetRaceDate", "Target race date cannot precede plan start date."),
    );
  }
  if (
    isDateOnly(plan.targetRaceDate) &&
    isDateOnly(plan.endDate) &&
    plan.endDate < plan.targetRaceDate
  ) {
    issues.push(
      issue("out_of_order", "endDate", "Plan end date cannot precede the target race date."),
    );
  }
  if (plan.completionGoal !== "complete_first_marathon") {
    issues.push(
      issue(
        "invalid_value",
        "completionGoal",
        "The version 1 generated plan supports the completion-focused first-marathon goal only.",
      ),
    );
  }

  issues.push(...validateProvenance(plan.provenance, "provenance"));

  issues.push(...validateReasonCodes(plan.reasonCodes, "reasonCodes"));

  if (!Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    issues.push(issue("required", "weeks", "Add at least one generated week."));
  } else {
    const workoutIds = new Set<string>();
    let expectedWeekStart = plan.startDate;

    for (const [index, week] of plan.weeks.entries()) {
      const field = `weeks.${index}`;
      if (week.weekNumber !== index + 1) {
        issues.push(
          issue(
            "out_of_order",
            `${field}.weekNumber`,
            "Generated week numbers must start at one and remain consecutive.",
          ),
        );
      }
      if (!isDateOnly(week.startDate) || !isDateOnly(week.endDate)) {
        issues.push(
          issue("invalid_value", `${field}.startDate`, "Generated week dates must be valid calendar dates."),
        );
      } else {
        if (week.startDate !== expectedWeekStart) {
          issues.push(
            issue(
              "out_of_order",
              `${field}.startDate`,
              "Generated weeks must cover consecutive dates without gaps.",
            ),
          );
        }
        if (week.endDate < week.startDate || week.endDate > addDays(week.startDate, 6)) {
          issues.push(
            issue(
              "out_of_order",
              `${field}.endDate`,
              "A generated week must contain between one and seven consecutive days.",
            ),
          );
        }
        expectedWeekStart = addDays(week.endDate, 1);
      }
      if (!phases.includes(week.phase)) {
        issues.push(
          issue("invalid_value", `${field}.phase`, "Choose a supported training phase."),
        );
      }
      issues.push(...validateReasonCodes(week.reasonCodes, `${field}.reasonCodes`));

      if (!Array.isArray(week.workouts) || week.workouts.length === 0) {
        issues.push(
          issue("required", `${field}.workouts`, "Add at least one workout to each generated week."),
        );
      } else {
        for (const [workoutIndex, workout] of week.workouts.entries()) {
          const workoutField = `${field}.workouts.${workoutIndex}`;
          issues.push(...validateWorkout(workout, workoutField, week));
          if (workoutIds.has(workout.id)) {
            issues.push(
              issue(
                "duplicate",
                `${workoutField}.id`,
                "Generated workout identifiers must be unique within the plan.",
              ),
            );
          }
          workoutIds.add(workout.id);
        }
      }
    }

    const lastWeek = plan.weeks.at(-1);
    if (lastWeek !== undefined && lastWeek.endDate !== plan.endDate) {
      issues.push(
        issue("inconsistent", "endDate", "Plan end date must match the final generated week."),
      );
    }
  }

  if (!Array.isArray(plan.phases) || plan.phases.length === 0) {
    issues.push(issue("required", "phases", "Add at least one generated phase."));
  } else {
    let expectedStartWeek = 1;
    for (const [index, phase] of plan.phases.entries()) {
      const field = `phases.${index}`;
      if (!phases.includes(phase.phase)) {
        issues.push(
          issue("invalid_value", `${field}.phase`, "Choose a supported training phase."),
        );
      }
      if (
        !isPositiveWholeNumber(phase.startWeek) ||
        !isPositiveWholeNumber(phase.endWeek) ||
        phase.endWeek < phase.startWeek
      ) {
        issues.push(
          issue("out_of_order", field, "Phase week boundaries must be positive and ordered."),
        );
      } else {
        if (phase.startWeek !== expectedStartWeek) {
          issues.push(
            issue(
              "out_of_order",
              `${field}.startWeek`,
              "Generated phases must cover consecutive weeks without gaps.",
            ),
          );
        }
        expectedStartWeek = phase.endWeek + 1;
        for (let weekIndex = phase.startWeek; weekIndex <= phase.endWeek; weekIndex += 1) {
          const week = plan.weeks?.[weekIndex - 1];
          if (week !== undefined && week.phase !== phase.phase) {
            issues.push(
              issue(
                "inconsistent",
                `weeks.${weekIndex - 1}.phase`,
                "Generated week phase must match its phase segment.",
              ),
            );
          }
        }
      }
      issues.push(...validateReasonCodes(phase.reasonCodes, `${field}.reasonCodes`));
    }
    const lastPhase = plan.phases.at(-1);
    if (lastPhase !== undefined && lastPhase.endWeek !== plan.weeks?.length) {
      issues.push(
        issue("inconsistent", "phases", "Generated phases must cover every generated week."),
      );
    }
  }

  return issues;
}

export function validatePlanGenerationResult(
  result: PlanGenerationResultV1,
): PlanGenerationValidationIssue[] {
  const issues: PlanGenerationValidationIssue[] = [];
  if (result.schemaVersion !== PLAN_GENERATION_RESULT_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        "schemaVersion",
        `Use ${PLAN_GENERATION_RESULT_SCHEMA_VERSION}.`,
      ),
    );
  }

  if (result.kind === "generated") {
    issues.push(
      ...validateGeneratedPlan(result.plan).map((validationIssue) => ({
        ...validationIssue,
        field: `plan.${validationIssue.field}`,
      })),
    );
  } else if (result.kind === "unsupported") {
    issues.push(...validateProvenance(result.provenance, "provenance"));
    issues.push(...validateReasonCodes(result.reasonCodes, "reasonCodes"));
  } else if (result.kind === "invalid_input") {
    if (!Array.isArray(result.issues) || result.issues.length === 0) {
      issues.push(
        issue("required", "issues", "An invalid-input result must explain at least one issue."),
      );
    } else {
      for (const [index, validationIssue] of result.issues.entries()) {
        if (
          !validationCodes.includes(validationIssue.code) ||
          typeof validationIssue.field !== "string" ||
          validationIssue.field.trim() === "" ||
          typeof validationIssue.message !== "string" ||
          validationIssue.message.trim() === ""
        ) {
          issues.push(
            issue(
              "invalid_value",
              `issues.${index}`,
              "Each invalid-input issue needs a field and an actionable message.",
            ),
          );
        }
      }
    }
  } else {
    issues.push(
      issue(
        "invalid_value",
        "kind",
        "Use a generated, unsupported, or invalid-input result.",
      ),
    );
  }

  return issues;
}

export function validatePlanGenerationContract(
  input: PlanGenerationInputV1,
  result: PlanGenerationResultV1,
): PlanGenerationValidationIssue[] {
  const issues = [
    ...validatePlanGenerationInput(input).map((validationIssue) => ({
      ...validationIssue,
      field: `input.${validationIssue.field}`,
    })),
    ...validatePlanGenerationResult(result).map((validationIssue) => ({
      ...validationIssue,
      field: `result.${validationIssue.field}`,
    })),
  ];

  const resultProvenance =
    result.kind === "generated"
      ? result.plan.provenance
      : result.kind === "unsupported"
        ? result.provenance
        : null;
  if (
    resultProvenance !== null &&
    resultProvenance?.rulesetVersion !== input.rulesetVersion
  ) {
    issues.push(
      issue(
        "inconsistent",
        result.kind === "generated"
          ? "result.plan.provenance.rulesetVersion"
          : "result.provenance.rulesetVersion",
        "Generation-result provenance must match the requested ruleset version.",
      ),
    );
  }

  if (result.kind !== "generated" || input.runner === undefined) return issues;

  const plan = result.plan;
  if (plan.startDate !== input.planStartDate) {
    issues.push(
      issue(
        "inconsistent",
        "result.plan.startDate",
        "Generated plan must start on the requested plan start date.",
      ),
    );
  }
  if (plan.completionGoal !== input.runner.completionGoal) {
    issues.push(
      issue(
        "inconsistent",
        "result.plan.completionGoal",
        "Generated plan must preserve the runner's completion goal.",
      ),
    );
  }

  const targetRace = input.runner.targetRace;
  if (targetRace === undefined || targetRace === null) return issues;
  const targetMatches =
    targetRace.kind === "date"
      ? plan.targetRaceDate === targetRace.date
      : plan.targetRaceDate >= targetRace.startDate &&
        plan.targetRaceDate <= targetRace.endDate;
  if (!targetMatches) {
    issues.push(
      issue(
        "inconsistent",
        "result.plan.targetRaceDate",
        "Generated target race date must match the requested date or fall inside its window.",
      ),
    );
  }

  return issues;
}
