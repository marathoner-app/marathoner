import { describe, expect, it } from "vitest";
import {
  createDistanceMeters,
  createPlanGenerationArtifactVersion,
  generateDeterministicPlan,
  validatePlanGenerationContract,
  type DeterministicPlanRulesV1,
  type GeneratedPlanV1,
  type PlanGenerationReasonCode,
} from "../src/domain/training";
import {
  draftFixtures,
  draftRules,
  inputFromValues,
  packetReasonCode,
  planSupportRules,
  type DraftWeekKind,
} from "./beta-rules-test-support";

const generatorVersion = createPlanGenerationArtifactVersion(
  "deterministic-plan-generator@1.0.0",
);

const weekReasonCodeByKind: Record<
  DraftWeekKind,
  PlanGenerationReasonCode
> = {
  load: packetReasonCode("PLAN-LOAD-WEEK"),
  cutback: packetReasonCode("PLAN-CUTBACK-WEEK"),
  peak: packetReasonCode("PLAN-LOAD-WEEK"),
  taper: packetReasonCode("PLAN-TAPER-WEEK"),
  race: packetReasonCode("PLAN-RACE-WEEK"),
};

const planRules: DeterministicPlanRulesV1 = {
  ...planSupportRules,
  planName: draftRules.planFamily.name,
  planReasonCodes: [
    packetReasonCode("ELIG-CONSISTENT-RUNNER"),
    packetReasonCode("ELIG-BASE-WITHIN-BOUNDS"),
    packetReasonCode("FEAS-RACE-HORIZON-SUPPORTED"),
    packetReasonCode("PLAN-COMPLETION-GOAL"),
    packetReasonCode("PLAN-FOUR-DAY-RHYTHM"),
  ],
  positionPurposes: draftRules.planFamily.positionPurposes,
  leadInWeek: {
    phase: draftRules.planFamily.leadInWeek.phase,
    distancesMetersByPosition:
      draftRules.planFamily.leadInWeek.distancesMetersByPosition.map(
        createDistanceMeters,
      ),
    reasonCodes: draftRules.planFamily.leadInWeek.reasonCodes.map(
      packetReasonCode,
    ),
  },
  coreWeeks: draftRules.planFamily.coreWeeks.map((week) => ({
    phase: week.phase,
    distancesMetersByPosition: week.distancesMetersByPosition.map(
      createDistanceMeters,
    ),
    reasonCodes: [weekReasonCodeByKind[week.kind]],
  })),
  raceWeek: {
    finalPositionPurpose: draftRules.planFamily.raceWeek.finalPositionPurpose,
    raceDistanceMeters: createDistanceMeters(
      draftRules.planFamily.raceWeek.raceDistanceMeters,
    ),
  },
  recoveryWeek: {
    phase: draftRules.planFamily.recoveryWeek.phase,
    days: draftRules.planFamily.recoveryWeek.days,
    reasonCodes: draftRules.planFamily.recoveryWeek.reasonCodes.map(
      packetReasonCode,
    ),
  },
};

function generate(fixture: (typeof draftFixtures.cases)[number]) {
  const values = { ...draftFixtures.defaults, ...fixture.changes };
  const input = inputFromValues(values);
  const result = generateDeterministicPlan({
    input,
    cohortEligibilityConfirmed: values.cohortEligibilityConfirmed,
    generatorVersion,
    rules: planRules,
  });
  return { input, result };
}

function generatedPlanFor(fixtureId: string): GeneratedPlanV1 {
  const fixture = draftFixtures.cases.find((entry) => entry.id === fixtureId);
  if (fixture === undefined) throw new Error(`Missing fixture: ${fixtureId}`);
  const { result } = generate(fixture);
  if (result.kind !== "generated") {
    throw new Error(`Expected generated result for ${fixtureId}`);
  }
  return result.plan;
}

