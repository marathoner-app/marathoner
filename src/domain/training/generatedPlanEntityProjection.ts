import type { UtcDateTime } from "./dates.js";
import type { TrainingPlanId, UserId } from "./identifiers.js";
import type { GeneratedPlanV1, GeneratedWorkoutV1 } from "./planGeneration.js";
import type {
  PlannedWorkout,
  TrainingPhase,
  TrainingPlan,
  TrainingPlanStatus,
} from "./types.js";
import {
  validatePlannedWorkout,
  validateTrainingPlan,
  validateWorkoutForPlan,
} from "./validation.js";

export interface GeneratedPlanEntityProjectionOptions {
  readonly proposal: GeneratedPlanV1;
  readonly ownerId: UserId;
  readonly planId: TrainingPlanId;
  readonly projectedAt: UtcDateTime;
  readonly status: TrainingPlanStatus;
}

export interface GeneratedPlanEntityProjection {
  readonly plan: TrainingPlan;
  readonly workouts: readonly PlannedWorkout[];
}

export class GeneratedPlanEntityProjectionError extends Error {
  readonly code = "invalid_generated_plan_entity_projection" as const;

  constructor(message: string) {
    super(message);
    this.name = "GeneratedPlanEntityProjectionError";
  }
}

function projectWorkout(
  generated: GeneratedWorkoutV1,
  phase: TrainingPhase,
  ownerId: UserId,
  planId: TrainingPlanId,
  projectedAt: UtcDateTime,
): PlannedWorkout {
  const base = {
    id: generated.id,
    userId: ownerId,
    planId,
    scheduledDate: generated.scheduledDate,
    phase,
    status: "planned" as const,
    createdAt: projectedAt,
    updatedAt: projectedAt,
  };

  if (generated.kind === "rest") return { ...base, kind: "rest" };

  const target =
    generated.target.kind === "distance"
      ? { targetDistance: generated.target.distance }
      : { targetDuration: generated.target.duration };

  return generated.kind === "run"
    ? { ...base, ...target, kind: "run", purpose: generated.purpose }
    : { ...base, ...target, kind: "walk_run" };
}

export function projectGeneratedPlanEntities({
  proposal,
  ownerId,
  planId,
  projectedAt,
  status,
}: GeneratedPlanEntityProjectionOptions): GeneratedPlanEntityProjection {
  const plan: TrainingPlan = {
    id: planId,
    userId: ownerId,
    name: proposal.name,
    startDate: proposal.startDate,
    targetRaceDate: proposal.targetRaceDate,
    endDate: proposal.endDate,
    completionGoal: proposal.completionGoal,
    status,
    createdAt: projectedAt,
    updatedAt: projectedAt,
  };
  const workouts = proposal.weeks.flatMap((week) =>
    week.workouts.map((workout) =>
      projectWorkout(workout, week.phase, ownerId, planId, projectedAt),
    ),
  );
  const validationIssues = [
    ...validateTrainingPlan(plan),
    ...workouts.flatMap((workout) => [
      ...validatePlannedWorkout(workout),
      ...validateWorkoutForPlan(workout, plan),
    ]),
  ];

  if (validationIssues.length > 0) {
    throw new GeneratedPlanEntityProjectionError(
      "The generated plan did not project into valid training entities.",
    );
  }

  return { plan, workouts };
}
