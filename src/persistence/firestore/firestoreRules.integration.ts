import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
} from "../../domain/training";
import { createDocumentTrainingRepositories } from "../documentTrainingRepositories";
import { FirestoreDocumentStore } from "./firestoreDocumentStore";

const projectId = "demo-marathoner";
const firstUserId = "runner-one";
const secondUserId = "runner-two";

let testEnvironment: RulesTestEnvironment;

function planDocument(userId = firstUserId) {
  return {
    schemaVersion: 1,
    userId,
    name: "First marathon",
    startDate: "2026-08-01",
    targetRaceDate: "2027-01-10",
    status: "draft",
    createdAt: new Date("2026-07-30T12:00:00.000Z"),
    updatedAt: new Date("2026-07-30T12:00:00.000Z"),
  };
}

function profileDocument(userId = firstUserId) {
  return {
    schemaVersion: 1,
    userId,
    displayName: "Runner One",
    preferredDistanceUnit: "mile",
    timeZone: "America/Los_Angeles",
    experienceLevel: "consistent",
    targetRace: { kind: "date", date: "2027-05-02" },
    currentWeeklyDistanceMeters: 24_000,
    currentRunningFrequencyDaysPerWeek: 4,
    longestRecentRunDistanceMeters: 12_000,
    availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
    preferredLongRunDay: "sunday",
    completionGoal: "complete_first_marathon",
    createdAt: new Date("2026-10-05T12:00:00.000Z"),
    updatedAt: new Date("2026-10-05T12:00:00.000Z"),
  };
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile("firestore.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("Firestore training-data ownership rules", () => {
  it("allows a runner to create, read, and update only their own profile", async () => {
    const ownerDatabase = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const otherDatabase = testEnvironment
      .authenticatedContext(secondUserId)
      .firestore();
    const anonymousDatabase = testEnvironment.unauthenticatedContext().firestore();
    const path = `users/${firstUserId}`;
    const ownerReference = doc(ownerDatabase, path);

    await assertSucceeds(setDoc(ownerReference, profileDocument()));
    await assertSucceeds(getDoc(ownerReference));
    await assertSucceeds(
      updateDoc(ownerReference, {
        displayName: "Updated Runner",
        updatedAt: new Date("2026-10-05T13:00:00.000Z"),
      }),
    );
    await assertFails(getDoc(doc(otherDatabase, path)));
    await assertFails(setDoc(doc(otherDatabase, path), profileDocument()));
    await assertFails(getDoc(doc(anonymousDatabase, path)));
    await assertFails(deleteDoc(ownerReference));
  });

  it("rejects malformed profiles and immutable ownership changes", async () => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const reference = doc(database, `users/${firstUserId}`);

    await assertFails(setDoc(reference, profileDocument(secondUserId)));
    await assertFails(
      setDoc(reference, {
        ...profileDocument(),
        currentRunningFrequencyDaysPerWeek: 8,
      }),
    );
    await assertFails(
      setDoc(reference, { ...profileDocument(), unexpectedField: true }),
    );

    await assertSucceeds(setDoc(reference, profileDocument()));
    await assertFails(
      updateDoc(reference, {
        createdAt: new Date("2026-10-05T13:00:00.000Z"),
        updatedAt: new Date("2026-10-05T13:00:00.000Z"),
      }),
    );
  });

  it("allows a runner to create and read a document in their own path", async () => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore() as unknown as Firestore;
    const reference = doc(database, `users/${firstUserId}/plans/plan-1`);

    await assertSucceeds(setDoc(reference, planDocument()));
    await assertSucceeds(getDoc(reference));
  });

  it("denies anonymous and cross-user access", async () => {
    const ownerDatabase = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const otherDatabase = testEnvironment
      .authenticatedContext(secondUserId)
      .firestore();
    const anonymousDatabase = testEnvironment.unauthenticatedContext().firestore();
    const path = `users/${firstUserId}/plans/plan-1`;

    await assertSucceeds(setDoc(doc(ownerDatabase, path), planDocument()));
    await assertFails(getDoc(doc(otherDatabase, path)));
    await assertFails(setDoc(doc(otherDatabase, path), planDocument()));
    await assertFails(getDoc(doc(anonymousDatabase, path)));
  });

  it("rejects writes whose owner field disagrees with the user path", async () => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();

    await assertFails(
      setDoc(
        doc(database, `users/${firstUserId}/plans/plan-1`),
        planDocument(secondUserId),
      ),
    );
  });

  it("rejects workouts whose plan field disagrees with the parent path", async () => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const workout = {
      schemaVersion: 1,
      userId: firstUserId,
      planId: "another-plan",
      scheduledDate: "2026-08-01",
      phase: "base_building",
      status: "planned",
      kind: "rest",
      createdAt: new Date("2026-07-30T12:00:00.000Z"),
      updatedAt: new Date("2026-07-30T12:00:00.000Z"),
    };

    await assertFails(
      setDoc(
        doc(
          database,
          `users/${firstUserId}/plans/plan-1/workouts/workout-1`,
        ),
        workout,
      ),
    );
  });

  it.each(["runs/run-1", "shoes/shoe-1"])(
    "applies the same ownership boundary to %s",
    async (relativePath) => {
      const ownerDatabase = testEnvironment
        .authenticatedContext(firstUserId)
        .firestore();
      const otherDatabase = testEnvironment
        .authenticatedContext(secondUserId)
        .firestore();
      const path = `users/${firstUserId}/${relativePath}`;
      const data = {
        schemaVersion: 1,
        userId: firstUserId,
      };

      await assertSucceeds(setDoc(doc(ownerDatabase, path), data));
      await assertFails(getDoc(doc(otherDatabase, path)));
    },
  );
});

