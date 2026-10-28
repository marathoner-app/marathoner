import { describe, expect, it } from "vitest";
import {
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
} from ".";
import {
  GeneratedPlanEntityProjectionError,
  projectGeneratedPlanEntities,
} from "./generatedPlanEntityProjection";
import { planGenerationContractFixtures } from "./planGenerationFixtures";

const generatedResult = planGenerationContractFixtures[0]?.result;

if (generatedResult?.kind !== "generated") {
  throw new Error("Expected the first contract fixture to contain a plan.");
}

const ownerId = createUserId("owner-1");
const planId = createTrainingPlanId("session-plan-1");
const projectedAt = createUtcDateTime("2026-10-28T18:00:00.000Z");

describe("projectGeneratedPlanEntities", () => {
  it("projects the generated plan and every workout into canonical entities", () => {
    const projection = projectGeneratedPlanEntities({
      proposal: generatedResult.plan,
      ownerId,
      planId,
      projectedAt,
      status: "active",
    });

    expect(projection.plan).toEqual({
      id: planId,
      userId: ownerId,
      name: "Synthetic contract plan",
      startDate: "2030-01-07",
      targetRaceDate: "2030-01-13",
      endDate: "2030-01-13",
      completionGoal: "complete_first_marathon",
      status: "active",
      createdAt: projectedAt,
      updatedAt: projectedAt,
    });
    expect(projection.workouts).toEqual([
      {
        id: "fixture-week-1-easy",
        userId: ownerId,
        planId,
        scheduledDate: "2030-01-08",
        phase: "base_building",
        status: "planned",
        kind: "run",
        purpose: "easy",
        targetDistance: 5_000,
        createdAt: projectedAt,
        updatedAt: projectedAt,
      },
      {
        id: "fixture-week-1-rest",
        userId: ownerId,
        planId,
        scheduledDate: "2030-01-09",
        phase: "base_building",
        status: "planned",
        kind: "rest",
        createdAt: projectedAt,
        updatedAt: projectedAt,
      },
    ]);
  });

  it("rejects a generated plan that cannot become valid training entities", () => {
    expect(() =>
      projectGeneratedPlanEntities({
        proposal: { ...generatedResult.plan, name: "" },
        ownerId,
        planId,
        projectedAt,
        status: "draft",
      }),
    ).toThrow(GeneratedPlanEntityProjectionError);
  });
});
