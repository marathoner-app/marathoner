import type {
  CompletedRunId,
  PlannedWorkoutId,
  ShoeId,
  TrainingPlanId,
  UserId,
} from "../../domain/training/identifiers.js";

export const userDocumentPath = (userId: UserId): string => `users/${userId}`;

export const profileDocumentPath = userDocumentPath;

export const plansCollectionPath = (userId: UserId): string =>
  `${userDocumentPath(userId)}/plans`;

export const planDocumentPath = (userId: UserId, planId: TrainingPlanId): string =>
  `${plansCollectionPath(userId)}/${planId}`;

export const activePlanStateDocumentPath = (userId: UserId): string =>
  `${userDocumentPath(userId)}/planState/active`;

export const planGenerationProvenanceDocumentPath = (
  userId: UserId,
  planId: TrainingPlanId,
): string => `${planDocumentPath(userId, planId)}/metadata/generation`;

export const workoutsCollectionPath = (
  userId: UserId,
  planId: TrainingPlanId,
): string => `${planDocumentPath(userId, planId)}/workouts`;

export const workoutDocumentPath = (
  userId: UserId,
  planId: TrainingPlanId,
  workoutId: PlannedWorkoutId,
): string => `${workoutsCollectionPath(userId, planId)}/${workoutId}`;

export const workoutCompletionGuardDocumentPath = (
  userId: UserId,
  planId: TrainingPlanId,
  workoutId: PlannedWorkoutId,
): string =>
  `${workoutDocumentPath(userId, planId, workoutId)}/completionState/current`;

export const runsCollectionPath = (userId: UserId): string =>
  `${userDocumentPath(userId)}/runs`;

export const runDocumentPath = (userId: UserId, runId: CompletedRunId): string =>
  `${runsCollectionPath(userId)}/${runId}`;

export const shoesCollectionPath = (userId: UserId): string =>
  `${userDocumentPath(userId)}/shoes`;

export const shoeDocumentPath = (userId: UserId, shoeId: ShoeId): string =>
  `${shoesCollectionPath(userId)}/${shoeId}`;
