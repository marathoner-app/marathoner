import { describe, expect, it } from "vitest";
import {
  ADAPTATION_PLAN_PROJECTION_INPUT_SCHEMA_VERSION,
  AdaptationPlanProjectionError,
  projectAdaptationPlan,
  type AdaptationPlanProjectionInputV1,
  type AdaptationPlanWorkoutV1,
} from "./adaptationPlanProjection";
import { createDateOnly } from "./dates";
import {
  createPlannedWorkoutId,
  createTrainingPlanId,
} from "./identifiers";
import { createDistanceMeters, createDurationSeconds } from "./units";

function runWorkout(
  id: string,
  weekNumber: number,
  scheduledDate: string,
  distance: number,
  purpose: "easy" | "recovery" | "long" | "tempo" = "easy",
): AdaptationPlanWorkoutV1 {
  return {
    id: createPlannedWorkoutId(id),
    weekNumber,
    scheduledDate: createDateOnly(scheduledDate),
    phase: "marathon_training",
    kind: "run",
    purpose,
    target: {
      kind: "distance",
      distance: createDistanceMeters(distance),
    },
  };
}

const workouts: readonly AdaptationPlanWorkoutV1[] = [
  runWorkout("week-1-easy", 1, "2030-01-01", 4_000, "easy"),
  runWorkout("week-1-recovery", 1, "2030-01-03", 5_000, "recovery"),
  runWorkout("week-1-tempo", 1, "2030-01-05", 6_000, "tempo"),
  runWorkout("week-1-long", 1, "2030-01-07", 8_000, "long"),
  runWorkout("week-2-easy", 2, "2030-01-08", 4_500, "easy"),
  runWorkout("week-2-recovery", 2, "2030-01-10", 5_500, "recovery"),
  runWorkout("week-2-tempo", 2, "2030-01-12", 6_500, "tempo"),
  runWorkout("week-2-long", 2, "2030-01-14", 9_000, "long"),
  runWorkout("week-3-easy", 3, "2030-01-15", 5_000, "easy"),
  runWorkout("week-3-recovery", 3, "2030-01-17", 6_000, "recovery"),
  runWorkout("week-3-tempo", 3, "2030-01-19", 7_000, "tempo"),
  runWorkout("week-3-long", 3, "2030-01-21", 10_000, "long"),
];

function input(
  adjustment: AdaptationPlanProjectionInputV1["adjustment"],
  overrides: Partial<AdaptationPlanProjectionInputV1> = {},
): AdaptationPlanProjectionInputV1 {
  return {
    schemaVersion: ADAPTATION_PLAN_PROJECTION_INPUT_SCHEMA_VERSION,
    planId: createTrainingPlanId("plan-1"),
    activePlanRevision: 7,
    evaluatedPlanRevision: 7,
    targetRaceDate: createDateOnly("2030-05-05"),
    workouts,
    adjustment,
    ...overrides,
  };
}

