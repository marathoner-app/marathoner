import { createDateOnly } from "./dates";
import { createPlannedWorkoutId } from "./identifiers";
import {
  GENERATED_PLAN_SCHEMA_VERSION,
  PLAN_GENERATION_INPUT_SCHEMA_VERSION,
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
  createPlanGenerationArtifactVersion,
  createPlanGenerationReasonCode,
  type PlanGenerationInputV1,
  type PlanGenerationResultV1,
} from "./planGeneration";
import { createDistanceMeters, createDurationSeconds } from "./units";

export interface PlanGenerationContractFixtureV1 {
  readonly id: string;
  readonly description: string;
  readonly input: PlanGenerationInputV1;
  readonly result: PlanGenerationResultV1;
}

const fixtureRulesetVersion = createPlanGenerationArtifactVersion(
  "fixture-rules@1.0.0",
);
const fixtureGeneratorVersion = createPlanGenerationArtifactVersion(
  "fixture-generator@1.0.0",
);
const structureReason = createPlanGenerationReasonCode("FIXTURE-STRUCTURE");
const weekReason = createPlanGenerationReasonCode("FIXTURE-WEEK");
const workoutReason = createPlanGenerationReasonCode("FIXTURE-WORKOUT");

export const planGenerationContractFixtures: readonly PlanGenerationContractFixtureV1[] = [
  {
    id: "generated-exact-date-distance-target",
    description:
      "A complete exact-date input and structurally valid distance-target proposal.",
    input: {
      schemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
      rulesetVersion: fixtureRulesetVersion,
      planStartDate: createDateOnly("2030-01-07"),
      runner: {
        experienceLevel: "consistent",
        targetRace: {
          kind: "date",
          date: createDateOnly("2030-01-13"),
        },
        currentWeeklyDistance: createDistanceMeters(30_000),
        currentRunningFrequencyDaysPerWeek: 4,
        longestRecentRunDistance: createDistanceMeters(12_000),
        recentPerformance: {
          completedOn: createDateOnly("2029-12-15"),
          distance: createDistanceMeters(10_000),
          duration: createDurationSeconds(3_600),
        },
        availableTrainingDays: [
          "tuesday",
          "thursday",
          "saturday",
          "sunday",
        ],
        preferredLongRunDay: "sunday",
        completionGoal: "complete_first_marathon",
        safetySignal: "none_reported",
      },
    },
    result: {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: "generated",
      plan: {
        schemaVersion: GENERATED_PLAN_SCHEMA_VERSION,
        name: "Synthetic contract plan",
        startDate: createDateOnly("2030-01-07"),
        targetRaceDate: createDateOnly("2030-01-13"),
        endDate: createDateOnly("2030-01-13"),
        completionGoal: "complete_first_marathon",
        provenance: {
          inputSchemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
          generatorVersion: fixtureGeneratorVersion,
          rulesetVersion: fixtureRulesetVersion,
        },
        reasonCodes: [structureReason],
        phases: [
          {
            phase: "base_building",
            startWeek: 1,
            endWeek: 1,
            reasonCodes: [structureReason],
          },
        ],
        weeks: [
          {
            weekNumber: 1,
            startDate: createDateOnly("2030-01-07"),
            endDate: createDateOnly("2030-01-13"),
            phase: "base_building",
            reasonCodes: [weekReason],
            workouts: [
              {
                id: createPlannedWorkoutId("fixture-week-1-easy"),
                kind: "run",
                purpose: "easy",
                scheduledDate: createDateOnly("2030-01-08"),
                target: {
                  kind: "distance",
                  distance: createDistanceMeters(5_000),
                },
                reasonCodes: [workoutReason],
              },
              {
                id: createPlannedWorkoutId("fixture-week-1-rest"),
                kind: "rest",
                scheduledDate: createDateOnly("2030-01-09"),
                reasonCodes: [workoutReason],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "generated-target-window-duration-target",
    description:
      "A target-window input and structurally valid multi-phase duration-target proposal.",
    input: {
      schemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
      rulesetVersion: fixtureRulesetVersion,
      planStartDate: createDateOnly("2030-02-04"),
      runner: {
        experienceLevel: "consistent",
        targetRace: {
          kind: "window",
          startDate: createDateOnly("2030-02-14"),
          endDate: createDateOnly("2030-02-17"),
        },
        currentWeeklyDistance: createDistanceMeters(36_000),
        currentRunningFrequencyDaysPerWeek: 5,
        longestRecentRunDistance: createDistanceMeters(15_000),
        availableTrainingDays: [
          "monday",
          "tuesday",
          "thursday",
          "saturday",
          "sunday",
        ],
        preferredLongRunDay: "sunday",
        scheduleConstraints: "Synthetic fixture constraint; not training advice.",
        completionGoal: "complete_first_marathon",
        safetySignal: "none_reported",
      },
    },
    result: {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: "generated",
      plan: {
        schemaVersion: GENERATED_PLAN_SCHEMA_VERSION,
        name: "Synthetic window contract plan",
        startDate: createDateOnly("2030-02-04"),
        targetRaceDate: createDateOnly("2030-02-17"),
        endDate: createDateOnly("2030-02-17"),
        completionGoal: "complete_first_marathon",
        provenance: {
          inputSchemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
          generatorVersion: fixtureGeneratorVersion,
          rulesetVersion: fixtureRulesetVersion,
        },
        reasonCodes: [structureReason],
        phases: [
          {
            phase: "base_building",
            startWeek: 1,
            endWeek: 1,
            reasonCodes: [structureReason],
          },
          {
            phase: "marathon_training",
            startWeek: 2,
            endWeek: 2,
            reasonCodes: [structureReason],
          },
        ],
        weeks: [
          {
            weekNumber: 1,
            startDate: createDateOnly("2030-02-04"),
            endDate: createDateOnly("2030-02-10"),
            phase: "base_building",
            reasonCodes: [weekReason],
            workouts: [
              {
                id: createPlannedWorkoutId("fixture-window-week-1"),
                kind: "run",
                purpose: "easy",
                scheduledDate: createDateOnly("2030-02-05"),
                target: {
                  kind: "duration",
                  duration: createDurationSeconds(1_800),
                },
                reasonCodes: [workoutReason],
              },
            ],
          },
          {
            weekNumber: 2,
            startDate: createDateOnly("2030-02-11"),
            endDate: createDateOnly("2030-02-17"),
            phase: "marathon_training",
            reasonCodes: [weekReason],
            workouts: [
              {
                id: createPlannedWorkoutId("fixture-window-week-2"),
                kind: "walk_run",
                scheduledDate: createDateOnly("2030-02-12"),
                target: {
                  kind: "duration",
                  duration: createDurationSeconds(2_100),
                },
                reasonCodes: [workoutReason],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "unsupported-result-shape",
    description:
      "A complete input and structurally valid unsupported result without prescriptive output.",
    input: {
      schemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
      rulesetVersion: fixtureRulesetVersion,
      planStartDate: createDateOnly("2030-03-04"),
      runner: {
        experienceLevel: "inconsistent",
        targetRace: {
          kind: "date",
          date: createDateOnly("2030-03-10"),
        },
        currentWeeklyDistance: createDistanceMeters(8_000),
        currentRunningFrequencyDaysPerWeek: 2,
        longestRecentRunDistance: createDistanceMeters(5_000),
        availableTrainingDays: ["tuesday", "thursday", "sunday"],
        preferredLongRunDay: "sunday",
        completionGoal: "complete_first_marathon",
        safetySignal: "pain_or_unusual_symptoms_reported",
      },
    },
    result: {
      schemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
      kind: "unsupported",
      provenance: {
        inputSchemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
        generatorVersion: fixtureGeneratorVersion,
        rulesetVersion: fixtureRulesetVersion,
      },
      reasonCodes: [
        createPlanGenerationReasonCode("FIXTURE-UNSUPPORTED"),
      ],
    },
  },
];
