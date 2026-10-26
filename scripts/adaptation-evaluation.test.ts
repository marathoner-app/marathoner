import { describe, expect, it } from "vitest";
import {
  ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
  createAdaptationArtifactVersion,
  evaluateAdaptation,
  type AdaptationEvaluationInputV1,
  type PerceivedEffort,
} from "../src/domain/training";
import {
  adaptationInput,
  adaptationRules,
  draftAdaptationFixtures,
  fixtureValues,
} from "./beta-adaptation-test-support";

const evaluatorVersion = createAdaptationArtifactVersion(
  "deterministic-adaptation-evaluator@1.0.0",
);

function evaluate(input: AdaptationEvaluationInputV1) {
  return evaluateAdaptation({ input, evaluatorVersion, rules: adaptationRules });
}

describe("deterministic adaptation evaluator", () => {
  it.each(draftAdaptationFixtures.cases)(
    "matches frozen fixture $id",
    (fixture) => {
      const result = evaluate(adaptationInput(fixtureValues(fixture)));

      if (result.kind === "invalid_input") {
        throw new Error(`Unexpected invalid fixture: ${fixture.id}`);
      }
      expect({
        kind: result.kind,
        action: result.action,
        reasonCode: result.reasonCode,
        runnerApprovalRequired: result.runnerApprovalRequired,
      }).toEqual(fixture.expected);
      expect(result.provenance).toEqual({
        inputSchemaVersion: ADAPTATION_EVALUATION_INPUT_SCHEMA_VERSION,
        evaluatorVersion,
        basePlanArtifactVersion: adaptationRules.basePlanArtifactVersion,
        adaptationArtifactVersion: adaptationRules.adaptationArtifactVersion,
      });
      const outcome = adaptationRules.outcomes.find(
        (candidate) => candidate.reasonCode === result.reasonCode,
      );
      expect(result.explanationKey).toBe(outcome?.explanationKey);
    },
  );

  it("returns byte-for-byte stable output for identical normalized evidence", () => {
    const input = adaptationInput(draftAdaptationFixtures.defaults);

    expect(evaluate(input)).toEqual(evaluate(structuredClone(input)));
  });

  it.each([
    "harder_than_expected",
    "much_harder_than_expected",
  ] satisfies readonly PerceivedEffort[])(
    "never turns one %s signal into a material recommendation",
    (hardEffort) => {
      for (let index = 0; index < 4; index += 1) {
        const efforts: PerceivedEffort[] = Array.from(
          { length: 4 },
          () => "about_right" as const,
        );
        efforts[index] = hardEffort;
        const input = adaptationInput({
          ...draftAdaptationFixtures.defaults,
          recentEfforts: efforts,
        });

        expect(evaluate(input)).toMatchObject({
          kind: "no_change",
          action: "no_change",
          reasonCode: "ADAPT-NO-CHANGE-SINGLE-HARD-EFFORT",
          runnerApprovalRequired: false,
        });
      }
    },
  );

  it("preserves exact and just-outside decision boundaries", () => {
    const defaults = draftAdaptationFixtures.defaults;
    const repeatBoundary = adaptationInput({
      ...defaults,
      triggerKind: "planned_run_skipped",
      daysUntilRace: adaptationRules.minimumDaysUntilRaceForRepeat,
      currentWeek: {
        plannedRunCount: 4,
        completedRunCount: 2,
        skippedRunCount: 2,
        pendingRunCount: 0,
      },
    });
    const lateDisruption = {
      ...repeatBoundary,
      daysUntilRace: adaptationRules.minimumDaysUntilRaceForRepeat - 1,
    };
    const beforeLongDisruption = adaptationInput({
      ...defaults,
      daysSinceLastCompletedPlannedRun:
        adaptationRules.longDisruptionDays - 1,
    });
    const atLongDisruption = {
      ...beforeLongDisruption,
      daysSinceLastCompletedPlannedRun: adaptationRules.longDisruptionDays,
    };

    expect(evaluate(repeatBoundary)).toMatchObject({
      action: "repeat_period",
      reasonCode: "ADAPT-REPEAT-MISSED-WEEK",
    });
    expect(evaluate(lateDisruption)).toMatchObject({
      kind: "refused",
      reasonCode: "ADAPT-REFUSE-LATE-DISRUPTION",
    });
    expect(evaluate(beforeLongDisruption)).toMatchObject({
      reasonCode: "ADAPT-NO-CHANGE-ON-TRACK",
    });
    expect(evaluate(atLongDisruption)).toMatchObject({
      kind: "refused",
      reasonCode: "ADAPT-REFUSE-LONG-DISRUPTION",
    });
  });

  it("returns invalid_input for malformed evidence instead of applying rules", () => {
    const input = {
      ...adaptationInput(draftAdaptationFixtures.defaults),
      daysUntilRace: -1,
      recentEfforts: ["unsupported_effort"],
    } as unknown as AdaptationEvaluationInputV1;

    const result = evaluate(input);

    expect(result).toMatchObject({
      kind: "invalid_input",
      issues: expect.arrayContaining([
        expect.objectContaining({ field: "daysUntilRace" }),
        expect.objectContaining({ field: "recentEfforts.0" }),
      ]),
    });
    expect(result).not.toHaveProperty("provenance");
  });

  it("requires runner approval only for material recommendations", () => {
    for (const fixture of draftAdaptationFixtures.cases) {
      const result = evaluate(adaptationInput(fixtureValues(fixture)));
      if (result.kind === "invalid_input") {
        throw new Error(`Unexpected invalid fixture: ${fixture.id}`);
      }

      expect(result.runnerApprovalRequired, fixture.id).toBe(
        result.kind === "recommendation",
      );
    }
  });
});
