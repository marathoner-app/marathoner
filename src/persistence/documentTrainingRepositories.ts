import {
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUtcDateTime,
  validatePlannedWorkout,
  validateTrainingPlan,
  validateWorkoutForPlan,
  type CompletedRun,
  type PlannedWorkout,
  type PlannedWorkoutId,
  type TrainingPlan,
  type TrainingPlanId,
  type UserId,
  type UtcDateTime,
} from "../domain/training";
import type { DocumentStore, StoredDocument } from "./documentStore";
import { createDocumentRunAndShoeRepositories } from "./documentRunShoeRepositories";
import { createDocumentUserProfileRepository } from "./documentUserProfileRepository";
import { PersistenceError, toPersistenceError } from "./errors";
import {
  completedRunFromDocument,
  plannedWorkoutFromDocument,
  plannedWorkoutToDocument,
  trainingPlanFromDocument,
  trainingPlanToDocument,
} from "./firestore/converters";
import {
  planDocumentPath,
  plansCollectionPath,
  runsCollectionPath,
  workoutDocumentPath,
  workoutsCollectionPath,
} from "./firestore/paths";
import type {
  CreatePlannedWorkoutInput,
  CreateTrainingPlanInput,
  PlannedWorkoutRepository,
  TrainingPlanRepository,
  TrainingRepositories,
  UpdatePlannedWorkoutInput,
  UpdateTrainingPlanInput,
} from "./trainingRepositories";

export type PersistenceClock = () => UtcDateTime;

const systemClock: PersistenceClock = () => createUtcDateTime(new Date().toISOString());

async function safely<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toPersistenceError(error);
  }
}

function requireValidPlan(plan: TrainingPlan): void {
  const issues = validateTrainingPlan(plan);

  if (issues.length > 0) {
    throw new PersistenceError(
      "invalid_data",
      issues.map((issue) => issue.message).join(" "),
    );
  }
}

function requireValidWorkout(workout: PlannedWorkout, plan: TrainingPlan): void {
  const issues = [
    ...validatePlannedWorkout(workout),
    ...validateWorkoutForPlan(workout, plan),
  ];

  if (issues.length > 0) {
    throw new PersistenceError(
      "invalid_data",
      issues.map((issue) => issue.message).join(" "),
    );
  }
}

async function hasAssociatedRun(
  store: DocumentStore,
  userId: UserId,
  predicate: (run: CompletedRun) => boolean,
): Promise<boolean> {
  const documents = await store.list(runsCollectionPath(userId));

  return documents
    .map((document) => completedRunFromDocument(document.id, document.data, userId))
    .some(predicate);
}

class DocumentTrainingPlanRepository implements TrainingPlanRepository {
  constructor(
    private readonly store: DocumentStore,
    private readonly userId: UserId,
    private readonly clock: PersistenceClock,
  ) {}

  create(input: CreateTrainingPlanInput): Promise<TrainingPlan> {
    return safely(async () => {
      const id = createTrainingPlanId(
        this.store.createId(plansCollectionPath(this.userId)),
      );
      const now = this.clock();
      const plan: TrainingPlan = {
        ...input,
        id,
        userId: this.userId,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };

      requireValidPlan(plan);
      await this.store.set(
        planDocumentPath(this.userId, id),
        trainingPlanToDocument(plan),
      );

      return plan;
    });
  }

  get(id: TrainingPlanId): Promise<TrainingPlan | null> {
    return safely(async () => {
      const document = await this.store.get(planDocumentPath(this.userId, id));
      return document === null ? null : this.fromDocument(document);
    });
  }

  list(): Promise<TrainingPlan[]> {
    return safely(async () => {
      const documents = await this.store.list(plansCollectionPath(this.userId));

      return documents
        .map((document) => this.fromDocument(document))
        .sort((left, right) => right.startDate.localeCompare(left.startDate));
    });
  }

  update(
    id: TrainingPlanId,
    changes: UpdateTrainingPlanInput,
  ): Promise<TrainingPlan> {
    return safely(async () => {
      const existing = await this.requirePlan(id);
      const updated: TrainingPlan = {
        ...existing,
        ...changes,
        id: existing.id,
        userId: existing.userId,
        createdAt: existing.createdAt,
        updatedAt: this.clock(),
      };

      requireValidPlan(updated);
      await this.store.set(
        planDocumentPath(this.userId, id),
        trainingPlanToDocument(updated),
      );

      return updated;
    });
  }

  archive(id: TrainingPlanId): Promise<TrainingPlan> {
    return this.update(id, { status: "archived" });
  }

  permanentlyDelete(id: TrainingPlanId): Promise<void> {
    return safely(async () => {
      await this.requirePlan(id);

      if (
        await hasAssociatedRun(
          this.store,
          this.userId,
          (run) => run.plannedWorkoutPlanId === id,
        )
      ) {
        throw new PersistenceError(
          "conflict",
          "A plan associated with completed runs must be archived instead of deleted.",
        );
      }

      const workoutCollection = workoutsCollectionPath(this.userId, id);
      const workouts = await this.store.list(workoutCollection);

      if (workouts.length > 499) {
        throw new PersistenceError(
          "limit_exceeded",
          "A plan with more than 499 workouts cannot be permanently deleted in one operation.",
        );
      }

      await this.store.deleteMany([
        ...workouts.map((workout) => `${workoutCollection}/${workout.id}`),
        planDocumentPath(this.userId, id),
      ]);
    });
  }

