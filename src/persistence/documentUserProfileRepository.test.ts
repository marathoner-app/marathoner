import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
} from "../domain/training";
import { createDocumentTrainingRepositories } from "./documentTrainingRepositories";
import { TRAINING_SCHEMA_VERSION } from "./firestore/converters";
import { InMemoryDocumentStore } from "./testing/InMemoryDocumentStore";
import type {
  SaveUserProfileInput,
  TrainingRepositories,
} from "./trainingRepositories";

const userId = createUserId("runner-1");
const profilePath = `users/${userId}`;
const createdAt = createUtcDateTime("2026-10-05T12:00:00Z");
const updatedAt = createUtcDateTime("2026-10-05T13:00:00Z");
const input: SaveUserProfileInput = {
  displayName: "Kevin",
  preferredDistanceUnit: "mile",
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  experienceLevel: "consistent",
  targetRace: {
    kind: "date",
    date: createDateOnly("2027-05-02"),
  },
  currentWeeklyDistance: createDistanceMeters(32_187),
  currentRunningFrequencyDaysPerWeek: 4,
  longestRecentRunDistance: createDistanceMeters(16_093),
  recentPerformance: {
    completedOn: createDateOnly("2026-09-27"),
    distance: createDistanceMeters(10_000),
    duration: createDurationSeconds(3_600),
  },
  availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
  preferredLongRunDay: "sunday",
  scheduleConstraints: "Weekday runs need to happen before work.",
  completionGoal: "complete_first_marathon",
};

let clockValue = createdAt;
let store: InMemoryDocumentStore;
let repositories: TrainingRepositories;

beforeEach(() => {
  clockValue = createdAt;
  store = new InMemoryDocumentStore();
  repositories = createDocumentTrainingRepositories(
    store,
    userId,
    () => clockValue,
  );
});

describe("user profile repository", () => {
  it("creates and reloads the complete versioned profile contract", async () => {
    const profile = await repositories.profile.save(input);

    expect(profile).toEqual({
      id: userId,
      ...input,
      createdAt,
      updatedAt: createdAt,
    });
    expect(store.read(profilePath)).toEqual({
      schemaVersion: TRAINING_SCHEMA_VERSION,
      userId,
      displayName: "Kevin",
      preferredDistanceUnit: "mile",
      timeZone: "America/Los_Angeles",
      experienceLevel: "consistent",
      targetRace: { kind: "date", date: "2027-05-02" },
      currentWeeklyDistanceMeters: 32_187,
      currentRunningFrequencyDaysPerWeek: 4,
      longestRecentRunDistanceMeters: 16_093,
      recentPerformance: {
        completedOn: "2026-09-27",
        distanceMeters: 10_000,
        durationSeconds: 3_600,
      },
      availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
      scheduleConstraints: "Weekday runs need to happen before work.",
      completionGoal: "complete_first_marathon",
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(createdAt)),
    });
    await expect(repositories.profile.load()).resolves.toEqual(profile);
  });

  it("updates the profile while preserving its creation timestamp", async () => {
    await repositories.profile.save(input);
    clockValue = updatedAt;

    const updated = await repositories.profile.save({
      ...input,
      displayName: "Kevin T.",
      targetRace: {
        kind: "window",
        startDate: createDateOnly("2027-05-01"),
        endDate: createDateOnly("2027-05-31"),
      },
    });

    expect(updated.createdAt).toBe(createdAt);
    expect(updated.updatedAt).toBe(updatedAt);
    expect(updated.displayName).toBe("Kevin T.");
    expect(updated.targetRace).toEqual({
      kind: "window",
      startDate: "2027-05-01",
      endDate: "2027-05-31",
    });
  });

  it("returns null before the runner has created a profile", async () => {
    await expect(repositories.profile.load()).resolves.toBeNull();
  });

  it("rejects invalid profile input without writing it", async () => {
    await expect(
      repositories.profile.save({
        ...input,
        currentRunningFrequencyDaysPerWeek: 8,
      }),
    ).rejects.toMatchObject({ code: "invalid_data" });
    expect(store.read(profilePath)).toBeUndefined();
  });

  it.each([
    ["unknown schema", { schemaVersion: 2 }],
    ["wrong owner", { userId: "runner-2" }],
    ["invalid enum", { experienceLevel: "elite" }],
    ["invalid target date", { targetRace: { kind: "date", date: "2027-02-29" } }],
  ])("returns a typed error for %s stored data", async (_name, change) => {
    await repositories.profile.save(input);
    store.overwrite(profilePath, {
      ...store.read(profilePath),
      ...change,
    });

    await expect(repositories.profile.load()).rejects.toMatchObject({
      code: "invalid_data",
    });
  });
});
