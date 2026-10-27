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

function profileDocument(
  userId = firstUserId,
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: 1,
    userId,
    displayName: "Runner One",
    preferredDistanceUnit: "mile",
    timeZone: "America/Los_Angeles",
    experienceLevel: "consistent",
    consistentRunningWeeks: 12,
    targetRace: { kind: "date", date: "2027-05-02" },
    currentWeeklyDistanceMeters: 24_000,
    currentRunningFrequencyDaysPerWeek: 4,
    longestRecentRunDistanceMeters: 12_000,
    recentPerformance: {
      completedOn: "2026-09-27",
      distanceMeters: 5_000,
      durationSeconds: 1_800,
    },
    availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
    preferredLongRunDay: "sunday",
    scheduleConstraints: "Weekdays after work.\nWeekend mornings.",
    completionGoal: "complete_first_marathon",
    createdAt: new Date("2026-10-05T12:00:00.000Z"),
    updatedAt: new Date("2026-10-05T12:00:00.000Z"),
    ...overrides,
  };
}

function shoeDocument(
  userId = firstUserId,
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: 1,
    userId,
    name: "Daily trainer",
    startingDistanceMeters: 0,
    status: "active",
    createdAt: new Date("2026-10-05T12:00:00.000Z"),
    updatedAt: new Date("2026-10-05T12:00:00.000Z"),
    ...overrides,
  };
}

