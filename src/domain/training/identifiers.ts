declare const identifierBrand: unique symbol;

export {
  createCompletedRunId,
  isCompletedRunIdValue,
} from "@marathoner/training-contract";
export type { CompletedRunId } from "@marathoner/training-contract";

type Identifier<EntityName extends string> = string & {
  readonly [identifierBrand]: EntityName;
};

export type UserId = Identifier<"User">;
export type TrainingPlanId = Identifier<"TrainingPlan">;
export type PlannedWorkoutId = Identifier<"PlannedWorkout">;
export type ShoeId = Identifier<"Shoe">;

function createIdentifier<EntityName extends string>(
  value: string,
  entityName: EntityName,
): Identifier<EntityName> {
  if (!isIdentifierValue(value)) {
    throw new Error(`${entityName} identifier must be non-empty and cannot contain slashes.`);
  }

  return value as Identifier<EntityName>;
}

export function isIdentifierValue(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && !value.includes("/");
}

export const createUserId = (value: string): UserId => createIdentifier(value, "User");

export const createTrainingPlanId = (value: string): TrainingPlanId =>
  createIdentifier(value, "TrainingPlan");

export const createPlannedWorkoutId = (value: string): PlannedWorkoutId =>
  createIdentifier(value, "PlannedWorkout");

export const createShoeId = (value: string): ShoeId => createIdentifier(value, "Shoe");
