import { createDateOnly, type DateOnly, type IanaTimeZone } from "./dates.js";
import type { PlannedWorkout, TrainingPlan } from "./types.js";

function dateOnlyInTimeZone(
  timeZone: IanaTimeZone,
  instant: Date,
): DateOnly {
  if (Number.isNaN(instant.getTime())) {
    throw new Error("The current instant must be a valid date.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = Object.fromEntries(
    parts
      .filter(({ type }) => type === "year" || type === "month" || type === "day")
      .map(({ type, value: partValue }) => [type, partValue]),
  );

  return createDateOnly(`${value.year}-${value.month}-${value.day}`);
}

export function selectNextPlannedWorkout(
  plan: TrainingPlan | null,
  workouts: readonly PlannedWorkout[],
  timeZone: IanaTimeZone,
  instant = new Date(),
): PlannedWorkout | null {
  if (plan === null || plan.status !== "active") {
    return null;
  }

  const currentDate = dateOnlyInTimeZone(timeZone, instant);

  return (
    workouts
      .filter(
        (workout) =>
          workout.planId === plan.id &&
          workout.userId === plan.userId &&
          workout.status === "planned" &&
          workout.scheduledDate >= currentDate,
      )
      .sort(
        (left, right) =>
          left.scheduledDate.localeCompare(right.scheduledDate) ||
          left.id.localeCompare(right.id),
      )[0] ?? null
  );
}