  private async requirePlan(id: TrainingPlanId): Promise<TrainingPlan> {
    const document = await this.store.get(planDocumentPath(this.userId, id));

    if (document === null) {
      throw new PersistenceError("not_found", "Training plan was not found.");
    }

    return this.fromDocument(document);
  }

  private fromDocument(document: StoredDocument): TrainingPlan {
    return trainingPlanFromDocument(document.id, document.data, this.userId);
  }
}

class DocumentPlannedWorkoutRepository implements PlannedWorkoutRepository {
  constructor(
    private readonly store: DocumentStore,
    private readonly userId: UserId,
    private readonly plans: TrainingPlanRepository,
    private readonly clock: PersistenceClock,
  ) {}

  create(input: CreatePlannedWorkoutInput): Promise<PlannedWorkout> {
    return safely(async () => {
      const plan = await this.requirePlan(input.planId);
      const id = createPlannedWorkoutId(
        this.store.createId(workoutsCollectionPath(this.userId, input.planId)),
      );
      const now = this.clock();
      const base = {
        ...input,
        id,
        userId: this.userId,
        status: "planned" as const,
        createdAt: now,
        updatedAt: now,
      };
      const workout: PlannedWorkout =
        input.kind === "run"
          ? { ...base, kind: "run", purpose: input.purpose }
          : input.kind === "walk_run"
            ? { ...base, kind: "walk_run" }
            : { ...base, kind: "rest" };

      requireValidWorkout(workout, plan);
      await this.store.set(
        workoutDocumentPath(this.userId, input.planId, id),
        plannedWorkoutToDocument(workout),
      );

      return workout;
    });
  }

  get(
    planId: TrainingPlanId,
    id: PlannedWorkoutId,
  ): Promise<PlannedWorkout | null> {
    return safely(async () => {
      const document = await this.store.get(
        workoutDocumentPath(this.userId, planId, id),
      );

      return document === null ? null : this.fromDocument(document, planId);
    });
  }

  listForPlan(planId: TrainingPlanId): Promise<PlannedWorkout[]> {
    return safely(async () => {
      const documents = await this.store.list(
        workoutsCollectionPath(this.userId, planId),
      );

      return documents
        .map((document) => this.fromDocument(document, planId))
        .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));
    });
  }

  update(
    planId: TrainingPlanId,
    id: PlannedWorkoutId,
    changes: UpdatePlannedWorkoutInput,
  ): Promise<PlannedWorkout> {
    return safely(async () => {
      const plan = await this.requirePlan(planId);
      const existing = await this.requireWorkout(planId, id);
      const common = {
        ...existing,
        scheduledDate: changes.scheduledDate ?? existing.scheduledDate,
        phase: changes.phase ?? existing.phase,
        status: changes.status ?? existing.status,
        notes: changes.notes === null ? undefined : changes.notes ?? existing.notes,
        updatedAt: this.clock(),
      };
      let updated: PlannedWorkout;

      if (existing.kind === "rest") {
        updated = { ...common, kind: "rest" };
      } else {
        const targets = {
          targetDistance:
            changes.targetDistance === null
              ? undefined
              : changes.targetDistance ?? existing.targetDistance,
          targetDuration:
            changes.targetDuration === null
              ? undefined
              : changes.targetDuration ?? existing.targetDuration,
        };

        updated =
          existing.kind === "run"
            ? {
                ...common,
                ...targets,
                kind: "run",
                purpose: changes.purpose ?? existing.purpose,
              }
            : { ...common, ...targets, kind: "walk_run" };
      }

      requireValidWorkout(updated, plan);
      await this.store.set(
        workoutDocumentPath(this.userId, planId, id),
        plannedWorkoutToDocument(updated),
      );

      return updated;
    });
  }

  delete(
    planId: TrainingPlanId,
    id: PlannedWorkoutId,
  ): Promise<void> {
    return safely(async () => {
      await this.requireWorkout(planId, id);

      if (
        await hasAssociatedRun(
          this.store,
          this.userId,
          (run) =>
            run.plannedWorkoutPlanId === planId && run.plannedWorkoutId === id,
        )
      ) {
        throw new PersistenceError(
          "conflict",
          "A workout associated with a completed run cannot be deleted.",
        );
      }

      await this.store.delete(workoutDocumentPath(this.userId, planId, id));
    });
  }

  private async requirePlan(id: TrainingPlanId): Promise<TrainingPlan> {
    const plan = await this.plans.get(id);

    if (plan === null) {
      throw new PersistenceError("not_found", "Training plan was not found.");
    }

    return plan;
  }

  private async requireWorkout(
    planId: TrainingPlanId,
    id: PlannedWorkoutId,
  ): Promise<PlannedWorkout> {
    const document = await this.store.get(
      workoutDocumentPath(this.userId, planId, id),
    );

    if (document === null) {
      throw new PersistenceError("not_found", "Planned workout was not found.");
    }

    return this.fromDocument(document, planId);
  }

  private fromDocument(
    document: StoredDocument,
    planId: TrainingPlanId,
  ): PlannedWorkout {
    return plannedWorkoutFromDocument(
      document.id,
      document.data,
      this.userId,
      planId,
    );
  }
}

export function createDocumentTrainingRepositories(
  store: DocumentStore,
  userId: UserId,
  clock: PersistenceClock = systemClock,
): TrainingRepositories {
  const plans = new DocumentTrainingPlanRepository(store, userId, clock);
  const workouts = new DocumentPlannedWorkoutRepository(store, userId, plans, clock);

  return {
    profile: createDocumentUserProfileRepository(store, userId, clock),
    plans,
    workouts,
    ...createDocumentRunAndShoeRepositories(store, userId, workouts, clock),
  };
}
