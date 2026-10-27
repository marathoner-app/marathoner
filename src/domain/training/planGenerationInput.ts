import type { DateOnly } from "./dates.js";
import {
  PLAN_GENERATION_INPUT_SCHEMA_VERSION,
  validatePlanGenerationInput,
  type PlanGenerationArtifactVersion,
  type PlanGenerationInputV1,
  type PlanGenerationSafetySignal,
  type PlanGenerationValidationIssue,
} from "./planGeneration.js";
import type { UserProfile } from "./types.js";

export const planGenerationProfileFields = [
  "experienceLevel",
  "consistentRunningWeeks",
  "targetRace",
  "currentWeeklyDistance",
  "currentRunningFrequencyDaysPerWeek",
  "longestRecentRunDistance",
  "availableTrainingDays",
  "preferredLongRunDay",
  "completionGoal",
] as const;

export type PlanGenerationProfileField =
  (typeof planGenerationProfileFields)[number];

export interface PlanGenerationInputOptions {
  readonly planStartDate: DateOnly;
  readonly rulesetVersion: PlanGenerationArtifactVersion;
  readonly safetySignal: PlanGenerationSafetySignal;
}

export type PlanGenerationInputFromProfileResult =
  | {
      readonly kind: "ready";
      readonly input: PlanGenerationInputV1;
    }
  | {
      readonly kind: "incomplete_profile";
      readonly missingFields: readonly PlanGenerationProfileField[];
    }
  | {
      readonly kind: "invalid_input";
      readonly issues: readonly PlanGenerationValidationIssue[];
    };

function missingProfileFields(
  profile: UserProfile,
): PlanGenerationProfileField[] {
  const missing: PlanGenerationProfileField[] = [];

  if (profile.experienceLevel === undefined) missing.push("experienceLevel");
  if (
    profile.experienceLevel === "consistent" &&
    profile.consistentRunningWeeks === undefined
  ) {
    missing.push("consistentRunningWeeks");
  }
  if (profile.targetRace === undefined) missing.push("targetRace");
  if (profile.currentWeeklyDistance === undefined) {
    missing.push("currentWeeklyDistance");
  }
  if (profile.currentRunningFrequencyDaysPerWeek === undefined) {
    missing.push("currentRunningFrequencyDaysPerWeek");
  }
  if (profile.longestRecentRunDistance === undefined) {
    missing.push("longestRecentRunDistance");
  }
  if (
    profile.availableTrainingDays === undefined ||
    profile.availableTrainingDays.length === 0
  ) {
    missing.push("availableTrainingDays");
  }
  if (profile.preferredLongRunDay === undefined) {
    missing.push("preferredLongRunDay");
  }
  if (profile.completionGoal === undefined) missing.push("completionGoal");

  return missing;
}

export function createPlanGenerationInputFromProfile(
  profile: UserProfile,
  options: PlanGenerationInputOptions,
): PlanGenerationInputFromProfileResult {
  const missingFields = missingProfileFields(profile);
  const {
    availableTrainingDays,
    completionGoal,
    currentRunningFrequencyDaysPerWeek,
    currentWeeklyDistance,
    experienceLevel,
    longestRecentRunDistance,
    preferredLongRunDay,
    targetRace,
  } = profile;
  if (
    experienceLevel === undefined ||
    (experienceLevel === "consistent" &&
      profile.consistentRunningWeeks === undefined) ||
    targetRace === undefined ||
    currentWeeklyDistance === undefined ||
    currentRunningFrequencyDaysPerWeek === undefined ||
    longestRecentRunDistance === undefined ||
    availableTrainingDays === undefined ||
    availableTrainingDays.length === 0 ||
    preferredLongRunDay === undefined ||
    completionGoal === undefined
  ) {
    return { kind: "incomplete_profile", missingFields };
  }

  const input: PlanGenerationInputV1 = {
    schemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
    rulesetVersion: options.rulesetVersion,
    planStartDate: options.planStartDate,
    runner: {
      experienceLevel,
      ...(profile.consistentRunningWeeks === undefined
        ? {}
        : { consistentRunningWeeks: profile.consistentRunningWeeks }),
      targetRace:
        targetRace.kind === "date"
          ? { kind: "date", date: targetRace.date }
          : {
              kind: "window",
              startDate: targetRace.startDate,
              endDate: targetRace.endDate,
            },
      currentWeeklyDistance,
      currentRunningFrequencyDaysPerWeek,
      longestRecentRunDistance,
      ...(profile.recentPerformance === undefined
        ? {}
        : {
            recentPerformance: {
              completedOn: profile.recentPerformance.completedOn,
              distance: profile.recentPerformance.distance,
              duration: profile.recentPerformance.duration,
            },
          }),
      availableTrainingDays: [...availableTrainingDays],
      preferredLongRunDay,
      ...(profile.scheduleConstraints === undefined
        ? {}
        : { scheduleConstraints: profile.scheduleConstraints }),
      completionGoal,
      safetySignal: options.safetySignal,
    },
  };
  const issues = validatePlanGenerationInput(input);

  return issues.length === 0
    ? { kind: "ready", input }
    : { kind: "invalid_input", issues };
}
