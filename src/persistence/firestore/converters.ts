import { Timestamp } from "firebase/firestore";
import {
  createCompletedRunId,
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createPlannedWorkoutId,
  createShoeId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  validateCompletedRun,
  validatePlannedWorkout,
  validateShoe,
  validateTrainingPlan,
  validateUserProfile,
  type CompletionGoal,
  type CompletedRun,
  type DistanceUnit,
  type PerceivedEffort,
  type PlannedWorkout,
  type RecentRunPerformance,
  type RunPurpose,
  type RunningExperienceLevel,
  type Shoe,
  type ShoeStatus,
  type TargetRaceTiming,
  type TrainingPhase,
  type TrainingPlan,
  type TrainingPlanId,
  type TrainingPlanStatus,
  type UserId,
  type UserProfile,
  type Weekday,
  type WorkoutStatus,
} from "../../domain/training";
import { PersistenceError } from "../errors";

export const TRAINING_SCHEMA_VERSION = 1;

const PLAN_STATUSES = ["draft", "active", "completed", "archived"] as const;
const TRAINING_PHASES = [
  "learn_to_run",
  "base_building",
  "marathon_training",
  "race_preparation",
  "recovery",
] as const;
const WORKOUT_STATUSES = ["planned", "completed", "skipped"] as const;
const RUN_PURPOSES = ["easy", "recovery", "long", "tempo", "intervals", "race"] as const;
const WORKOUT_KINDS = ["rest", "run", "walk_run"] as const;
const PERCEIVED_EFFORTS = [
  "much_easier_than_expected",
  "easier_than_expected",
  "about_right",
  "harder_than_expected",
  "much_harder_than_expected",
] as const;
const SHOE_STATUSES = ["active", "retired"] as const;
const DISTANCE_UNITS = ["mile", "kilometer"] as const;
const RUNNING_EXPERIENCE_LEVELS = [
  "not_running",
  "inconsistent",
  "returning",
  "consistent",
] as const;
const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const COMPLETION_GOALS = ["complete_first_marathon"] as const;
const TARGET_RACE_KINDS = ["date", "window"] as const;

function invalidData(message: string): never {
  throw new PersistenceError("invalid_data", message);
}

function readString(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  return typeof value === "string" ? value : invalidData(`${field} must be a string.`);
}

function readOptionalString(
  data: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = data[field];

  if (value === undefined) {
    return undefined;
  }

  return typeof value === "string" ? value : invalidData(`${field} must be a string.`);
}

function readOptionalNumber(
  data: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = data[field];

  if (value === undefined) {
    return undefined;
  }

  return typeof value === "number" ? value : invalidData(`${field} must be a number.`);
}

function readNumber(data: Record<string, unknown>, field: string): number {
  const value = data[field];
  return typeof value === "number" ? value : invalidData(`${field} must be a number.`);
}

function readOptionalBoolean(
  data: Record<string, unknown>,
  field: string,
): boolean | undefined {
  const value = data[field];

  if (value === undefined) {
    return undefined;
  }

  return typeof value === "boolean"
    ? value
    : invalidData(`${field} must be a boolean.`);
}

function readRecord(data: Record<string, unknown>, field: string): Record<string, unknown> {
  const value = data[field];

  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : invalidData(`${field} must be an object.`);
}

function readOptionalRecord(
  data: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  return data[field] === undefined ? undefined : readRecord(data, field);
}

function readOptionalEnum<const Values extends readonly string[]>(
  data: Record<string, unknown>,
  field: string,
  values: Values,
): Values[number] | undefined {
  return data[field] === undefined ? undefined : readEnum(data, field, values);
}

function readOptionalEnumArray<const Values extends readonly string[]>(
  data: Record<string, unknown>,
  field: string,
  values: Values,
): Values[number][] | undefined {
  const value = data[field];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    invalidData(`${field} must be an array.`);
  }

  return value.map((item) =>
    typeof item === "string" && values.includes(item)
      ? item as Values[number]
      : invalidData(`${field} has an unsupported value.`),
  );
}

function readEnum<const Values extends readonly string[]>(
  data: Record<string, unknown>,
  field: string,
  values: Values,
): Values[number] {
  const value = readString(data, field);

  return values.includes(value) ? value : invalidData(`${field} has an unsupported value.`);
}

