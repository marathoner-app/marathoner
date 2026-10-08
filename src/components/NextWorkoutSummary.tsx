import { useId } from "react";
import {
  metersToKilometers,
  metersToMiles,
  type DistanceUnit,
  type PlannedWorkout,
  type TrainingPlan,
} from "../domain/training";

type NextWorkoutSummaryProps = {
  readonly plan: TrainingPlan | null;
  readonly workout: PlannedWorkout | null;
  readonly distanceUnit: DistanceUnit;
  readonly onOpenPlan: () => void;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatLabel(value: string): string {
  const label = value.split("_").join(" ");
  return `${label[0].toUpperCase()}${label.slice(1)}`;
}

function workoutName(workout: PlannedWorkout): string {
  if (workout.kind === "rest") return "Rest day";
  if (workout.kind === "walk_run") return "Walk/run";
  return `${formatLabel(workout.purpose)} run`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} hr`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (seconds > 0) parts.push(`${seconds} sec`);

  return parts.join(" ");
}

function workoutTarget(
  workout: PlannedWorkout,
  distanceUnit: DistanceUnit,
): string | null {
  if (workout.kind === "rest") return null;

  const targets: string[] = [];
  if (workout.targetDistance !== undefined) {
    const value =
      distanceUnit === "mile"
        ? metersToMiles(workout.targetDistance)
        : metersToKilometers(workout.targetDistance);
    targets.push(
      `${Number(value.toFixed(1))} ${distanceUnit === "mile" ? "mi" : "km"}`,
    );
  }
  if (workout.targetDuration !== undefined) {
    targets.push(formatDuration(workout.targetDuration));
  }

  return targets.length === 0 ? null : targets.join(" · ");
}

export default function NextWorkoutSummary({
  plan,
  workout,
  distanceUnit,
  onOpenPlan,
}: NextWorkoutSummaryProps) {
  const titleId = `${useId()}-title`;

  if (plan === null) {
    return (
      <section className="next-workout-summary empty" aria-labelledby={titleId}>
        <p className="next-workout-label">Next workout</p>
        <h2 id={titleId}>No active plan yet</h2>
        <p>Your next workout will appear here after a plan is approved.</p>
        <button type="button" onClick={onOpenPlan}>
          Open Plan
        </button>
      </section>
    );
  }

  if (workout === null) {
    return (
      <section className="next-workout-summary empty" aria-labelledby={titleId}>
        <p className="next-workout-label">Next workout</p>
        <h2 id={titleId}>No upcoming planned workouts</h2>
        <p>{plan.name} has no remaining planned workout on the calendar.</p>
        <button type="button" onClick={onOpenPlan}>
          Open Plan
        </button>
      </section>
    );
  }

  const target = workoutTarget(workout, distanceUnit);

  return (
    <section className="next-workout-summary" aria-labelledby={titleId}>
      <p className="next-workout-label">Next workout</p>
      <h2 id={titleId}>{workoutName(workout)}</h2>
      <p>
        <time dateTime={workout.scheduledDate}>
          {formatDate(workout.scheduledDate)}
        </time>
      </p>
      {target !== null && <p className="next-workout-target">{target}</p>}
      <button type="button" onClick={onOpenPlan}>
        Open Plan
      </button>
    </section>
  );
}
