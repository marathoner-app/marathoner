import { useEffect, useMemo, useRef, useState } from "react";
import {
  metersToMiles,
  type PlannedWorkout,
  type TrainingPlan,
} from "../domain/training";

type CalendarProps = {
  readonly plan: TrainingPlan | null;
  readonly workouts: readonly PlannedWorkout[];
};

const workoutAbbr = {
  long: "LR",
  easy: "E",
  tempo: "T",
  recovery: "RR",
  intervals: "I",
  race: "RACE",
  walk_run: "WR",
  rest: "R",
} as const;

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
  return `${workout.purpose[0].toUpperCase()}${workout.purpose.slice(1)} run`;
}

function workoutAbbreviation(workout: PlannedWorkout): string {
  if (workout.kind === "rest") return workoutAbbr.rest;
  if (workout.kind === "walk_run") return workoutAbbr.walk_run;
  return workoutAbbr[workout.purpose];
}

function workoutColorClass(workout: PlannedWorkout): string {
  if (workout.kind === "rest") return "rest-day";
  if (workout.kind === "walk_run") return "easy-run";
  return `${workout.purpose.replace("_", "-")}-run`;
}

export default function Calendar({ plan, workouts }: CalendarProps) {
  const [selectedWorkout, setSelectedWorkout] =
    useState<PlannedWorkout | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const workoutDialogHeadingRef = useRef<HTMLHeadingElement>(null);
  const workoutDialogCloseRef = useRef<HTMLButtonElement>(null);
  const workoutTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setSelectedWeek(1);
    setSelectedWorkout(null);
  }, [plan?.id]);

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

  const weekCount = useMemo(() => {
    if (plan === null) return 0;
    return Math.max(1, Math.ceil((daysBetween(plan.startDate, plan.targetRaceDate) + 1) / 7));
  }, [plan]);

  if (plan === null) {
    return (
      <p className="training-empty-state">
        No training plan yet. Your plan will appear here once it has been created.
      </p>
    );
  }

  const weekStart = addDays(plan.startDate, (selectedWeek - 1) * 7);
  const weekEnd = addDays(weekStart, 6);
  const weekWorkouts = workouts.filter(
    (workout) =>
      workout.planId === plan.id &&
      workout.scheduledDate >= weekStart &&
      workout.scheduledDate <= weekEnd,
  );
  const targetMileage = weekWorkouts.reduce(
    (total, workout) =>
      total +
      (workout.kind === "rest" || workout.targetDistance === undefined
        ? 0
        : metersToMiles(workout.targetDistance)),
    0,
  );

  return (
    <div className="plan-container">
      <div className="plan-header">
        <h2 className="section-heading">
          {plan.name} Week{" "}
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
        </h2>
        <p>
          {weekStart} to {weekEnd}
        </p>
        <p>Target Mileage: {Number(targetMileage.toFixed(1))} mi</p>
      </div>

      {weekWorkouts.length === 0 ? (
        <p className="training-empty-state">No workouts are scheduled this week.</p>
      ) : (
        <div className="plan-grid">
          {weekWorkouts.map((workout) => (
            <button
              key={workout.id}
              type="button"
              className={`plan-day ${workoutColorClass(workout)} ${workout.status}`}
              onClick={(event) => {
                workoutTriggerRef.current = event.currentTarget;
                setSelectedWorkout(workout);
              }}
              aria-label={`${workout.scheduledDate}: ${workoutLabel(workout)}`}
            >
              <span className="plan-day-number">{workout.scheduledDate.slice(5)}</span>
              <span className="plan-day-abbr">
                {workoutAbbreviation(workout)}
              </span>
            </button>
          ))}
        </div>
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
              {selectedWorkout.scheduledDate} Details
            </h3>
            <p>
              <strong>Workout:</strong> {workoutLabel(selectedWorkout)}
            </p>
            <p>
              <strong>Status:</strong> {selectedWorkout.status}
            </p>
            {selectedWorkout.kind !== "rest" &&
              selectedWorkout.targetDistance !== undefined && (
                <p>
                  <strong>Distance:</strong>{" "}
                  {Number(metersToMiles(selectedWorkout.targetDistance).toFixed(1))} mi
                </p>
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