function readTimestamp(data: Record<string, unknown>, field: string) {
  const value = data[field];

  if (!(value instanceof Timestamp)) {
    invalidData(`${field} must be a Firestore timestamp.`);
  }

  return createUtcDateTime(value.toDate().toISOString());
}

function timestampFromUtc(value: string): Timestamp {
  return Timestamp.fromDate(new Date(value));
}

function verifySchemaVersion(data: Record<string, unknown>): void {
  if (data.schemaVersion !== TRAINING_SCHEMA_VERSION) {
    invalidData(`Unsupported training schema version: ${String(data.schemaVersion)}.`);
  }
}

function verifyOwner(storedUserId: string, expectedUserId: UserId): UserId {
  const userId = createUserId(storedUserId);

  if (userId !== expectedUserId) {
    invalidData("Stored training data does not belong to the requested user.");
  }

  return userId;
}

function convertStoredValue<Value>(field: string, convert: () => Value): Value {
  try {
    return convert();
  } catch (error) {
    if (error instanceof PersistenceError) {
      throw error;
    }

    return invalidData(`${field} is invalid.`);
  }
}

function targetRaceToDocument(targetRace: TargetRaceTiming): Record<string, unknown> {
  return targetRace.kind === "date"
    ? { kind: targetRace.kind, date: targetRace.date }
    : {
        kind: targetRace.kind,
        startDate: targetRace.startDate,
        endDate: targetRace.endDate,
      };
}

function targetRaceFromDocument(data: Record<string, unknown>): TargetRaceTiming {
  const kind = readEnum(data, "kind", TARGET_RACE_KINDS);

  return kind === "date"
    ? {
        kind,
        date: convertStoredValue("targetRace.date", () =>
          createDateOnly(readString(data, "date")),
        ),
      }
    : {
        kind,
        startDate: convertStoredValue("targetRace.startDate", () =>
          createDateOnly(readString(data, "startDate")),
        ),
        endDate: convertStoredValue("targetRace.endDate", () =>
          createDateOnly(readString(data, "endDate")),
        ),
      };
}

function recentPerformanceToDocument(
  performance: RecentRunPerformance,
): Record<string, unknown> {
  return {
    completedOn: performance.completedOn,
    distanceMeters: performance.distance,
    durationSeconds: performance.duration,
  };
}

function recentPerformanceFromDocument(
  data: Record<string, unknown>,
): RecentRunPerformance {
  return {
    completedOn: convertStoredValue("recentPerformance.completedOn", () =>
      createDateOnly(readString(data, "completedOn")),
    ),
    distance: convertStoredValue("recentPerformance.distanceMeters", () =>
      createDistanceMeters(readNumber(data, "distanceMeters")),
    ),
    duration: convertStoredValue("recentPerformance.durationSeconds", () =>
      createDurationSeconds(readNumber(data, "durationSeconds")),
    ),
  };
}

export function userProfileToDocument(profile: UserProfile): Record<string, unknown> {
  const document: Record<string, unknown> = {
    schemaVersion: TRAINING_SCHEMA_VERSION,
    userId: profile.id,
    preferredDistanceUnit: profile.preferredDistanceUnit,
    timeZone: profile.timeZone,
    createdAt: timestampFromUtc(profile.createdAt),
    updatedAt: timestampFromUtc(profile.updatedAt),
  };

  if (profile.displayName !== undefined) document.displayName = profile.displayName;
  if (profile.experienceLevel !== undefined) {
    document.experienceLevel = profile.experienceLevel;
  }
  if (profile.targetRace !== undefined) {
    document.targetRace = targetRaceToDocument(profile.targetRace);
  }
  if (profile.currentWeeklyDistance !== undefined) {
    document.currentWeeklyDistanceMeters = profile.currentWeeklyDistance;
  }
  if (profile.currentRunningFrequencyDaysPerWeek !== undefined) {
    document.currentRunningFrequencyDaysPerWeek =
      profile.currentRunningFrequencyDaysPerWeek;
  }
  if (profile.longestRecentRunDistance !== undefined) {
    document.longestRecentRunDistanceMeters = profile.longestRecentRunDistance;
  }
  if (profile.recentPerformance !== undefined) {
    document.recentPerformance = recentPerformanceToDocument(
      profile.recentPerformance,
    );
  }
  if (profile.availableTrainingDays !== undefined) {
    document.availableTrainingDays = [...profile.availableTrainingDays];
  }
  if (profile.preferredLongRunDay !== undefined) {
    document.preferredLongRunDay = profile.preferredLongRunDay;
  }
  if (profile.scheduleConstraints !== undefined) {
    document.scheduleConstraints = profile.scheduleConstraints;
  }
  if (profile.completionGoal !== undefined) {
    document.completionGoal = profile.completionGoal;
  }

  return document;
}

