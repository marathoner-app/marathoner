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
  type InternalSessionDraftRunPair,
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
  const [confirmedPairs, setConfirmedPairs] = useState<readonly ConfirmedPair[]>(
    [],
  );

  const confirmedWorkoutIds = useMemo(
    () => new Set(confirmedPairs.map((pair) => pair.workoutId)),
    [confirmedPairs],
  );
  const confirmedRunIds = useMemo(
    () => new Set(confirmedPairs.map((pair) => pair.runId)),
    [confirmedPairs],
  );

  const eligibleWorkouts = useMemo(() => {
    if (projection === null) return [];

    return projection.workouts.filter(
      (
        workout,
      ): workout is Exclude<PlannedWorkout, { readonly kind: "rest" }> =>
        workout.kind !== "rest" &&
        !confirmedWorkoutIds.has(workout.id) &&
        runs.some(
          (run) =>
            run.userId === projection.plan.userId &&
            !confirmedRunIds.has(run.id) &&
            getRunLocalDate(run) === workout.scheduledDate,
        ),
    );
  }, [confirmedRunIds, confirmedWorkoutIds, projection, runs]);

  const selectedWorkout = eligibleWorkouts.find(
    (workout) => workout.id === selectedWorkoutId,
  );
  const eligibleRuns = useMemo(() => {
    if (projection === null || selectedWorkout === undefined) return [];

    return runs.filter(
      (run) =>
        run.userId === projection.plan.userId &&
        !confirmedRunIds.has(run.id) &&
        getRunLocalDate(run) === selectedWorkout.scheduledDate,
    );
  }, [confirmedRunIds, projection, runs, selectedWorkout]);

  const resolvedConfirmedPairs = useMemo(
    () =>
      confirmedPairs.flatMap((pair) => {
        const workout = projection?.workouts.find(
          (candidate) => candidate.id === pair.workoutId,
        );
        const run = runs.find((candidate) => candidate.id === pair.runId);
        return workout === undefined ||
          workout.kind === "rest" ||
          run === undefined
          ? []
          : [{ ...pair, workout, run }];
      }),
    [confirmedPairs, projection, runs],
  );

  const assembly = useMemo<InternalSessionDraftAdaptationAssembly | null>(() => {
    if (
      projection === null ||
      resolvedConfirmedPairs.length !== confirmedPairs.length
    ) {
      return null;
    }

    return assembleInternalSessionDraftAdaptation({
      projection,
      pairs: resolvedConfirmedPairs.map(
        ({ workoutId, run, confirmedAt }): InternalSessionDraftRunPair => ({
          workoutId,
          run,
          confirmedAt,
        }),
      ),
    });
  }, [confirmedPairs.length, projection, resolvedConfirmedPairs]);

  if (projection === null) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const workout = eligibleWorkouts.find(
      (candidate) => candidate.id === selectedWorkoutId,
    );
    const run = eligibleRuns.find((candidate) => candidate.id === selectedRunId);
    if (workout === undefined || run === undefined) return;

    setConfirmedPairs((current) => [
      ...current,
      {
        workoutId: workout.id,
        runId: run.id,
        confirmedAt: createUtcDateTime(new Date().toISOString()),
      },
    ]);
    setSelectedWorkoutId("");
    setSelectedRunId("");
  };

  return (
    <section
      id="internal-session-draft-feedback"
      className="internal-adaptation-history internal-session-draft-feedback"
      aria-labelledby="internal-session-draft-feedback-title"
      tabIndex={-1}
    >
      <header>
        <p className="internal-adaptation-history-eyebrow">
          Owner-confirmed session evidence
        </p>
        <h2 id="internal-session-draft-feedback-title">
          Rehearse session-draft feedback
        </h2>
        <p>
          Build a deliberate history of draft workouts paired with synchronized
          runs from the same local date, then pass transient copies through the
          existing adaptation rehearsal. Nothing here changes the saved runs or
          plan.
        </p>
      </header>

      {resolvedConfirmedPairs.length > 0 && (
        <section
          className="internal-session-draft-feedback-confirmed"
          aria-labelledby="internal-session-draft-feedback-confirmed-title"
        >
          <h3 id="internal-session-draft-feedback-confirmed-title">
            Confirmed session history
          </h3>
          <p>
            {resolvedConfirmedPairs.length}{" "}
            {resolvedConfirmedPairs.length === 1
              ? "confirmed pair is"
              : "confirmed pairs are"}{" "}
            contributing evidence. The latest dated workout is always the
            evaluation trigger.
          </p>
          <ul>
            {resolvedConfirmedPairs.map(({ workout, run }) => (
              <li key={`${workout.id}:${run.id}`}>
                <span>
                  <strong>{workoutLabel(workout)}</strong>
                  <br />
                  {runLabel(run, distanceUnit)}
                </span>
                <button
                  type="button"
                  aria-label={`Remove confirmed pair for ${formatDate(workout.scheduledDate)}`}
                  onClick={() =>
                    setConfirmedPairs((current) =>
                      current.filter(
                        (pair) =>
                          pair.workoutId !== workout.id || pair.runId !== run.id,
                      ),
                    )
                  }
                >
                  Remove pair
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {eligibleWorkouts.length === 0 ? (
        <p className="internal-session-draft-feedback-empty">
          {confirmedPairs.length > 0
            ? "Every currently eligible workout/run pair is already in this rehearsal. Remove a pair to choose it again."
            : "No non-rest draft workout has a same-date synchronized run yet. Log a run from the daily comparison before rehearsing feedback."}
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
            onChange={(event) => setSelectedRunId(event.target.value)}
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
            Each confirmation creates a completed workout and run association
            only in this browser-session rehearsal. The current pair count is a
            testing window, not approved production methodology.
          </p>
          <button
            type="submit"
            disabled={selectedWorkout === undefined || selectedRunId === ""}
          >
            Add pair to session rehearsal
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
            The strict history normalizer accepted all owner-confirmed transient
            pairs. They remain separate from saved synchronized history.
          </p>
          <InternalLiveAdaptationRehearsal
            key={confirmedPairs
              .map((pair) => `${pair.workoutId}:${pair.runId}`)
              .join("|")}
            evidence={assembly.normalization.evidence}
            packet={draftPacket}
            activePlan={assembly.plan}
            workouts={assembly.workouts}
            distanceUnit={distanceUnit}
          />
        </section>
      )}

      <aside className="internal-adaptation-history-boundary">
        Session-only and unapproved for participants. These confirmations do not
        write Firestore, associate real runs, save a recommendation, or change
        the draft plan.
      </aside>
    </section>
  );
}
