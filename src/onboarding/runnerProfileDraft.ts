import {
  createDateOnly,
  createDurationSeconds,
  createIanaTimeZone,
  kilometersToMeters,
  metersToKilometers,
  metersToMiles,
  milesToMeters,
  type DistanceMeters,
  type DistanceUnit,
  type RunningExperienceLevel,
  type UserProfile,
  type Weekday,
} from "../domain/training";
import type { SaveUserProfileInput } from "../persistence/trainingRepositories";

export type RaceTimingMode = "" | "date" | "window";

export interface RunnerProfileDraft {
  readonly displayName: string;
  readonly preferredDistanceUnit: DistanceUnit;
  readonly experienceLevel: "" | RunningExperienceLevel;
  readonly raceTimingMode: RaceTimingMode;
  readonly raceDate: string;
  readonly raceWindowStartDate: string;
  readonly raceWindowEndDate: string;
  readonly currentWeeklyDistance: string;
  readonly currentRunningFrequencyDaysPerWeek: string;
  readonly longestRecentRunDistance: string;
  readonly recentPerformanceDate: string;
  readonly recentPerformanceDistance: string;
  readonly recentPerformanceDurationMinutes: string;
  readonly availableTrainingDays: readonly Weekday[];
  readonly preferredLongRunDay: "" | Weekday;
  readonly scheduleConstraints: string;
  readonly completionGoalConfirmed: boolean;
}

export type RunnerProfileDraftField =
  | "displayName"
  | "experienceLevel"
  | "targetRace"
  | "currentWeeklyDistance"
  | "currentRunningFrequencyDaysPerWeek"
  | "longestRecentRunDistance"
  | "recentPerformance"
  | "availableTrainingDays"
  | "preferredLongRunDay"
  | "scheduleConstraints"
  | "completionGoal";

export type RunnerProfileDraftErrors = Partial<
  Record<RunnerProfileDraftField, string>
>;

function formatDistance(
  distance: DistanceMeters | undefined,
  unit: DistanceUnit,
): string {
  if (distance === undefined) return "";

  const value =
    unit === "mile" ? metersToMiles(distance) : metersToKilometers(distance);
  return String(Number(value.toFixed(2)));
}

export function createRunnerProfileDraft(
  profile: UserProfile | null,
): RunnerProfileDraft {
  const unit = profile?.preferredDistanceUnit ?? "mile";
  const targetRace = profile?.targetRace;
  const recentPerformance = profile?.recentPerformance;

  return {
    displayName: profile?.displayName ?? "",
    preferredDistanceUnit: unit,
    experienceLevel: profile?.experienceLevel ?? "",
    raceTimingMode: targetRace?.kind ?? "",
    raceDate: targetRace?.kind === "date" ? targetRace.date : "",
    raceWindowStartDate:
      targetRace?.kind === "window" ? targetRace.startDate : "",
    raceWindowEndDate:
      targetRace?.kind === "window" ? targetRace.endDate : "",
    currentWeeklyDistance: formatDistance(
      profile?.currentWeeklyDistance,
      unit,
    ),
    currentRunningFrequencyDaysPerWeek:
      profile?.currentRunningFrequencyDaysPerWeek?.toString() ?? "",
    longestRecentRunDistance: formatDistance(
      profile?.longestRecentRunDistance,
      unit,
    ),
    recentPerformanceDate: recentPerformance?.completedOn ?? "",
    recentPerformanceDistance: formatDistance(recentPerformance?.distance, unit),
    recentPerformanceDurationMinutes:
      recentPerformance === undefined
        ? ""
        : String(Number((recentPerformance.duration / 60).toFixed(1))),
    availableTrainingDays: profile?.availableTrainingDays ?? [],
    preferredLongRunDay: profile?.preferredLongRunDay ?? "",
    scheduleConstraints: profile?.scheduleConstraints ?? "",
    completionGoalConfirmed:
      profile?.completionGoal === "complete_first_marathon",
  };
}

function isNonNegativeNumber(value: string): boolean {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
}

function isPositiveNumber(value: string): boolean {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) && parsed > 0;
}