describe("Firestore retired mobile-spike boundary", () => {
  it("denies the former proof path even to its authenticated owner", async () => {
    const ownerDatabase = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const path = `users/${firstUserId}/mobileSpikeProofs/issue-87-shared-record`;
    const reference = doc(ownerDatabase, path);
    const retiredProofRecord = {
      schemaVersion: 1,
      recordType: "shared_training_record_proof",
      userId: firstUserId,
      sampleRunId: "issue-87-sample-run",
      distanceMeters: 5000,
      sourceClient: "capacitor",
    };

    await assertFails(getDoc(reference));
    await assertFails(setDoc(reference, retiredProofRecord));
    await assertFails(deleteDoc(reference));
  });
});

describe("Firestore repository integration", () => {
  it("persists and reloads an owned profile, plan, workout, shoe, and run", async () => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore() as unknown as Firestore;
    const clock = () => createUtcDateTime("2026-07-30T12:00:00.000Z");
    const repositories = createDocumentTrainingRepositories(
      new FirestoreDocumentStore(database),
      createUserId(firstUserId),
      clock,
    );
    const profile = await repositories.profile.save({
      displayName: "Runner One",
      preferredDistanceUnit: "mile",
      timeZone: createIanaTimeZone("America/Los_Angeles"),
      experienceLevel: "consistent",
      currentWeeklyDistance: createDistanceMeters(24_000),
      currentRunningFrequencyDaysPerWeek: 4,
      longestRecentRunDistance: createDistanceMeters(12_000),
      availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
      completionGoal: "complete_first_marathon",
    });
    const plan = await repositories.plans.create({
      name: "First marathon",
      startDate: createDateOnly("2026-08-01"),
      targetRaceDate: createDateOnly("2027-01-10"),
    });
    const workout = await repositories.workouts.create({
      kind: "run",
      planId: plan.id,
      scheduledDate: createDateOnly("2026-08-02"),
      phase: "base_building",
      purpose: "easy",
      targetDistance: createDistanceMeters(4_800),
    });
    const shoe = await repositories.shoes.create({ name: "Daily trainer" });
    const run = await repositories.runs.create({
      plannedWorkoutPlanId: plan.id,
      plannedWorkoutId: workout.id,
      shoeId: shoe.id,
      startedAt: createUtcDateTime("2026-08-02T14:00:00.000Z"),
      timeZone: createIanaTimeZone("America/Los_Angeles"),
      distance: createDistanceMeters(5_000),
      duration: createDurationSeconds(1_800),
      perceivedEffort: "about_right",
    });

    await expect(repositories.profile.load()).resolves.toEqual(profile);
    await expect(repositories.plans.get(plan.id)).resolves.toEqual(plan);
    await expect(repositories.workouts.get(plan.id, workout.id)).resolves.toEqual(
      workout,
    );
    await expect(repositories.shoes.get(shoe.id)).resolves.toEqual(shoe);
    await expect(repositories.runs.get(run.id)).resolves.toEqual(run);
  });
});
