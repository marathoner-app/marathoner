import { useState } from "react";
import {
  metersToMiles,
  type GeneratedPlanResultV1,
  type GeneratedWorkoutTargetV1,
  type GeneratedWorkoutV1,
} from "../domain/training";
import ProposedPlanSummary from "./ProposedPlanSummary";
import "./InternalPlanActivationRehearsal.css";

interface InternalPlanActivationRehearsalProps {
  readonly result: GeneratedPlanResultV1;
  readonly onReviewInputs: () => void;
  readonly onSessionActivationChange: (
    result: GeneratedPlanResultV1 | null,
  ) => void;
}

type RehearsalScreen = "proposal" | "confirmation" | "active";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatLabel(value: string): string {
  const label = value.split("_").join(" ");
  return `${label[0]?.toUpperCase() ?? ""}${label.slice(1)}`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} hr`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.join(" ");
}

function formatTarget(target: GeneratedWorkoutTargetV1): string {
  return target.kind === "distance"
    ? `${Number(metersToMiles(target.distance).toFixed(1))} mi`
    : formatDuration(target.duration);
}

function workoutName(workout: GeneratedWorkoutV1): string {
  if (workout.kind === "walk_run") return "Walk/run";
  if (workout.kind === "rest") return "Rest";
  return `${formatLabel(workout.purpose)} run`;
}

function firstTrainingWorkout(
  result: GeneratedPlanResultV1,
): GeneratedWorkoutV1 | null {
  return (
    result.plan.weeks
      .flatMap((week) => week.workouts)
      .filter((workout) => workout.kind !== "rest")
      .sort(
        (left, right) =>
          left.scheduledDate.localeCompare(right.scheduledDate) ||
          left.id.localeCompare(right.id),
      )[0] ?? null
  );
}

function workoutCount(result: GeneratedPlanResultV1): number {
  return result.plan.weeks.reduce(
    (total, week) => total + week.workouts.length,
    0,
  );
}

export default function InternalPlanActivationRehearsal({
  result,
  onReviewInputs,
  onSessionActivationChange,
}: InternalPlanActivationRehearsalProps) {
  const [screen, setScreen] = useState<RehearsalScreen>("proposal");
  const firstWorkout = firstTrainingWorkout(result);

  const reviewInputs = () => {
    onSessionActivationChange(null);
    onReviewInputs();
  };

  const activateInSession = () => {
    onSessionActivationChange(result);
    setScreen("active");
  };

  const endSessionActivation = () => {
    onSessionActivationChange(null);
    setScreen("proposal");
  };

  if (screen === "proposal") {
    return (
      <div className="internal-plan-activation-rehearsal">
        <p className="internal-plan-activation-boundary" role="status">
          Internal draft only. Continuing can activate this plan only inside
          the current rehearsal session.
        </p>
        <ProposedPlanSummary
          result={result}
          onReviewInputs={reviewInputs}
          onContinueReview={() => setScreen("confirmation")}
        />
      </div>
    );
  }

  if (screen === "confirmation") {
    return (
      <section
        className="internal-plan-activation-rehearsal internal-plan-activation-confirmation"
        aria-labelledby="internal-plan-activation-confirmation-title"
      >
        <p className="internal-plan-activation-eyebrow">
          Internal rehearsal confirmation
        </p>
        <h3 id="internal-plan-activation-confirmation-title">
          Activate {result.plan.name} in this session?
        </h3>
        <p>
          Activating previews this draft in the home next-workout card and Plan
          calendar for the current browser session. It does not save or approve
          the plan, call the plan-approval command, write Firestore, or change
          synchronized training data. Track continues to use synchronized
          training data.
        </p>
        <dl aria-label="Draft plan activation summary">
          <div>
            <dt>Starts</dt>
            <dd>{formatDate(result.plan.startDate)}</dd>
          </div>
          <div>
            <dt>Race day</dt>
            <dd>{formatDate(result.plan.targetRaceDate)}</dd>
          </div>
          <div>
            <dt>Schedule</dt>
            <dd>
              {result.plan.weeks.length} weeks · {workoutCount(result)} workouts
            </dd>
          </div>
        </dl>
        <div className="internal-plan-activation-actions">
          <button type="button" className="secondary" onClick={reviewInputs}>
            Review different inputs
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setScreen("proposal")}
          >
            Back to proposal details
          </button>
          <button type="button" onClick={activateInSession}>
            Activate only in this rehearsal
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="internal-plan-activation-rehearsal internal-plan-activation-active"
      aria-labelledby="internal-plan-activation-active-title"
    >
      <p className="internal-plan-activation-eyebrow">Session-only state</p>
      <h3 id="internal-plan-activation-active-title">
        Active only in this rehearsal
      </h3>
      <p role="status">
        {result.plan.name} is active as a session-only preview in home and Plan.
        It was not saved or approved. Track and synchronized training data
        remain unchanged.
      </p>

      <dl aria-label="Session-only active plan summary">
        <div>
          <dt>Starts</dt>
          <dd>{formatDate(result.plan.startDate)}</dd>
        </div>
        <div>
          <dt>Race day</dt>
          <dd>{formatDate(result.plan.targetRaceDate)}</dd>
        </div>
        <div>
          <dt>Draft source</dt>
          <dd>{result.plan.provenance.rulesetVersion}</dd>
        </div>
      </dl>

      <section aria-labelledby="internal-plan-activation-next-workout-title">
        <h4 id="internal-plan-activation-next-workout-title">
          First scheduled training workout
        </h4>
        {firstWorkout === null ? (
          <p>No training workout appears in this generated proposal.</p>
        ) : (
          <p>
            <time dateTime={firstWorkout.scheduledDate}>
              {formatDate(firstWorkout.scheduledDate)}
            </time>
            {": "}
            <strong>{workoutName(firstWorkout)}</strong>
            {firstWorkout.kind !== "rest" && (
              <> · {formatTarget(firstWorkout.target)}</>
            )}
          </p>
        )}
      </section>

      <p className="internal-plan-activation-boundary">
        Refreshing the page ends this rehearsal activation. No approval receipt,
        plan record, or workout record was created.
      </p>
      <div className="internal-plan-activation-actions">
        <button type="button" className="secondary" onClick={reviewInputs}>
          Review different inputs
        </button>
        <button type="button" onClick={endSessionActivation}>
          End rehearsal activation
        </button>
      </div>
    </section>
  );
}
