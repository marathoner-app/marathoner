import { isDateOnly, type DateOnly } from "./dates.js";
import {
  isIdentifierValue,
  type PlannedWorkoutId,
  type TrainingPlanId,
} from "./identifiers.js";
import type { RunPurpose, TrainingPhase } from "./types.js";
import type { DistanceMeters, DurationSeconds } from "./units.js";

export const ADAPTATION_PLAN_PROJECTION_INPUT_SCHEMA_VERSION =
  "adaptation-plan-projection-input@1" as const;
export const ADAPTATION_PLAN_PROJECTION_SCHEMA_VERSION =
  "adaptation-plan-projection@1" as const;

export type AdaptationPlanProjectionAction =
  | "repeat_period"
  | "hold_progression"
  | "reschedule";

export type AdaptationWorkoutTargetV1 =
  | {
      readonly kind: "distance";
      readonly distance: DistanceMeters;
    }
  | {
      readonly kind: "duration";
      readonly duration: DurationSeconds;
    };

interface AdaptationPlanWorkoutBaseV1 {
  readonly id: PlannedWorkoutId;
  readonly weekNumber: number;
  readonly scheduledDate: DateOnly;
  readonly phase: TrainingPhase;
  readonly target: AdaptationWorkoutTargetV1;
}

export interface AdaptationRunWorkoutV1 extends AdaptationPlanWorkoutBaseV1 {
  readonly kind: "run";
  readonly purpose: RunPurpose;
}

export interface AdaptationWalkRunWorkoutV1
  extends AdaptationPlanWorkoutBaseV1 {
  readonly kind: "walk_run";
}

export type AdaptationPlanWorkoutV1 =
  | AdaptationRunWorkoutV1
  | AdaptationWalkRunWorkoutV1;

export interface RepeatPeriodAdjustmentV1 {
  readonly action: "repeat_period";
  readonly sourceWeekNumber: number;
  readonly targetWeekNumber: number;
}

export interface HoldProgressionAdjustmentV1 {
  readonly action: "hold_progression";
  readonly sourceWeekNumber: number;
  readonly targetWeekNumber: number;
}

export interface RescheduleAdjustmentV1 {
  readonly action: "reschedule";
  readonly workoutId: PlannedWorkoutId;
  readonly weekNumber: number;
  readonly weekStartDate: DateOnly;
  readonly weekEndDate: DateOnly;
  readonly targetDate: DateOnly;
}

export type AdaptationPlanAdjustmentV1 =
  | RepeatPeriodAdjustmentV1
  | HoldProgressionAdjustmentV1
  | RescheduleAdjustmentV1;

export interface AdaptationPlanProjectionInputV1 {
  readonly schemaVersion: typeof ADAPTATION_PLAN_PROJECTION_INPUT_SCHEMA_VERSION;
  readonly planId: TrainingPlanId;
  readonly activePlanRevision: number;
  readonly evaluatedPlanRevision: number;
  readonly targetRaceDate: DateOnly;
  readonly workouts: readonly AdaptationPlanWorkoutV1[];
  readonly adjustment: AdaptationPlanAdjustmentV1;
}

export interface AdaptationPlanWorkoutChangeV1 {
  readonly workoutId: PlannedWorkoutId;
  readonly before: AdaptationPlanWorkoutV1;
  readonly after: AdaptationPlanWorkoutV1;
}

export interface AdaptationPlanProjectionV1 {
  readonly schemaVersion: typeof ADAPTATION_PLAN_PROJECTION_SCHEMA_VERSION;
  readonly action: AdaptationPlanProjectionAction;
  readonly planId: TrainingPlanId;
  readonly evaluatedPlanRevision: number;
  readonly resultingPlanRevision: number;
  readonly targetRaceDate: DateOnly;
  readonly workouts: readonly AdaptationPlanWorkoutV1[];
  readonly changes: readonly AdaptationPlanWorkoutChangeV1[];
}

