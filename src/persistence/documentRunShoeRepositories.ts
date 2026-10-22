import {
  createCompletedRunId,
  createDistanceMeters,
  createShoeId,
  validateCompletedRun,
  validateShoe,
  type CompletedRun,
  type CompletedRunId,
  type DateOnly,
  type PlannedWorkout,
  type Shoe,
  type ShoeId,
  type UserId,
} from "../domain/training";
import type { DocumentStore, StoredDocument } from "./documentStore";
import type { PersistenceClock } from "./documentTrainingRepositories";
import { PersistenceError, toPersistenceError } from "./errors";
import {
  measureOperation,
  runCreationTimingNames,
  runUpdateTimingNames,
} from "./operationTiming";
import {
  completedRunFromDocument,
  completedRunToDocument,
  shoeFromDocument,
  shoeToDocument,
} from "./firestore/converters";
import {
  runDocumentPath,
  runsCollectionPath,
  shoeDocumentPath,
  shoesCollectionPath,
} from "./firestore/paths";
import type {
  CompletedRunRepository,
  CreateCompletedRunInput,
  CreateShoeInput,
  PlannedWorkoutRepository,
  ShoeRepository,
  TrainingRepositories,
  UpdateCompletedRunInput,
  UpdateShoeInput,
} from "./trainingRepositories";

async function safely<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toPersistenceError(error);
  }
}

function requireValidRun(run: CompletedRun): void {
  const issues = validateCompletedRun(run);

  if (issues.length > 0) {
    throw new PersistenceError(
      "invalid_data",
      issues.map((issue) => issue.message).join(" "),
    );
  }
}

function requireValidShoe(shoe: Shoe): void {
  const issues = validateShoe(shoe);

  if (issues.length > 0) {
    throw new PersistenceError(
      "invalid_data",
      issues.map((issue) => issue.message).join(" "),
    );
  }
}

class DocumentShoeRepository implements ShoeRepository {
  constructor(
    private readonly store: DocumentStore,
    private readonly userId: UserId,
    private readonly clock: PersistenceClock,
  ) {}

  create(input: CreateShoeInput): Promise<Shoe> {
    return safely(async () => {
      const id = createShoeId(this.store.createId(shoesCollectionPath(this.userId)));
      const now = this.clock();
      const shoe: Shoe = {
        id,
        userId: this.userId,
        name: input.name,
        startingDistance: input.startingDistance ?? createDistanceMeters(0),
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      requireValidShoe(shoe);
      await this.store.set(shoeDocumentPath(this.userId, id), shoeToDocument(shoe));
      return shoe;
    });
  }

  get(id: ShoeId): Promise<Shoe | null> {
    return safely(async () => {
      const document = await this.store.get(shoeDocumentPath(this.userId, id));
      return document === null ? null : this.fromDocument(document);
    });
  }

  list(): Promise<Shoe[]> {
    return safely(async () => {
      const documents = await this.store.list(shoesCollectionPath(this.userId));
      return documents
        .map((document) => this.fromDocument(document))
        .sort((left, right) => left.name.localeCompare(right.name));
    });
  }

  update(id: ShoeId, changes: UpdateShoeInput): Promise<Shoe> {
    return safely(async () => {
      const existing = await this.requireShoe(id);
      const updated: Shoe = {
        ...existing,
        name: changes.name ?? existing.name,
        startingDistance: changes.startingDistance ?? existing.startingDistance,
        status: changes.status ?? existing.status,
        retiredOn:
          changes.retiredOn === null
            ? undefined
            : changes.retiredOn ?? existing.retiredOn,
        updatedAt: this.clock(),
      };

      requireValidShoe(updated);
      await this.store.set(shoeDocumentPath(this.userId, id), shoeToDocument(updated));
      return updated;
    });
  }

  retire(id: ShoeId, retiredOn: DateOnly): Promise<Shoe> {
    return this.update(id, { status: "retired", retiredOn });
  }

  permanentlyDelete(id: ShoeId): Promise<void> {
    return safely(async () => {
      await this.requireShoe(id);
      const runDocuments = await this.store.list(runsCollectionPath(this.userId));
      const isInUse = runDocuments
        .map((document) => completedRunFromDocument(document.id, document.data, this.userId))
        .some((run) => run.shoeId === id);

      if (isInUse) {
        throw new PersistenceError(
          "conflict",
          "A shoe associated with completed runs must be retired instead of deleted.",
        );
      }

      await this.store.delete(shoeDocumentPath(this.userId, id));
    });
  }

  private async requireShoe(id: ShoeId): Promise<Shoe> {
    const document = await this.store.get(shoeDocumentPath(this.userId, id));

    if (document === null) {
      throw new PersistenceError("not_found", "Shoe was not found.");
    }

    return this.fromDocument(document);
  }

  private fromDocument(document: StoredDocument): Shoe {
    return shoeFromDocument(document.id, document.data, this.userId);
  }
}

class DocumentCompletedRunRepository implements CompletedRunRepository {
  constructor(
    private readonly store: DocumentStore,
    private readonly userId: UserId,
    private readonly workouts: PlannedWorkoutRepository,
    private readonly shoes: ShoeRepository,
    private readonly clock: PersistenceClock,
  ) {}

