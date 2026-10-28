import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDistanceMeters,
  metersToKilometers,
  metersToMiles,
  type DateOnly,
  type DistanceMeters,
  type DistanceUnit,
  type PlannedWorkout,
  type TrainingPlan,
} from "../domain/training";

type CalendarProps = {
  readonly plan: TrainingPlan | null;
  readonly workouts: readonly PlannedWorkout[];
  readonly distanceUnit: DistanceUnit;
  readonly initialDate?: DateOnly;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const dateRangeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function addDays(date: string, numberOfDays: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + numberOfDays);
  return value.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  return Math.floor(
    (Date.parse(`${end}T00:00:00.000Z`) -
      Date.parse(`${start}T00:00:00.000Z`)) /
      86_400_000,
  );
}

function workoutLabel(workout: PlannedWorkout): string {
  if (workout.kind === "rest") return "Rest";
  if (workout.kind === "walk_run") return "Walk/run";
  return `${formatLabel(workout.purpose)} run`;
}

function formatLabel(value: string): string {
  const label = value.split("_").join(" ");
  return `${label[0].toUpperCase()}${label.slice(1)}`;
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatShortDate(value: string): string {
  return dateRangeFormatter.format(new Date(`${value}T00:00:00.000Z`));
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

function formatDistance(
  distance: DistanceMeters,
  distanceUnit: DistanceUnit,
): string {
  const value =
    distanceUnit === "mile"
      ? metersToMiles(distance)
      : metersToKilometers(distance);
  return `${Number(value.toFixed(1))} ${distanceUnit === "mile" ? "mi" : "km"}`;
}

function workoutTarget(
  workout: PlannedWorkout,
  distanceUnit: DistanceUnit,
): string | null {
  if (workout.kind === "rest") return null;

  const targets: string[] = [];
  if (workout.targetDistance !== undefined) {
    targets.push(formatDistance(workout.targetDistance, distanceUnit));
  }
  if (workout.targetDuration !== undefined) {
    targets.push(formatDuration(workout.targetDuration));
  }

  return targets.length === 0 ? null : targets.join(" · ");
}

function workoutStatusLabel(workout: PlannedWorkout): string {
  if (workout.status === "planned") return "Scheduled";
  return formatLabel(workout.status);
}

function workoutColorClass(workout: PlannedWorkout): string {
  if (workout.kind === "rest") return "rest-day";
  if (workout.kind === "walk_run") return "easy-run";
  return `${workout.purpose.replace("_", "-")}-run`;
}

export default function Calendar({
  plan,
  workouts,
  distanceUnit,
  initialDate,
}: CalendarProps) {
  const [selectedWorkout, setSelectedWorkout] =
    useState<PlannedWorkout | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const workoutDialogHeadingRef = useRef<HTMLHeadingElement>(null);
  const workoutDialogCloseRef = useRef<HTMLButtonElement>(null);
  const workoutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const weekCount = useMemo(() => {
    if (plan === null) return 0;
    const calendarEndDate = plan.endDate ?? plan.targetRaceDate;
    return Math.max(
      1,
      Math.ceil((daysBetween(plan.startDate, calendarEndDate) + 1) / 7),
    );
  }, [plan]);
  const initialWeek = useMemo(() => {
    if (plan === null || initialDate === undefined) return 1;

    const weekForDate =
      Math.floor(daysBetween(plan.startDate, initialDate) / 7) + 1;
    return Math.min(weekCount, Math.max(1, weekForDate));
  }, [initialDate, plan, weekCount]);

  useEffect(() => {
    setSelectedWeek(initialWeek);
    setSelectedWorkout(null);
  }, [initialWeek, plan?.id]);

  useEffect(() => {
    if (selectedWorkout !== null) {
      workoutDialogHeadingRef.current?.focus();
      return;
    }

    if (workoutTriggerRef.current?.isConnected) {
      workoutTriggerRef.current.focus();
    }
  }, [selectedWorkout]);

  const closeWorkoutDetails = () => setSelectedWorkout(null);

  if (plan === null) {
    return (
      <p className="training-empty-state">
        No training plan yet. Your plan will appear here once it has been created.
      </p>
    );
  }

  const weekStart = addDays(plan.startDate, (selectedWeek - 1) * 7);
  const weekEnd = addDays(weekStart, 6);
  const weekWorkouts = workouts
    .filter(
      (workout) =>
        workout.planId === plan.id &&
        workout.scheduledDate >= weekStart &&
        workout.scheduledDate <= weekEnd,
    )
    .slice()
    .sort((left, right) =>
      left.scheduledDate.localeCompare(right.scheduledDate),
    );
  const targetDistance = weekWorkouts.reduce(
    (total, workout) =>
      total +
      (workout.kind === "rest" || workout.targetDistance === undefined
        ? 0
        : workout.targetDistance),
    0,
  );
  const trainingWorkouts = weekWorkouts.filter(
    (workout) => workout.kind !== "rest",
  );
  const completedWorkoutCount = trainingWorkouts.filter(
    (workout) => workout.status === "completed",
  ).length;
  const phases = Array.from(
    new Set(weekWorkouts.map((workout) => formatLabel(workout.phase))),
  );
  const phaseSummary = phases.length > 0 ? phases.join(" / ") : "Not scheduled";
  const progressSummary =
    weekWorkouts.length === 0
      ? "No workouts scheduled"
      : trainingWorkouts.length === 0
      ? "Rest week"
      : `${completedWorkoutCount} of ${trainingWorkouts.length} workouts complete`;

  return (
    <div className="plan-container">
      <div className="plan-header">
        <div className="plan-heading">
          <p className="plan-name">{plan.name}</p>
          <h2 className="section-heading">
            Week {selectedWeek} of {weekCount}
          </h2>
          <p className="plan-week-dates">
            <time dateTime={weekStart}>{formatShortDate(weekStart)}</time>
            {"–"}
            <time dateTime={weekEnd}>{formatShortDate(weekEnd)}</time>
          </p>
        </div>

        <nav className="plan-week-controls" aria-label="Training week navigation">
          <button
            type="button"
            onClick={() => setSelectedWeek((week) => week - 1)}
            disabled={selectedWeek === 1}
          >
            Previous week
          </button>
          <label>
            Jump to week
            <select
              aria-label="Training week"
              className="week-selector"
              value={selectedWeek}
              onChange={(event) => setSelectedWeek(Number(event.target.value))}
            >
              {Array.from({ length: weekCount }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSelectedWeek((week) => week + 1)}
            disabled={selectedWeek === weekCount}
          >
            Next week
          </button>
        </nav>

        <dl className="plan-week-summary" aria-label="Selected week summary">
          <div>
            <dt>Phase</dt>
            <dd>{phaseSummary}</dd>
          </div>
          <div>
            <dt>Target distance</dt>
            <dd>
              {formatDistance(createDistanceMeters(targetDistance), distanceUnit)}
            </dd>
          </div>
          <div>
            <dt>Progress</dt>
            <dd>{progressSummary}</dd>
          </div>
        </dl>
      </div>

      {weekWorkouts.length === 0 ? (
        <p className="training-empty-state">No workouts are scheduled this week.</p>
      ) : (
        <ol className="plan-grid" aria-label={`Workouts for week ${selectedWeek}`}>
          {weekWorkouts.map((workout) => (
            <li key={workout.id}>
              <button
                type="button"
                className={`plan-day ${workoutColorClass(workout)} ${workout.status}`}
                onClick={(event) => {
                  workoutTriggerRef.current = event.currentTarget;
                  setSelectedWorkout(workout);
                }}
              >
                <span className="plan-day-date">
                  <time dateTime={workout.scheduledDate}>
                    {formatDate(workout.scheduledDate)}
                  </time>
                </span>
                <span className="plan-day-workout">{workoutLabel(workout)}</span>
                <span className="plan-day-meta">
                  {workoutTarget(workout, distanceUnit) ?? "No training target"}
                </span>
                <span className={`plan-day-status ${workout.status}`}>
                  {workoutStatusLabel(workout)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {selectedWorkout && (
        <div
          className="plan-modal-overlay"
          onClick={closeWorkoutDetails}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              closeWorkoutDetails();
              return;
            }

            if (event.key === "Tab") {
              event.preventDefault();
              workoutDialogCloseRef.current?.focus();
            }
          }}
        >
          <div
            className="plan-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workout-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="workout-detail-title"
              ref={workoutDialogHeadingRef}
              tabIndex={-1}
            >
              {workoutLabel(selectedWorkout)}
            </h3>
            <p className="plan-modal-date">
              <time dateTime={selectedWorkout.scheduledDate}>
                {formatDate(selectedWorkout.scheduledDate)}
              </time>
            </p>
            <dl className="plan-workout-details">
              <div>
                <dt>Status</dt>
                <dd>{workoutStatusLabel(selectedWorkout)}</dd>
              </div>
              <div>
                <dt>Phase</dt>
                <dd>{formatLabel(selectedWorkout.phase)}</dd>
              </div>
              {selectedWorkout.kind !== "rest" &&
                selectedWorkout.targetDistance !== undefined && (
                  <div>
                    <dt>Target distance</dt>
                    <dd>
                      {formatDistance(
                        selectedWorkout.targetDistance,
                        distanceUnit,
                      )}
                    </dd>
                  </div>
                )}
              {selectedWorkout.kind !== "rest" &&
                selectedWorkout.targetDuration !== undefined && (
                  <div>
                    <dt>Target time</dt>
                    <dd>{formatDuration(selectedWorkout.targetDuration)}</dd>
                  </div>
                )}
            </dl>
            {selectedWorkout.notes && (
              <div className="plan-workout-notes">
                <h4>Workout notes</h4>
                <p>{selectedWorkout.notes}</p>
              </div>
            )}
            <button
              ref={workoutDialogCloseRef}
              type="button"
              onClick={closeWorkoutDetails}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
