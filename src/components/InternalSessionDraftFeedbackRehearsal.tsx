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
import type { InternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";
import {
  assembleInternalSessionDraftAdaptation,
  type InternalSessionDraftAdaptationAssembly,
  type InternalSessionDraftRunPair,
  type InternalSessionDraftSkippedWorkout,
} from "./internalSessionDraftAdaptation";
import { deriveInternalSessionDraftPlanContext } from "./internalSessionDraftPlanContext";

interface InternalSessionDraftFeedbackRehearsalProps {
  readonly projection: GeneratedPlanEntityProjection | null;
  readonly runs: readonly CompletedRun[];
  readonly distanceUnit: DistanceUnit;
  readonly draftPacket: InternalAdaptationScenarioPacket;
  readonly planRuleSet: InternalPlanProposalRehearsalRuleSet;
}

interface ConfirmedPair {
  readonly workoutId: PlannedWorkoutId;
  readonly runId: CompletedRun["id"];
  readonly confirmedAt: ReturnType<typeof createUtcDateTime>;
}

interface ConfirmedSkippedWorkout {
  readonly workoutId: PlannedWorkoutId;
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
  planRuleSet,
}: InternalSessionDraftFeedbackRehearsalProps) {
  const [selectedWorkoutId, setSelectedWorkoutId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedSkippedWorkoutId, setSelectedSkippedWorkoutId] = useState("");
  const [confirmedPairs, setConfirmedPairs] = useState<readonly ConfirmedPair[]>(
    [],
  );
  const [confirmedSkippedWorkouts, setConfirmedSkippedWorkouts] = useState<
    readonly ConfirmedSkippedWorkout[]
  >([]);

  const confirmedWorkoutIds = useMemo(
    () =>
      new Set([
        ...confirmedPairs.map((pair) => pair.workoutId),
        ...confirmedSkippedWorkouts.map((workout) => workout.workoutId),
      ]),
    [confirmedPairs, confirmedSkippedWorkouts],
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

  const eligibleSkippedWorkouts = useMemo(() => {
    if (projection === null) return [];

    return projection.workouts.filter(
      (
        workout,
      ): workout is Exclude<PlannedWorkout, { readonly kind: "rest" }> =>
        workout.kind !== "rest" && !confirmedWorkoutIds.has(workout.id),
    );
  }, [confirmedWorkoutIds, projection]);

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

  const resolvedConfirmedSkippedWorkouts = useMemo(
    () =>
      confirmedSkippedWorkouts.flatMap((confirmedWorkout) => {
        const workout = projection?.workouts.find(
          (candidate) => candidate.id === confirmedWorkout.workoutId,
        );
        return workout === undefined || workout.kind === "rest"
          ? []
          : [{ ...confirmedWorkout, workout }];
      }),
    [confirmedSkippedWorkouts, projection],
  );
  const confirmedEventCount =
    resolvedConfirmedPairs.length + resolvedConfirmedSkippedWorkouts.length;

  const assembly = useMemo<InternalSessionDraftAdaptationAssembly | null>(() => {
    if (
      projection === null ||
      resolvedConfirmedPairs.length !== confirmedPairs.length ||
      resolvedConfirmedSkippedWorkouts.length !==
        confirmedSkippedWorkouts.length
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
      skippedWorkouts: resolvedConfirmedSkippedWorkouts.map(
        ({ workoutId, confirmedAt }): InternalSessionDraftSkippedWorkout => ({
          workoutId,
          confirmedAt,
        }),
      ),
    });
  }, [
    confirmedPairs.length,
    confirmedSkippedWorkouts.length,
    projection,
    resolvedConfirmedPairs,
    resolvedConfirmedSkippedWorkouts,
  ]);
  const planContextResult = useMemo(() => {
    if (assembly?.normalization.kind !== "ready") return null;

    return deriveInternalSessionDraftPlanContext({
      plan: assembly.plan,
      evaluationDate: assembly.normalization.evidence.evaluationDate,
      basePlanRules: planRuleSet,
      adaptationRules: draftPacket.rules,
    });
  }, [assembly, draftPacket.rules, planRuleSet]);

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

  const handleSkippedWorkoutSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const workout = eligibleSkippedWorkouts.find(
      (candidate) => candidate.id === selectedSkippedWorkoutId,
    );
    if (workout === undefined) return;

    setConfirmedSkippedWorkouts((current) => [
      ...current,
      {
        workoutId: workout.id,
        confirmedAt: createUtcDateTime(new Date().toISOString()),
      },
    ]);
    setSelectedSkippedWorkoutId("");
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
          Build a deliberate history of completed and skipped draft workouts,
          then pass transient copies through the existing adaptation rehearsal.
          Nothing here changes the saved runs or plan.
        </p>
      </header>

      {confirmedEventCount > 0 && (
        <section
          className="internal-session-draft-feedback-confirmed"
          aria-labelledby="internal-session-draft-feedback-confirmed-title"
        >
          <h3 id="internal-session-draft-feedback-confirmed-title">
            Confirmed session history
          </h3>
          <p>
            {confirmedEventCount}{" "}
            {confirmedEventCount === 1
              ? "confirmed event is"
              : "confirmed events are"}{" "}
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
            {resolvedConfirmedSkippedWorkouts.map(({ workout }) => (
              <li key={`skipped:${workout.id}`}>
                <span>
                  <strong>{workoutLabel(workout)}</strong>
                  <br />
                  Skipped for rehearsal · no run associated
                </span>
                <button
                  type="button"
                  aria-label={`Remove skipped workout for ${formatDate(workout.scheduledDate)}`}
                  onClick={() =>
                    setConfirmedSkippedWorkouts((current) =>
                      current.filter(
                        (confirmedWorkout) =>
                          confirmedWorkout.workoutId !== workout.id,
                      ),
                    )
                  }
                >
                  Remove skip
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h3 className="internal-session-draft-feedback-entry-title">
        Add a completed workout
      </h3>
      {eligibleWorkouts.length === 0 ? (
        <p className="internal-session-draft-feedback-empty">
          {confirmedEventCount > 0
            ? "No unused workout/run pair is currently available. Remove an event or log another same-date run."
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

      <h3 className="internal-session-draft-feedback-entry-title">
        Add a skipped workout
      </h3>
      {eligibleSkippedWorkouts.length === 0 ? (
        <p className="internal-session-draft-feedback-empty">
          Every non-rest draft workout is already in this rehearsal. Remove an
          event to choose it again.
        </p>
      ) : (
        <form onSubmit={handleSkippedWorkoutSubmit}>
          <label htmlFor="session-draft-feedback-skipped-workout">
            Draft workout to skip
          </label>
          <select
            id="session-draft-feedback-skipped-workout"
            required
            value={selectedSkippedWorkoutId}
            onChange={(event) =>
              setSelectedSkippedWorkoutId(event.target.value)
            }
          >
            <option value="">Choose the workout to mark skipped</option>
            {eligibleSkippedWorkouts.map((workout) => (
              <option key={workout.id} value={workout.id}>
                {workoutLabel(workout)}
              </option>
            ))}
          </select>
          <p className="internal-adaptation-history-help">
            This is an explicit owner rehearsal choice, not an automatic claim
            that the runner missed the workout. It does not create run evidence.
          </p>
          <button type="submit" disabled={selectedSkippedWorkoutId === ""}>
            Mark skipped for rehearsal
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
            events. They remain separate from saved synchronized history.
          </p>
          {planContextResult?.kind === "not_ready" && (
            <section
              className="internal-adaptation-history-result"
              role="alert"
            >
              <h4>Session plan context is not ready</h4>
              <p>{planContextResult.message}</p>
              <p>
                Internal code: <code>{planContextResult.code}</code>
              </p>
            </section>
          )}
          {planContextResult?.kind === "ready" && (
            <InternalLiveAdaptationRehearsal
              key={[
                ...confirmedPairs.map(
                  (pair) => `completed:${pair.workoutId}:${pair.runId}`,
                ),
                ...confirmedSkippedWorkouts.map(
                  (workout) => `skipped:${workout.workoutId}`,
                ),
              ].join("|")}
              evidence={assembly.normalization.evidence}
              packet={draftPacket}
              activePlan={assembly.plan}
              workouts={assembly.workouts}
              distanceUnit={distanceUnit}
              planContext={planContextResult.context}
            />
          )}
        </section>
      )}

      <aside className="internal-adaptation-history-boundary">
        Session-only and unapproved for participants. These confirmations do not
        write Firestore, associate real runs, save completed or skipped workout
        statuses, save a recommendation, or change the draft plan.
      </aside>
    </section>
  );
}
