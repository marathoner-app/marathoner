import { useMemo, useState, type FormEvent } from "react";
import {
  createUtcDateTime,
  getRunLocalDate,
  metersToKilometers,
  metersToMiles,
  type CompletedRun,
  type DistanceUnit,
  type GeneratedPlanEntityProjection,
  type PlannedWorkout,
  type PlannedWorkoutId,
} from "../domain/training";
import InternalLiveAdaptationRehearsal from "./InternalLiveAdaptationRehearsal";
import "./InternalAdaptationHistoryInspector.css";
import type { InternalAdaptationScenarioPacket } from "./internalAdaptationScenarioPacket";
import {
  assembleInternalSessionDraftAdaptation,
  type InternalSessionDraftAdaptationAssembly,
} from "./internalSessionDraftAdaptation";

interface InternalSessionDraftFeedbackRehearsalProps {
  readonly projection: GeneratedPlanEntityProjection | null;
  readonly runs: readonly CompletedRun[];
  readonly distanceUnit: DistanceUnit;
  readonly draftPacket: InternalAdaptationScenarioPacket;
}

interface ConfirmedPair {
  readonly workoutId: PlannedWorkoutId;
  readonly runId: CompletedRun["id"];
  readonly confirmedAt: ReturnType<typeof createUtcDateTime>;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function readableLabel(value: string): string {
  const words = value.split("_").join(" ");
  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
}

function workoutLabel(workout: Exclude<PlannedWorkout, { kind: "rest" }>): string {
  const workoutName =
    workout.kind === "walk_run"
      ? "Walk/run"
      : `${readableLabel(workout.purpose)} run`;
  return `${formatDate(workout.scheduledDate)} · ${workoutName}`;
}

function runLabel(run: CompletedRun, distanceUnit: DistanceUnit): string {
  const distance =
    distanceUnit === "mile"
      ? metersToMiles(run.distance)
      : metersToKilometers(run.distance);
  const unit = distanceUnit === "mile" ? "mi" : "km";
  const minutes = Math.round(run.duration / 60);
  return `${Number(distance.toFixed(2))} ${unit} · ${minutes} min`;
}

export default function InternalSessionDraftFeedbackRehearsal({
  projection,
  runs,
  distanceUnit,
  draftPacket,
}: InternalSessionDraftFeedbackRehearsalProps) {
  const [selectedWorkoutId, setSelectedWorkoutId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [confirmedPair, setConfirmedPair] = useState<ConfirmedPair | null>(null);

  const eligibleWorkouts = useMemo(() => {
    if (projection === null) return [];

    return projection.workouts.filter(
      (
        workout,
      ): workout is Exclude<PlannedWorkout, { readonly kind: "rest" }> =>
        workout.kind !== "rest" &&
        runs.some(
          (run) =>
            run.userId === projection.plan.userId &&
            getRunLocalDate(run) === workout.scheduledDate,
        ),
    );
  }, [projection, runs]);

  const selectedWorkout = eligibleWorkouts.find(
    (workout) => workout.id === selectedWorkoutId,
  );
  const eligibleRuns = useMemo(() => {
    if (projection === null || selectedWorkout === undefined) return [];

    return runs.filter(
      (run) =>
        run.userId === projection.plan.userId &&
        getRunLocalDate(run) === selectedWorkout.scheduledDate,
    );
  }, [projection, runs, selectedWorkout]);

  const assembly = useMemo<InternalSessionDraftAdaptationAssembly | null>(() => {
    if (projection === null || confirmedPair === null) return null;
    const run = runs.find((candidate) => candidate.id === confirmedPair.runId);
    if (run === undefined) return null;

    return assembleInternalSessionDraftAdaptation({
      projection,
      workoutId: confirmedPair.workoutId,
      run,
      confirmedAt: confirmedPair.confirmedAt,
    });
  }, [confirmedPair, projection, runs]);

  if (projection === null) return null;

  const clearConfirmation = () => setConfirmedPair(null);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const workout = eligibleWorkouts.find(
      (candidate) => candidate.id === selectedWorkoutId,
    );
    const run = eligibleRuns.find((candidate) => candidate.id === selectedRunId);
    if (workout === undefined || run === undefined) return;

    setConfirmedPair({
      workoutId: workout.id,
      runId: run.id,
      confirmedAt: createUtcDateTime(new Date().toISOString()),
    });
  };

  return (
    <section
      id="internal-session-draft-feedback"
      className="internal-adaptation-history internal-session-draft-feedback"
      aria-labelledby="internal-session-draft-feedback-title"
    >
      <header>
        <p className="internal-adaptation-history-eyebrow">
          Owner-confirmed session evidence
        </p>
        <h2 id="internal-session-draft-feedback-title">
          Rehearse session-draft feedback
        </h2>
        <p>
          Deliberately pair one draft workout with one synchronized run from the
          same local date, then pass transient copies through the existing
          adaptation rehearsal. Nothing here changes the saved run or plan.
        </p>
      </header>

      {eligibleWorkouts.length === 0 ? (
        <p className="internal-session-draft-feedback-empty">
          No non-rest draft workout has a same-date synchronized run yet. Log a
          run from the daily comparison before rehearsing feedback.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="session-draft-feedback-workout">Draft workout</label>
          <select
            id="session-draft-feedback-workout"
            required
            value={selectedWorkoutId}
            onChange={(event) => {
              setSelectedWorkoutId(event.target.value);
              setSelectedRunId("");
              clearConfirmation();
            }}
          >
            <option value="">Choose the draft workout</option>
            {eligibleWorkouts.map((workout) => (
              <option key={workout.id} value={workout.id}>
                {workoutLabel(workout)}
              </option>
            ))}
          </select>

          <label htmlFor="session-draft-feedback-run">Synchronized run</label>
          <select
            id="session-draft-feedback-run"
            required
            disabled={selectedWorkout === undefined}
            value={selectedRunId}
            onChange={(event) => {
              setSelectedRunId(event.target.value);
              clearConfirmation();
            }}
          >
            <option value="">
              {selectedWorkout === undefined
                ? "Choose a draft workout first"
                : "Choose the run to pair"}
            </option>
            {eligibleRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {runLabel(run, distanceUnit)}
              </option>
            ))}
          </select>

          <p className="internal-adaptation-history-help">
            Confirming creates a completed workout and run association only in
            this browser-session rehearsal.
          </p>
          <button
            type="submit"
            disabled={selectedWorkout === undefined || selectedRunId === ""}
          >
            Use this pair for session rehearsal
          </button>
        </form>
      )}

