export type TrainingFixtureSubject =
  | "userId"
  | "trainingPlanId"
  | "plannedWorkoutId"
  | "completedRunId"
  | "shoeId"
  | "distanceMeters"
  | "durationSeconds"
  | "dateOnly"
  | "utcDateTime"
  | "ianaTimeZone"
  | "userProfile"
  | "trainingPlan"
  | "plannedWorkout"
  | "completedRun"
  | "shoe";

export interface TrainingFixture {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly subject: TrainingFixtureSubject;
  readonly expected: {
    readonly valid: boolean;
    readonly reason?: string;
  };
  readonly value: unknown;
}

export interface TrainingFixtureDocument {
  readonly $schema: "./fixture-format.schema.json";
  readonly fixtureFormatVersion: 1;
  readonly contractVersion: "training-domain@1";
  readonly fixtures: readonly TrainingFixture[];
}

declare const trainingFixtures: TrainingFixtureDocument;

export default trainingFixtures;
