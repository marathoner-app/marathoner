import { describe, expect, it } from "vitest";
import {
  ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
  adaptationHistoryTrustedCallerFacts,
  normalizeAdaptationHistory,
  type AdaptationHistoryIssueCode,
  type AdaptationHistoryNormalizationResult,
  type NormalizeAdaptationHistoryRequest,
} from "./adaptationHistoryNormalization";
import {
  createDateOnly,
  createIanaTimeZone,
  createUtcDateTime,
} from "./dates";
import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
} from "./identifiers";
import type {
  ActivePlanState,
  CompletedRun,
  PlannedWorkout,
  RunWorkout,
  TrainingPlan,
  WalkRunWorkout,
  WorkoutStatus,
} from "./types";
import { createDistanceMeters, createDurationSeconds } from "./units";

const ownerId = createUserId("runner-1");
const otherOwnerId = createUserId("runner-2");
const activePlanId = createTrainingPlanId("plan-active");
const otherPlanId = createTrainingPlanId("plan-other");
const createdAt = createUtcDateTime("2026-10-01T12:00:00Z");
const updatedAt = createUtcDateTime("2026-10-18T12:00:00Z");

function plan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: activePlanId,
    userId: ownerId,
    name: "First marathon",
    startDate: createDateOnly("2026-10-01"),
    targetRaceDate: createDateOnly("2027-04-18"),
    status: "active",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function activeState(overrides: Partial<ActivePlanState> = {}): ActivePlanState {
  return {
    userId: ownerId,
    activePlanId,
    activePlanRevision: 7,
    approvedAt: updatedAt,
    updatedAt,
    ...overrides,
  };
}

