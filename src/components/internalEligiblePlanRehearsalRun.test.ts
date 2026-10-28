import { describe, expect, it } from "vitest";
import {
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  getRunLocalDate,
  planGenerationContractFixtures,
  projectGeneratedPlanEntities,
} from "../domain/training";
import {
  INTERNAL_ELIGIBLE_PLAN_REHEARSAL_RUN_VERSION,
  createInternalEligiblePlanRehearsalRunFixture,
  selectInternalEligiblePlanRehearsalRunFixture,
} from "./internalEligiblePlanRehearsalRun";

describe("createInternalEligiblePlanRehearsalRunFixture", () => {
  it("aligns an unassociated synthetic run to the final first-week distance workout", () => {
    const result = planGenerationContractFixtures[0].result;
    if (result.kind !== "generated") {
      throw new Error("Expected the contract fixture to generate a plan.");
    }
    const projection = projectGeneratedPlanEntities({
      proposal: result.plan,
      ownerId: createUserId("owner-1"),
      planId: createTrainingPlanId("internal-session-draft"),
      projectedAt: createUtcDateTime("2030-01-01T00:00:00.000Z"),
      status: "active",
    });
    const fixture = createInternalEligiblePlanRehearsalRunFixture(projection);

    if (fixture === null) {
      throw new Error("Expected the frozen run fixture to be available.");
    }
    const alignedWorkout = projection.workouts.find(
      (workout) => workout.id === fixture.alignedWorkoutId,
    );
    if (
      alignedWorkout === undefined ||
      alignedWorkout.kind === "rest" ||
      alignedWorkout.targetDistance === undefined
    ) {
      throw new Error("Expected a distance-based aligned workout.");
    }

    expect(fixture.version).toBe(
      INTERNAL_ELIGIBLE_PLAN_REHEARSAL_RUN_VERSION,
    );
    expect(fixture.alignedWorkoutId).toBe(alignedWorkout.id);
    expect(getRunLocalDate(fixture.run)).toBe(alignedWorkout.scheduledDate);
    expect(fixture.run.distance).toBe(alignedWorkout.targetDistance);
    expect(fixture.run.userId).toBe(projection.plan.userId);
    expect(fixture.run.plannedWorkoutId).toBeUndefined();
    expect(fixture.run.plannedWorkoutPlanId).toBeUndefined();
    const laterFirstWeekDistanceWorkout = projection.workouts.find(
      (workout) =>
        workout.kind !== "rest" &&
        workout.targetDistance !== undefined &&
        workout.scheduledDate > alignedWorkout.scheduledDate &&
        workout.scheduledDate < "2030-01-14",
    );
    expect(laterFirstWeekDistanceWorkout).toBeUndefined();

    expect(
      selectInternalEligiblePlanRehearsalRunFixture(
        "saved_profile",
        projection,
      ),
    ).toBeNull();
    expect(
      selectInternalEligiblePlanRehearsalRunFixture(
        "frozen_eligible_profile",
        projection,
      ),
    ).toEqual(fixture);
  });
});
