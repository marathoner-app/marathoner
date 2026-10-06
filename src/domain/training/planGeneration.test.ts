import { describe, expect, it } from "vitest";
import {
  GENERATED_PLAN_SCHEMA_VERSION,
  PLAN_GENERATION_INPUT_SCHEMA_VERSION,
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  createPlanGenerationArtifactVersion,
  createPlanGenerationReasonCode,
  planGenerationContractFixtures,
  validateGeneratedPlan,
  validatePlanGenerationContract,
  validatePlanGenerationInput,
  validatePlanGenerationResult,
  type GeneratedPlanV1,
  type PlanGenerationInputV1,
  type PlanGenerationResultV1,
} from ".";

function copy<Value>(value: Value): Value {
  return structuredClone(value);
}

describe("plan-generation contract", () => {
  it("uses explicit version identifiers and constrained provenance values", () => {
    expect(PLAN_GENERATION_INPUT_SCHEMA_VERSION).toBe("plan-generation-input@1");
    expect(GENERATED_PLAN_SCHEMA_VERSION).toBe("generated-plan@1");
    expect(PLAN_GENERATION_RESULT_SCHEMA_VERSION).toBe("plan-generation-result@1");

    expect(createPlanGenerationArtifactVersion("beta-rules@1.0.0")).toBe(
      "beta-rules@1.0.0",
    );
    expect(
      createPlanGenerationArtifactVersion("beta-rules@0.1.0-draft"),
    ).toBe("beta-rules@0.1.0-draft");
    expect(() => createPlanGenerationArtifactVersion("latest")).toThrow(
      /semantic version/i,
    );
    expect(createPlanGenerationReasonCode("ELIG-001")).toBe("ELIG-001");
    expect(() => createPlanGenerationReasonCode("free form copy")).toThrow(
      /reason code/i,
    );
  });

  it("checks in three unique, valid, non-UI fixture pairs", () => {
    expect(planGenerationContractFixtures.length).toBeGreaterThanOrEqual(3);
    expect(
      new Set(planGenerationContractFixtures.map((fixture) => fixture.id)).size,
    ).toBe(planGenerationContractFixtures.length);

    for (const fixture of planGenerationContractFixtures) {
      expect(validatePlanGenerationContract(fixture.input, fixture.result), fixture.id).toEqual([]);
      expect(fixture.input).not.toHaveProperty("userId");
      expect(fixture.input.runner).not.toHaveProperty("displayName");
      expect(fixture.input.runner).not.toHaveProperty("preferredDistanceUnit");
      expect(fixture.input.runner).not.toHaveProperty("timeZone");
      expect(fixture.input.runner).not.toHaveProperty("activeStep");
    }
  });

  it("returns actionable issues for invalid and conflicting runner context", () => {
    const input = copy(planGenerationContractFixtures[0].input);
    const invalid = {
      ...input,
      schemaVersion: "plan-generation-input@2",
      planStartDate: "2030-02-01",
      runner: {
        ...input.runner,
        targetRace: {
          kind: "window",
          startDate: "2030-01-20",
          endDate: "2030-01-10",
        },
        currentRunningFrequencyDaysPerWeek: 8,
        availableTrainingDays: ["tuesday", "tuesday"],
        preferredLongRunDay: "sunday",
      },
    } as unknown as PlanGenerationInputV1;

    expect(validatePlanGenerationInput(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_schema_version",
          field: "schemaVersion",
        }),
        expect.objectContaining({
          code: "out_of_order",
          field: "runner.targetRace.endDate",
        }),
        expect.objectContaining({
          code: "invalid_value",
          field: "runner.currentRunningFrequencyDaysPerWeek",
        }),
        expect.objectContaining({
          code: "duplicate",
          field: "runner.availableTrainingDays.1",
        }),
        expect.objectContaining({
          code: "inconsistent",
          field: "runner.preferredLongRunDay",
        }),
      ]),
    );
  });

  it("rejects invalid generated scheduling, targets, phase coverage, and identity", () => {
    const generated = planGenerationContractFixtures[1].result;
    if (generated.kind !== "generated") throw new Error("Expected generated fixture.");

    const invalid = copy(generated.plan) as GeneratedPlanV1;
    const firstWeek = invalid.weeks[0];
    const secondWeek = invalid.weeks[1];
    const firstWorkout = firstWeek.workouts[0];
    const secondWorkout = secondWeek.workouts[0];
    const mutated = {
      ...invalid,
      phases: [
        {
          ...invalid.phases[0],
          endWeek: 2,
        },
      ],
      weeks: [
        {
          ...firstWeek,
          workouts: [
            {
              ...firstWorkout,
              id: "workouts/invalid",
              target: { kind: "duration", duration: 0 },
            },
          ],
        },
        {
          ...secondWeek,
          startDate: "2030-02-12",
          workouts: [
            {
              ...secondWorkout,
              id: "workouts/invalid",
            },
          ],
        },
      ],
    } as unknown as GeneratedPlanV1;

    expect(validateGeneratedPlan(mutated)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_value",
          field: "weeks.0.workouts.0.id",
        }),
        expect.objectContaining({
          code: "invalid_value",
          field: "weeks.0.workouts.0.target.duration",
        }),
        expect.objectContaining({
          code: "out_of_order",
          field: "weeks.1.startDate",
        }),
        expect.objectContaining({
          code: "duplicate",
          field: "weeks.1.workouts.0.id",
        }),
        expect.objectContaining({
          code: "inconsistent",
          field: "weeks.1.phase",
        }),
      ]),
    );
  });

  it("requires an explained result and matching generation provenance", () => {
    const input = planGenerationContractFixtures[0].input;
    const emptyUnsupported = {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: "unsupported",
      provenance: {
        inputSchemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
        generatorVersion: createPlanGenerationArtifactVersion(
          "fixture-generator@1.0.0",
        ),
        rulesetVersion: input.rulesetVersion,
      },
      reasonCodes: [],
    } satisfies PlanGenerationResultV1;
    const emptyInvalidInput = {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: "invalid_input",
      issues: [],
    } satisfies PlanGenerationResultV1;

    expect(validatePlanGenerationResult(emptyUnsupported)).toContainEqual(
      expect.objectContaining({ code: "required", field: "reasonCodes" }),
    );
    expect(validatePlanGenerationResult(emptyInvalidInput)).toContainEqual(
      expect.objectContaining({ code: "required", field: "issues" }),
    );

    const generated = copy(planGenerationContractFixtures[0].result);
    if (generated.kind !== "generated") throw new Error("Expected generated fixture.");
    const invalidGeneratedResult = {
      ...generated,
      plan: {
        ...generated.plan,
        schemaVersion: "generated-plan@999",
      },
    } as unknown as PlanGenerationResultV1;
    expect(validatePlanGenerationResult(invalidGeneratedResult)).toContainEqual(
      expect.objectContaining({
        code: "invalid_schema_version",
        field: "plan.schemaVersion",
      }),
    );

    const mismatched = {
      ...generated,
      plan: {
        ...generated.plan,
        provenance: {
          ...generated.plan.provenance,
          rulesetVersion: createPlanGenerationArtifactVersion(
            "different-rules@1.0.0",
          ),
        },
      },
    };

    expect(validatePlanGenerationContract(input, mismatched)).toContainEqual(
      expect.objectContaining({
        code: "inconsistent",
        field: "result.plan.provenance.rulesetVersion",
      }),
    );
  });
});