export type AdaptationPlanProjectionErrorCode =
  | "invalid_input"
  | "stale_revision"
  | "unsafe_projection"
  | "no_material_change";

export class AdaptationPlanProjectionError extends Error {
  constructor(
    readonly code: AdaptationPlanProjectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdaptationPlanProjectionError";
  }
}

type UnknownRecord = Readonly<Record<string, unknown>>;

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

function fail(
  code: AdaptationPlanProjectionErrorCode,
  message: string,
): never {
  throw new AdaptationPlanProjectionError(code, message);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireExactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  field: string,
): UnknownRecord {
  if (!isRecord(value)) {
    return fail("invalid_input", `${field} must be an object.`);
  }
  const expected = new Set(expectedKeys);
  const unexpected = Object.keys(value)
    .filter((key) => !expected.has(key))
    .sort()[0];
  if (unexpected !== undefined) {
    return fail(
      "invalid_input",
      `${field}.${unexpected} is not part of this contract version.`,
    );
  }
  const missing = expectedKeys.find((key) => !(key in value));
  if (missing !== undefined) {
    return fail("invalid_input", `${field}.${missing} is required.`);
  }
  return value;
}

function requirePositiveWholeNumber(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    return fail("invalid_input", `${field} must be a positive whole number.`);
  }
  return Number(value);
}

function requireDate(value: unknown, field: string): DateOnly {
  if (!isDateOnly(value)) {
    return fail("invalid_input", `${field} must be a valid YYYY-MM-DD date.`);
  }
  return value;
}

function requireTarget(
  value: unknown,
  field: string,
): AdaptationWorkoutTargetV1 {
  if (!isRecord(value)) {
    return fail("invalid_input", `${field} must be a workout target.`);
  }
  if (value.kind === "distance") {
    const target = requireExactRecord(value, ["kind", "distance"], field);
    if (!Number.isSafeInteger(target.distance) || Number(target.distance) < 1) {
      return fail(
        "invalid_input",
        `${field}.distance must be a positive whole number of meters.`,
      );
    }
    return target as unknown as AdaptationWorkoutTargetV1;
  }
  if (value.kind === "duration") {
    const target = requireExactRecord(value, ["kind", "duration"], field);
    if (!Number.isSafeInteger(target.duration) || Number(target.duration) < 1) {
      return fail(
        "invalid_input",
        `${field}.duration must be a positive whole number of seconds.`,
      );
    }
    return target as unknown as AdaptationWorkoutTargetV1;
  }
  return fail("invalid_input", `${field}.kind is not supported.`);
}

function requireWorkout(
  value: unknown,
  index: number,
): AdaptationPlanWorkoutV1 {
  const field = `workouts.${index}`;
  if (!isRecord(value)) {
    return fail("invalid_input", `${field} must be a workout.`);
  }
  const expectedKeys =
    value.kind === "run"
      ? ["id", "weekNumber", "scheduledDate", "phase", "kind", "purpose", "target"]
      : ["id", "weekNumber", "scheduledDate", "phase", "kind", "target"];
  const workout = requireExactRecord(value, expectedKeys, field);
  if (!isIdentifierValue(workout.id)) {
    return fail("invalid_input", `${field}.id is invalid.`);
  }
  requirePositiveWholeNumber(workout.weekNumber, `${field}.weekNumber`);
  requireDate(workout.scheduledDate, `${field}.scheduledDate`);
  if (!phases.includes(workout.phase as TrainingPhase)) {
    return fail("invalid_input", `${field}.phase is not supported.`);
  }
  if (workout.kind !== "run" && workout.kind !== "walk_run") {
    return fail("invalid_input", `${field}.kind is not supported.`);
  }
  if (
    workout.kind === "run" &&
    !runPurposes.includes(workout.purpose as RunPurpose)
  ) {
    return fail("invalid_input", `${field}.purpose is not supported.`);
  }
  requireTarget(workout.target, `${field}.target`);
  return workout as unknown as AdaptationPlanWorkoutV1;
}