function runWorkout(
  id: string,
  scheduledDate: string,
  status: WorkoutStatus,
  overrides: Partial<RunWorkout> = {},
): RunWorkout {
  return {
    id: createPlannedWorkoutId(id),
    userId: ownerId,
    planId: activePlanId,
    scheduledDate: createDateOnly(scheduledDate),
    phase: "base_building",
    status,
    kind: "run",
    purpose: "easy",
    targetDistance: createDistanceMeters(5_000),
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function walkRunWorkout(
  id: string,
  scheduledDate: string,
  status: WorkoutStatus,
  overrides: Partial<WalkRunWorkout> = {},
): WalkRunWorkout {
  return {
    id: createPlannedWorkoutId(id),
    userId: ownerId,
    planId: activePlanId,
    scheduledDate: createDateOnly(scheduledDate),
    phase: "learn_to_run",
    status,
    kind: "walk_run",
    targetDuration: createDurationSeconds(1_800),
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function restWorkout(
  id: string,
  scheduledDate: string,
  overrides: Partial<Extract<PlannedWorkout, { readonly kind: "rest" }>> = {},
): Extract<PlannedWorkout, { readonly kind: "rest" }> {
  return {
    id: createPlannedWorkoutId(id),
    userId: ownerId,
    planId: activePlanId,
    scheduledDate: createDateOnly(scheduledDate),
    phase: "base_building",
    status: "planned",
    kind: "rest",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function completedRun(
  id: string,
  workout: RunWorkout | WalkRunWorkout,
  startedAt: string,
  overrides: Partial<CompletedRun> = {},
): CompletedRun {
  return {
    id: createCompletedRunId(id),
    userId: ownerId,
    plannedWorkoutPlanId: workout.planId,
    plannedWorkoutId: workout.id,
    startedAt: createUtcDateTime(startedAt),
    timeZone: createIanaTimeZone("America/Los_Angeles"),
    distance: createDistanceMeters(5_000),
    duration: createDurationSeconds(1_800),
    perceivedEffort: "about_right",
    unusualPain: false,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function fixture(): NormalizeAdaptationHistoryRequest {
  const prior = runWorkout("prior", "2026-10-17", "completed");
  const easy = runWorkout("easy", "2026-10-20", "completed");
  const walkRun = walkRunWorkout("walk-run", "2026-10-21", "completed");
  const missed = runWorkout("missed", "2026-10-22", "skipped");
  const pending = runWorkout("pending", "2026-10-24", "planned", {
    purpose: "long",
  });
  const rest = restWorkout("rest", "2026-10-23");

  return {
    ownerId,
    activePlanState: activeState(),
    plans: [plan()],
    workouts: [prior, easy, walkRun, missed, pending, rest],
    runs: [
      completedRun("run-prior", prior, "2026-10-17T17:00:00Z", {
        perceivedEffort: "easier_than_expected",
      }),
      completedRun("run-easy", easy, "2026-10-20T17:00:00Z"),
      completedRun("run-walk", walkRun, "2026-10-22T05:00:00Z", {
        perceivedEffort: "harder_than_expected",
      }),
    ],
    evaluationDate: createDateOnly("2026-10-24"),
    currentWeekStartDate: createDateOnly("2026-10-19"),
    currentWeekEndDate: createDateOnly("2026-10-25"),
    triggerWorkoutId: missed.id,
    recentRunWindowSize: 2,
  };
}

function issueCodes(
  result: AdaptationHistoryNormalizationResult,
): readonly AdaptationHistoryIssueCode[] {
  expect(result.kind).toBe("not_ready");
  if (result.kind !== "not_ready") {
    throw new Error("Expected adaptation history to be rejected.");
  }
  return result.issues.map(({ code }) => code);
}

describe("normalizeAdaptationHistory", () => {
  it("derives deterministic objective evidence from coherent saved history", () => {
    const request = fixture();
    const result = normalizeAdaptationHistory(request);

    expect(result).toEqual(normalizeAdaptationHistory(request));
    expect(result).toEqual({
      schemaVersion: ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
      kind: "ready",
      evidence: {
        schemaVersion: ADAPTATION_HISTORY_EVIDENCE_SCHEMA_VERSION,
        ownerId,
        activePlanId,
        activePlanRevision: 7,
        evaluatedPlanRevision: 7,
        activePlanStatus: "active",
        evaluationDate: "2026-10-24",
        currentWeekStartDate: "2026-10-19",
        currentWeekEndDate: "2026-10-25",
        triggerWorkoutId: "missed",
        triggerKind: "planned_run_skipped",
        currentWeek: {
          plannedRunCount: 4,
          completedRunCount: 2,
          skippedRunCount: 1,
          pendingRunCount: 1,
        },
        daysUntilRace: 176,
        daysSinceLastCompletedPlannedRun: 3,
        recentRunCount: 2,
        recentEfforts: ["harder_than_expected", "about_right"],
        recentRunsMissingPerceivedEffort: 0,
        safetyGateState: "none_reported",
      },
      requiredTrustedCallerFacts: adaptationHistoryTrustedCallerFacts,
    });
  });

  it("counts walk-run prescriptions as planned running and accepts completion triggers", () => {
    const request = fixture();
    const walkRun = request.workouts.find(({ id }) => id === "walk-run");
    expect(walkRun).toBeDefined();

    const result = normalizeAdaptationHistory({
      ...request,
      triggerWorkoutId: createPlannedWorkoutId("walk-run"),
    });

    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.evidence.triggerKind).toBe("planned_run_completed");
      expect(result.evidence.currentWeek.plannedRunCount).toBe(4);
    }
  });

  it("uses the run's local calendar date for days since completion", () => {
    const request = fixture();
    const walkRun = request.workouts.find(({ id }) => id === "walk-run");
    expect(walkRun?.kind).toBe("walk_run");
    if (walkRun?.kind !== "walk_run") throw new Error("Missing fixture.");
    const otherRuns = request.runs.filter(({ id }) => id !== "run-walk");
    const lateHonoluluRun = completedRun(
      "run-walk",
      walkRun,
      "2026-10-22T08:30:00Z",
      { timeZone: createIanaTimeZone("Pacific/Honolulu") },
    );

    const result = normalizeAdaptationHistory({
      ...request,
      runs: [...otherRuns, lateHonoluluRun],
    });

    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.evidence.daysSinceLastCompletedPlannedRun).toBe(3);
    }
  });

  it("caps recent evidence before counting unanswered effort and safety fields", () => {
    const request = fixture();
    const latestRun = request.runs.find(({ id }) => id === "run-walk");
    expect(latestRun).toBeDefined();
    const runs = request.runs.map((run) =>
      run.id === latestRun?.id
        ? { ...run, perceivedEffort: undefined, unusualPain: undefined }
        : run,
    );

    const result = normalizeAdaptationHistory({
      ...request,
      runs,
      recentRunWindowSize: 1,
    });

    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.evidence.recentRunCount).toBe(1);
      expect(result.evidence.recentEfforts).toEqual([]);
      expect(result.evidence.recentRunsMissingPerceivedEffort).toBe(1);
      expect(result.evidence.safetyGateState).toBe("not_answered");
    }
  });

  it("gives a reported safety concern precedence over unanswered runs", () => {
    const request = fixture();
    const runs = request.runs.map((run) => {
      if (run.id === "run-walk") return { ...run, unusualPain: undefined };
      if (run.id === "run-easy") return { ...run, unusualPain: true };
      return run;
    });

    const result = normalizeAdaptationHistory({ ...request, runs });

    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.evidence.safetyGateState).toBe("requires_review");
    }
  });

  it("ignores unplanned runs and completed runs associated with historical plans", () => {
    const request = fixture();
    const unplanned = {
      ...request.runs[0],
      id: createCompletedRunId("unplanned"),
      plannedWorkoutPlanId: undefined,
      plannedWorkoutId: undefined,
      unusualPain: true,
    };
    const historical = {
      ...request.runs[0],
      id: createCompletedRunId("historical"),
      plannedWorkoutPlanId: otherPlanId,
      plannedWorkoutId: createPlannedWorkoutId("historical-workout"),
      unusualPain: true,
    };

    const result = normalizeAdaptationHistory({
      ...request,
      runs: [...request.runs, unplanned, historical],
    });

    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.evidence.recentRunCount).toBe(2);
      expect(result.evidence.safetyGateState).toBe("none_reported");
    }
  });

  it.each([
    [0, "invalid_recent_run_window"],
    [1.5, "invalid_recent_run_window"],
  ] as const)("rejects an invalid recent-run window of %s", (size, code) => {
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...fixture(),
          recentRunWindowSize: size,
        }),
      ),
    ).toContain(code);
  });

  it.each([
    ["2026-10-24", "invalid_week_window"],
    ["2026-10-26", "invalid_week_window"],
  ] as const)("rejects a week ending on %s", (endDate, code) => {
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...fixture(),
          currentWeekEndDate: createDateOnly(endDate),
        }),
      ),
    ).toContain(code);
  });

  it("requires the evaluation date to be inside the evidence week", () => {
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...fixture(),
          evaluationDate: createDateOnly("2026-10-26"),
        }),
      ),
    ).toContain("evaluation_outside_week");
  });

  it("requires a unique authoritative active plan belonging to the owner", () => {
    const request = fixture();
    expect(
      issueCodes(
        normalizeAdaptationHistory({ ...request, activePlanState: null }),
      ),
    ).toContain("missing_active_plan_state");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          activePlanState: activeState({ userId: otherOwnerId }),
        }),
      ),
    ).toContain("active_state_owner_mismatch");
    expect(
      issueCodes(normalizeAdaptationHistory({ ...request, plans: [] })),
    ).toContain("active_plan_not_found");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          plans: [plan(), plan({ name: "Duplicate" })],
        }),
      ),
    ).toContain("duplicate_active_plan");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          plans: [plan({ userId: otherOwnerId })],
        }),
      ),
    ).toContain("active_plan_owner_mismatch");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          plans: [plan({ status: "draft" })],
        }),
      ),
    ).toContain("active_plan_not_active");
  });

  it("keeps the evidence week and evaluation inside the active plan lifecycle", () => {
    const request = fixture();
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          plans: [plan({ startDate: createDateOnly("2026-10-20") })],
        }),
      ),
    ).toContain("week_outside_plan");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          evaluationDate: createDateOnly("2027-04-19"),
        }),
      ),
    ).toContain("evaluation_after_race");
  });

  it("rejects inconsistent active-plan workout identity and dates", () => {
    const request = fixture();
    const easy = request.workouts.find(({ id }) => id === "easy");
    expect(easy).toBeDefined();
    if (easy === undefined) throw new Error("Missing fixture.");

    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          workouts: request.workouts.map((workout) =>
            workout.id === easy.id
              ? { ...workout, userId: otherOwnerId }
              : workout,
          ),
        }),
      ),
    ).toContain("workout_owner_mismatch");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          workouts: request.workouts.map((workout) =>
            workout.id === easy.id
              ? { ...workout, scheduledDate: createDateOnly("2027-04-19") }
              : workout,
          ),
        }),
      ),
    ).toContain("workout_outside_plan");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          workouts: [...request.workouts, easy],
        }),
      ),
    ).toContain("duplicate_workout");
  });

  it("requires complete, owner-matched, same-plan run associations", () => {
    const request = fixture();
    const run = request.runs[0] as CompletedRun;
    const activeWorkoutId = createPlannedWorkoutId("easy");

    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          runs: [
            ...request.runs,
            {
              ...run,
              id: createCompletedRunId("partial"),
              plannedWorkoutId: undefined,
            },
          ],
        }),
      ),
    ).toContain("partial_run_association");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          runs: request.runs.map((candidate) =>
            candidate.id === run.id
              ? { ...candidate, userId: otherOwnerId }
              : candidate,
          ),
        }),
      ),
    ).toContain("run_owner_mismatch");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          runs: [
            ...request.runs,
            {
              ...run,
              id: createCompletedRunId("unknown-workout"),
              plannedWorkoutId: createPlannedWorkoutId("unknown"),
            },
          ],
        }),
      ),
    ).toContain("associated_workout_not_found");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          runs: [
            ...request.runs,
            {
              ...run,
              id: createCompletedRunId("cross-plan"),
              plannedWorkoutPlanId: otherPlanId,
              plannedWorkoutId: activeWorkoutId,
            },
          ],
        }),
      ),
    ).toContain("cross_plan_run_association");
  });

  it("requires exactly one completion for each completed non-rest workout", () => {
    const request = fixture();
    const easy = request.workouts.find(({ id }) => id === "easy");
    expect(easy?.kind).toBe("run");
    if (easy?.kind !== "run") throw new Error("Missing fixture.");
    const baseRun = request.runs.find(({ plannedWorkoutId }) => plannedWorkoutId === easy.id);
    expect(baseRun).toBeDefined();
    if (baseRun === undefined) throw new Error("Missing fixture.");

    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          runs: [
            ...request.runs,
            { ...baseRun, id: createCompletedRunId("duplicate-completion") },
          ],
        }),
      ),
    ).toContain("duplicate_workout_completion");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          runs: request.runs.filter(({ plannedWorkoutId }) => plannedWorkoutId !== easy.id),
        }),
      ),
    ).toContain("completed_workout_missing_run");

    const pending = request.workouts.find(({ id }) => id === "pending");
    expect(pending?.kind).toBe("run");
    if (pending?.kind !== "run") throw new Error("Missing fixture.");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          runs: [
            ...request.runs,
            completedRun("run-pending", pending, "2026-10-24T17:00:00Z"),
          ],
        }),
      ),
    ).toContain("workout_status_mismatch");

    const rest = request.workouts.find(({ id }) => id === "rest");
    expect(rest).toBeDefined();
    if (rest === undefined) throw new Error("Missing fixture.");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          runs: [
            ...request.runs,
            {
              ...baseRun,
              id: createCompletedRunId("run-rest"),
              plannedWorkoutId: rest.id,
            },
          ],
        }),
      ),
    ).toContain("rest_workout_completion");
  });

  it("rejects completions after the evidence date", () => {
    const request = fixture();
    const runs = request.runs.map((run) =>
      run.id === "run-walk"
        ? { ...run, startedAt: createUtcDateTime("2026-10-25T17:00:00Z") }
        : run,
    );
    expect(
      issueCodes(normalizeAdaptationHistory({ ...request, runs })),
    ).toContain("completed_run_after_evaluation");
  });

  it("requires a completed or skipped non-rest trigger in the evidence week", () => {
    const request = fixture();
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          triggerWorkoutId: createPlannedWorkoutId("missing"),
        }),
      ),
    ).toContain("trigger_workout_not_found");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          triggerWorkoutId: createPlannedWorkoutId("prior"),
        }),
      ),
    ).toContain("trigger_outside_week");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          triggerWorkoutId: createPlannedWorkoutId("rest"),
        }),
      ),
    ).toContain("trigger_not_run_workout");
    expect(
      issueCodes(
        normalizeAdaptationHistory({
          ...request,
          triggerWorkoutId: createPlannedWorkoutId("pending"),
        }),
      ),
    ).toContain("trigger_status_unsupported");
  });

  it("requires at least one coherent completed planned run", () => {
    const request = fixture();
    const workouts = request.workouts.map((workout) =>
      workout.kind !== "rest" && workout.status === "completed"
        ? { ...workout, status: "skipped" as const }
        : workout,
    );
    expect(
      issueCodes(
        normalizeAdaptationHistory({ ...request, workouts, runs: [] }),
      ),
    ).toContain("missing_completed_planned_run");
  });
});
