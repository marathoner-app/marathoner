import trainingFixtures, {
  type TrainingFixture,
} from "@marathoner/training-contract/fixtures/v1";
import { describe, expect, it } from "vitest";
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
  type CompletedRun,
  type PlannedWorkout,
  type Shoe,
  type TrainingPlan,
  type UserProfile,
} from ".";

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Fixture value must be an object.");
  }

  return value as Record<string, unknown>;
}

function readString(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }

  return value;
}

function readOptionalString(
  data: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = data[field];
  if (value === undefined) {
    return undefined;
  }

  return readString(data, field);
}

function readNumber(data: Record<string, unknown>, field: string): number {
  const value = data[field];
  if (typeof value !== "number") {
    throw new Error(`${field} must be a number.`);
  }

  return value;
}

function readOptionalNumber(
  data: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = data[field];
  if (value === undefined) {
    return undefined;
  }

  return readNumber(data, field);
}

function readOptionalBoolean(
  data: Record<string, unknown>,
  field: string,
): boolean | undefined {
  const value = data[field];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean.`);
  }

  return value;
}

function readEnum<const Values extends readonly string[]>(
  data: Record<string, unknown>,
  field: string,
  values: Values,
): Values[number] {
  const value = readString(data, field);
  if (!values.includes(value)) {
    throw new Error(`${field} has an unsupported value.`);
  }

  return value;
}

function hydrateUserProfile(value: unknown): UserProfile {
  const data = readRecord(value);

  return {
    id: createUserId(readString(data, "id")),
    displayName: readOptionalString(data, "displayName"),
    preferredDistanceUnit: readEnum(
      data,
      "preferredDistanceUnit",
      ["mile", "kilometer"] as const,
    ),
    timeZone: createIanaTimeZone(readString(data, "timeZone")),
    createdAt: createUtcDateTime(readString(data, "createdAt")),
    updatedAt: createUtcDateTime(readString(data, "updatedAt")),
  };
}

function hydrateTrainingPlan(value: unknown): TrainingPlan {
  const data = readRecord(value);

  return {
    id: createTrainingPlanId(readString(data, "id")),
    userId: createUserId(readString(data, "userId")),
    name: readString(data, "name"),
    startDate: createDateOnly(readString(data, "startDate")),
    targetRaceDate: createDateOnly(readString(data, "targetRaceDate")),
    status: readEnum(
      data,
      "status",
      ["draft", "active", "completed", "archived"] as const,
    ),
    createdAt: createUtcDateTime(readString(data, "createdAt")),
    updatedAt: createUtcDateTime(readString(data, "updatedAt")),
  };
}

function hydratePlannedWorkout(value: unknown): PlannedWorkout {
  const data = readRecord(value);
  const base = {
    id: createPlannedWorkoutId(readString(data, "id")),
    userId: createUserId(readString(data, "userId")),
    planId: createTrainingPlanId(readString(data, "planId")),
    scheduledDate: createDateOnly(readString(data, "scheduledDate")),
    phase: readEnum(
      data,
      "phase",
      [
        "learn_to_run",
        "base_building",
        "marathon_training",
        "race_preparation",
        "recovery",
      ] as const,
    ),
    status: readEnum(
      data,
      "status",
      ["planned", "completed", "skipped"] as const,
    ),
    notes: readOptionalString(data, "notes"),
    createdAt: createUtcDateTime(readString(data, "createdAt")),
    updatedAt: createUtcDateTime(readString(data, "updatedAt")),
  };
  const kind = readString(data, "kind");

  if (kind === "rest") {
    return { ...base, kind };
  }

  const targetDistance = readOptionalNumber(data, "targetDistanceMeters");
  const targetDuration = readOptionalNumber(data, "targetDurationSeconds");
  const targets = {
    targetDistance:
      targetDistance === undefined
        ? undefined
        : createDistanceMeters(targetDistance),
    targetDuration:
      targetDuration === undefined
        ? undefined
        : createDurationSeconds(targetDuration),
  };

  if (kind === "run") {
    return {
      ...base,
      ...targets,
      kind,
      purpose: readEnum(
        data,
        "purpose",
        ["easy", "recovery", "long", "tempo", "intervals", "race"] as const,
      ),
    };
  }

  if (kind === "walk_run") {
    return { ...base, ...targets, kind };
  }

  throw new Error("kind has an unsupported value.");
}

function hydrateCompletedRun(value: unknown): CompletedRun {
  const data = readRecord(value);
  const plannedWorkoutPlanId = readOptionalString(
    data,
    "plannedWorkoutPlanId",
  );
  const plannedWorkoutId = readOptionalString(data, "plannedWorkoutId");
  const shoeId = readOptionalString(data, "shoeId");
  const perceivedEffort = readOptionalString(data, "perceivedEffort");

  return {
    id: createCompletedRunId(readString(data, "id")),
    userId: createUserId(readString(data, "userId")),
    plannedWorkoutPlanId:
      plannedWorkoutPlanId === undefined
        ? undefined
        : createTrainingPlanId(plannedWorkoutPlanId),
    plannedWorkoutId:
      plannedWorkoutId === undefined
        ? undefined
        : createPlannedWorkoutId(plannedWorkoutId),
    shoeId: shoeId === undefined ? undefined : createShoeId(shoeId),
    startedAt: createUtcDateTime(readString(data, "startedAt")),
    timeZone: createIanaTimeZone(readString(data, "timeZone")),
    distance: createDistanceMeters(readNumber(data, "distanceMeters")),
    duration: createDurationSeconds(readNumber(data, "durationSeconds")),
    perceivedEffort:
      perceivedEffort === undefined
        ? undefined
        : readEnum(
            { value: perceivedEffort },
            "value",
            [
              "much_easier_than_expected",
              "easier_than_expected",
              "about_right",
              "harder_than_expected",
              "much_harder_than_expected",
            ] as const,
          ),
    unusualPain: readOptionalBoolean(data, "unusualPain"),
    notes: readOptionalString(data, "notes"),
    createdAt: createUtcDateTime(readString(data, "createdAt")),
    updatedAt: createUtcDateTime(readString(data, "updatedAt")),
  };
}

function hydrateShoe(value: unknown): Shoe {
  const data = readRecord(value);
  const retiredOn = readOptionalString(data, "retiredOn");

  return {
    id: createShoeId(readString(data, "id")),
    userId: createUserId(readString(data, "userId")),
    name: readString(data, "name"),
    startingDistance: createDistanceMeters(
      readNumber(data, "startingDistanceMeters"),
    ),
    status: readEnum(data, "status", ["active", "retired"] as const),
    retiredOn:
      retiredOn === undefined ? undefined : createDateOnly(retiredOn),
    createdAt: createUtcDateTime(readString(data, "createdAt")),
    updatedAt: createUtcDateTime(readString(data, "updatedAt")),
  };
}

function acceptsFixture(fixture: TrainingFixture): boolean {
  try {
    switch (fixture.subject) {
      case "userId":
        createUserId(readString({ value: fixture.value }, "value"));
        break;
      case "trainingPlanId":
        createTrainingPlanId(readString({ value: fixture.value }, "value"));
        break;
      case "plannedWorkoutId":
        createPlannedWorkoutId(readString({ value: fixture.value }, "value"));
        break;
      case "completedRunId":
        createCompletedRunId(readString({ value: fixture.value }, "value"));
        break;
      case "shoeId":
        createShoeId(readString({ value: fixture.value }, "value"));
        break;
      case "distanceMeters":
        createDistanceMeters(readNumber({ value: fixture.value }, "value"));
        break;
      case "durationSeconds":
        createDurationSeconds(readNumber({ value: fixture.value }, "value"));
        break;
      case "dateOnly":
        createDateOnly(readString({ value: fixture.value }, "value"));
        break;
      case "utcDateTime":
        createUtcDateTime(readString({ value: fixture.value }, "value"));
        break;
      case "ianaTimeZone":
        createIanaTimeZone(readString({ value: fixture.value }, "value"));
        break;
      case "userProfile":
        return validateUserProfile(hydrateUserProfile(fixture.value)).length === 0;
      case "trainingPlan":
        return validateTrainingPlan(hydrateTrainingPlan(fixture.value)).length === 0;
      case "plannedWorkout":
        return (
          validatePlannedWorkout(hydratePlannedWorkout(fixture.value)).length ===
          0
        );
      case "completedRun":
        return validateCompletedRun(hydrateCompletedRun(fixture.value)).length === 0;
      case "shoe":
        return validateShoe(hydrateShoe(fixture.value)).length === 0;
    }

    return true;
  } catch {
    return false;
  }
}

describe("canonical cross-client training fixtures", () => {
  it("uses one versioned, unique, complete fixture envelope", () => {
    expect(trainingFixtures.$schema).toBe("./fixture-format.schema.json");
    expect(trainingFixtures.fixtureFormatVersion).toBe(1);
    expect(trainingFixtures.contractVersion).toBe("training-domain@1");

    const fixtureIds = trainingFixtures.fixtures.map((fixture) => fixture.id);
    expect(new Set(fixtureIds).size).toBe(fixtureIds.length);
    expect(
      trainingFixtures.fixtures.every(
        (fixture) =>
          fixture.schemaVersion === 1 &&
          (fixture.expected.valid || fixture.expected.reason !== undefined),
      ),
    ).toBe(true);

    expect(
      new Set(trainingFixtures.fixtures.map((fixture) => fixture.subject)),
    ).toEqual(
      new Set([
        "userId",
        "trainingPlanId",
        "plannedWorkoutId",
        "completedRunId",
        "shoeId",
        "distanceMeters",
        "durationSeconds",
        "dateOnly",
        "utcDateTime",
        "ianaTimeZone",
        "userProfile",
        "trainingPlan",
        "plannedWorkout",
        "completedRun",
        "shoe",
      ]),
    );
  });

  it("matches every fixture against the web domain", () => {
    for (const fixture of trainingFixtures.fixtures) {
      expect(acceptsFixture(fixture), fixture.id).toBe(fixture.expected.valid);
    }
  });
});