function runDocument(
  userId = firstUserId,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const document: Record<string, unknown> = {
    schemaVersion: 1,
    userId,
    plannedWorkoutPlanId: "plan-1",
    plannedWorkoutId: "workout-1",
    shoeId: "shoe-1",
    startedAt: new Date("2026-10-05T12:00:00.000Z"),
    timeZone: "America/Los_Angeles",
    distanceMeters: 5_000,
    durationSeconds: 1_800,
    perceivedEffort: "about_right",
    unusualPain: false,
    notes: "Comfortable progression run.",
    createdAt: new Date("2026-10-05T13:00:00.000Z"),
    updatedAt: new Date("2026-10-05T13:00:00.000Z"),
    ...overrides,
  };

  for (const [key, value] of Object.entries(document)) {
    if (value === undefined) {
      delete document[key];
    }
  }

  return document;
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
      setDoc(reference, {
        ...profileDocument(),
        consistentRunningWeeks: -1,
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
    await assertFails(
      updateDoc(reference, {
        schemaVersion: 2,
        updatedAt: new Date("2026-10-05T13:00:00.000Z"),
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        displayName: "Updated Runner",
        updatedAt: new Date("2026-10-05T13:00:00.000Z"),
      }),
    );
    await assertFails(
      updateDoc(reference, {
        updatedAt: new Date("2026-10-05T12:30:00.000Z"),
      }),
    );
  });

  it.each([
    ["an incoherent create timestamp", {
      updatedAt: new Date("2026-10-05T13:00:00.000Z"),
    }],
    ["a whitespace-only display name", { displayName: "   " }],
    ["an oversized display name", { displayName: "d".repeat(121) }],
    ["whitespace-only schedule constraints", { scheduleConstraints: "\t\n" }],
    ["oversized schedule constraints", { scheduleConstraints: "s".repeat(501) }],
    ["a malformed race date", {
      targetRace: { kind: "date", date: "05/02/2027" },
    }],
    ["a reversed race window", {
      targetRace: {
        kind: "window",
        startDate: "2027-06-01",
        endDate: "2027-05-01",
      },
    }],
    ["a malformed recent-performance date", {
      recentPerformance: {
        completedOn: "09/27/2026",
        distanceMeters: 5_000,
        durationSeconds: 1_800,
      },
    }],
    ["duplicate available training days", {
      availableTrainingDays: ["tuesday", "tuesday", "sunday"],
    }],
    ["a preferred day outside the available days", {
      availableTrainingDays: ["tuesday", "thursday"],
      preferredLongRunDay: "sunday",
    }],
  ])("rejects a profile with %s", async (_, overrides) => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const reference = doc(database, `users/${firstUserId}`);

    await assertFails(setDoc(reference, profileDocument(firstUserId, overrides)));
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

  it("keeps active state, provenance, and command receipts server-owned", async () => {
    const activeStatePath = `users/${firstUserId}/planState/active`;
    const provenancePath =
      `users/${firstUserId}/plans/plan-1/metadata/generation`;
    const receiptPath =
      `materialCommandReceipts/${firstUserId}/commands/approve-plan-1`;
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), activeStatePath), {
        schemaVersion: 1,
        userId: firstUserId,
      });
      await setDoc(doc(context.firestore(), provenancePath), {
        schemaVersion: 1,
        userId: firstUserId,
      });
      await setDoc(doc(context.firestore(), receiptPath), {
        schemaVersion: 1,
      });
    });

    const ownerDatabase = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const otherDatabase = testEnvironment
      .authenticatedContext(secondUserId)
      .firestore();

    for (const path of [activeStatePath, provenancePath]) {
      await assertSucceeds(getDoc(doc(ownerDatabase, path)));
      await assertFails(getDoc(doc(otherDatabase, path)));
      await assertFails(setDoc(doc(ownerDatabase, path), { userId: firstUserId }));
      await assertFails(deleteDoc(doc(ownerDatabase, path)));
    }
    await assertFails(getDoc(doc(ownerDatabase, receiptPath)));
    await assertFails(setDoc(doc(ownerDatabase, receiptPath), {}));
    await assertFails(deleteDoc(doc(ownerDatabase, receiptPath)));
  });

  it("keeps recommendation evidence readable only by its owner and immutable to clients", async () => {
    const evidencePath =
      `users/${firstUserId}/recommendationEvidence/recommendation-0001`;
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), evidencePath), {
        schemaVersion: "recommendation-evidence@1",
        recommendationId: "recommendation-0001",
      });
    });

    const ownerDatabase = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const otherDatabase = testEnvironment
      .authenticatedContext(secondUserId)
      .firestore();
    const anonymousDatabase = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(ownerDatabase, evidencePath)));
    await assertFails(getDoc(doc(otherDatabase, evidencePath)));
    await assertFails(getDoc(doc(anonymousDatabase, evidencePath)));
    await assertFails(
      setDoc(doc(ownerDatabase, evidencePath), { decision: "accepted" }),
    );
    await assertFails(
      updateDoc(doc(ownerDatabase, evidencePath), { decision: "declined" }),
    );
    await assertFails(deleteDoc(doc(ownerDatabase, evidencePath)));
  });

  it("keeps operator activation controls entirely server-owned", async () => {
    const controlPath = "operatorControls/recommendationActivation";
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), controlPath), {
        schemaVersion: "operator-activation-control@1",
        revision: 1,
      });
    });

    const ownerDatabase = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const anonymousDatabase = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(ownerDatabase, controlPath)));
    await assertFails(getDoc(doc(anonymousDatabase, controlPath)));
    await assertFails(
      setDoc(doc(ownerDatabase, controlPath), { revision: 2 }),
    );
    await assertFails(deleteDoc(doc(ownerDatabase, controlPath)));
  });

  it.each([
    ["shoes/shoe-1", shoeDocument()],
  ])(
    "applies the same ownership boundary to %s",
    async (relativePath, data) => {
      const ownerDatabase = testEnvironment
        .authenticatedContext(firstUserId)
        .firestore();
      const otherDatabase = testEnvironment
        .authenticatedContext(secondUserId)
        .firestore();
      const path = `users/${firstUserId}/${relativePath}`;
      await assertSucceeds(setDoc(doc(ownerDatabase, path), data));
      await assertFails(getDoc(doc(otherDatabase, path)));
    },
  );

  it("accepts the exact completed-run lifecycle for its owner", async () => {
    const ownerDatabase = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const otherDatabase = testEnvironment
      .authenticatedContext(secondUserId)
      .firestore();
    const path = `users/${firstUserId}/runs/run-1`;
    const ownerReference = doc(ownerDatabase, path);
    const otherReference = doc(otherDatabase, path);

    await assertSucceeds(setDoc(ownerReference, runDocument()));
    await assertSucceeds(getDoc(ownerReference));
    await assertFails(getDoc(otherReference));
    await assertSucceeds(
      updateDoc(ownerReference, {
        distanceMeters: 5_100,
        perceivedEffort: "easier_than_expected",
        updatedAt: new Date("2026-10-05T14:00:00.000Z"),
      }),
    );
    await assertFails(
      updateDoc(otherReference, {
        distanceMeters: 10_000,
        updatedAt: new Date("2026-10-05T15:00:00.000Z"),
      }),
    );
    await assertFails(deleteDoc(otherReference));
    await assertSucceeds(deleteDoc(ownerReference));
  });

  it.each([
    ["an unknown field", { unexpectedField: true }],
    ["a blank time zone", { timeZone: "" }],
    ["zero distance", { distanceMeters: 0 }],
    ["fractional distance", { distanceMeters: 1.5 }],
    ["zero duration", { durationSeconds: 0 }],
    ["an invalid perceived effort", { perceivedEffort: "fast" }],
    ["a non-boolean pain flag", { unusualPain: "no" }],
    ["blank notes", { notes: " \n " }],
    ["oversized notes", { notes: "n".repeat(501) }],
    ["only a plan association", { plannedWorkoutId: undefined }],
    ["an invalid shoe identifier", { shoeId: "shoes/shoe-1" }],
    ["incoherent create timestamps", {
      updatedAt: new Date("2026-10-05T14:00:00.000Z"),
    }],
  ])("rejects a completed run with %s", async (_, overrides) => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const reference = doc(database, `users/${firstUserId}/runs/run-1`);

    await assertFails(setDoc(reference, runDocument(firstUserId, overrides)));
  });

  it("rejects a completed run missing a required field", async () => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const reference = doc(database, `users/${firstUserId}/runs/run-1`);
    const incompleteRun = runDocument();
    delete incompleteRun.startedAt;

    await assertFails(setDoc(reference, incompleteRun));
  });

  it("preserves immutable run fields and monotonic update time", async () => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const reference = doc(database, `users/${firstUserId}/runs/run-1`);

    await assertSucceeds(setDoc(reference, runDocument()));
    await assertFails(
      setDoc(
        reference,
        runDocument(secondUserId, {
          updatedAt: new Date("2026-10-05T14:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      updateDoc(reference, {
        schemaVersion: 2,
        updatedAt: new Date("2026-10-05T14:00:00.000Z"),
      }),
    );
    await assertFails(
      updateDoc(reference, {
        createdAt: new Date("2026-10-05T12:00:00.000Z"),
        updatedAt: new Date("2026-10-05T14:00:00.000Z"),
      }),
    );
    await assertFails(
      updateDoc(reference, {
        updatedAt: new Date("2026-10-05T12:59:59.000Z"),
      }),
    );
  });

  it("accepts exact shoe creation and makes retirement terminal", async () => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const reference = doc(database, `users/${firstUserId}/shoes/shoe-1`);

    await assertSucceeds(setDoc(reference, shoeDocument()));
    await assertSucceeds(
      setDoc(
        reference,
        shoeDocument(firstUserId, {
          name: "Daily trainer renamed",
          updatedAt: new Date("2026-10-05T13:00:00.000Z"),
        }),
      ),
    );
    await assertSucceeds(
      setDoc(
        reference,
        shoeDocument(firstUserId, {
          name: "Daily trainer renamed",
          status: "retired",
          retiredOn: "2026-10-06",
          updatedAt: new Date("2026-10-06T12:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      setDoc(
        reference,
        shoeDocument(firstUserId, {
          updatedAt: new Date("2026-10-06T13:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      setDoc(
        reference,
        shoeDocument(firstUserId, {
          status: "retired",
          retiredOn: "2026-10-07",
          updatedAt: new Date("2026-10-07T12:00:00.000Z"),
        }),
      ),
    );
    await assertFails(deleteDoc(reference));
  });

  it.each([
    ["an unknown field", { unexpectedField: true }],
    ["a blank name", { name: "" }],
    ["an oversized name", { name: "s".repeat(121) }],
    ["negative starting distance", { startingDistanceMeters: -1 }],
    ["fractional starting distance", { startingDistanceMeters: 1.5 }],
    ["retired status without a date", { status: "retired" }],
    ["active status with a retirement date", { retiredOn: "2026-10-06" }],
  ])("rejects a shoe with %s", async (_, overrides) => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const reference = doc(database, `users/${firstUserId}/shoes/shoe-1`);

    await assertFails(setDoc(reference, shoeDocument(firstUserId, overrides)));
  });

  it("preserves immutable shoe fields and monotonic update time", async () => {
    const database = testEnvironment
      .authenticatedContext(firstUserId)
      .firestore();
    const reference = doc(database, `users/${firstUserId}/shoes/shoe-1`);

    await assertSucceeds(setDoc(reference, shoeDocument()));
    await assertFails(
      setDoc(
        reference,
        shoeDocument(secondUserId, {
          updatedAt: new Date("2026-10-05T13:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      setDoc(
        reference,
        shoeDocument(firstUserId, {
          schemaVersion: 2,
          updatedAt: new Date("2026-10-05T13:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      setDoc(
        reference,
        shoeDocument(firstUserId, {
          startingDistanceMeters: 1609,
          updatedAt: new Date("2026-10-05T13:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      setDoc(
        reference,
        shoeDocument(firstUserId, {
          createdAt: new Date("2026-10-05T11:00:00.000Z"),
          updatedAt: new Date("2026-10-05T13:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      setDoc(
        reference,
        shoeDocument(firstUserId, {
          updatedAt: new Date("2026-10-05T11:00:00.000Z"),
        }),
      ),
    );
  });
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
      consistentRunningWeeks: 12,
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
