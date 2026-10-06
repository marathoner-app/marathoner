import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "demo-marathoner-beta";
const firstUserId = "runner-one";
const secondUserId = "runner-two";
const fixtureEmailDomain = "example.test";

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

function authenticatedContext(
  userId: string,
  emailVerified = true,
): RulesTestContext {
  return testEnvironment.authenticatedContext(userId, {
    email: `${userId}@${fixtureEmailDomain}`,
    email_verified: emailVerified,
  });
}

async function seedMembership(
  userId: string,
  overrides: Record<string, unknown> = {},
) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `betaMemberships/${userId}`), {
      schemaVersion: 1,
      userId,
      status: "approved",
      approvedAt: new Date("2026-09-30T12:00:00.000Z"),
      approvedBy: "operator-fixture",
      ...overrides,
    });
  });
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile("firestore.beta.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("founding-beta membership rules", () => {
  it("allows an approved verified owner to create, read, and update their profile", async () => {
    await seedMembership(firstUserId);
    const ownerDatabase = authenticatedContext(firstUserId).firestore();
    const otherDatabase = authenticatedContext(secondUserId).firestore();
    const reference = doc(ownerDatabase, `users/${firstUserId}`);

    await assertSucceeds(setDoc(reference, profileDocument()));
    await assertSucceeds(getDoc(reference));
    await assertSucceeds(
      updateDoc(reference, {
        updatedAt: new Date("2026-10-05T13:00:00.000Z"),
      }),
    );
    await assertFails(getDoc(doc(otherDatabase, `users/${firstUserId}`)));
    await assertFails(deleteDoc(reference));
  });

  it.each([
    ["plans/plan-1", planDocument()],
    [
      "plans/plan-1/workouts/workout-1",
      {
        schemaVersion: 1,
        userId: firstUserId,
        planId: "plan-1",
      },
    ],
    ["runs/run-1", { schemaVersion: 1, userId: firstUserId }],
    ["shoes/shoe-1", { schemaVersion: 1, userId: firstUserId }],
  ])(
    "allows an approved verified owner to write and read %s",
    async (relativePath, data) => {
      await seedMembership(firstUserId);
      const database = authenticatedContext(firstUserId)
        .firestore() as unknown as Firestore;
      const reference = doc(database, `users/${firstUserId}/${relativePath}`);

      await assertSucceeds(setDoc(reference, data));
      await assertSucceeds(getDoc(reference));
    },
  );

  it("denies a verified account with no membership", async () => {
    const database = authenticatedContext(firstUserId).firestore();
    const reference = doc(database, `users/${firstUserId}/plans/plan-1`);

    await assertFails(setDoc(reference, planDocument()));
    await assertFails(getDoc(reference));
  });

  it("denies an approved account whose email is not verified", async () => {
    await seedMembership(firstUserId);
    const database = authenticatedContext(firstUserId, false).firestore();
    const reference = doc(database, `users/${firstUserId}/plans/plan-1`);

    await assertFails(setDoc(reference, planDocument()));
    await assertFails(getDoc(reference));
  });

  it("denies pending and malformed membership records", async () => {
    const database = authenticatedContext(firstUserId).firestore();
    const reference = doc(database, `users/${firstUserId}/plans/plan-1`);

    await seedMembership(firstUserId, { status: "pending" });
    await assertFails(setDoc(reference, planDocument()));

    await seedMembership(firstUserId, { status: "revoked" });
    await assertFails(setDoc(reference, planDocument()));

    await seedMembership(firstUserId, { schemaVersion: 2 });
    await assertFails(setDoc(reference, planDocument()));

    await seedMembership(firstUserId, { userId: secondUserId });
    await assertFails(setDoc(reference, planDocument()));

    await seedMembership(firstUserId, { unexpectedField: true });
    await assertFails(setDoc(reference, planDocument()));

    await seedMembership(firstUserId, { approvedBy: "" });
    await assertFails(setDoc(reference, planDocument()));
  });

  it("denies anonymous and cross-owner access", async () => {
    await seedMembership(firstUserId);
    await seedMembership(secondUserId);
    const ownerDatabase = authenticatedContext(firstUserId).firestore();
    const otherDatabase = authenticatedContext(secondUserId).firestore();
    const anonymousDatabase = testEnvironment.unauthenticatedContext().firestore();
    const path = `users/${firstUserId}/plans/plan-1`;

    await assertSucceeds(setDoc(doc(ownerDatabase, path), planDocument()));
    await assertFails(getDoc(doc(otherDatabase, path)));
    await assertFails(setDoc(doc(otherDatabase, path), planDocument()));
    await assertFails(getDoc(doc(anonymousDatabase, path)));
  });

  it("allows a verified account to read only its own membership status", async () => {
    await seedMembership(firstUserId, { status: "pending" });
    await seedMembership(secondUserId);
    const database = authenticatedContext(firstUserId).firestore();

    await assertSucceeds(
      getDoc(doc(database, `betaMemberships/${firstUserId}`)),
    );
    await assertFails(
      getDoc(doc(database, `betaMemberships/${secondUserId}`)),
    );
    await assertFails(getDocs(collection(database, "betaMemberships")));
    await assertFails(
      getDoc(
        doc(
          authenticatedContext(firstUserId, false).firestore(),
          `betaMemberships/${firstUserId}`,
        ),
      ),
    );
  });

  it("denies every client membership mutation", async () => {
    await seedMembership(firstUserId);
    const approvedDatabase = authenticatedContext(firstUserId).firestore();
    const unapprovedDatabase = authenticatedContext(secondUserId).firestore();
    const ownMembership = doc(
      approvedDatabase,
      `betaMemberships/${firstUserId}`,
    );

    await assertFails(
      setDoc(doc(unapprovedDatabase, `betaMemberships/${secondUserId}`), {
        schemaVersion: 1,
        userId: secondUserId,
        status: "approved",
        approvedAt: new Date("2026-09-30T12:00:00.000Z"),
        approvedBy: "self-approved",
      }),
    );
    await assertFails(updateDoc(ownMembership, { status: "revoked" }));
    await assertFails(deleteDoc(ownMembership));
  });
});