function validateDate(value: string): boolean {
  try {
    createDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

export function validateRunnerProfileDraft(
  draft: RunnerProfileDraft,
  requireComplete: boolean,
): RunnerProfileDraftErrors {
  const errors: RunnerProfileDraftErrors = {};

  if (draft.displayName.length > 120) {
    errors.displayName = "Keep your display name to 120 characters or fewer.";
  }

  if (draft.scheduleConstraints.length > 500) {
    errors.scheduleConstraints =
      "Keep schedule constraints to 500 characters or fewer.";
  }

  if (requireComplete && draft.experienceLevel === "") {
    errors.experienceLevel = "Choose the option that best matches your recent running.";
  }

  if (draft.raceTimingMode === "date") {
    if (!validateDate(draft.raceDate)) {
      errors.targetRace = "Choose a valid marathon date.";
    }
  } else if (draft.raceTimingMode === "window") {
    if (
      !validateDate(draft.raceWindowStartDate) ||
      !validateDate(draft.raceWindowEndDate)
    ) {
      errors.targetRace = "Add valid beginning and ending dates for your target window.";
    } else if (draft.raceWindowEndDate < draft.raceWindowStartDate) {
      errors.targetRace = "The target window must end on or after it begins.";
    }
  } else if (requireComplete) {
    errors.targetRace = "Choose a marathon date or a target window.";
  }

  if (
    draft.currentWeeklyDistance !== "" &&
    !isNonNegativeNumber(draft.currentWeeklyDistance)
  ) {
    errors.currentWeeklyDistance = "Enter a distance of zero or more.";
  } else if (requireComplete && draft.currentWeeklyDistance === "") {
    errors.currentWeeklyDistance = "Enter your current weekly distance, including zero.";
  }

  const frequency = Number(draft.currentRunningFrequencyDaysPerWeek);
  if (
    draft.currentRunningFrequencyDaysPerWeek !== "" &&
    (!Number.isSafeInteger(frequency) || frequency < 0 || frequency > 7)
  ) {
    errors.currentRunningFrequencyDaysPerWeek =
      "Enter a whole number from zero through seven.";
  } else if (
    requireComplete &&
    draft.currentRunningFrequencyDaysPerWeek === ""
  ) {
    errors.currentRunningFrequencyDaysPerWeek =
      "Enter how many days you currently run each week.";
  }

  if (
    draft.longestRecentRunDistance !== "" &&
    !isNonNegativeNumber(draft.longestRecentRunDistance)
  ) {
    errors.longestRecentRunDistance = "Enter a distance of zero or more.";
  } else if (requireComplete && draft.longestRecentRunDistance === "") {
    errors.longestRecentRunDistance =
      "Enter your longest recent continuous run, including zero.";
  }

  const hasAnyRecentPerformance = [
    draft.recentPerformanceDate,
    draft.recentPerformanceDistance,
    draft.recentPerformanceDurationMinutes,
  ].some((value) => value !== "");
  if (
    hasAnyRecentPerformance &&
    (!validateDate(draft.recentPerformanceDate) ||
      !isPositiveNumber(draft.recentPerformanceDistance) ||
      !isPositiveNumber(draft.recentPerformanceDurationMinutes))
  ) {
    errors.recentPerformance =
      "For an optional recent effort, add its date, positive distance, and elapsed minutes.";
  }

  if (requireComplete && draft.availableTrainingDays.length === 0) {
    errors.availableTrainingDays = "Choose at least one day you can usually train.";
  }

  if (
    draft.preferredLongRunDay !== "" &&
    !draft.availableTrainingDays.includes(draft.preferredLongRunDay)
  ) {
    errors.preferredLongRunDay =
      "Choose a preferred long-run day from your available days.";
  } else if (requireComplete && draft.preferredLongRunDay === "") {
    errors.preferredLongRunDay = "Choose your preferred long-run day.";
  }

  if (requireComplete && !draft.completionGoalConfirmed) {
    errors.completionGoal =
      "Confirm that your current goal is to complete your first marathon.";
  }

  return errors;
}

function distanceToMeters(value: string, unit: DistanceUnit): DistanceMeters {
  const distance = Number(value);
  return unit === "mile"
    ? milesToMeters(distance)
    : kilometersToMeters(distance);
}

export function changeRunnerProfileDraftUnit(
  draft: RunnerProfileDraft,
  preferredDistanceUnit: DistanceUnit,
): RunnerProfileDraft {
  if (draft.preferredDistanceUnit === preferredDistanceUnit) return draft;

  const convert = (value: string) => {
    if (value === "" || !isNonNegativeNumber(value)) return value;
    return formatDistance(
      distanceToMeters(value, draft.preferredDistanceUnit),
      preferredDistanceUnit,
    );
  };

  return {
    ...draft,
    preferredDistanceUnit,
    currentWeeklyDistance: convert(draft.currentWeeklyDistance),
    longestRecentRunDistance: convert(draft.longestRecentRunDistance),
    recentPerformanceDistance: convert(draft.recentPerformanceDistance),
  };
}

export function runnerProfileDraftToInput(
  draft: RunnerProfileDraft,
  timeZone: string,
): SaveUserProfileInput {
  const displayName = draft.displayName.trim();
  const constraints = draft.scheduleConstraints.trim();
  const hasRecentPerformance = draft.recentPerformanceDate !== "";

  return {
    preferredDistanceUnit: draft.preferredDistanceUnit,
    timeZone: createIanaTimeZone(timeZone),
    ...(displayName === "" ? {} : { displayName }),
    ...(draft.experienceLevel === ""
      ? {}
      : { experienceLevel: draft.experienceLevel }),
    ...(draft.raceTimingMode === "date"
      ? {
          targetRace: {
            kind: "date" as const,
            date: createDateOnly(draft.raceDate),
          },
        }
      : draft.raceTimingMode === "window"
        ? {
            targetRace: {
              kind: "window" as const,
              startDate: createDateOnly(draft.raceWindowStartDate),
              endDate: createDateOnly(draft.raceWindowEndDate),
            },
          }
        : {}),
    ...(draft.currentWeeklyDistance === ""
      ? {}
      : {
          currentWeeklyDistance: distanceToMeters(
            draft.currentWeeklyDistance,
            draft.preferredDistanceUnit,
          ),
        }),
    ...(draft.currentRunningFrequencyDaysPerWeek === ""
      ? {}
      : {
          currentRunningFrequencyDaysPerWeek: Number(
            draft.currentRunningFrequencyDaysPerWeek,
          ),
        }),
    ...(draft.longestRecentRunDistance === ""
      ? {}
      : {
          longestRecentRunDistance: distanceToMeters(
            draft.longestRecentRunDistance,
            draft.preferredDistanceUnit,
          ),
        }),
    ...(hasRecentPerformance
      ? {
          recentPerformance: {
            completedOn: createDateOnly(draft.recentPerformanceDate),
            distance: distanceToMeters(
              draft.recentPerformanceDistance,
              draft.preferredDistanceUnit,
            ),
            duration: createDurationSeconds(
              Math.round(Number(draft.recentPerformanceDurationMinutes) * 60),
            ),
          },
        }
      : {}),
    ...(draft.availableTrainingDays.length === 0
      ? {}
      : { availableTrainingDays: draft.availableTrainingDays }),
    ...(draft.preferredLongRunDay === ""
      ? {}
      : { preferredLongRunDay: draft.preferredLongRunDay }),
    ...(constraints === "" ? {} : { scheduleConstraints: constraints }),
    ...(draft.completionGoalConfirmed
      ? { completionGoal: "complete_first_marathon" as const }
      : {}),
  };
}

export function isRunnerProfileOnboardingComplete(
  profile: UserProfile | null,
): boolean {
  return (
    profile?.experienceLevel !== undefined &&
    profile.targetRace !== undefined &&
    profile.currentWeeklyDistance !== undefined &&
    profile.currentRunningFrequencyDaysPerWeek !== undefined &&
    profile.longestRecentRunDistance !== undefined &&
    profile.availableTrainingDays !== undefined &&
    profile.availableTrainingDays.length > 0 &&
    profile.preferredLongRunDay !== undefined &&
    profile.completionGoal === "complete_first_marathon"
  );
}
