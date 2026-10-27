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

function planDocument(
  userId = firstUserId,
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: 1,
    userId,
    name: "First marathon",
    startDate: "2026-08-01",
    targetRaceDate: "2027-01-10",
    status: "draft",
    createdAt: new Date("2026-07-30T12:00:00.000Z"),
    updatedAt: new Date("2026-07-30T12:00:00.000Z"),
    ...overrides,
  };
}

function workoutDocument(
  userId = firstUserId,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const document: Record<string, unknown> = {
    schemaVersion: 1,
    userId,
    planId: "plan-1",
    scheduledDate: "2026-08-02",
    phase: "base_building",
    status: "planned",
    kind: "run",
    notes: "Easy aerobic run.",
    purpose: "easy",
    targetDistanceMeters: 5_000,
    createdAt: new Date("2026-07-30T12:00:00.000Z"),
    updatedAt: new Date("2026-07-30T12:00:00.000Z"),
    ...overrides,
  };

  for (const [key, value] of Object.entries(document)) {
    if (value === undefined) {
      delete document[key];
    }
  }

  return document;
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

async function seedPlanAndWorkout(
  userId = firstUserId,
  planOverrides: Record<string, unknown> = {},
  workoutOverrides: Record<string, unknown> = {},
) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), `users/${userId}/plans/plan-1`),
      planDocument(userId, planOverrides),
    );
    await setDoc(
      doc(
        context.firestore(),
        `users/${userId}/plans/plan-1/workouts/workout-1`,
      ),
      workoutDocument(userId, workoutOverrides),
    );
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

  it("enforces exact profile lifecycle and scheduling relationships", async () => {
    await seedMembership(firstUserId);
    const database = authenticatedContext(firstUserId).firestore();
    const reference = doc(database, `users/${firstUserId}`);

    await assertFails(
      setDoc(
        reference,
        profileDocument(firstUserId, {
          updatedAt: new Date("2026-10-05T13:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      setDoc(reference, profileDocument(firstUserId, { displayName: "   " })),
    );
    await assertFails(
      setDoc(
        reference,
        profileDocument(firstUserId, {
          targetRace: {
            kind: "window",
            startDate: "2027-06-01",
            endDate: "2027-05-01",
          },
        }),
      ),
    );
    await assertFails(
      setDoc(
        reference,
        profileDocument(firstUserId, {
          availableTrainingDays: ["tuesday", "tuesday", "sunday"],
        }),
      ),
    );
    await assertFails(
      setDoc(
        reference,
        profileDocument(firstUserId, {
          availableTrainingDays: ["tuesday", "thursday"],
          preferredLongRunDay: "sunday",
        }),
      ),
    );

    await assertSucceeds(setDoc(reference, profileDocument()));
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
    await assertFails(
      updateDoc(reference, {
        createdAt: new Date("2026-10-05T13:00:00.000Z"),
        updatedAt: new Date("2026-10-05T14:00:00.000Z"),
      }),
    );
  });

  it("keeps server-committed plans readable by approved owners and immutable to clients", async () => {
    await seedMembership(firstUserId);
    await seedMembership(secondUserId);
    await seedPlanAndWorkout();
    const ownerDatabase = authenticatedContext(firstUserId).firestore();
    const otherDatabase = authenticatedContext(secondUserId).firestore();
    const path = `users/${firstUserId}/plans/plan-1`;
    const reference = doc(ownerDatabase, path);

    await assertSucceeds(getDoc(reference));
    await assertFails(getDoc(doc(otherDatabase, path)));
    await assertFails(
      setDoc(
        doc(ownerDatabase, `users/${firstUserId}/plans/plan-2`),
        planDocument(),
      ),
    );
    await assertFails(
      setDoc(reference, { ...planDocument(), name: "Replacement plan" }),
    );
    await assertFails(
      updateDoc(reference, {
        status: "archived",
        updatedAt: new Date("2026-07-30T13:00:00.000Z"),
      }),
    );
    await assertFails(deleteDoc(reference));
  });

  it.each([
    ["runs/run-1", runDocument()],
    ["shoes/shoe-1", shoeDocument()],
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
    await seedPlanAndWorkout();
    const database = authenticatedContext(firstUserId).firestore();
    const reference = doc(database, `users/${firstUserId}/plans/plan-1`);

    await assertFails(setDoc(reference, planDocument()));
    await assertFails(getDoc(reference));
  });

  it("keeps workout definitions server-owned with one temporary status transition", async () => {
    await seedMembership(firstUserId);
    await seedMembership(secondUserId);
    await seedPlanAndWorkout();
    const ownerDatabase = authenticatedContext(firstUserId).firestore();
    const otherDatabase = authenticatedContext(secondUserId).firestore();
    const path = `users/${firstUserId}/plans/plan-1/workouts/workout-1`;
    const ownerReference = doc(ownerDatabase, path);
    const otherReference = doc(otherDatabase, path);
    await assertSucceeds(getDoc(ownerReference));
    await assertFails(
      setDoc(
        doc(
          ownerDatabase,
          `users/${firstUserId}/plans/plan-1/workouts/workout-2`,
        ),
        workoutDocument(),
      ),
    );
    await assertFails(
      setDoc(ownerReference, {
        ...workoutDocument(),
        notes: "Replacement workout",
      }),
    );
    await assertSucceeds(
      updateDoc(ownerReference, {
        status: "completed",
        updatedAt: new Date("2026-07-30T13:00:00.000Z"),
      }),
    );
    await assertSucceeds(
      updateDoc(ownerReference, {
        status: "planned",
        updatedAt: new Date("2026-07-30T14:00:00.000Z"),
      }),
    );
    await assertFails(
      updateDoc(ownerReference, {
        scheduledDate: "2026-08-03",
        updatedAt: new Date("2026-07-30T15:00:00.000Z"),
      }),
    );
    await assertFails(
      updateDoc(ownerReference, {
        status: "skipped",
        updatedAt: new Date("2026-07-30T15:00:00.000Z"),
      }),
    );
    await assertFails(getDoc(otherReference));
    await assertFails(setDoc(otherReference, workoutDocument()));
    await assertFails(deleteDoc(otherReference));
    await assertFails(deleteDoc(ownerReference));
  });

  it("enforces the exact one-way shoe lifecycle for an approved member", async () => {
    await seedMembership(firstUserId);
    const database = authenticatedContext(firstUserId).firestore();
    const reference = doc(database, `users/${firstUserId}/shoes/shoe-1`);

    await assertSucceeds(setDoc(reference, shoeDocument()));
    await assertFails(
      setDoc(reference, shoeDocument(firstUserId, { unexpectedField: true })),
    );
    await assertFails(
      setDoc(
        reference,
        shoeDocument(firstUserId, {
          startingDistanceMeters: -1,
          updatedAt: new Date("2026-10-05T13:00:00.000Z"),
        }),
      ),
    );
    await assertSucceeds(
      setDoc(
        reference,
        shoeDocument(firstUserId, {
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
    await assertFails(deleteDoc(reference));
  });

  it("enforces the exact completed-run lifecycle for an approved member", async () => {
    await seedMembership(firstUserId);
    await seedMembership(secondUserId);
    const ownerDatabase = authenticatedContext(firstUserId).firestore();
    const otherDatabase = authenticatedContext(secondUserId).firestore();
    const path = `users/${firstUserId}/runs/run-1`;
    const ownerReference = doc(ownerDatabase, path);
    const otherReference = doc(otherDatabase, path);

    await assertSucceeds(setDoc(ownerReference, runDocument()));
    await assertSucceeds(getDoc(ownerReference));
    await assertSucceeds(
      updateDoc(ownerReference, {
        durationSeconds: 1_750,
        notes: "Felt controlled throughout.",
        updatedAt: new Date("2026-10-05T14:00:00.000Z"),
      }),
    );
    await assertFails(
      setDoc(
        ownerReference,
        runDocument(firstUserId, {
          unexpectedField: true,
          updatedAt: new Date("2026-10-05T15:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      setDoc(
        ownerReference,
        runDocument(firstUserId, {
          distanceMeters: 0,
          updatedAt: new Date("2026-10-05T15:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      setDoc(
        ownerReference,
        runDocument(firstUserId, {
          plannedWorkoutId: undefined,
          updatedAt: new Date("2026-10-05T15:00:00.000Z"),
        }),
      ),
    );
    await assertFails(
      updateDoc(ownerReference, {
        createdAt: new Date("2026-10-05T12:00:00.000Z"),
        updatedAt: new Date("2026-10-05T15:00:00.000Z"),
      }),
    );
    await assertFails(getDoc(otherReference));
    await assertFails(deleteDoc(otherReference));
    await assertSucceeds(deleteDoc(ownerReference));
  });

  it("denies an approved account whose email is not verified", async () => {
    await seedMembership(firstUserId);
    await seedPlanAndWorkout();
    const database = authenticatedContext(firstUserId, false).firestore();
    const reference = doc(database, `users/${firstUserId}/plans/plan-1`);

    await assertFails(setDoc(reference, planDocument()));
    await assertFails(getDoc(reference));
  });

  it("denies pending and malformed membership records", async () => {
    await seedPlanAndWorkout();
    const database = authenticatedContext(firstUserId).firestore();
    const reference = doc(database, `users/${firstUserId}/plans/plan-1`);

    await seedMembership(firstUserId, { status: "pending" });
    await assertFails(setDoc(reference, planDocument()));

    await seedMembership(firstUserId, { status: "revoked" });
    await assertFails(setDoc(reference, planDocument()));

    await seedMembership(firstUserId, { status: "deletion_pending" });
    await assertFails(setDoc(reference, planDocument()));
    await assertFails(getDoc(reference));

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
    await seedPlanAndWorkout();
    const ownerDatabase = authenticatedContext(firstUserId).firestore();
    const otherDatabase = authenticatedContext(secondUserId).firestore();
    const anonymousDatabase = testEnvironment.unauthenticatedContext().firestore();
    const path = `users/${firstUserId}/plans/plan-1`;

    await assertSucceeds(getDoc(doc(ownerDatabase, path)));
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

  it("keeps account-deletion workflow records server-only", async () => {
    const requestPath = "accountDeletionRequests/request-fixture";
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), requestPath), {
        schemaVersion: 1,
        requestId: "request-fixture",
        userId: firstUserId,
        status: "auth_lock_pending",
      });
    });

    const ownerDatabase = authenticatedContext(firstUserId).firestore();
    const otherDatabase = authenticatedContext(secondUserId).firestore();
    const anonymousDatabase = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(ownerDatabase, requestPath)));
    await assertFails(getDoc(doc(otherDatabase, requestPath)));
    await assertFails(getDoc(doc(anonymousDatabase, requestPath)));
    await assertFails(
      setDoc(doc(ownerDatabase, "accountDeletionRequests/self-created"), {
        userId: firstUserId,
      }),
    );
  });

  it("keeps plan activation records server-owned while allowing owner reads", async () => {
    await seedMembership(firstUserId);
    await seedMembership(secondUserId);
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

    const ownerDatabase = authenticatedContext(firstUserId).firestore();
    const otherDatabase = authenticatedContext(secondUserId).firestore();
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

  it("keeps recommendation evidence readable only by its approved owner and immutable to clients", async () => {
    await seedMembership(firstUserId);
    await seedMembership(secondUserId);
    const evidencePath =
      `users/${firstUserId}/recommendationEvidence/recommendation-0001`;
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), evidencePath), {
        schemaVersion: "recommendation-evidence@1",
        recommendationId: "recommendation-0001",
      });
    });

    const ownerDatabase = authenticatedContext(firstUserId).firestore();
    const otherDatabase = authenticatedContext(secondUserId).firestore();
    const unverifiedDatabase = authenticatedContext(firstUserId, false).firestore();

    await assertSucceeds(getDoc(doc(ownerDatabase, evidencePath)));
    await assertFails(getDoc(doc(otherDatabase, evidencePath)));
    await assertFails(getDoc(doc(unverifiedDatabase, evidencePath)));
    await assertFails(
      setDoc(doc(ownerDatabase, evidencePath), { decision: "accepted" }),
    );
    await assertFails(
      updateDoc(doc(ownerDatabase, evidencePath), { decision: "declined" }),
    );
    await assertFails(deleteDoc(doc(ownerDatabase, evidencePath)));
  });

  it.each([
    [
      "recommendation activation",
      "operatorControls/recommendationActivation",
      "operator-activation-control@1",
    ],
    ["feature controls", "operatorControls/featureControls", "feature-controls@1"],
    [
      "minimum client version",
      "operatorControls/minimumClientVersion",
      "minimum-client-version@1",
    ],
  ])("keeps %s entirely server-owned", async (_, controlPath, schemaVersion) => {
    await seedMembership(firstUserId);
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), controlPath), {
        schemaVersion,
        revision: 1,
      });
    });

    const ownerDatabase = authenticatedContext(firstUserId).firestore();
    const anonymousDatabase = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(ownerDatabase, controlPath)));
    await assertFails(getDoc(doc(anonymousDatabase, controlPath)));
    await assertFails(
      setDoc(doc(ownerDatabase, controlPath), { revision: 2 }),
    );
    await assertFails(deleteDoc(doc(ownerDatabase, controlPath)));
  });
});