function expectProjectionError(
  operation: () => unknown,
  code: AdaptationPlanProjectionError["code"],
): void {
  try {
    operation();
    throw new Error("Expected the projection to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(AdaptationPlanProjectionError);
    expect((error as AdaptationPlanProjectionError).code).toBe(code);
  }
}

describe("projectAdaptationPlan", () => {
  it("repeats the prior four targets on the next week's existing prescriptions", () => {
    const projection = projectAdaptationPlan(
      input({
        action: "repeat_period",
        sourceWeekNumber: 1,
        targetWeekNumber: 2,
      }),
    );

    const targetWeek = projection.workouts.filter(
      (workout) => workout.weekNumber === 2,
    );
    expect(targetWeek.map((workout) => workout.target)).toEqual(
      workouts.slice(0, 4).map((workout) => workout.target),
    );
    expect(targetWeek.map((workout) => workout.scheduledDate)).toEqual([
      "2030-01-08",
      "2030-01-10",
      "2030-01-12",
      "2030-01-14",
    ]);
    expect(targetWeek.map((workout) => workout.kind === "run" && workout.purpose)).toEqual([
      "easy",
      "recovery",
      "tempo",
      "long",
    ]);
    expect(projection.evaluatedPlanRevision).toBe(7);
    expect(projection.resultingPlanRevision).toBe(8);
    expect(projection.targetRaceDate).toBe("2030-05-05");
    expect(projection.workouts).toHaveLength(workouts.length);
    expect(projection.workouts.map((workout) => workout.id)).toEqual(
      workouts.map((workout) => workout.id),
    );
  });

  it("holds progression by capping compatible next-week targets positionally", () => {
    const mixedTargetWeek = workouts.map((workout) => {
      if (workout.id === "week-2-recovery") {
        return runWorkout(
          "week-2-recovery",
          2,
          "2030-01-10",
          4_500,
          "recovery",
        );
      }
      if (workout.id === "week-2-long") {
        return runWorkout("week-2-long", 2, "2030-01-14", 8_000, "long");
      }
      return workout;
    });
    const projection = projectAdaptationPlan(
      input(
        {
          action: "hold_progression",
          sourceWeekNumber: 1,
          targetWeekNumber: 2,
        },
        { workouts: mixedTargetWeek },
      ),
    );

    expect(
      projection.workouts
        .filter((workout) => workout.weekNumber === 2)
        .map((workout) =>
          workout.target.kind === "distance" ? workout.target.distance : null,
        ),
    ).toEqual([4_000, 4_500, 6_000, 8_000]);
    expect(projection.changes.map((change) => change.workoutId)).toEqual([
      "week-2-easy",
      "week-2-tempo",
    ]);
  });

  it("moves one easy prescription to an empty date in the same week", () => {
    const projection = projectAdaptationPlan(
      input({
        action: "reschedule",
        workoutId: createPlannedWorkoutId("week-1-easy"),
        weekNumber: 1,
        weekStartDate: createDateOnly("2030-01-01"),
        weekEndDate: createDateOnly("2030-01-07"),
        targetDate: createDateOnly("2030-01-02"),
      }),
    );

    const changed = projection.changes[0];
    expect(changed.workoutId).toBe("week-1-easy");
    expect(changed.before.scheduledDate).toBe("2030-01-01");
    expect(changed.after).toEqual({
      ...changed.before,
      scheduledDate: "2030-01-02",
    });
    expect(projection.workouts).toHaveLength(workouts.length);
    expect(
      projection.workouts.find((workout) => workout.id === "week-2-easy"),
    ).toEqual(workouts.find((workout) => workout.id === "week-2-easy"));
  });

  it("is deterministic and leaves the caller's snapshot untouched", () => {
    const request = input({
      action: "repeat_period",
      sourceWeekNumber: 1,
      targetWeekNumber: 2,
    });
    const before = JSON.stringify(request);

    expect(JSON.stringify(projectAdaptationPlan(request))).toBe(
      JSON.stringify(projectAdaptationPlan(request)),
    );
    expect(JSON.stringify(request)).toBe(before);
  });

  it("rejects stale revisions and revisions that cannot advance", () => {
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input(
            {
              action: "repeat_period",
              sourceWeekNumber: 1,
              targetWeekNumber: 2,
            },
            { activePlanRevision: 8 },
          ),
        ),
      "stale_revision",
    );
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input(
            {
              action: "repeat_period",
              sourceWeekNumber: 1,
              targetWeekNumber: 2,
            },
            {
              activePlanRevision: Number.MAX_SAFE_INTEGER,
              evaluatedPlanRevision: Number.MAX_SAFE_INTEGER,
            },
          ),
        ),
      "invalid_input",
    );
  });

  it("rejects repeat projections that increase a target", () => {
    const smallerTarget = workouts.map((workout) =>
      workout.id === "week-2-easy"
        ? runWorkout("week-2-easy", 2, "2030-01-08", 3_000, "easy")
        : workout,
    );
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input(
            {
              action: "repeat_period",
              sourceWeekNumber: 1,
              targetWeekNumber: 2,
            },
            { workouts: smallerTarget },
          ),
        ),
      "unsafe_projection",
    );
  });

  it("rejects incomplete, non-sequential, and incompatible week mappings", () => {
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input(
            {
              action: "repeat_period",
              sourceWeekNumber: 1,
              targetWeekNumber: 2,
            },
            { workouts: workouts.filter((workout) => workout.id !== "week-1-long") },
          ),
        ),
      "invalid_input",
    );
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input({
            action: "repeat_period",
            sourceWeekNumber: 1,
            targetWeekNumber: 3,
          }),
        ),
      "invalid_input",
    );
    const incompatible = workouts.map((workout) =>
      workout.id === "week-2-easy"
        ? {
            ...workout,
            target: {
              kind: "duration" as const,
              duration: createDurationSeconds(1_800),
            },
          }
        : workout,
    );
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input(
            {
              action: "hold_progression",
              sourceWeekNumber: 1,
              targetWeekNumber: 2,
            },
            { workouts: incompatible },
          ),
        ),
      "unsafe_projection",
    );
  });

  it("rejects duplicate identities, occupied dates, later-week moves, and race overflow", () => {
    const duplicateId = workouts.map((workout, index) =>
      index === 1 ? { ...workout, id: workouts[0].id } : workout,
    );
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input(
            {
              action: "repeat_period",
              sourceWeekNumber: 1,
              targetWeekNumber: 2,
            },
            { workouts: duplicateId },
          ),
        ),
      "invalid_input",
    );
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input({
            action: "reschedule",
            workoutId: createPlannedWorkoutId("week-1-easy"),
            weekNumber: 1,
            weekStartDate: createDateOnly("2030-01-01"),
            weekEndDate: createDateOnly("2030-01-07"),
            targetDate: createDateOnly("2030-01-03"),
          }),
        ),
      "unsafe_projection",
    );
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input({
            action: "reschedule",
            workoutId: createPlannedWorkoutId("week-1-easy"),
            weekNumber: 1,
            weekStartDate: createDateOnly("2030-01-01"),
            weekEndDate: createDateOnly("2030-01-07"),
            targetDate: createDateOnly("2030-01-08"),
          }),
        ),
      "unsafe_projection",
    );
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input(
            {
              action: "repeat_period",
              sourceWeekNumber: 1,
              targetWeekNumber: 2,
            },
            { targetRaceDate: createDateOnly("2030-01-13") },
          ),
        ),
      "invalid_input",
    );
  });

  it("rejects ineligible reschedules and no-op material adjustments", () => {
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input({
            action: "reschedule",
            workoutId: createPlannedWorkoutId("week-1-long"),
            weekNumber: 1,
            weekStartDate: createDateOnly("2030-01-01"),
            weekEndDate: createDateOnly("2030-01-07"),
            targetDate: createDateOnly("2030-01-06"),
          }),
        ),
      "unsafe_projection",
    );
    const equalWeeks = workouts.map((workout) => {
      if (workout.weekNumber !== 2) return workout;
      const source = workouts.find(
        (candidate) =>
          candidate.weekNumber === 1 &&
          workouts
            .filter((item) => item.weekNumber === 1)
            .indexOf(candidate) ===
            workouts.filter((item) => item.weekNumber === 2).indexOf(workout),
      );
      return source === undefined
        ? workout
        : { ...workout, target: source.target };
    });
    expectProjectionError(
      () =>
        projectAdaptationPlan(
          input(
            {
              action: "hold_progression",
              sourceWeekNumber: 1,
              targetWeekNumber: 2,
            },
            { workouts: equalWeeks },
          ),
        ),
      "no_material_change",
    );
  });

  it("rejects unknown fields instead of accepting caller-owned expansion", () => {
    const request = {
      ...input({
        action: "repeat_period",
        sourceWeekNumber: 1,
        targetWeekNumber: 2,
      }),
      resultingPlanRevision: 99,
    };

    expectProjectionError(
      () => projectAdaptationPlan(request),
      "invalid_input",
    );
  });
});