export function userProfileFromDocument(
  id: string,
  data: Record<string, unknown>,
  expectedUserId: UserId,
): UserProfile {
  verifySchemaVersion(data);

  const idFromPath = convertStoredValue("profile id", () => createUserId(id));
  if (idFromPath !== expectedUserId) {
    invalidData("Stored profile path does not belong to the requested user.");
  }

  const targetRace = readOptionalRecord(data, "targetRace");
  const recentPerformance = readOptionalRecord(data, "recentPerformance");
  const currentWeeklyDistance = readOptionalNumber(
    data,
    "currentWeeklyDistanceMeters",
  );
  const longestRecentRunDistance = readOptionalNumber(
    data,
    "longestRecentRunDistanceMeters",
  );
  const frequency = readOptionalNumber(
    data,
    "currentRunningFrequencyDaysPerWeek",
  );

  const profile: UserProfile = {
    id: verifyOwner(readString(data, "userId"), expectedUserId),
    displayName: readOptionalString(data, "displayName"),
    preferredDistanceUnit: readEnum(
      data,
      "preferredDistanceUnit",
      DISTANCE_UNITS,
    ) as DistanceUnit,
    timeZone: convertStoredValue("timeZone", () =>
      createIanaTimeZone(readString(data, "timeZone")),
    ),
    experienceLevel: readOptionalEnum(
      data,
      "experienceLevel",
      RUNNING_EXPERIENCE_LEVELS,
    ) as RunningExperienceLevel | undefined,
    targetRace:
      targetRace === undefined ? undefined : targetRaceFromDocument(targetRace),
    currentWeeklyDistance:
      currentWeeklyDistance === undefined
        ? undefined
        : convertStoredValue("currentWeeklyDistanceMeters", () =>
            createDistanceMeters(currentWeeklyDistance),
          ),
    currentRunningFrequencyDaysPerWeek: frequency,
    longestRecentRunDistance:
      longestRecentRunDistance === undefined
        ? undefined
        : convertStoredValue("longestRecentRunDistanceMeters", () =>
            createDistanceMeters(longestRecentRunDistance),
          ),
    recentPerformance:
      recentPerformance === undefined
        ? undefined
        : recentPerformanceFromDocument(recentPerformance),
    availableTrainingDays: readOptionalEnumArray(
      data,
      "availableTrainingDays",
      WEEKDAYS,
    ) as Weekday[] | undefined,
    preferredLongRunDay: readOptionalEnum(
      data,
      "preferredLongRunDay",
      WEEKDAYS,
    ) as Weekday | undefined,
    scheduleConstraints: readOptionalString(data, "scheduleConstraints"),
    completionGoal: readOptionalEnum(
      data,
      "completionGoal",
      COMPLETION_GOALS,
    ) as CompletionGoal | undefined,
    createdAt: readTimestamp(data, "createdAt"),
    updatedAt: readTimestamp(data, "updatedAt"),
  };

  const issues = validateUserProfile(profile);
  if (issues.length > 0) {
    invalidData(issues.map((issue) => issue.message).join(" "));
  }

  return profile;
}

export function trainingPlanToDocument(plan: TrainingPlan): Record<string, unknown> {
  return {
    schemaVersion: TRAINING_SCHEMA_VERSION,
    userId: plan.userId,
    name: plan.name,
    startDate: plan.startDate,
    targetRaceDate: plan.targetRaceDate,
    status: plan.status,
    createdAt: timestampFromUtc(plan.createdAt),
    updatedAt: timestampFromUtc(plan.updatedAt),
  };
}

