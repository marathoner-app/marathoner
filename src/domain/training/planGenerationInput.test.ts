import { describe, expect, it } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createPlanGenerationArtifactVersion,
  createUserId,
  createUtcDateTime,
  type PlanGenerationArtifactVersion,
  type UserProfile,
} from ".";
import { createPlanGenerationInputFromProfile } from "./planGenerationInput";

const timestamp = createUtcDateTime("2026-10-27T12:00:00Z");
const rulesetVersion = createPlanGenerationArtifactVersion(
  "internal-rules@1.0.0",
);
const completeProfile: UserProfile = {
  id: createUserId("runner-1"),
  displayName: "River",
  preferredDistanceUnit: "mile",
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  experienceLevel: "consistent",
  consistentRunningWeeks: 12,
  targetRace: { kind: "date", date: createDateOnly("2027-03-28") },
  currentWeeklyDistance: createDistanceMeters(42_000),
  currentRunningFrequencyDaysPerWeek: 4,
  longestRecentRunDistance: createDistanceMeters(16_000),
  recentPerformance: {
    completedOn: createDateOnly("2026-10-18"),
    distance: createDistanceMeters(10_000),
    duration: createDurationSeconds(3_600),
  },
  availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
  preferredLongRunDay: "sunday",
  scheduleConstraints: "Weekday runs happen before work.",
  completionGoal: "complete_first_marathon",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const options = {
  planStartDate: createDateOnly("2026-10-26"),
  rulesetVersion,
  safetySignal: "none_reported" as const,
};

describe("createPlanGenerationInputFromProfile", () => {
  it("copies a complete profile into a valid normalized input", () => {
    const profileBefore = structuredClone(completeProfile);
    const result = createPlanGenerationInputFromProfile(
      completeProfile,
      options,
    );

    expect(result).toEqual({
      kind: "ready",
      input: {
        schemaVersion: "plan-generation-input@1",
        rulesetVersion,
        planStartDate: createDateOnly("2026-10-26"),
        runner: {
          experienceLevel: "consistent",
          consistentRunningWeeks: 12,
          targetRace: {
            kind: "date",
            date: createDateOnly("2027-03-28"),
          },
          currentWeeklyDistance: createDistanceMeters(42_000),
          currentRunningFrequencyDaysPerWeek: 4,
          longestRecentRunDistance: createDistanceMeters(16_000),
          recentPerformance: {
            completedOn: createDateOnly("2026-10-18"),
            distance: createDistanceMeters(10_000),
            duration: createDurationSeconds(3_600),
          },
          availableTrainingDays: [
            "tuesday",
            "thursday",
            "saturday",
            "sunday",
          ],
          preferredLongRunDay: "sunday",
          scheduleConstraints: "Weekday runs happen before work.",
          completionGoal: "complete_first_marathon",
          safetySignal: "none_reported",
        },
      },
    });

    if (result.kind !== "ready") throw new Error("Expected a ready input.");
    expect(result.input.runner.targetRace).not.toBe(completeProfile.targetRace);
    expect(result.input.runner.recentPerformance).not.toBe(
      completeProfile.recentPerformance,
    );
    expect(result.input.runner.availableTrainingDays).not.toBe(
      completeProfile.availableTrainingDays,
    );
    expect(completeProfile).toEqual(profileBefore);
  });

  it("omits optional profile context when it was not saved", () => {
    const result = createPlanGenerationInputFromProfile(
      {
        ...completeProfile,
        recentPerformance: undefined,
        scheduleConstraints: undefined,
      },
      options,
    );

    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") throw new Error("Expected a ready input.");
    expect(result.input.runner).not.toHaveProperty("recentPerformance");
    expect(result.input.runner).not.toHaveProperty("scheduleConstraints");
  });

  it("reports every missing required profile field in stable order", () => {
    const result = createPlanGenerationInputFromProfile(
      {
        id: completeProfile.id,
        preferredDistanceUnit: "mile",
        timeZone: completeProfile.timeZone,
        experienceLevel: "consistent",
        availableTrainingDays: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      options,
    );

    expect(result).toEqual({
      kind: "incomplete_profile",
      missingFields: [
        "consistentRunningWeeks",
        "targetRace",
        "currentWeeklyDistance",
        "currentRunningFrequencyDaysPerWeek",
        "longestRecentRunDistance",
        "availableTrainingDays",
        "preferredLongRunDay",
        "completionGoal",
      ],
    });
  });

  it("does not require consistency duration from a non-consistent runner", () => {
    const result = createPlanGenerationInputFromProfile(
      {
        ...completeProfile,
        experienceLevel: "returning",
        consistentRunningWeeks: undefined,
      },
      options,
    );

    expect(result.kind).toBe("ready");
  });

  it("returns contract issues for invalid explicit context or saved values", () => {
    const result = createPlanGenerationInputFromProfile(
      {
        ...completeProfile,
        currentRunningFrequencyDaysPerWeek: 8,
      },
      {
        ...options,
        rulesetVersion: "invalid" as PlanGenerationArtifactVersion,
      },
    );

    expect(result.kind).toBe("invalid_input");
    if (result.kind !== "invalid_input") {
      throw new Error("Expected invalid input issues.");
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "rulesetVersion" }),
        expect.objectContaining({
          field: "runner.currentRunningFrequencyDaysPerWeek",
        }),
      ]),
    );
  });
});
