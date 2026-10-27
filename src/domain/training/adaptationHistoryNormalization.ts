import type {
  AdaptationSafetyGateState,
  AdaptationTriggerKind,
  AdaptationWeekEvidenceV1,
} from "./adaptationEvaluation.js";
import { createDateOnly, type DateOnly } from "./dates.js";
import type {
  PlannedWorkoutId,
  TrainingPlanId,
  UserId,
} from "./identifiers.js";
import type {
  ActivePlanState,
  CompletedRun,
  PerceivedEffort,
  PlannedWorkout,
  TrainingPlan,
} from "./types.js";

export const ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION =
  "adaptation-history-evidence@1" as const;

export const adaptationHistoryTrustedCallerFacts = [
  "basePlanArtifactVersion",
  "adaptationArtifactVersion",
  "currentCoreWeek",
  "currentWeekKind",
  "nextWeekKind",
  "nextWeekIntroducesProgression",
  "rescheduleCandidate",
] as const;

export type AdaptationHistoryTrustedCallerFact =
  (typeof adaptationHistoryTrustedCallerFacts)[number];

export type AdaptationHistoryIssueCode =
  | "invalid_recent_run_window"
  | "invalid_week_window"
  | "evaluation_outside_week"
  | "week_outside_plan"
  | "missing_active_plan_state"
  | "active_state_owner_mismatch"
  | "active_plan_not_found"
  | "duplicate_active_plan"
  | "active_plan_owner_mismatch"
  | "active_plan_not_active"
  | "evaluation_after_race"
  | "workout_owner_mismatch"
  | "workout_outside_plan"
  | "duplicate_workout"
  | "partial_run_association"
  | "cross_plan_run_association"
  | "run_owner_mismatch"
  | "associated_workout_not_found"
  | "duplicate_workout_completion"
  | "rest_workout_completion"
  | "workout_status_mismatch"
  | "completed_workout_missing_run"
  | "completed_run_after_evaluation"
  | "trigger_workout_not_found"
  | "trigger_outside_week"
  | "trigger_not_run_workout"
  | "trigger_status_unsupported"
  | "missing_completed_planned_run";

export interface AdaptationHistoryIssue {
  readonly code: AdaptationHistoryIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface NormalizeAdaptationHistoryRequest {
  readonly ownerId: UserId;
  readonly activePlanState: ActivePlanState | null;
  readonly plans: readonly TrainingPlan[];
  readonly workouts: readonly PlannedWorkout[];
  readonly runs: readonly CompletedRun[];
  readonly evaluationDate: DateOnly;
  readonly currentWeekStartDate: DateOnly;
  readonly currentWeekEndDate: DateOnly;
  readonly triggerWorkoutId: PlannedWorkoutId;
  readonly recentRunWindowSize: number;
}

export interface AdaptationHistoryEvidenceV1 {
  readonly schemaVersion: typeof ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION;
  readonly ownerId: UserId;
  readonly activePlanId: TrainingPlanId;
  readonly activePlanRevision: number;
  readonly evaluatedPlanRevision: number;
  readonly activePlanStatus: "active";
  readonly evaluationDate: DateOnly;
  readonly currentWeekStartDate: DateOnly;
  readonly currentWeekEndDate: DateOnly;
  readonly triggerWorkoutId: PlannedWorkoutId;
  readonly triggerKind: AdaptationTriggerKind;
  readonly currentWeek: AdaptationWeekEvidenceV1;
  readonly daysUntilRace: number;
  readonly daysSinceLastCompletedPlannedRun: number;
  readonly recentRunCount: number;
  readonly recentEfforts: readonly PerceivedEffort[];
  readonly recentRunsMissingPerceivedEffort: number;
  readonly safetyGateState: AdaptationSafetyGateState;
}

export interface AdaptationHistoryNotReadyResult {
  readonly schemaVersion: typeof ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION;
  readonly kind: "not_ready";
  readonly issues: readonly AdaptationHistoryIssue[];
}

export interface AdaptationHistoryReadyResult {
  readonly schemaVersion: typeof ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION;
  readonly kind: "ready";
  readonly evidence: AdaptationHistoryEvidenceV1;
  readonly requiredTrustedCallerFacts: readonly AdaptationHistoryTrustedCallerFact[];
}

export type AdaptationHistoryNormalizationResult =
  | AdaptationHistoryNotReadyResult
  | AdaptationHistoryReadyResult;

interface AssociatedCompletion {
  readonly workout: Exclude<PlannedWorkout, { readonly kind: "rest" }>;
  readonly run: CompletedRun;
  readonly runDate: DateOnly;
}

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

function calendarDay(value: DateOnly): number {
  return Date.parse(`${value}T00:00:00.000Z`) / DAY_MILLISECONDS;
}

function calendarDaysBetween(start: DateOnly, end: DateOnly): number {
  return calendarDay(end) - calendarDay(start);
}

function dateOnlyForRun(run: CompletedRun): DateOnly {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: run.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(run.startedAt))
      .map((part) => [part.type, part.value]),
  );

  return createDateOnly(`${parts.year}-${parts.month}-${parts.day}`);
}

