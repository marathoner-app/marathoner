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
import {
  createSharedRecordProof,
  sharedRecordProofDocumentPath,
} from "@marathoner/training-contract";

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

describe("Firestore shared-record spike ownership rules", () => {
  it("allows the owner to write, read, and clean up the exact proof record", async () => {
    const ownerDatabase = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const path = sharedRecordProofDocumentPath(firstUserId);
    const reference = doc(ownerDatabase, path);

    await assertSucceeds(
      setDoc(reference, createSharedRecordProof(firstUserId, "capacitor")),
    );
    await assertSucceeds(getDoc(reference));
    await assertSucceeds(deleteDoc(reference));
    const cleanedSnapshot = await assertSucceeds(getDoc(reference));

    expect(cleanedSnapshot.exists()).toBe(false);
  });

  it("denies anonymous and cross-owner reads, writes, and cleanup", async () => {
    const ownerDatabase = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const otherDatabase = testEnvironment
      .authenticatedContext(secondUserId)
      .firestore();
    const anonymousDatabase = testEnvironment.unauthenticatedContext().firestore();
    const path = sharedRecordProofDocumentPath(firstUserId);
    const record = createSharedRecordProof(firstUserId, "expo");

    await assertSucceeds(setDoc(doc(ownerDatabase, path), record));
    await assertFails(getDoc(doc(otherDatabase, path)));
    await assertFails(setDoc(doc(otherDatabase, path), record));
    await assertFails(deleteDoc(doc(otherDatabase, path)));
    await assertFails(getDoc(doc(anonymousDatabase, path)));
    await assertFails(setDoc(doc(anonymousDatabase, path), record));
  });

  it("rejects wrong-owner, malformed, and non-proof writes", async () => {
    const ownerDatabase = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const path = sharedRecordProofDocumentPath(firstUserId);
    const record = createSharedRecordProof(firstUserId, "web");

    await assertFails(
      setDoc(doc(ownerDatabase, path), { ...record, userId: secondUserId }),
    );
    await assertFails(
      setDoc(doc(ownerDatabase, path), { ...record, unexpected: true }),
    );
    await assertFails(
      setDoc(
        doc(ownerDatabase, `users/${firstUserId}/mobileSpikeProofs/another-proof`),
        record,
      ),
    );
  });
});

describe("Firestore repository integration", () => {
  it("persists and reloads an associated plan, workout, shoe, and run", async () => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore() as unknown as Firestore;
    const clock = () => createUtcDateTime("2026-07-30T12:00:00.000Z");
    const repositories = createDocumentTrainingRepositories(
      new FirestoreDocumentStore(database),
      createUserId(firstUserId),
      clock,
    );
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

    await expect(repositories.plans.get(plan.id)).resolves.toEqual(plan);
    await expect(repositories.workouts.get(plan.id, workout.id)).resolves.toEqual(
      workout,
    );
    await expect(repositories.shoes.get(shoe.id)).resolves.toEqual(shoe);
    await expect(repositories.runs.get(run.id)).resolves.toEqual(run);
  });
});