function compareWorkouts(
  left: AdaptationPlanWorkoutV1,
  right: AdaptationPlanWorkoutV1,
): number {
  return (
    left.weekNumber - right.weekNumber ||
    left.scheduledDate.localeCompare(right.scheduledDate) ||
    left.id.localeCompare(right.id)
  );
}

function targetValue(target: AdaptationWorkoutTargetV1): number {
  return target.kind === "distance" ? target.distance : target.duration;
}

function compatibleTargets(
  source: AdaptationPlanWorkoutV1,
  target: AdaptationPlanWorkoutV1,
  position: number,
): void {
  if (source.kind !== target.kind || source.target.kind !== target.target.kind) {
    fail(
      "unsafe_projection",
      `Workout position ${position + 1} has incompatible workout or target kinds.`,
    );
  }
}

function replaceWorkout(
  workouts: readonly AdaptationPlanWorkoutV1[],
  replacement: AdaptationPlanWorkoutV1,
): readonly AdaptationPlanWorkoutV1[] {
  return workouts.map((workout) =>
    workout.id === replacement.id ? replacement : workout,
  );
}

function requireFourWeekWorkouts(
  workouts: readonly AdaptationPlanWorkoutV1[],
  weekNumber: number,
  label: string,
): readonly AdaptationPlanWorkoutV1[] {
  const selected = workouts
    .filter((workout) => workout.weekNumber === weekNumber)
    .sort(compareWorkouts);
  if (selected.length !== 4) {
    return fail(
      "invalid_input",
      `${label} must contain exactly four workout prescriptions.`,
    );
  }
  return selected;
}

function requireSequentialWeeks(
  sourceWeekNumber: number,
  targetWeekNumber: number,
): void {
  if (targetWeekNumber !== sourceWeekNumber + 1) {
    fail(
      "invalid_input",
      "The target week must immediately follow the source week.",
    );
  }
}

function projectPairedWeek(
  action: "repeat_period" | "hold_progression",
  workouts: readonly AdaptationPlanWorkoutV1[],
  sourceWeekNumber: number,
  targetWeekNumber: number,
): {
  readonly workouts: readonly AdaptationPlanWorkoutV1[];
  readonly changes: readonly AdaptationPlanWorkoutChangeV1[];
} {
  requireSequentialWeeks(sourceWeekNumber, targetWeekNumber);
  const source = requireFourWeekWorkouts(
    workouts,
    sourceWeekNumber,
    "The source week",
  );
  const target = requireFourWeekWorkouts(
    workouts,
    targetWeekNumber,
    "The target week",
  );
  if (source[3].scheduledDate >= target[0].scheduledDate) {
    return fail(
      "invalid_input",
      "The source workouts must occur before the target workouts.",
    );
  }

  let projectedWorkouts = workouts;
  const changes: AdaptationPlanWorkoutChangeV1[] = [];
  target.forEach((targetWorkout, index) => {
    const sourceWorkout = source[index];
    compatibleTargets(sourceWorkout, targetWorkout, index);
    const sourceValue = targetValue(sourceWorkout.target);
    const currentValue = targetValue(targetWorkout.target);
    if (action === "repeat_period" && sourceValue > currentValue) {
      fail(
        "unsafe_projection",
        `Repeat position ${index + 1} would increase its target.`,
      );
    }
    const nextValue =
      action === "hold_progression"
        ? Math.min(sourceValue, currentValue)
        : sourceValue;
    if (nextValue === currentValue) return;
    const nextTarget: AdaptationWorkoutTargetV1 =
      targetWorkout.target.kind === "distance"
        ? {
            kind: "distance",
            distance: nextValue as DistanceMeters,
          }
        : {
            kind: "duration",
            duration: nextValue as DurationSeconds,
          };
    const after = { ...targetWorkout, target: nextTarget };
    projectedWorkouts = replaceWorkout(projectedWorkouts, after);
    changes.push({ workoutId: targetWorkout.id, before: targetWorkout, after });
  });
  return { workouts: projectedWorkouts, changes };
}

