import {
  createDateOnly,
  createDistanceMeters,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  type UserProfile,
} from "../domain/training";

export const INTERNAL_ELIGIBLE_PLAN_REHEARSAL_PROFILE_VERSION =
  "internal-eligible-profile@1.0.0";

export type InternalPlanRehearsalProfileSource =
  | "saved_profile"
  | "frozen_eligible_profile";

const fixtureTimestamp = createUtcDateTime("2029-12-01T12:00:00.000Z");

export const internalEligiblePlanRehearsalProfile = {
  id: createUserId("internal-eligible-plan-rehearsal-runner"),
  displayName: "Frozen eligible rehearsal profile",
  preferredDistanceUnit: "mile",
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  experienceLevel: "consistent",
  consistentRunningWeeks: 12,
  targetRace: { kind: "date", date: createDateOnly("2030-05-12") },
  currentWeeklyDistance: createDistanceMeters(42_000),
  currentRunningFrequencyDaysPerWeek: 4,
  longestRecentRunDistance: createDistanceMeters(16_000),
  availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
  preferredLongRunDay: "sunday",
  completionGoal: "complete_first_marathon",
  createdAt: fixtureTimestamp,
  updatedAt: fixtureTimestamp,
} as const satisfies UserProfile;