  create(input: CreateCompletedRunInput): Promise<CompletedRun> {
    return safely(() =>
      measureOperation(runCreationTimingNames.total, async () => {
        const id = createCompletedRunId(
          this.store.createId(runsCollectionPath(this.userId)),
        );
        const now = this.clock();
        const run: CompletedRun = {
          ...input,
          id,
          userId: this.userId,
          createdAt: now,
          updatedAt: now,
        };

        requireValidRun(run);
        await measureOperation(runCreationTimingNames.associations, () =>
          this.requireAssociations(run),
        );
        await measureOperation(runCreationTimingNames.writeAcknowledgement, () =>
          this.store.set(
            runDocumentPath(this.userId, id),
            completedRunToDocument(run),
          ),
        );
        return run;
      }),
    );
  }

  get(id: CompletedRunId): Promise<CompletedRun | null> {
    return safely(async () => {
      const document = await this.store.get(runDocumentPath(this.userId, id));
      return document === null ? null : this.fromDocument(document);
    });
  }

  list(): Promise<CompletedRun[]> {
    return safely(async () => {
      const documents = await this.store.list(runsCollectionPath(this.userId));
      return documents
        .map((document) => this.fromDocument(document))
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    });
  }

  update(id: CompletedRunId, changes: UpdateCompletedRunInput): Promise<CompletedRun> {
    return safely(() =>
      measureOperation(runUpdateTimingNames.total, async () => {
        const existing = await measureOperation(
          runUpdateTimingNames.existingRead,
          () => this.requireRun(id),
        );
        const updated: CompletedRun = {
          ...existing,
          plannedWorkoutPlanId:
            changes.plannedWorkoutPlanId === null
              ? undefined
              : changes.plannedWorkoutPlanId ?? existing.plannedWorkoutPlanId,
          plannedWorkoutId:
            changes.plannedWorkoutId === null
              ? undefined
              : changes.plannedWorkoutId ?? existing.plannedWorkoutId,
          shoeId:
            changes.shoeId === null ? undefined : changes.shoeId ?? existing.shoeId,
          startedAt: changes.startedAt ?? existing.startedAt,
          timeZone: changes.timeZone ?? existing.timeZone,
          distance: changes.distance ?? existing.distance,
          duration: changes.duration ?? existing.duration,
          perceivedEffort:
            changes.perceivedEffort === null
              ? undefined
              : changes.perceivedEffort ?? existing.perceivedEffort,
          unusualPain:
            changes.unusualPain === null
              ? undefined
              : changes.unusualPain ?? existing.unusualPain,
          notes: changes.notes === null ? undefined : changes.notes ?? existing.notes,
          updatedAt: this.clock(),
        };

        requireValidRun(updated);
        await measureOperation(runUpdateTimingNames.associations, () =>
          this.requireAssociations(updated),
        );
        await measureOperation(runUpdateTimingNames.writeAcknowledgement, () =>
          this.store.set(
            runDocumentPath(this.userId, id),
            completedRunToDocument(updated),
          ),
        );
        return updated;
      }),
    );
  }

  delete(id: CompletedRunId): Promise<void> {
    return safely(() => this.store.delete(runDocumentPath(this.userId, id)));
  }

  private async requireAssociations(run: CompletedRun): Promise<void> {
    if (
      run.plannedWorkoutPlanId !== undefined &&
      run.plannedWorkoutId !== undefined
    ) {
      const workout = await this.workouts.get(
        run.plannedWorkoutPlanId,
        run.plannedWorkoutId,
      );
      this.requireAssociation(workout, "Planned workout was not found.");
    }

    if (run.shoeId !== undefined) {
      const shoe = await this.shoes.get(run.shoeId);
      this.requireAssociation(shoe, "Shoe was not found.");
    }
  }

  private requireAssociation(
    value: PlannedWorkout | Shoe | null,
    message: string,
  ): void {
    if (value === null) {
      throw new PersistenceError("not_found", message);
    }
  }

  private async requireRun(id: CompletedRunId): Promise<CompletedRun> {
    const document = await this.store.get(runDocumentPath(this.userId, id));

    if (document === null) {
      throw new PersistenceError("not_found", "Completed run was not found.");
    }

    return this.fromDocument(document);
  }

  private fromDocument(document: StoredDocument): CompletedRun {
    return completedRunFromDocument(document.id, document.data, this.userId);
  }
}

export function createDocumentRunAndShoeRepositories(
  store: DocumentStore,
  userId: UserId,
  workouts: PlannedWorkoutRepository,
  clock: PersistenceClock,
): Pick<
  TrainingRepositories,
  "runs" | "shoes"
> {
  const shoes = new DocumentShoeRepository(store, userId, clock);

  return {
    shoes,
    runs: new DocumentCompletedRunRepository(
      store,
      userId,
      workouts,
      shoes,
      clock,
    ),
  };
}