function projectReschedule(
  workouts: readonly AdaptationPlanWorkoutV1[],
  adjustment: RescheduleAdjustmentV1,
  targetRaceDate: DateOnly,
): {
  readonly workouts: readonly AdaptationPlanWorkoutV1[];
  readonly changes: readonly AdaptationPlanWorkoutChangeV1[];
} {
  const workout = workouts.find((candidate) => candidate.id === adjustment.workoutId);
  if (workout === undefined) {
    return fail("invalid_input", "The rescheduled workout does not exist.");
  }
  if (
    workout.kind !== "run" ||
    (workout.purpose !== "easy" && workout.purpose !== "recovery")
  ) {
    return fail(
      "unsafe_projection",
      "Only an easy or recovery run prescription can be rescheduled.",
    );
  }
  if (workout.weekNumber !== adjustment.weekNumber) {
    return fail(
      "invalid_input",
      "The rescheduled workout is not in the supplied plan week.",
    );
  }
  if (adjustment.weekStartDate > adjustment.weekEndDate) {
    return fail("invalid_input", "The plan-week date range is invalid.");
  }
  for (const date of [workout.scheduledDate, adjustment.targetDate]) {
    if (date < adjustment.weekStartDate || date > adjustment.weekEndDate) {
      return fail(
        "unsafe_projection",
        "The rescheduled workout must stay inside its plan week.",
      );
    }
  }
  if (adjustment.targetDate <= workout.scheduledDate) {
    return fail(
      "unsafe_projection",
      "The reschedule target must be later than the original date.",
    );
  }
  if (adjustment.targetDate > targetRaceDate) {
    return fail(
      "unsafe_projection",
      "The reschedule target cannot be after the race date.",
    );
  }
  if (
    workouts.some(
      (candidate) => candidate.scheduledDate === adjustment.targetDate,
    )
  ) {
    return fail("unsafe_projection", "The reschedule target date is not empty.");
  }
  const after = { ...workout, scheduledDate: adjustment.targetDate };
  return {
    workouts: replaceWorkout(workouts, after),
    changes: [{ workoutId: workout.id, before: workout, after }],
  };
}

function requireAdjustment(value: unknown): AdaptationPlanAdjustmentV1 {
  if (!isRecord(value)) {
    return fail("invalid_input", "adjustment must be an object.");
  }
  if (value.action === "repeat_period" || value.action === "hold_progression") {
    const adjustment = requireExactRecord(
      value,
      ["action", "sourceWeekNumber", "targetWeekNumber"],
      "adjustment",
    );
    requirePositiveWholeNumber(
      adjustment.sourceWeekNumber,
      "adjustment.sourceWeekNumber",
    );
    requirePositiveWholeNumber(
      adjustment.targetWeekNumber,
      "adjustment.targetWeekNumber",
    );
    return adjustment as unknown as AdaptationPlanAdjustmentV1;
  }
  if (value.action === "reschedule") {
    const adjustment = requireExactRecord(
      value,
      [
        "action",
        "workoutId",
        "weekNumber",
        "weekStartDate",
        "weekEndDate",
        "targetDate",
      ],
      "adjustment",
    );
    if (!isIdentifierValue(adjustment.workoutId)) {
      return fail("invalid_input", "adjustment.workoutId is invalid.");
    }
    requirePositiveWholeNumber(
      adjustment.weekNumber,
      "adjustment.weekNumber",
    );
    requireDate(adjustment.weekStartDate, "adjustment.weekStartDate");
    requireDate(adjustment.weekEndDate, "adjustment.weekEndDate");
    requireDate(adjustment.targetDate, "adjustment.targetDate");
    return adjustment as unknown as AdaptationPlanAdjustmentV1;
  }
  return fail("invalid_input", "adjustment.action is not supported.");
}

