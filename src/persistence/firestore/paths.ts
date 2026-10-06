import type {
  CompletedRunId,
  PlannedWorkoutId,
  ShoeId,
  TrainingPlanId,
  UserId,
} from "../../domain/training";

export const userDocumentPath = (userId: UserId): string => `users/${userId}`;

export const profileDocumentPath = userDocumentPath;

export const plansCollectionPath = (userId: UserId): string =>
  `${userDocumentPath(userId)}/plans`;

export const planDocumentPath = (userId: UserId, planId: TrainingPlanId): string =>
  `${plansCollectionPath(userId)}/${planId}`;

export const workoutsCollectionPath = (
  userId: UserId,
  planId: TrainingPlanId,
): string => `${planDocumentPath(userId, planId)}/workouts`;

export const workoutDocumentPath = (
  userId: UserId,
  planId: TrainingPlanId,
  workoutId: PlannedWorkoutId,
): string => `${workoutsCollectionPath(userId, planId)}/${workoutId}`;

export const runsCollectionPath = (userId: UserId): string =>
  `${userDocumentPath(userId)}/runs`;

export const runDocumentPath = (userId: UserId, runId: CompletedRunId): string =>
  `${runsCollectionPath(userId)}/${runId}`;

export const shoesCollectionPath = (userId: UserId): string =>
  `${userDocumentPath(userId)}/shoes`;

export const shoeDocumentPath = (userId: UserId, shoeId: ShoeId): string =>
  `${shoesCollectionPath(userId)}/${shoeId}`;
