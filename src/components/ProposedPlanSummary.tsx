import { useId } from "react";
import {
  metersToMiles,
  type GeneratedPlanResultV1,
  type GeneratedWorkoutTargetV1,
  type GeneratedWorkoutV1,
} from "../domain/training";

type ProposedPlanSummaryProps = {
  readonly result: GeneratedPlanResultV1;
  readonly onReviewInputs: () => void;
  readonly onContinueReview: () => void;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatLabel(value: string): string {
  const label = value.split("_").join(" ");
  return `${label[0].toUpperCase()}${label.slice(1)}`;
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

function formatTarget(target: GeneratedWorkoutTargetV1): string {
  if (target.kind === "duration") {
    return formatDuration(target.duration);
  }

  return `${Number(metersToMiles(target.distance).toFixed(1))} mi`;
}

function workoutName(workout: GeneratedWorkoutV1): string {
  if (workout.kind === "rest") return "Rest";
  if (workout.kind === "walk_run") return "Walk/run";
  return `${formatLabel(workout.purpose)} run`;
}

function phaseWeekRange(startWeek: number, endWeek: number): string {
  return startWeek === endWeek
    ? `week ${startWeek}`
    : `weeks ${startWeek}–${endWeek}`;
}

export default function ProposedPlanSummary({
  result,
  onReviewInputs,
  onContinueReview,
}: ProposedPlanSummaryProps) {
  const { plan } = result;
  const idPrefix = useId();
  const titleId = `${idPrefix}-title`;
  const phasesId = `${idPrefix}-phases`;
  const weeksId = `${idPrefix}-weeks`;
  const detailsId = `${idPrefix}-details`;

  return (
    <article className="proposed-plan" aria-labelledby={titleId}>
      <header className="proposed-plan-header">
        <p className="proposed-plan-status" role="status">
          Proposed plan — not active
        </p>
        <h2 id={titleId}>{plan.name}</h2>
        <p>
          Review this proposal before continuing. Nothing shown here has been
          activated or added to your calendar.
        </p>
      </header>

      <dl className="proposed-plan-dates" aria-label="Proposed plan dates">
        <div>
          <dt>Starts</dt>
          <dd>
            <time dateTime={plan.startDate}>{formatDate(plan.startDate)}</time>
          </dd>
        </div>
        <div>
          <dt>Race day</dt>
          <dd>
            <time dateTime={plan.targetRaceDate}>
              {formatDate(plan.targetRaceDate)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Plan ends</dt>
          <dd>
            <time dateTime={plan.endDate}>{formatDate(plan.endDate)}</time>
          </dd>
        </div>
      </dl>

      <section aria-labelledby={phasesId}>
        <h3 id={phasesId}>Plan phases</h3>
        <ul className="proposed-plan-phase-list">
          {plan.phases.map((phase) => (
            <li key={`${phase.phase}-${phase.startWeek}`}>
              <strong>{formatLabel(phase.phase)}</strong>{" "}
              <span>{phaseWeekRange(phase.startWeek, phase.endWeek)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={weeksId}>
        <h3 id={weeksId}>Weekly schedule</h3>
        <div className="proposed-plan-week-list">
          {plan.weeks.map((week) => (
            <section
              className="proposed-plan-week"
              key={week.weekNumber}
              aria-labelledby={`${idPrefix}-week-${week.weekNumber}`}
            >
              <h4 id={`${idPrefix}-week-${week.weekNumber}`}>
                Week {week.weekNumber}: {formatLabel(week.phase)}
              </h4>
              <p>
                <time dateTime={week.startDate}>{formatDate(week.startDate)}</time>{" "}
                to <time dateTime={week.endDate}>{formatDate(week.endDate)}</time>
              </p>
              <ul className="proposed-plan-workouts">
                {week.workouts.map((workout) => (
                  <li key={workout.id}>
                    <time dateTime={workout.scheduledDate}>
                      {formatDate(workout.scheduledDate)}
                    </time>
                    <span>
                      <strong>{workoutName(workout)}</strong>
                      {workout.kind !== "rest" && (
                        <>
                          {" · "}
                          <span className="proposed-plan-target">
                            {formatTarget(workout.target)}
                          </span>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section
        className="proposed-plan-provenance"
        aria-labelledby={detailsId}
      >
        <h3 id={detailsId}>Proposal details</h3>
        <dl>
          <div>
            <dt>Ruleset</dt>
            <dd>{plan.provenance.rulesetVersion}</dd>
          </div>
          <div>
            <dt>Generator</dt>
            <dd>{plan.provenance.generatorVersion}</dd>
          </div>
          <div>
            <dt>Plan format</dt>
            <dd>{plan.schemaVersion}</dd>
          </div>
        </dl>
      </section>

      <div className="proposed-plan-actions">
        <button type="button" className="secondary" onClick={onReviewInputs}>
          Review inputs
        </button>
        <button type="button" onClick={onContinueReview}>
          Continue review
        </button>
      </div>
    </article>
  );
}
