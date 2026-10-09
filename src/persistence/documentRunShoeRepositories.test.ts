import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import {
  calculateShoeDistance,
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createPlannedWorkoutId,
  createShoeId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
} from "../domain/training";
import { createDocumentTrainingRepositories } from "./documentTrainingRepositories";
import { TRAINING_SCHEMA_VERSION } from "./firestore/converters";
import { InMemoryDocumentStore } from "./testing/InMemoryDocumentStore";
import type { TrainingRepositories } from "./trainingRepositories";

const userId = createUserId("runner-1");
const now = createUtcDateTime("2026-07-30T12:00:00Z");
const timeZone = createIanaTimeZone("America/Los_Angeles");

let store: InMemoryDocumentStore;
let repositories: TrainingRepositories;

beforeEach(() => {
  store = new InMemoryDocumentStore();
  repositories = createDocumentTrainingRepositories(store, userId, () => now);
});

async function createPlanAndWorkout() {
  const plan = await repositories.plans.create({
    name: "First Marathon Journey",
    startDate: createDateOnly("2026-08-03"),
    targetRaceDate: createDateOnly("2027-05-02"),
  });
  const workout = await repositories.workouts.create({
    planId: plan.id,
    scheduledDate: createDateOnly("2026-08-03"),
    phase: "base_building",
    kind: "run",
    purpose: "easy",
    targetDistance: createDistanceMeters(4828),
  });

  return { plan, workout };
}

describe("shoe repository", () => {
  it("creates, reads, updates, lists, and retires shoes", async () => {
    const second = await repositories.shoes.create({ name: "Tempo Shoe" });
    const first = await repositories.shoes.create({
      name: "Daily Trainer",
      startingDistance: createDistanceMeters(16093),
    });

    await expect(repositories.shoes.get(first.id)).resolves.toEqual(first);
    await expect(repositories.shoes.list()).resolves.toEqual([first, second]);

    const renamed = await repositories.shoes.update(first.id, {
      name: "Daily Trainer 2",
    });
    expect(renamed.name).toBe("Daily Trainer 2");

    const retired = await repositories.shoes.retire(
      first.id,
      createDateOnly("2026-12-01"),
    );
    expect(retired).toMatchObject({
      status: "retired",
      retiredOn: "2026-12-01",
    });
  });

  it("stores shoe distances in meters with Firestore timestamps", async () => {
    const shoe = await repositories.shoes.create({
      name: "Daily Trainer",
      startingDistance: createDistanceMeters(8047),
    });
    const document = store.read(`users/${userId}/shoes/${shoe.id}`);

    expect(document).toMatchObject({
      schemaVersion: TRAINING_SCHEMA_VERSION,
      userId,
      startingDistanceMeters: 8047,
      status: "active",
    });
    expect(document?.createdAt).toBeInstanceOf(Timestamp);
  });
});

describe("completed run repository", () => {
  it("persists a run associated with its plan, workout, and shoe", async () => {
    const { plan, workout } = await createPlanAndWorkout();
    const shoe = await repositories.shoes.create({ name: "Daily Trainer" });
    const run = await repositories.runs.create({
      plannedWorkoutPlanId: plan.id,
      plannedWorkoutId: workout.id,
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: createDistanceMeters(4828),
      duration: createDurationSeconds(30 * 60),
      perceivedEffort: "about_right",
      unusualPain: false,
      notes: "Warm afternoon; carried water.",
    });

    await expect(repositories.runs.get(run.id)).resolves.toEqual(run);
    expect(store.read(`users/${userId}/runs/${run.id}`)).toMatchObject({
      schemaVersion: TRAINING_SCHEMA_VERSION,
      userId,
      plannedWorkoutPlanId: plan.id,
      plannedWorkoutId: workout.id,
      shoeId: shoe.id,
      distanceMeters: 4828,
      durationSeconds: 1800,
      notes: "Warm afternoon; carried water.",
    });
  });

  it("lists runs newest first and supports editing and deleting", async () => {
    const older = await repositories.runs.create({
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: createDistanceMeters(4828),
      duration: createDurationSeconds(1800),
    });
    const newer = await repositories.runs.create({
      startedAt: createUtcDateTime("2026-08-04T14:00:00Z"),
      timeZone,
      distance: createDistanceMeters(6437),
      duration: createDurationSeconds(2400),
    });

    await expect(repositories.runs.list()).resolves.toEqual([newer, older]);

    const updated = await repositories.runs.update(older.id, {
      startedAt: createUtcDateTime("2026-08-10T14:00:00Z"),
      distance: createDistanceMeters(5000),
      perceivedEffort: "harder_than_expected",
    });
    expect(updated).toMatchObject({
      startedAt: "2026-08-10T14:00:00.000Z",
      distance: 5000,
      perceivedEffort: "harder_than_expected",
    });
    await expect(repositories.runs.get(older.id)).resolves.toMatchObject({
      startedAt: "2026-08-10T14:00:00.000Z",
    });

    await repositories.runs.delete(newer.id);
    await expect(repositories.runs.get(newer.id)).resolves.toBeNull();
  });

  it("requires both parts of a planned workout association", async () => {
    await expect(
      repositories.runs.create({
        plannedWorkoutPlanId: createTrainingPlanId("plan-1"),
        startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
        timeZone,
        distance: createDistanceMeters(4828),
        duration: createDurationSeconds(1800),
      }),
    ).rejects.toMatchObject({ code: "invalid_data" });
  });

  it("rejects missing workout and shoe associations", async () => {
    await expect(
      repositories.runs.create({
        plannedWorkoutPlanId: createTrainingPlanId("missing-plan"),
        plannedWorkoutId: createPlannedWorkoutId("missing-workout"),
        startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
        timeZone,
        distance: createDistanceMeters(4828),
        duration: createDurationSeconds(1800),
      }),
    ).rejects.toMatchObject({ code: "not_found" });

    await expect(
      repositories.runs.create({
        shoeId: createShoeId("missing-shoe"),
        startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
        timeZone,
        distance: createDistanceMeters(4828),
        duration: createDurationSeconds(1800),
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("derives shoe mileage from persisted run history and protects referenced shoes", async () => {
    const shoe = await repositories.shoes.create({
      name: "Daily Trainer",
      startingDistance: createDistanceMeters(1609),
    });
    const run = await repositories.runs.create({
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-03T14:00:00Z"),
      timeZone,
      distance: createDistanceMeters(4828),
      duration: createDurationSeconds(1800),
    });

    expect(calculateShoeDistance(shoe, await repositories.runs.list())).toBe(6437);
    await expect(repositories.shoes.permanentlyDelete(shoe.id)).rejects.toMatchObject({
      code: "conflict",
    });

    await repositories.runs.delete(run.id);
    await repositories.shoes.permanentlyDelete(shoe.id);
    await expect(repositories.shoes.get(shoe.id)).resolves.toBeNull();
  });
});
