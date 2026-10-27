import { useMemo, useState, type FormEvent } from "react";
import {
  createDateOnly,
  createPlannedWorkoutId,
  isDateOnly,
  normalizeAdaptationHistory,
  type ActivePlanState,
  type CompletedRun,
  type DateOnly,
  type IanaTimeZone,
  type PlannedWorkout,
  type TrainingPlan,
  type UserId,
} from "../domain/training";
import "./InternalAdaptationHistoryInspector.css";
import {
  evidenceWeekContaining,
  type EvidenceWeek,
} from "./internalAdaptationHistoryWeek";

interface InternalAdaptationHistoryInspectorProps {
  readonly ownerId: UserId;
  readonly activePlanState: ActivePlanState | null;
  readonly plans: readonly TrainingPlan[];
  readonly workouts: readonly PlannedWorkout[];
  readonly runs: readonly CompletedRun[];
  readonly timeZone: IanaTimeZone;
  readonly initialEvaluationDate?: DateOnly;
}

const trustedFactLabels = {
  basePlanArtifactVersion: "Approved base-plan artifact version",
  adaptationArtifactVersion: "Approved adaptation artifact version",
  currentCoreWeek: "Current core-training week number",
  currentWeekKind: "Current week kind",
  nextWeekKind: "Next week kind",
  nextWeekIntroducesProgression: "Whether next week adds progression",
  rescheduleCandidate: "Prevalidated reschedule candidate",
} as const;

function dateOnlyInTimeZone(timeZone: IanaTimeZone, now = new Date()): DateOnly {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );

  return createDateOnly(`${parts.year}-${parts.month}-${parts.day}`);
}

function readableValue(value: string): string {
  const words = value.replace(/_/gu, " ");
  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
}

function triggerOptions(
  workouts: readonly PlannedWorkout[],
  ownerId: UserId,
  week: EvidenceWeek | null,
  activePlanState: ActivePlanState | null,
): readonly PlannedWorkout[] {
  if (week === null) return [];

  return workouts
    .filter(
      (workout) =>
        workout.userId === ownerId &&
        (activePlanState === null ||
          workout.planId === activePlanState.activePlanId) &&
        workout.kind !== "rest" &&
        (workout.status === "completed" || workout.status === "skipped") &&
        workout.scheduledDate >= week.startDate &&
        workout.scheduledDate <= week.endDate,
    )
    .sort(
      (left, right) =>
        right.scheduledDate.localeCompare(left.scheduledDate) ||
        right.id.localeCompare(left.id),
    );
}

function triggerOptionKey(workout: PlannedWorkout): string {
  return `${workout.planId}:${workout.id}`;
}