function issue(
  code: AdaptationHistoryIssueCode,
  field: string,
  message: string,
): AdaptationHistoryIssue {
  return { code, field, message };
}

function notReady(
  issues: readonly AdaptationHistoryIssue[],
): AdaptationHistoryNotReadyResult {
  return {
    schemaVersion: ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
    kind: "not_ready",
    issues,
  };
}

function workoutAssociationKey(
  planId: TrainingPlanId,
  workoutId: PlannedWorkoutId,
): string {
  return `${planId}:${workoutId}`;
}

function safetyStateFor(
  completions: readonly AssociatedCompletion[],
): AdaptationSafetyGateState {
  if (completions.some(({ run }) => run.unusualPain === true)) {
    return "requires_review";
  }
  if (completions.some(({ run }) => run.unusualPain === undefined)) {
    return "not_answered";
  }
  return "none_reported";
}

function compareMostRecent(
  left: AssociatedCompletion,
  right: AssociatedCompletion,
): number {
  return (
    right.run.startedAt.localeCompare(left.run.startedAt) ||
    right.workout.id.localeCompare(left.workout.id) ||
    right.run.id.localeCompare(left.run.id)
  );
}

export function normalizeAdaptationHistory(
  request: NormalizeAdaptationHistoryRequest,
): AdaptationHistoryNormalizationResult {
  const issues: AdaptationHistoryIssue[] = [];

  if (
    !Number.isSafeInteger(request.recentRunWindowSize) ||
    request.recentRunWindowSize < 1
  ) {
    issues.push(
      issue(
        "invalid_recent_run_window",
        "recentRunWindowSize",
        "Use a positive whole-number recent-run window size.",
      ),
    );
  }

  if (
    calendarDaysBetween(
      request.currentWeekStartDate,
      request.currentWeekEndDate,
    ) !== 6
  ) {
    issues.push(
      issue(
        "invalid_week_window",
        "currentWeekEndDate",
        "The evidence week must contain exactly seven calendar days.",
      ),
    );
  }
  if (
    request.evaluationDate < request.currentWeekStartDate ||
    request.evaluationDate > request.currentWeekEndDate
  ) {
    issues.push(
      issue(
        "evaluation_outside_week",
        "evaluationDate",
        "The evaluation date must fall inside the evidence week.",
      ),
    );
  }

  const state = request.activePlanState;
  if (state === null) {
    issues.push(
      issue(
        "missing_active_plan_state",
        "activePlanState",
        "A server-approved active-plan state is required.",
      ),
    );
    return notReady(issues);
  }
  if (state.userId !== request.ownerId) {
    issues.push(
      issue(
        "active_state_owner_mismatch",
        "activePlanState.userId",
        "The active-plan state must belong to the requested owner.",
      ),
    );
  }

  const matchingPlans = request.plans.filter(
    (plan) => plan.id === state.activePlanId,
  );
  if (matchingPlans.length === 0) {
    issues.push(
      issue(
        "active_plan_not_found",
        "activePlanState.activePlanId",
        "The active-plan state does not resolve to a loaded plan.",
      ),
    );
    return notReady(issues);
  }
  if (matchingPlans.length > 1) {
    issues.push(
      issue(
        "duplicate_active_plan",
        "plans",
        "The active-plan identifier resolves to more than one loaded plan.",
      ),
    );
    return notReady(issues);
  }

  const activePlan = matchingPlans[0] as TrainingPlan;
  if (activePlan.userId !== request.ownerId) {
    issues.push(
      issue(
        "active_plan_owner_mismatch",
        "plans.userId",
        "The active plan must belong to the requested owner.",
      ),
    );
  }
  if (activePlan.status !== "active") {
    issues.push(
      issue(
        "active_plan_not_active",
        "plans.status",
        "The authoritative active-plan pointer must resolve to an active plan.",
      ),
    );
  }
  if (
    request.currentWeekStartDate < activePlan.startDate ||
    request.currentWeekEndDate > (activePlan.endDate ?? activePlan.targetRaceDate)
  ) {
    issues.push(
      issue(
        "week_outside_plan",
        "currentWeekStartDate",
        "The evidence week must be contained within the active plan.",
      ),
    );
  }
  if (request.evaluationDate > activePlan.targetRaceDate) {
    issues.push(
      issue(
        "evaluation_after_race",
        "evaluationDate",
        "Adaptation history cannot be normalized after the target race date.",
      ),
    );
  }

  const activePlanWorkouts = request.workouts.filter(
    (workout) => workout.planId === activePlan.id,
  );
  const workoutsById = new Map<PlannedWorkoutId, PlannedWorkout>();
  for (const workout of activePlanWorkouts) {
    if (workout.userId !== request.ownerId) {
      issues.push(
        issue(
          "workout_owner_mismatch",
          `workouts.${workout.id}.userId`,
          "Every active-plan workout must belong to the requested owner.",
        ),
      );
    }
    if (
      workout.scheduledDate < activePlan.startDate ||
      workout.scheduledDate > (activePlan.endDate ?? activePlan.targetRaceDate)
    ) {
      issues.push(
        issue(
          "workout_outside_plan",
          `workouts.${workout.id}.scheduledDate`,
          "Every active-plan workout must fall within the plan dates.",
        ),
      );
    }
    if (workoutsById.has(workout.id)) {
      issues.push(
        issue(
          "duplicate_workout",
          `workouts.${workout.id}`,
          "Active-plan workout identifiers must be unique.",
        ),
      );
    } else {
      workoutsById.set(workout.id, workout);
    }
  }

  const runsByWorkout = new Map<string, CompletedRun[]>();
  for (const run of request.runs) {
    const hasPlanId = run.plannedWorkoutPlanId !== undefined;
    const hasWorkoutId = run.plannedWorkoutId !== undefined;
    if (hasPlanId !== hasWorkoutId) {
      issues.push(
        issue(
          "partial_run_association",
          `runs.${run.id}.plannedWorkoutId`,
          "A planned-run association requires both plan and workout identifiers.",
        ),
      );
      continue;
    }
    if (!hasPlanId) continue;
    if (run.plannedWorkoutPlanId !== activePlan.id) {
      if (workoutsById.has(run.plannedWorkoutId as PlannedWorkoutId)) {
        issues.push(
          issue(
            "cross_plan_run_association",
            `runs.${run.id}.plannedWorkoutPlanId`,
            "A run cannot name an active-plan workout under another plan.",
          ),
        );
      }
      continue;
    }
    if (run.userId !== request.ownerId) {
      issues.push(
        issue(
          "run_owner_mismatch",
          `runs.${run.id}.userId`,
          "Every run associated with the active plan must belong to the owner.",
        ),
      );
    }

    const associatedWorkout = workoutsById.get(
      run.plannedWorkoutId as PlannedWorkoutId,
    );
    if (associatedWorkout === undefined) {
      issues.push(
        issue(
          "associated_workout_not_found",
          `runs.${run.id}.plannedWorkoutId`,
          "The associated active-plan workout was not loaded.",
        ),
      );
      continue;
    }

    const key = workoutAssociationKey(
      activePlan.id,
      associatedWorkout.id,
    );
    const associatedRuns = runsByWorkout.get(key) ?? [];
    associatedRuns.push(run);
    runsByWorkout.set(key, associatedRuns);
  }

  const associatedCompletions: AssociatedCompletion[] = [];
  for (const workout of activePlanWorkouts) {
    const associatedRuns =
      runsByWorkout.get(workoutAssociationKey(activePlan.id, workout.id)) ?? [];
    if (associatedRuns.length > 1) {
      issues.push(
        issue(
          "duplicate_workout_completion",
          `workouts.${workout.id}`,
          "A planned workout cannot have more than one completed run.",
        ),
      );
    }
    if (workout.kind === "rest") {
      if (associatedRuns.length > 0) {
        issues.push(
          issue(
            "rest_workout_completion",
            `workouts.${workout.id}`,
            "A rest workout cannot have an associated completed run.",
          ),
        );
      }
      continue;
    }
    if (workout.status === "completed" && associatedRuns.length === 0) {
      issues.push(
        issue(
          "completed_workout_missing_run",
          `workouts.${workout.id}.status`,
          "A completed workout requires exactly one associated run.",
        ),
      );
      continue;
    }
    if (workout.status !== "completed" && associatedRuns.length > 0) {
      issues.push(
        issue(
          "workout_status_mismatch",
          `workouts.${workout.id}.status`,
          "A planned or skipped workout cannot have a completed run.",
        ),
      );
      continue;
    }
    const completedRun = associatedRuns[0];
    if (workout.status === "completed" && completedRun !== undefined) {
      const runDate = dateOnlyForRun(completedRun);
      if (runDate > request.evaluationDate) {
        issues.push(
          issue(
            "completed_run_after_evaluation",
            `runs.${completedRun.id}.startedAt`,
            "A completed run cannot occur after the evaluation date.",
          ),
        );
      }
      associatedCompletions.push({
        workout,
        run: completedRun,
        runDate,
      });
    }
  }

  const triggerWorkout = workoutsById.get(request.triggerWorkoutId);
  if (triggerWorkout === undefined) {
    issues.push(
      issue(
        "trigger_workout_not_found",
        "triggerWorkoutId",
        "The trigger must identify a loaded active-plan workout.",
      ),
    );
  } else {
    if (
      triggerWorkout.scheduledDate < request.currentWeekStartDate ||
      triggerWorkout.scheduledDate > request.currentWeekEndDate
    ) {
      issues.push(
        issue(
          "trigger_outside_week",
          "triggerWorkoutId",
          "The trigger workout must be inside the evidence week.",
        ),
      );
    }
    if (triggerWorkout.kind === "rest") {
      issues.push(
        issue(
          "trigger_not_run_workout",
          "triggerWorkoutId",
          "A rest workout cannot trigger adaptation history.",
        ),
      );
    } else if (
      triggerWorkout.status !== "completed" &&
      triggerWorkout.status !== "skipped"
    ) {
      issues.push(
        issue(
          "trigger_status_unsupported",
          `workouts.${triggerWorkout.id}.status`,
          "The trigger workout must be completed or skipped.",
        ),
      );
    }
  }

  if (associatedCompletions.length === 0) {
    issues.push(
      issue(
        "missing_completed_planned_run",
        "runs",
        "At least one associated completed planned run is required.",
      ),
    );
  }

  if (issues.length > 0) return notReady(issues);

  const currentWeekWorkouts = activePlanWorkouts.filter(
    (workout) =>
      workout.kind !== "rest" &&
      workout.scheduledDate >= request.currentWeekStartDate &&
      workout.scheduledDate <= request.currentWeekEndDate,
  );
  const sortedCompletions = [...associatedCompletions].sort(compareMostRecent);
  const recentCompletions = sortedCompletions.slice(
    0,
    request.recentRunWindowSize,
  );
  const recentEfforts = recentCompletions.flatMap(({ run }) =>
    run.perceivedEffort === undefined ? [] : [run.perceivedEffort],
  );
  const lastCompletion = sortedCompletions[0] as AssociatedCompletion;
  const trigger = triggerWorkout as Exclude<
    PlannedWorkout,
    { readonly kind: "rest" }
  >;

  return {
    schemaVersion: ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
    kind: "ready",
    evidence: {
      schemaVersion: ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
      ownerId: request.ownerId,
      activePlanId: activePlan.id,
      activePlanRevision: state.activePlanRevision,
      evaluatedPlanRevision: state.activePlanRevision,
      activePlanStatus: "active",
      evaluationDate: request.evaluationDate,
      currentWeekStartDate: request.currentWeekStartDate,
      currentWeekEndDate: request.currentWeekEndDate,
      triggerWorkoutId: trigger.id,
      triggerKind:
        trigger.status === "completed"
          ? "planned_run_completed"
          : "planned_run_skipped",
      currentWeek: {
        plannedRunCount: currentWeekWorkouts.length,
        completedRunCount: currentWeekWorkouts.filter(
          ({ status }) => status === "completed",
        ).length,
        skippedRunCount: currentWeekWorkouts.filter(
          ({ status }) => status === "skipped",
        ).length,
        pendingRunCount: currentWeekWorkouts.filter(
          ({ status }) => status === "planned",
        ).length,
      },
      daysUntilRace: calendarDaysBetween(
        request.evaluationDate,
        activePlan.targetRaceDate,
      ),
      daysSinceLastCompletedPlannedRun: calendarDaysBetween(
        lastCompletion.runDate,
        request.evaluationDate,
      ),
      recentRunCount: recentCompletions.length,
      recentEfforts,
      recentRunsMissingPerceivedEffort:
        recentCompletions.length - recentEfforts.length,
      safetyGateState: safetyStateFor(recentCompletions),
    },
    requiredTrustedCallerFacts: adaptationHistoryTrustedCallerFacts,
  };
}
