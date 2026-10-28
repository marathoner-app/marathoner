import {
  createDateOnly,
  type AdaptationEvaluationRulesV1,
  type AdaptationHistoryEvidenceV1,
  type AdaptationRescheduleCandidateV1,
  type DateOnly,
  type PlannedWorkout,
  type TrainingPlan,
} from "../domain/training";

export interface InternalSessionDraftRescheduleCandidate {
  readonly targetDate: DateOnly;
  readonly candidate: AdaptationRescheduleCandidateV1;
}

interface DeriveInternalSessionDraftRescheduleCandidatesRequest {
  readonly plan: TrainingPlan;
  readonly workouts: readonly PlannedWorkout[];
  readonly evidence: AdaptationHistoryEvidenceV1;
  readonly rules: Pick<
    AdaptationEvaluationRulesV1,
    | "allowedReschedulePurposes"
    | "maximumRescheduleDelayDays"
    | "maximumConsecutiveRunDatesAfterReschedule"
  >;
}

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

function calendarDay(value: DateOnly): number {
  return Date.parse(`${value}T00:00:00.000Z`) / DAY_MILLISECONDS;
}

function shiftDate(value: DateOnly, days: number): DateOnly {
  const shifted = new Date(`${value}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return createDateOnly(shifted.toISOString().slice(0, 10));
}

function planWeekNumber(plan: TrainingPlan, value: DateOnly): number | null {
  const dayOffset = calendarDay(value) - calendarDay(plan.startDate);
  return dayOffset < 0 ? null : Math.floor(dayOffset / 7) + 1;
}

function maximumConsecutiveDates(dates: readonly DateOnly[]): number {
  const uniqueDays = [...new Set(dates.map(calendarDay))].sort(
    (left, right) => left - right,
  );
  let maximum = 0;
  let current = 0;
  let previous: number | null = null;

  for (const day of uniqueDays) {
    current = previous !== null && day === previous + 1 ? current + 1 : 1;
    maximum = Math.max(maximum, current);
    previous = day;
  }

  return maximum;
}

/**
 * Derives schedule facts for the owner-only session rehearsal.
 *
 * Availability deliberately remains false because only the runner can confirm
 * that fact in the interface.
 */
export function deriveInternalSessionDraftRescheduleCandidates({
  plan,
  workouts,
  evidence,
  rules,
}: DeriveInternalSessionDraftRescheduleCandidatesRequest): readonly InternalSessionDraftRescheduleCandidate[] {
  if (
    evidence.triggerKind !== "planned_run_skipped" ||
    !Number.isSafeInteger(rules.maximumRescheduleDelayDays) ||
    rules.maximumRescheduleDelayDays < 1 ||
    !Number.isSafeInteger(
      rules.maximumConsecutiveRunDatesAfterReschedule,
    ) ||
    rules.maximumConsecutiveRunDatesAfterReschedule < 1
  ) {
    return [];
  }

  const trigger = workouts.find(
    (workout) =>
      workout.planId === plan.id && workout.id === evidence.triggerWorkoutId,
  );
  if (
    trigger === undefined ||
    trigger.kind !== "run" ||
    trigger.status !== "skipped" ||
    !rules.allowedReschedulePurposes.includes(trigger.purpose)
  ) {
    return [];
  }

  const triggerWeekNumber = planWeekNumber(plan, trigger.scheduledDate);
  if (triggerWeekNumber === null) return [];

  const planWorkouts = workouts.filter((workout) => workout.planId === plan.id);
  const occupiedDates = new Set(
    planWorkouts.flatMap((workout) =>
      workout.kind === "rest" ? [] : [workout.scheduledDate],
    ),
  );
  const otherRunDatesInWeek = planWorkouts.flatMap((workout) => {
    if (
      workout.id === trigger.id ||
      workout.kind === "rest" ||
      planWeekNumber(plan, workout.scheduledDate) !== triggerWeekNumber
    ) {
      return [];
    }
    return [workout.scheduledDate];
  });

  const candidates: InternalSessionDraftRescheduleCandidate[] = [];
  for (
    let delayCalendarDays = 1;
    delayCalendarDays <= rules.maximumRescheduleDelayDays;
    delayCalendarDays += 1
  ) {
    const targetDate = shiftDate(trigger.scheduledDate, delayCalendarDays);
    if (
      planWeekNumber(plan, targetDate) !== triggerWeekNumber ||
      occupiedDates.has(targetDate)
    ) {
      continue;
    }

    const consecutiveRunDatesAfterMove = maximumConsecutiveDates([
      ...otherRunDatesInWeek,
      targetDate,
    ]);
    if (
      consecutiveRunDatesAfterMove >
      rules.maximumConsecutiveRunDatesAfterReschedule
    ) {
      continue;
    }

    candidates.push({
      targetDate,
      candidate: {
        present: true,
        workoutPurpose: trigger.purpose,
        delayCalendarDays,
        samePlanWeek: true,
        runnerConfirmedAvailable: false,
        targetDateEmpty: true,
        consecutiveRunDatesAfterMove,
      },
    });
  }

  return candidates;
}