export function trainingPlanFromDocument(
  id: string,
  data: Record<string, unknown>,
  expectedUserId: UserId,
): TrainingPlan {
  verifySchemaVersion(data);

  const plan: TrainingPlan = {
    id: createTrainingPlanId(id),
    userId: verifyOwner(readString(data, "userId"), expectedUserId),
    name: readString(data, "name"),
    startDate: createDateOnly(readString(data, "startDate")),
    targetRaceDate: createDateOnly(readString(data, "targetRaceDate")),
    status: readEnum(data, "status", PLAN_STATUSES) as TrainingPlanStatus,
    createdAt: readTimestamp(data, "createdAt"),
    updatedAt: readTimestamp(data, "updatedAt"),
  };

  const issues = validateTrainingPlan(plan);
  if (issues.length > 0) {
    invalidData(issues.map((issue) => issue.message).join(" "));
  }

  return plan;
}

export function plannedWorkoutToDocument(
  workout: PlannedWorkout,
): Record<string, unknown> {
  const document: Record<string, unknown> = {
    schemaVersion: TRAINING_SCHEMA_VERSION,
    userId: workout.userId,
    planId: workout.planId,
    scheduledDate: workout.scheduledDate,
    phase: workout.phase,
    status: workout.status,
    kind: workout.kind,
    createdAt: timestampFromUtc(workout.createdAt),
    updatedAt: timestampFromUtc(workout.updatedAt),
  };

  if (workout.notes !== undefined) {
    document.notes = workout.notes;
  }

  if (workout.kind === "run") {
    document.purpose = workout.purpose;
  }

  if (workout.kind !== "rest") {
    if (workout.targetDistance !== undefined) {
      document.targetDistanceMeters = workout.targetDistance;
    }

    if (workout.targetDuration !== undefined) {
      document.targetDurationSeconds = workout.targetDuration;
    }
  }

  return document;
}

export function plannedWorkoutFromDocument(
  id: string,
  data: Record<string, unknown>,
  expectedUserId: UserId,
  expectedPlanId: TrainingPlanId,
): PlannedWorkout {
  verifySchemaVersion(data);

  const userId = verifyOwner(readString(data, "userId"), expectedUserId);
  const planId = createTrainingPlanId(readString(data, "planId"));

  if (planId !== expectedPlanId) {
    invalidData("Stored workout does not belong to the requested training plan.");
  }

  const base = {
    id: createPlannedWorkoutId(id),
    userId,
    planId,
    scheduledDate: createDateOnly(readString(data, "scheduledDate")),
    phase: readEnum(data, "phase", TRAINING_PHASES) as TrainingPhase,
    status: readEnum(data, "status", WORKOUT_STATUSES) as WorkoutStatus,
    notes: readOptionalString(data, "notes"),
    createdAt: readTimestamp(data, "createdAt"),
    updatedAt: readTimestamp(data, "updatedAt"),
  };
  const kind = readEnum(data, "kind", WORKOUT_KINDS);

  let workout: PlannedWorkout;
  if (kind === "rest") {
    workout = { ...base, kind };
  } else {
    const targetDistanceValue = readOptionalNumber(data, "targetDistanceMeters");
    const targetDurationValue = readOptionalNumber(data, "targetDurationSeconds");
    const targets = {
      targetDistance:
        targetDistanceValue === undefined
          ? undefined
          : createDistanceMeters(targetDistanceValue),
      targetDuration:
        targetDurationValue === undefined
          ? undefined
          : createDurationSeconds(targetDurationValue),
    };

    workout =
      kind === "run"
        ? {
            ...base,
            ...targets,
            kind,
            purpose: readEnum(data, "purpose", RUN_PURPOSES) as RunPurpose,
          }
        : { ...base, ...targets, kind };
  }

  const issues = validatePlannedWorkout(workout);
  if (issues.length > 0) {
    invalidData(issues.map((issue) => issue.message).join(" "));
  }

  return workout;
}

