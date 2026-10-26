import { describe, expect, it } from "vitest";
import draftFixturesText from "../docs/methodology/artifacts/beta-rules/0.1.0-draft/fixtures.json?raw";
import draftRulesText from "../docs/methodology/artifacts/beta-rules/0.1.0-draft/beta-rules.json?raw";
import {
  PLAN_GENERATION_INPUT_SCHEMA_VERSION,
  PLAN_SUPPORT_EVALUATION_SCHEMA_VERSION,
  createDateOnly,
  createDistanceMeters,
  createPlanGenerationArtifactVersion,
  createPlanGenerationReasonCode,
  evaluatePlanSupport,
  type PlanGenerationInputV1,
  type PlanGenerationSafetySignal,
  type PlanSupportRulesV1,
  type RunningExperienceLevel,
  type Weekday,
} from "../src/domain/training";

interface DraftRulesPacket {
  readonly artifactVersion: string;
  readonly eligibility: {
    readonly experienceLevel: RunningExperienceLevel;
    readonly consistentRunningWeeks: { readonly minimum: number };
    readonly currentWeeklyDistanceMeters: {
      readonly minimum: number;
      readonly maximum: number;
    };
    readonly currentRunningFrequencyDaysPerWeek: {
      readonly minimum: number;
      readonly maximum: number;
    };
    readonly longestRecentRunDistanceMeters: {
      readonly minimum: number;
      readonly maximum: number;
    };
    readonly availableTrainingDays: { readonly minimum: number };
    readonly scheduleConstraints: { readonly supported: "omitted" };
    readonly safetySignal: { readonly requiredUpstreamState: "none_reported" };
  };
  readonly feasibility: {
    readonly targetRaceKind: "date";
    readonly minimumWholeWeeksFromPlanStartToRace: number;
    readonly maximumWholeWeeksFromPlanStartToRace: number;
  };
  readonly planFamily: {
    readonly trainingDayPositionsRelativeToPreferredLongRunDay: readonly number[];
  };
  readonly unsupportedEvaluation: { readonly order: readonly string[] };
}

interface DraftFixtureValues {
  readonly cohortEligibilityConfirmed: boolean;
  readonly experienceLevel: RunningExperienceLevel;
  readonly consistentRunningWeeks: number;
  readonly currentWeeklyDistanceMeters: number;
  readonly currentRunningFrequencyDaysPerWeek: number;
  readonly longestRecentRunDistanceMeters: number;
  readonly targetRaceKind: "date" | "window";
  readonly wholeWeeksFromPlanStartToRace: number;
  readonly raceAlignmentValid: boolean;
  readonly availablePatternValid: boolean;
  readonly scheduleConstraints: string | null;
  readonly safetySignal: PlanGenerationSafetySignal;
}

interface DraftFixtureCase {
  readonly id: string;
  readonly changes: Partial<DraftFixtureValues>;
  readonly expectedKind: "generated" | "unsupported";
  readonly expectedReasonCodes: readonly string[];
}

interface DraftFixturesPacket {
  readonly artifactVersion: string;
  readonly defaults: DraftFixtureValues;
  readonly cases: readonly DraftFixtureCase[];
}

const draftRules = JSON.parse(draftRulesText) as DraftRulesPacket;
const draftFixtures = JSON.parse(draftFixturesText) as DraftFixturesPacket;
const planStartDate = createDateOnly("2030-01-07");

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function reasonAt(index: number) {
  return createPlanGenerationReasonCode(
    draftRules.unsupportedEvaluation.order[index],
  );
}

const planSupportRules: PlanSupportRulesV1 = {
  rulesetVersion: createPlanGenerationArtifactVersion(
    draftRules.artifactVersion,
  ),
  eligibleExperienceLevel: draftRules.eligibility.experienceLevel,
  minimumConsistentRunningWeeks:
    draftRules.eligibility.consistentRunningWeeks.minimum,
  currentWeeklyDistanceMeters:
    draftRules.eligibility.currentWeeklyDistanceMeters,
  currentRunningFrequencyDaysPerWeek:
    draftRules.eligibility.currentRunningFrequencyDaysPerWeek,
  longestRecentRunDistanceMeters:
    draftRules.eligibility.longestRecentRunDistanceMeters,
  minimumAvailableTrainingDays:
    draftRules.eligibility.availableTrainingDays.minimum,
  requiredTrainingDayPositionsRelativeToPreferredLongRunDay:
    draftRules.planFamily.trainingDayPositionsRelativeToPreferredLongRunDay,
  scheduleConstraintsSupported:
    draftRules.eligibility.scheduleConstraints.supported,
  requiredSafetySignal:
    draftRules.eligibility.safetySignal.requiredUpstreamState,
  targetRaceKind: draftRules.feasibility.targetRaceKind,
  wholeWeeksFromPlanStartToRace: {
    minimum: draftRules.feasibility.minimumWholeWeeksFromPlanStartToRace,
    maximum: draftRules.feasibility.maximumWholeWeeksFromPlanStartToRace,
  },
  reasonCodes: {
    cohortGate: reasonAt(0),
    experience: reasonAt(1),
    consistencyDuration: reasonAt(2),
    weeklyDistance: reasonAt(3),
    runFrequency: reasonAt(4),
    longestRun: reasonAt(5),
    raceDateRequired: reasonAt(6),
    raceHorizon: reasonAt(7),
    raceAlignment: reasonAt(8),
    availability: reasonAt(9),
    scheduleConstraint: reasonAt(10),
  },
  unsupportedReasonCodeOrder: draftRules.unsupportedEvaluation.order.map(
    createPlanGenerationReasonCode,
  ),
};

function inputFromValues(values: DraftFixtureValues): PlanGenerationInputV1 {
  const alignedRaceDate = addDays(
    planStartDate,
    values.wholeWeeksFromPlanStartToRace * 7 - 1,
  );
  const raceDate = createDateOnly(
    values.raceAlignmentValid ? alignedRaceDate : addDays(alignedRaceDate, 1),
  );
  const targetRace =
    values.targetRaceKind === "date"
      ? ({ kind: "date", date: raceDate } as const)
      : ({
          kind: "window",
          startDate: raceDate,
          endDate: createDateOnly(addDays(raceDate, 7)),
        } as const);
  const availableTrainingDays: readonly Weekday[] = values.availablePatternValid
    ? ["tuesday", "thursday", "saturday", "sunday"]
    : ["monday", "tuesday", "thursday", "sunday"];

  return {
    schemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
    rulesetVersion: createPlanGenerationArtifactVersion(
      draftFixtures.artifactVersion,
    ),
    planStartDate,
    runner: {
      experienceLevel: values.experienceLevel,
      consistentRunningWeeks: values.consistentRunningWeeks,
      targetRace,
      currentWeeklyDistance: createDistanceMeters(
        values.currentWeeklyDistanceMeters,
      ),
      currentRunningFrequencyDaysPerWeek:
        values.currentRunningFrequencyDaysPerWeek,
      longestRecentRunDistance: createDistanceMeters(
        values.longestRecentRunDistanceMeters,
      ),
      availableTrainingDays,
      preferredLongRunDay: "sunday",
      ...(values.scheduleConstraints === null
        ? {}
        : { scheduleConstraints: values.scheduleConstraints }),
      completionGoal: "complete_first_marathon",
      safetySignal: values.safetySignal,
    },
  };
}

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
