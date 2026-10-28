import {
  createDateOnly,
  getRunLocalDate,
  metersToKilometers,
  metersToMiles,
  type CompletedRun,
  type CompletedRunId,
  type DateOnly,
  type DistanceUnit,
  type GeneratedPlanEntityProjection,
  type IanaTimeZone,
  type PlannedWorkout,
} from "../domain/training";
import "./InternalSessionTodayComparison.css";

interface InternalSessionTodayComparisonProps {
  readonly projection: GeneratedPlanEntityProjection | null;
  readonly runs: readonly CompletedRun[];
  readonly distanceUnit: DistanceUnit;
  readonly timeZone: IanaTimeZone;
  readonly today?: DateOnly;
  readonly onOpenTrack: (runId: CompletedRunId | null) => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeZone: "UTC",
});

function dateOnlyInTimeZone(timeZone: IanaTimeZone): DateOnly {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );

  return createDateOnly(`${parts.year}-${parts.month}-${parts.day}`);
}

function formatDate(value: DateOnly): string {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function readableLabel(value: string): string {
  const words = value.split("_").join(" ");
  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
}

function workoutName(workout: PlannedWorkout): string {
  if (workout.kind === "walk_run") return "Walk/run";
  if (workout.kind === "rest") return "Rest day";
  return `${readableLabel(workout.purpose)} run`;
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
  distance: CompletedRun["distance"],
  distanceUnit: DistanceUnit,
): string {
  const value =
    distanceUnit === "mile"
      ? metersToMiles(distance)
      : metersToKilometers(distance);
  return `${Number(value.toFixed(2))} ${distanceUnit === "mile" ? "mi" : "km"}`;
}

function workoutTarget(
  workout: Exclude<PlannedWorkout, { readonly kind: "rest" }>,
  distanceUnit: DistanceUnit,
): string | null {
  const parts: string[] = [];

  if (workout.targetDistance !== undefined) {
    parts.push(formatDistance(workout.targetDistance, distanceUnit));
  }
  if (workout.targetDuration !== undefined) {
    parts.push(formatDuration(workout.targetDuration));
  }

  return parts.length === 0 ? null : parts.join(" · ");
}

function dailyStatusMessage({
  hasTrainingWorkout,
  hasRestDay,
  hasRun,
}: {
  readonly hasTrainingWorkout: boolean;
  readonly hasRestDay: boolean;
  readonly hasRun: boolean;
}): string {
  if (hasTrainingWorkout) {
    return hasRun
      ? "A run is logged on today's draft workout day."
      : "Today's draft workout does not have a same-date run logged yet.";
  }

  if (hasRestDay) {
    return hasRun
      ? "A run is logged on today's draft rest day."
      : "No run is logged on today's draft rest day.";
  }

  return hasRun
    ? "A run is logged on a day with no draft workout."
    : "No draft workout or synchronized run is logged for today.";
}

export default function InternalSessionTodayComparison({
  projection,
  runs,
  distanceUnit,
  timeZone,
  today,
  onOpenTrack,
}: InternalSessionTodayComparisonProps) {
  if (projection === null) return null;

  const comparisonDate = today ?? dateOnlyInTimeZone(timeZone);
  const todaysWorkouts = projection.workouts.filter(
    (workout) => workout.scheduledDate === comparisonDate,
  );
  const trainingWorkouts = todaysWorkouts.filter(
    (workout): workout is Exclude<PlannedWorkout, { readonly kind: "rest" }> =>
      workout.kind !== "rest",
  );
  const hasRestDay = todaysWorkouts.some((workout) => workout.kind === "rest");
  const todaysRuns = runs.filter(
    (run) =>
      run.userId === projection.plan.userId &&
      getRunLocalDate(run) === comparisonDate,
  );
  const dailyStatus = dailyStatusMessage({
    hasTrainingWorkout: trainingWorkouts.length > 0,
    hasRestDay,
    hasRun: todaysRuns.length > 0,
  });
  const feedbackIsAvailable =
    trainingWorkouts.length > 0 && todaysRuns.length > 0;

  const focusSessionDraftFeedback = () => {
    document.getElementById("internal-session-draft-feedback")?.focus({
      preventScroll: true,
    });
  };

  return (
    <section
      id="internal-session-today-comparison"
      className="internal-session-today-comparison"
      aria-labelledby="internal-session-today-comparison-title"
    >
      <header>
        <p className="internal-session-today-comparison-eyebrow">
          Owner-only daily comparison
        </p>
        <h2 id="internal-session-today-comparison-title">
          Today in the session draft
        </h2>
        <p>
          <time dateTime={comparisonDate}>{formatDate(comparisonDate)}</time>
        </p>
      </header>

      <div className="internal-session-today-comparison-status">
        <p role="status" aria-label="Daily comparison status">
          <strong>Daily status:</strong> {dailyStatus}
        </p>
        <div className="internal-session-today-comparison-actions">
          <button
            type="button"
            onClick={() => onOpenTrack(todaysRuns[0]?.id ?? null)}
          >
            {todaysRuns.length > 0
              ? "Review runs in Track"
              : "Open Track to log a run"}
          </button>
          {feedbackIsAvailable && (
            <a
              href="#internal-session-draft-feedback"
              onClick={focusSessionDraftFeedback}
            >
              Rehearse feedback from today's run
            </a>
          )}
        </div>
      </div>

      <div className="internal-session-today-comparison-columns">
        <section aria-labelledby="internal-session-today-workout-title">
          <h3 id="internal-session-today-workout-title">Draft schedule</h3>
          {trainingWorkouts.length > 0 ? (
            <ul>
              {trainingWorkouts.map((workout) => {
                const target = workoutTarget(workout, distanceUnit);
                return (
                  <li key={workout.id}>
                    <strong>{workoutName(workout)}</strong>
                    {target !== null && <span>{target}</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>
              {hasRestDay
                ? "The session draft schedules a rest day today."
                : "No training workout is scheduled in the session draft today."}
            </p>
          )}
        </section>

        <section aria-labelledby="internal-session-today-runs-title">
          <h3 id="internal-session-today-runs-title">Synchronized runs</h3>
          {todaysRuns.length > 0 ? (
            <ul>
              {todaysRuns.map((run) => (
                <li key={run.id}>
                  <strong>{formatDistance(run.distance, distanceUnit)}</strong>
                  <span>{formatDuration(run.duration)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No synchronized run is logged for today.</p>
          )}
        </section>
      </div>

      <aside aria-label="Comparison boundary">
        Same-date comparison only. These runs are not associated with the draft
        plan or workouts, and no change is saved.
      </aside>
    </section>
  );
}