export function completedRunToDocument(run: CompletedRun): Record<string, unknown> {
  const document: Record<string, unknown> = {
    schemaVersion: TRAINING_SCHEMA_VERSION,
    userId: run.userId,
    startedAt: timestampFromUtc(run.startedAt),
    timeZone: run.timeZone,
    distanceMeters: run.distance,
    durationSeconds: run.duration,
    createdAt: timestampFromUtc(run.createdAt),
    updatedAt: timestampFromUtc(run.updatedAt),
  };

  if (run.plannedWorkoutPlanId !== undefined) {
    document.plannedWorkoutPlanId = run.plannedWorkoutPlanId;
  }

  if (run.plannedWorkoutId !== undefined) {
    document.plannedWorkoutId = run.plannedWorkoutId;
  }

  if (run.shoeId !== undefined) {
    document.shoeId = run.shoeId;
  }

  if (run.perceivedEffort !== undefined) {
    document.perceivedEffort = run.perceivedEffort;
  }

  if (run.unusualPain !== undefined) {
    document.unusualPain = run.unusualPain;
  }

  if (run.notes !== undefined) {
    document.notes = run.notes;
  }

  return document;
}

export function completedRunFromDocument(
  id: string,
  data: Record<string, unknown>,
  expectedUserId: UserId,
): CompletedRun {
  verifySchemaVersion(data);

  const plannedWorkoutPlanId = readOptionalString(data, "plannedWorkoutPlanId");
  const plannedWorkoutId = readOptionalString(data, "plannedWorkoutId");
  const shoeId = readOptionalString(data, "shoeId");
  const perceivedEffort = readOptionalString(data, "perceivedEffort");
  const run: CompletedRun = {
    id: createCompletedRunId(id),
    userId: verifyOwner(readString(data, "userId"), expectedUserId),
    plannedWorkoutPlanId:
      plannedWorkoutPlanId === undefined
        ? undefined
        : createTrainingPlanId(plannedWorkoutPlanId),
    plannedWorkoutId:
      plannedWorkoutId === undefined
        ? undefined
        : createPlannedWorkoutId(plannedWorkoutId),
    shoeId: shoeId === undefined ? undefined : createShoeId(shoeId),
    startedAt: readTimestamp(data, "startedAt"),
    timeZone: createIanaTimeZone(readString(data, "timeZone")),
    distance: createDistanceMeters(readNumber(data, "distanceMeters")),
    duration: createDurationSeconds(readNumber(data, "durationSeconds")),
    perceivedEffort:
      perceivedEffort === undefined
        ? undefined
        : readEnum(data, "perceivedEffort", PERCEIVED_EFFORTS) as PerceivedEffort,
    unusualPain: readOptionalBoolean(data, "unusualPain"),
    notes: readOptionalString(data, "notes"),
    createdAt: readTimestamp(data, "createdAt"),
    updatedAt: readTimestamp(data, "updatedAt"),
  };

  const issues = validateCompletedRun(run);
  if (issues.length > 0) {
    invalidData(issues.map((issue) => issue.message).join(" "));
  }

  return run;
}

export function shoeToDocument(shoe: Shoe): Record<string, unknown> {
  const document: Record<string, unknown> = {
    schemaVersion: TRAINING_SCHEMA_VERSION,
    userId: shoe.userId,
    name: shoe.name,
    startingDistanceMeters: shoe.startingDistance,
    status: shoe.status,
    createdAt: timestampFromUtc(shoe.createdAt),
    updatedAt: timestampFromUtc(shoe.updatedAt),
  };

  if (shoe.retiredOn !== undefined) {
    document.retiredOn = shoe.retiredOn;
  }

  return document;
}

export function shoeFromDocument(
  id: string,
  data: Record<string, unknown>,
  expectedUserId: UserId,
): Shoe {
  verifySchemaVersion(data);

  const retiredOn = readOptionalString(data, "retiredOn");
  const shoe: Shoe = {
    id: createShoeId(id),
    userId: verifyOwner(readString(data, "userId"), expectedUserId),
    name: readString(data, "name"),
    startingDistance: createDistanceMeters(readNumber(data, "startingDistanceMeters")),
    status: readEnum(data, "status", SHOE_STATUSES) as ShoeStatus,
    retiredOn: retiredOn === undefined ? undefined : createDateOnly(retiredOn),
    createdAt: readTimestamp(data, "createdAt"),
    updatedAt: readTimestamp(data, "updatedAt"),
  };

  const issues = validateShoe(shoe);
  if (issues.length > 0) {
    invalidData(issues.map((issue) => issue.message).join(" "));
  }

  return shoe;
}
