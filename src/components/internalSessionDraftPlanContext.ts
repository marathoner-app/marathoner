import type {
  AdaptationEvaluationRulesV1,
  AdaptationWeekKind,
  DateOnly,
  DeterministicPlanRulesV1,
  TrainingPlan,
} from "../domain/training";
import type { InternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";

export interface InternalSessionDraftPlanContext {
  readonly currentCoreWeek: number;
  readonly currentWeekKind: AdaptationWeekKind;
  readonly nextWeekKind: AdaptationWeekKind;
  readonly nextWeekIntroducesProgression: boolean;
}

interface InternalSessionDraftPlanContextRequest {
  readonly plan: TrainingPlan;
  readonly evaluationDate: DateOnly;
  readonly basePlanRules: Pick<
    InternalPlanProposalRehearsalRuleSet,
    "coreWeekKinds"
  > & {
    readonly rules: Pick<
      DeterministicPlanRulesV1,
      "positionPurposes" | "leadInWeek" | "coreWeeks"
    >;
  };
  readonly adaptationRules: Pick<
    AdaptationEvaluationRulesV1,
    "supportedCoreWeeks"
  >;
}

export type InternalSessionDraftPlanContextResult =
  | {
      readonly kind: "ready";
      readonly context: InternalSessionDraftPlanContext;
    }
  | {
      readonly kind: "not_ready";
      readonly code: string;
      readonly message: string;
    };

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

function calendarDay(value: DateOnly): number {
  return Date.parse(`${value}T00:00:00.000Z`) / DAY_MILLISECONDS;
}

function notReady(
  code: string,
  message: string,
): InternalSessionDraftPlanContextResult {
  return { kind: "not_ready", code, message };
}

function weeklyDistance(
  week: DeterministicPlanRulesV1["coreWeeks"][number],
): number {
  return week.distancesMetersByPosition.reduce(
    (total, distance) => total + distance,
    0,
  );
}

export function deriveInternalSessionDraftPlanContext({
  plan,
  evaluationDate,
  basePlanRules,
  adaptationRules,
}: InternalSessionDraftPlanContextRequest): InternalSessionDraftPlanContextResult {
  const planStartDay = calendarDay(plan.startDate);
  const targetRaceDay = calendarDay(plan.targetRaceDate);
  const inclusivePreRaceDays = targetRaceDay - planStartDay + 1;
  if (
    inclusivePreRaceDays <= 0 ||
    !Number.isInteger(inclusivePreRaceDays / 7)
  ) {
    return notReady(
      "session_plan_horizon_invalid",
      "The session plan dates do not form whole training weeks through race day.",
    );
  }

  const coreWeeks = basePlanRules.rules.coreWeeks;
  if (
    coreWeeks.length === 0 ||
    basePlanRules.coreWeekKinds.length !== coreWeeks.length
  ) {
    return notReady(
      "session_plan_rules_invalid",
      "The pinned base-plan packet does not contain matching core-week context.",
    );
  }

  const preRaceWeekCount = inclusivePreRaceDays / 7;
  const leadInWeekCount = preRaceWeekCount - coreWeeks.length;
  if (leadInWeekCount < 0) {
    return notReady(
      "session_plan_horizon_invalid",
      "The session plan is shorter than the pinned base-plan core.",
    );
  }

  const evaluationDayOffset = calendarDay(evaluationDate) - planStartDay;
  const planWeekNumber = Math.floor(evaluationDayOffset / 7) + 1;
  const currentCoreWeek = planWeekNumber - leadInWeekCount;
  const { minimum, maximum } = adaptationRules.supportedCoreWeeks;
  if (
    evaluationDayOffset < 0 ||
    currentCoreWeek < minimum ||
    currentCoreWeek > maximum
  ) {
    return notReady(
      "session_plan_week_unsupported",
      "The trigger falls outside the core weeks supported by the pinned adaptation draft.",
    );
  }

  const nextCoreWeek = currentCoreWeek + 1;
  const currentWeekKind = basePlanRules.coreWeekKinds[currentCoreWeek - 1];
  const nextWeekKind = basePlanRules.coreWeekKinds[nextCoreWeek - 1];
  const nextWeekRule = coreWeeks[nextCoreWeek - 1];
  if (
    currentWeekKind === undefined ||
    nextWeekKind === undefined ||
    nextWeekRule === undefined
  ) {
    return notReady(
      "session_plan_week_context_missing",
      "The pinned base-plan packet has no complete current-and-next-week context for this trigger.",
    );
  }

  const longRunPosition = basePlanRules.rules.positionPurposes.indexOf("long");
  const earlierWeeks = [
    ...(leadInWeekCount > 0 ? [basePlanRules.rules.leadInWeek] : []),
    ...coreWeeks.slice(0, nextCoreWeek - 1),
  ];
  if (
    longRunPosition < 0 ||
    earlierWeeks.length === 0 ||
    nextWeekRule.distancesMetersByPosition[longRunPosition] === undefined ||
    earlierWeeks.some(
      (week) => week.distancesMetersByPosition[longRunPosition] === undefined,
    )
  ) {
    return notReady(
      "session_plan_progression_context_missing",
      "The pinned base-plan packet cannot determine weekly and long-run progression for this trigger.",
    );
  }

  const previousWeeklyHigh = Math.max(...earlierWeeks.map(weeklyDistance));
  const previousLongRunHigh = Math.max(
    ...earlierWeeks.map(
      (week) => week.distancesMetersByPosition[longRunPosition] as number,
    ),
  );
  const nextLongRun = nextWeekRule.distancesMetersByPosition[
    longRunPosition
  ] as number;

  return {
    kind: "ready",
    context: {
      currentCoreWeek,
      currentWeekKind,
      nextWeekKind,
      nextWeekIntroducesProgression:
        weeklyDistance(nextWeekRule) > previousWeeklyHigh ||
        nextLongRun > previousLongRunHigh,
    },
  };
}
