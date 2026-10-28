import { describe, expect, it } from "vitest";
import {
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  type UserProfile,
} from "../domain/training";
import { createInternalPlanStartDateCandidates } from "./internalPlanStartDateCandidates";

const timestamp = createUtcDateTime("2029-12-01T12:00:00Z");
const profile: UserProfile = {
  id: createUserId("candidate-runner"),
  preferredDistanceUnit: "mile",
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  targetRace: { kind: "date", date: createDateOnly("2030-05-12") },
  preferredLongRunDay: "sunday",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const rules = {
  wholeWeeksFromPlanStartToRace: { minimum: 18, maximum: 22 },
};

describe("createInternalPlanStartDateCandidates", () => {
  it("derives every injected whole-week horizon in longest-first order", () => {
    expect(createInternalPlanStartDateCandidates(profile, rules)).toEqual({
      kind: "available",
      candidates: [
        { date: "2029-12-10", wholeWeeksToRace: 22 },
        { date: "2029-12-17", wholeWeeksToRace: 21 },
        { date: "2029-12-24", wholeWeeksToRace: 20 },
        { date: "2029-12-31", wholeWeeksToRace: 19 },
        { date: "2030-01-07", wholeWeeksToRace: 18 },
      ],
    });
  });

  it("preserves calendar dates across a leap-day boundary", () => {
    const result = createInternalPlanStartDateCandidates(
      {
        ...profile,
        targetRace: { kind: "date", date: createDateOnly("2032-07-04") },
      },
      {
        ...rules,
        wholeWeeksFromPlanStartToRace: { minimum: 18, maximum: 18 },
      },
    );

    expect(result).toEqual({
      kind: "available",
      candidates: [{ date: "2032-03-01", wholeWeeksToRace: 18 }],
    });
  });

  it("removes choices that predate the saved recent effort", () => {
    const result = createInternalPlanStartDateCandidates(
      {
        ...profile,
        recentPerformance: {
          completedOn: createDateOnly("2029-12-24"),
          distance: createDistanceMeters(10_000),
          duration: createDurationSeconds(3_600),
        },
      },
      rules,
    );

    expect(result).toEqual({
      kind: "available",
      candidates: [
        { date: "2029-12-24", wholeWeeksToRace: 20 },
        { date: "2029-12-31", wholeWeeksToRace: 19 },
        { date: "2030-01-07", wholeWeeksToRace: 18 },
      ],
    });
  });

  it("explains when the recent effort follows every supported start date", () => {
    expect(
      createInternalPlanStartDateCandidates(
        {
          ...profile,
          recentPerformance: {
            completedOn: createDateOnly("2030-01-08"),
            distance: createDistanceMeters(10_000),
            duration: createDurationSeconds(3_600),
          },
        },
        rules,
      ),
    ).toEqual({
      kind: "unavailable",
      reason: "recent_effort_after_supported_start_window",
    });
  });

  it("does not invent dates for incomplete, window, or misaligned profiles", () => {
    expect(
      createInternalPlanStartDateCandidates(
        { ...profile, preferredLongRunDay: undefined },
        rules,
      ),
    ).toEqual({ kind: "unavailable", reason: "profile_incomplete" });

    expect(
      createInternalPlanStartDateCandidates(
        {
          ...profile,
          targetRace: {
            kind: "window",
            startDate: createDateOnly("2030-05-12"),
            endDate: createDateOnly("2030-05-19"),
          },
        },
        rules,
      ),
    ).toEqual({ kind: "unavailable", reason: "race_window" });

    expect(
      createInternalPlanStartDateCandidates(
        { ...profile, preferredLongRunDay: "saturday" },
        rules,
      ),
    ).toEqual({ kind: "unavailable", reason: "race_weekday_mismatch" });
  });
});