describe("deterministic plan generator", () => {
  it.each(draftFixtures.cases)(
    "matches frozen fixture $id",
    (fixture) => {
      const { input, result } = generate(fixture);

      expect(validatePlanGenerationContract(input, result), fixture.id).toEqual(
        [],
      );
      expect(result.kind).toBe(fixture.expectedKind);
      if (result.kind === "unsupported") {
        expect(result.reasonCodes).toEqual(fixture.expectedReasonCodes);
        expect(result.provenance).toEqual({
          inputSchemaVersion: input.schemaVersion,
          generatorVersion,
          rulesetVersion: input.rulesetVersion,
        });
        expect(result).not.toHaveProperty("plan");
      }
      if (result.kind === "generated") {
        const expected = fixture.expectedPlan;
        if (expected === undefined) {
          throw new Error(`Missing expected plan summary for ${fixture.id}`);
        }
        const trainingWeeks = result.plan.weeks.slice(0, -1);
        const raceWeek = result.plan.weeks.find((week) =>
          week.workouts.some(
            (workout) => workout.kind === "run" && workout.purpose === "race",
          ),
        );
        const nonRaceRuns = trainingWeeks.flatMap((week) =>
          week.workouts.filter(
            (workout) =>
              workout.kind === "run" && workout.purpose !== "race",
          ),
        );
        const weeklyDistances = trainingWeeks.map((week) =>
          week.workouts.reduce(
            (total, workout) =>
              total +
              (workout.kind === "run" && workout.target.kind === "distance"
                ? workout.target.distance
                : 0),
            0,
          ),
        );

        expect(result.plan.weeks).toHaveLength(expected.totalGeneratedWeeks);
        expect(
          result.plan.weeks.length -
            draftRules.planFamily.coreTrainingWeeks -
            1,
        ).toBe(expected.leadInWeeks);
        expect(raceWeek?.weekNumber).toBe(expected.raceWeek);
        expect(result.plan.weeks.at(-1)?.weekNumber).toBe(
          expected.recoveryWeek,
        );
        expect(Math.max(...weeklyDistances)).toBe(
          expected.peakTrainingWeekDistanceMeters,
        );
        expect(
          Math.max(
            ...nonRaceRuns.map((workout) =>
              workout.kind === "run" && workout.target.kind === "distance"
                ? workout.target.distance
                : 0,
            ),
          ),
        ).toBe(expected.peakLongRunDistanceMeters);
      }
    },
  );

  it("creates the complete race and recovery calendar", () => {
    const plan = generatedPlanFor("supported-interior");
    const raceWeek = plan.weeks.at(-2);
    const raceRun = raceWeek?.workouts.at(-1);
    const recoveryWeek = plan.weeks.at(-1);

    expect(plan.provenance).toEqual({
      inputSchemaVersion: "plan-generation-input@1",
      generatorVersion,
      rulesetVersion: planRules.rulesetVersion,
    });
    expect(raceWeek?.endDate).toBe(plan.targetRaceDate);
    expect(raceRun).toMatchObject({
      kind: "run",
      purpose: "race",
      scheduledDate: plan.targetRaceDate,
      target: {
        kind: "distance",
        distance: draftRules.planFamily.raceWeek.raceDistanceMeters,
      },
    });
    expect(raceRun).not.toHaveProperty("paceTarget");
    expect(raceRun).not.toHaveProperty("finishTimeTarget");
    expect(recoveryWeek).toMatchObject({
      phase: "recovery",
      startDate: expect.any(String),
      endDate: plan.endDate,
    });
    expect(recoveryWeek?.workouts).toHaveLength(
      draftRules.planFamily.postRaceRecoveryDays,
    );
    expect(
      recoveryWeek?.workouts.every((workout) => workout.kind === "rest"),
    ).toBe(true);
  });

  it("uses the exact injected weekday rhythm for every training week", () => {
    const plan = generatedPlanFor("supported-upper-boundary");
    const trainingWeeks = plan.weeks.slice(0, -1);

    for (const week of trainingWeeks) {
      expect(
        week.workouts.map((workout) =>
          new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            timeZone: "UTC",
          })
            .format(new Date(`${workout.scheduledDate}T00:00:00.000Z`))
            .toLowerCase(),
        ),
      ).toEqual(["tuesday", "thursday", "saturday", "sunday"]);
    }
  });

  it("copies every injected lead-in and core week without improvising", () => {
    const plan = generatedPlanFor("supported-upper-boundary");
    const trainingWeeks = plan.weeks.slice(0, -1);
    const expectedWeekRules = [
      ...Array.from({ length: 4 }, () => planRules.leadInWeek),
      ...planRules.coreWeeks,
    ];

    expect(trainingWeeks).toHaveLength(expectedWeekRules.length);
    trainingWeeks.forEach((week, weekIndex) => {
      const expectedWeek = expectedWeekRules[weekIndex];
      const isRaceWeek = weekIndex === expectedWeekRules.length - 1;
      const expectedDistances = expectedWeek.distancesMetersByPosition.map(
        (distance, positionIndex) =>
          isRaceWeek &&
          positionIndex ===
            expectedWeek.distancesMetersByPosition.length - 1
            ? planRules.raceWeek.raceDistanceMeters
            : distance,
      );
      const expectedPurposes = planRules.positionPurposes.map(
        (purpose, positionIndex) =>
          isRaceWeek &&
          positionIndex === planRules.positionPurposes.length - 1
            ? planRules.raceWeek.finalPositionPurpose
            : purpose,
      );

      expect(week.phase).toBe(expectedWeek.phase);
      expect(week.reasonCodes).toEqual(expectedWeek.reasonCodes);
      expect(
        week.workouts.map((workout) =>
          workout.kind === "run" && workout.target.kind === "distance"
            ? workout.target.distance
            : null,
        ),
      ).toEqual(expectedDistances);
      expect(
        week.workouts.map((workout) =>
          workout.kind === "run" ? workout.purpose : null,
        ),
      ).toEqual(expectedPurposes);
    });
  });

  it("returns byte-for-byte stable structure and unique workout identifiers", () => {
    const fixture = draftFixtures.cases.find(
      (entry) => entry.id === "supported-upper-boundary",
    );
    if (fixture === undefined) throw new Error("Missing upper-boundary fixture.");

    const first = generate(fixture).result;
    const second = generate(fixture).result;
    expect(first).toEqual(second);
    if (first.kind !== "generated") throw new Error("Expected generated plan.");

    const identifiers = first.plan.weeks.flatMap((week) =>
      week.workouts.map((workout) => workout.id),
    );
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it("fails closed when the exact race weekday cannot use the preferred long-run day", () => {
    const input = inputFromValues(draftFixtures.defaults);
    const mismatchedInput = {
      ...input,
      runner: {
        ...input.runner,
        availableTrainingDays: ["monday", "wednesday", "friday", "saturday"],
        preferredLongRunDay: "saturday",
      },
    };

    const result = generateDeterministicPlan({
      input: mismatchedInput,
      cohortEligibilityConfirmed: true,
      generatorVersion,
      rules: planRules,
    });

    expect(validatePlanGenerationContract(mismatchedInput, result)).toEqual([]);
    expect(result).toMatchObject({
      kind: "invalid_input",
      issues: [
        expect.objectContaining({
          code: "inconsistent",
          field: "runner.preferredLongRunDay",
        }),
      ],
    });
  });
});