      {assembly?.normalization.kind === "not_ready" && (
        <section
          className="internal-adaptation-history-result"
          aria-labelledby="internal-session-draft-feedback-not-ready-title"
        >
          <h3 id="internal-session-draft-feedback-not-ready-title">
            Session evidence is not ready
          </h3>
          <ul>
            {assembly.normalization.issues.map((issue) => (
              <li key={`${issue.code}:${issue.field}`}>
                <strong>{issue.code}</strong>: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {assembly?.normalization.kind === "ready" && (
        <section
          className="internal-adaptation-history-result"
          aria-labelledby="internal-session-draft-feedback-ready-title"
        >
          <h3 id="internal-session-draft-feedback-ready-title">
            Session draft evidence is coherent
          </h3>
          <p>
            The strict history normalizer accepted the owner-confirmed transient
            pairing. It remains separate from saved synchronized history.
          </p>
          <InternalLiveAdaptationRehearsal
            key={`${confirmedPair?.workoutId}:${confirmedPair?.runId}`}
            evidence={assembly.normalization.evidence}
            packet={draftPacket}
            activePlan={assembly.plan}
            workouts={assembly.workouts}
            distanceUnit={distanceUnit}
          />
        </section>
      )}

      <aside className="internal-adaptation-history-boundary">
        Session-only and unapproved for participants. This confirmation does not
        write Firestore, associate the real run, save a recommendation, or
        change the draft plan.
      </aside>
    </section>
  );
}
