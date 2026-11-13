import { createDateOnly, type DateOnly } from "./dates";
import type { DeterministicPlanRulesV1 } from "./deterministicPlanGenerator";
import type { UserProfile } from "./types";

export interface PlanStartDateCandidate {
  readonly date: DateOnly;
  readonly wholeWeeksToRace: number;
}

export type PlanStartDateCandidateResult =
  | {
      readonly kind: "available";
      readonly candidates: readonly PlanStartDateCandidate[];
    }
  | {
      readonly kind: "unavailable";
      readonly reason:
        | "profile_incomplete"
        | "race_window"
        | "recent_effort_after_supported_start_window"
        | "supported_start_window_has_passed";
    };

interface PlanStartDateCandidateOptions {
  readonly notBefore?: DateOnly;
}

function utcDate(value: DateOnly): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function subtractDays(value: DateOnly, days: number): DateOnly {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() - days);
  return createDateOnly(date.toISOString().slice(0, 10));
}

export function createPlanStartDateCandidates(
  profile: UserProfile | null,
  rules: Pick<DeterministicPlanRulesV1, "wholeWeeksFromPlanStartToRace">,
  options: PlanStartDateCandidateOptions = {},
): PlanStartDateCandidateResult {
  if (
    profile?.targetRace === undefined ||
    profile.preferredLongRunDay === undefined
  ) {
    return { kind: "unavailable", reason: "profile_incomplete" };
  }

  if (profile.targetRace.kind !== "date") {
    return { kind: "unavailable", reason: "race_window" };
  }

  const { minimum, maximum } = rules.wholeWeeksFromPlanStartToRace;
  if (
    !Number.isInteger(minimum) ||
    !Number.isInteger(maximum) ||
    minimum <= 0 ||
    maximum < minimum
  ) {
    throw new Error("The plan race horizon is invalid.");
  }

  const horizonCandidates: PlanStartDateCandidate[] = [];
  for (let wholeWeeks = maximum; wholeWeeks >= minimum; wholeWeeks -= 1) {
    const candidate = {
      date: subtractDays(profile.targetRace.date, wholeWeeks * 7 - 1),
      wholeWeeksToRace: wholeWeeks,
    };
    if (
      profile.recentPerformance === undefined ||
      candidate.date >= profile.recentPerformance.completedOn
    ) {
      horizonCandidates.push(candidate);
    }
  }

  if (horizonCandidates.length === 0 && profile.recentPerformance !== undefined) {
    return {
      kind: "unavailable",
      reason: "recent_effort_after_supported_start_window",
    };
  }

  const notBefore = options.notBefore;
  const candidates =
    notBefore === undefined
      ? horizonCandidates
      : horizonCandidates.filter(({ date }) => date >= notBefore);

  if (candidates.length === 0 && options.notBefore !== undefined) {
    return {
      kind: "unavailable",
      reason: "supported_start_window_has_passed",
    };
  }

  return { kind: "available", candidates };
}

export function formatPlanStartDate(value: DateOnly): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(utcDate(value));
}
