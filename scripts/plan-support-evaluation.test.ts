import { describe, expect, it } from "vitest";
import {
  PLAN_SUPPORT_EVALUATION_SCHEMA_VERSION,
  createPlanGenerationArtifactVersion,
  evaluatePlanSupport,
  type PlanGenerationInputV1,
} from "../src/domain/training";
import {
  draftFixtures,
  inputFromValues,
  planSupportRules,
  type DraftFixtureValues,
} from "./beta-rules-test-support";

function evaluate(values: DraftFixtureValues) {
  return evaluatePlanSupport({
    input: inputFromValues(values),
    cohortEligibilityConfirmed: values.cohortEligibilityConfirmed,
    rules: planSupportRules,
  });
}

describe("plan support evaluation", () => {
  it("returns the same result for the same normalized request", () => {
    const request = {
      input: inputFromValues(draftFixtures.defaults),
      cohortEligibilityConfirmed: true,
      rules: planSupportRules,
    };

    expect(evaluatePlanSupport(request)).toEqual(evaluatePlanSupport(request));
  });

  it.each(draftFixtures.cases)(
    "matches frozen fixture $id",
    (fixture) => {
      const values = { ...draftFixtures.defaults, ...fixture.changes };
      const result = evaluate(values);

      expect(result.schemaVersion).toBe(
        PLAN_SUPPORT_EVALUATION_SCHEMA_VERSION,
      );
      expect(result.kind).toBe(
        fixture.expectedKind === "generated" ? "supported" : "unsupported",
      );
      expect(result).not.toHaveProperty("plan");
      if (result.kind === "supported" || result.kind === "unsupported") {
        expect(result.reasonCodes).toEqual(fixture.expectedReasonCodes);
        expect(result.rulesetVersion).toBe(draftFixtures.artifactVersion);
      }
    },
  );

  it.each([
    {
      label: "frequency above the upper boundary",
      changes: { currentRunningFrequencyDaysPerWeek: 6 },
      expectedReasonCode: "UNSUPPORTED-RUN-FREQUENCY",
    },
    {
      label: "longest run above the upper boundary",
      changes: { longestRecentRunDistanceMeters: 20_001 },
      expectedReasonCode: "UNSUPPORTED-LONGEST-RUN",
    },
  ])("rejects $label", ({ changes, expectedReasonCode }) => {
    const result = evaluate({ ...draftFixtures.defaults, ...changes });

    expect(result).toMatchObject({
      kind: "unsupported",
      reasonCodes: [expectedReasonCode],
    });
  });

  it("does not turn upper-bound misalignment into a horizon failure", () => {
    const result = evaluate({
      ...draftFixtures.defaults,
      wholeWeeksFromPlanStartToRace: 22,
      raceAlignmentValid: false,
    });

    expect(result).toMatchObject({
      kind: "unsupported",
      reasonCodes: ["UNSUPPORTED-RACE-ALIGNMENT"],
    });
  });

  it("rotates required training days around the preferred long-run day", () => {
    const input = inputFromValues(draftFixtures.defaults);
    const result = evaluatePlanSupport({
      input: {
        ...input,
        runner: {
          ...input.runner,
          availableTrainingDays: ["tuesday", "wednesday", "friday", "sunday"],
          preferredLongRunDay: "wednesday",
        },
      },
      cohortEligibilityConfirmed: true,
      rules: planSupportRules,
    });

    expect(result).toMatchObject({ kind: "supported", reasonCodes: [] });
  });

  it("requires the upstream safety state without interpreting other states", () => {
    const result = evaluate({
      ...draftFixtures.defaults,
      safetySignal: "pain_or_unusual_symptoms_reported",
    });

    expect(result).toMatchObject({
      kind: "invalid_input",
      issues: [
        expect.objectContaining({
          code: "inconsistent",
          field: "runner.safetySignal",
        }),
      ],
    });
    expect(result).not.toHaveProperty("reasonCodes");
  });

  it("returns contract issues before evaluating support", () => {
    const input = {
      ...inputFromValues(draftFixtures.defaults),
      schemaVersion: "plan-generation-input@2",
    } as unknown as PlanGenerationInputV1;

    const result = evaluatePlanSupport({
      input,
      cohortEligibilityConfirmed: true,
      rules: planSupportRules,
    });

    expect(result).toMatchObject({
      kind: "invalid_input",
      issues: [
        expect.objectContaining({
          code: "invalid_schema_version",
          field: "schemaVersion",
        }),
      ],
    });
  });

  it("rejects a ruleset other than the one requested by the input", () => {
    const rules = {
      ...planSupportRules,
      rulesetVersion: createPlanGenerationArtifactVersion(
        "different-rules@1.0.0",
      ),
    };

    const result = evaluatePlanSupport({
      input: inputFromValues(draftFixtures.defaults),
      cohortEligibilityConfirmed: true,
      rules,
    });

    expect(result).toMatchObject({
      kind: "invalid_input",
      issues: [
        expect.objectContaining({
          code: "inconsistent",
          field: "rulesetVersion",
        }),
      ],
    });
  });
});