export default function InternalAdaptationHistoryInspector({
  ownerId,
  activePlanState,
  plans,
  workouts,
  runs,
  timeZone,
  initialEvaluationDate,
}: InternalAdaptationHistoryInspectorProps) {
  const [evaluationDate, setEvaluationDate] = useState<string>(
    initialEvaluationDate ?? dateOnlyInTimeZone(timeZone),
  );
  const [triggerWorkoutKey, setTriggerWorkoutKey] = useState("");
  const [recentRunWindowSize, setRecentRunWindowSize] = useState(4);
  const [inspectionRequested, setInspectionRequested] = useState(false);
  const normalizedEvaluationDate = isDateOnly(evaluationDate)
    ? createDateOnly(evaluationDate)
    : null;
  const week = useMemo(
    () =>
      normalizedEvaluationDate === null
        ? null
        : evidenceWeekContaining(normalizedEvaluationDate),
    [normalizedEvaluationDate],
  );
  const availableTriggers = useMemo(
    () => triggerOptions(workouts, ownerId, week, activePlanState),
    [activePlanState, ownerId, week, workouts],
  );
  const selectedTrigger = availableTriggers.find(
    (workout) => triggerOptionKey(workout) === triggerWorkoutKey,
  );
  const result = useMemo(() => {
    if (
      !inspectionRequested ||
      normalizedEvaluationDate === null ||
      week === null ||
      selectedTrigger === undefined
    ) {
      return null;
    }

    return normalizeAdaptationHistory({
      ownerId,
      activePlanState,
      plans,
      workouts,
      runs,
      evaluationDate: normalizedEvaluationDate,
      currentWeekStartDate: week.startDate,
      currentWeekEndDate: week.endDate,
      triggerWorkoutId: createPlannedWorkoutId(selectedTrigger.id),
      recentRunWindowSize,
    });
  }, [
    activePlanState,
    inspectionRequested,
    normalizedEvaluationDate,
    ownerId,
    plans,
    recentRunWindowSize,
    runs,
    selectedTrigger,
    week,
    workouts,
  ]);

  const resetInspection = () => setInspectionRequested(false);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInspectionRequested(true);
  };

  return (
    <section
      className="internal-adaptation-history"
      aria-labelledby="internal-adaptation-history-title"
    >
      <header>
        <p className="internal-adaptation-history-eyebrow">
          Owner-only local tool
        </p>
        <h2 id="internal-adaptation-history-title">
          Internal live adaptation history
        </h2>
        <p>
          Inspect objective facts from the synchronized owner snapshot. This
          does not run the draft evaluator, recommend a change, or write to the
          plan.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        <label htmlFor="adaptation-history-evaluation-date">
          Evaluation date
        </label>
        <input
          id="adaptation-history-evaluation-date"
          type="date"
          required
          value={evaluationDate}
          onChange={(event) => {
            setEvaluationDate(event.target.value);
            setTriggerWorkoutKey("");
            resetInspection();
          }}
        />

        <div className="internal-adaptation-history-week" aria-live="polite">
          <span>Evidence week</span>
          <strong>
            {week === null
              ? "Choose a valid date"
              : `${week.startDate} through ${week.endDate}`}
          </strong>
        </div>

        <label htmlFor="adaptation-history-trigger">Trigger workout</label>
        <select
          id="adaptation-history-trigger"
          required
          value={triggerWorkoutKey}
          onChange={(event) => {
            setTriggerWorkoutKey(event.target.value);
            resetInspection();
          }}
        >
          <option value="">Choose a completed or skipped workout</option>
          {availableTriggers.map((workout) => {
            const planName =
              plans.find(({ id }) => id === workout.planId)?.name ??
              workout.planId;
            return (
              <option
                key={triggerOptionKey(workout)}
                value={triggerOptionKey(workout)}
              >
                {workout.scheduledDate} · {readableValue(workout.status)} · {planName}
              </option>
            );
          })}
        </select>
        {week !== null && availableTriggers.length === 0 && (
          <p className="internal-adaptation-history-help">
            No completed or skipped run/walk-run workout exists in this owner
            snapshot for the selected week.
          </p>
        )}

        <label htmlFor="adaptation-history-window">
          Recent planned runs to inspect
        </label>
        <input
          id="adaptation-history-window"
          type="number"
          min="1"
          step="1"
          required
          value={recentRunWindowSize}
          onChange={(event) => {
            setRecentRunWindowSize(Number(event.target.value));
            resetInspection();
          }}
        />
        <p className="internal-adaptation-history-help">
          This inspection bound is explicit and editable. It is not an approved
          methodology threshold.
        </p>

        <button
          type="submit"
          disabled={
            normalizedEvaluationDate === null || selectedTrigger === undefined
          }
        >
          Inspect saved history
        </button>
      </form>

      {result?.kind === "not_ready" && (
        <div className="internal-adaptation-history-result" role="status">
          <h3>Saved history is not ready</h3>
          <p>
            No partial evidence was produced. Resolve or deliberately account
            for each issue before trusting this snapshot.
          </p>
          <ul>
            {result.issues.map((issue) => (
              <li key={`${issue.field}-${issue.code}`}>
                <strong>{issue.field}</strong>: {issue.message} ({issue.code})
              </li>
            ))}
          </ul>
        </div>
      )}

      {result?.kind === "ready" && (
        <div className="internal-adaptation-history-result" role="status">
          <h3>Objective history is coherent</h3>
          <dl>
            <div>
              <dt>Active plan revision</dt>
              <dd>{result.evidence.activePlanRevision}</dd>
            </div>
            <div>
              <dt>Trigger</dt>
              <dd>{readableValue(result.evidence.triggerKind)}</dd>
            </div>
            <div>
              <dt>Planned runs this week</dt>
              <dd>{result.evidence.currentWeek.plannedRunCount}</dd>
            </div>
            <div>
              <dt>Completed / skipped / pending</dt>
              <dd>
                {result.evidence.currentWeek.completedRunCount} /{" "}
                {result.evidence.currentWeek.skippedRunCount} /{" "}
                {result.evidence.currentWeek.pendingRunCount}
              </dd>
            </div>
            <div>
              <dt>Days until race</dt>
              <dd>{result.evidence.daysUntilRace}</dd>
            </div>
            <div>
              <dt>Days since last planned-run completion</dt>
              <dd>{result.evidence.daysSinceLastCompletedPlannedRun}</dd>
            </div>
            <div>
              <dt>Recent planned runs inspected</dt>
              <dd>{result.evidence.recentRunCount}</dd>
            </div>
            <div>
              <dt>Runs missing perceived effort</dt>
              <dd>{result.evidence.recentRunsMissingPerceivedEffort}</dd>
            </div>
            <div>
              <dt>Safety completeness</dt>
              <dd>{readableValue(result.evidence.safetyGateState)}</dd>
            </div>
          </dl>
          <div>
            <h4>Recorded perceived effort</h4>
            {result.evidence.recentEfforts.length === 0 ? (
              <p>None recorded in the selected recent-run window.</p>
            ) : (
              <ol>
                {result.evidence.recentEfforts.map((effort, index) => (
                  <li key={`${effort}-${index}`}>{readableValue(effort)}</li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h4>Still required from a trusted caller</h4>
            <ul>
              {result.requiredTrustedCallerFacts.map((fact) => (
                <li key={fact}>{trustedFactLabels[fact]}</li>
              ))}
            </ul>
          </div>
          <p className="internal-adaptation-history-boundary">
            History-ready is not evaluation-ready. No recommendation record or
            plan change was created.
          </p>
        </div>
      )}
    </section>
  );
}
