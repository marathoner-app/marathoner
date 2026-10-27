import {
  createDateOnly,
  type DateOnly,
  type DeterministicPlanRulesV1,
  type UserProfile,
  type Weekday,
} from "../domain/training";

const weekdaysByUtcIndex: readonly Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export interface InternalPlanStartDateCandidate {
  readonly date: DateOnly;
  readonly wholeWeeksToRace: number;
}

export type InternalPlanStartDateCandidateResult =
  | {
      readonly kind: "available";
      readonly candidates: readonly InternalPlanStartDateCandidate[];
    }
  | {
      readonly kind: "unavailable";
      readonly reason:
        | "profile_incomplete"
        | "race_window"
        | "race_weekday_mismatch";
    };

function utcDate(value: DateOnly): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function weekdayForDate(value: DateOnly): Weekday {
  const weekday = weekdaysByUtcIndex[utcDate(value).getUTCDay()];
  if (weekday === undefined) {
    throw new Error("Unable to resolve the internal rehearsal race weekday.");
  }
  return weekday;
}

function subtractDays(value: DateOnly, days: number): DateOnly {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() - days);
  return createDateOnly(date.toISOString().slice(0, 10));
}

export function createInternalPlanStartDateCandidates(
  profile: UserProfile | null,
  rules: Pick<DeterministicPlanRulesV1, "wholeWeeksFromPlanStartToRace">,
): InternalPlanStartDateCandidateResult {
  if (
    profile?.targetRace === undefined ||
    profile.preferredLongRunDay === undefined
  ) {
    return { kind: "unavailable", reason: "profile_incomplete" };
  }

  if (profile.targetRace.kind !== "date") {
    return { kind: "unavailable", reason: "race_window" };
  }

  if (
    weekdayForDate(profile.targetRace.date) !== profile.preferredLongRunDay
  ) {
    return { kind: "unavailable", reason: "race_weekday_mismatch" };
  }

  const { minimum, maximum } = rules.wholeWeeksFromPlanStartToRace;
  if (
    !Number.isInteger(minimum) ||
    !Number.isInteger(maximum) ||
    minimum <= 0 ||
    maximum < minimum
  ) {
    throw new Error("The internal rehearsal race horizon is invalid.");
  }

  const candidates: InternalPlanStartDateCandidate[] = [];
  for (let wholeWeeks = maximum; wholeWeeks >= minimum; wholeWeeks -= 1) {
    candidates.push({
      date: subtractDays(
        profile.targetRace.date,
        wholeWeeks * 7 - 1,
      ),
      wholeWeeksToRace: wholeWeeks,
    });
  }

  return { kind: "available", candidates };
}

export function formatInternalPlanStartDate(value: DateOnly): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(utcDate(value));
}