function parseInput(value: unknown): AdaptationPlanProjectionInputV1 {
  const input = requireExactRecord(
    value,
    [
      "schemaVersion",
      "planId",
      "activePlanRevision",
      "evaluatedPlanRevision",
      "targetRaceDate",
      "workouts",
      "adjustment",
    ],
    "input",
  );
  if (
    input.schemaVersion !== ADAPTATION_PLAN_PROJECTION_INPUT_SCHEMA_VERSION
  ) {
    return fail("invalid_input", "input.schemaVersion is not supported.");
  }
  if (!isIdentifierValue(input.planId)) {
    return fail("invalid_input", "input.planId is invalid.");
  }
  const activePlanRevision = requirePositiveWholeNumber(
    input.activePlanRevision,
    "input.activePlanRevision",
  );
  const evaluatedPlanRevision = requirePositiveWholeNumber(
    input.evaluatedPlanRevision,
    "input.evaluatedPlanRevision",
  );
  if (activePlanRevision !== evaluatedPlanRevision) {
    return fail(
      "stale_revision",
      "The evaluated plan revision is no longer active.",
    );
  }
  if (activePlanRevision === Number.MAX_SAFE_INTEGER) {
    return fail("invalid_input", "The active plan revision cannot advance.");
  }
  const targetRaceDate = requireDate(
    input.targetRaceDate,
    "input.targetRaceDate",
  );
  if (!Array.isArray(input.workouts) || input.workouts.length === 0) {
    return fail("invalid_input", "input.workouts must not be empty.");
  }
  const workouts = input.workouts.map(requireWorkout).sort(compareWorkouts);
  const ids = new Set<string>();
  const dates = new Set<string>();
  workouts.forEach((workout, index) => {
    if (ids.has(workout.id)) {
      fail("invalid_input", `workouts.${index}.id is duplicated.`);
    }
    if (dates.has(workout.scheduledDate)) {
      fail("invalid_input", `workouts.${index}.scheduledDate is duplicated.`);
    }
    if (workout.scheduledDate > targetRaceDate) {
      fail(
        "invalid_input",
        `workouts.${index}.scheduledDate is after the race date.`,
      );
    }
    ids.add(workout.id);
    dates.add(workout.scheduledDate);
  });
  const adjustment = requireAdjustment(input.adjustment);
  return {
    schemaVersion: ADAPTATION_PLAN_PROJECTION_INPUT_SCHEMA_VERSION,
    planId: input.planId as TrainingPlanId,
    activePlanRevision,
    evaluatedPlanRevision,
    targetRaceDate,
    workouts,
    adjustment,
  };
}

export function projectAdaptationPlan(
  value: unknown,
): AdaptationPlanProjectionV1 {
  const input = parseInput(value);
  const result =
    input.adjustment.action === "reschedule"
      ? projectReschedule(
          input.workouts,
          input.adjustment,
          input.targetRaceDate,
        )
      : projectPairedWeek(
          input.adjustment.action,
          input.workouts,
          input.adjustment.sourceWeekNumber,
          input.adjustment.targetWeekNumber,
        );
  if (result.changes.length === 0) {
    return fail(
      "no_material_change",
      "The adjustment would not change the prescribed plan.",
    );
  }
  return {
    schemaVersion: ADAPTATION_PLAN_PROJECTION_SCHEMA_VERSION,
    action: input.adjustment.action,
    planId: input.planId,
    evaluatedPlanRevision: input.evaluatedPlanRevision,
    resultingPlanRevision: input.activePlanRevision + 1,
    targetRaceDate: input.targetRaceDate,
    workouts: [...result.workouts].sort(compareWorkouts),
    changes: [...result.changes].sort((left, right) =>
      left.workoutId.localeCompare(right.workoutId),
    ),
  };
}
