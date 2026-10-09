import { randomUUID } from 'node:crypto'

import {
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore'

import {
  isRunCompletionReceiptResult,
  materialCommandSignature,
  type RunCompletionCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import { createDateOnly, createUtcDateTime } from '../../src/domain/training/dates.js'
import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createShoeId,
  createTrainingPlanId,
  createUserId,
} from '../../src/domain/training/identifiers.js'
import type {
  CompletedRun,
  PlannedWorkout,
  RunPurpose,
  Shoe,
  ShoeStatus,
  TrainingPhase,
  WorkoutStatus,
} from '../../src/domain/training/types.js'
import {
  createDistanceMeters,
  createDurationSeconds,
} from '../../src/domain/training/units.js'
import {
  runDocumentPath,
  shoeDocumentPath,
  workoutCompletionGuardDocumentPath,
  workoutDocumentPath,
} from '../../src/persistence/firestore/paths.js'
import { TRAINING_SCHEMA_VERSION } from '../../src/persistence/trainingSchema.js'
import {
  projectRunCompletion,
  WORKOUT_COMPLETION_GUARD_SCHEMA_VERSION,
  type WorkoutCompletionGuardRecordV1,
} from './completedRunCommandProjection.js'
import {
  MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
  materialCommandReceiptPath,
} from './firestoreMaterialCommandStore.js'
import type { RunCompletionStore } from './materialCommandHandler.js'

const TRAINING_PHASES = [
  'learn_to_run',
  'base_building',
  'marathon_training',
  'race_preparation',
  'recovery',
] as const
const WORKOUT_STATUSES = ['planned', 'completed', 'skipped'] as const
const WORKOUT_KINDS = ['rest', 'run', 'walk_run'] as const
const RUN_PURPOSES = [
  'easy',
  'recovery',
  'long',
  'tempo',
  'intervals',
  'race',
] as const
const SHOE_STATUSES = ['active', 'retired'] as const

export interface FirestoreRunCompletionStoreOptions {
  createRunId?: () => string
  now?: () => Date
}

function invalidRecord(message: string): never {
  throw new Error(`A stored training record is invalid: ${message}`)
}

function readString(data: DocumentData, field: string): string {
  const value = data[field]
  return typeof value === 'string'
    ? value
    : invalidRecord(`${field} must be a string.`)
}

function readOptionalString(
  data: DocumentData,
  field: string,
): string | undefined {
  const value = data[field]
  if (value === undefined) return undefined
  return typeof value === 'string'
    ? value
    : invalidRecord(`${field} must be a string.`)
}

function readNumber(data: DocumentData, field: string): number {
  const value = data[field]
  return typeof value === 'number'
    ? value
    : invalidRecord(`${field} must be a number.`)
}

function readOptionalNumber(
  data: DocumentData,
  field: string,
): number | undefined {
  const value = data[field]
  if (value === undefined) return undefined
  return typeof value === 'number'
    ? value
    : invalidRecord(`${field} must be a number.`)
}

function readEnum<const Values extends readonly string[]>(
  data: DocumentData,
  field: string,
  values: Values,
): Values[number] {
  const value = readString(data, field)
  return values.includes(value as Values[number])
    ? (value as Values[number])
    : invalidRecord(`${field} has an unsupported value.`)
}

function readTimestamp(data: DocumentData, field: string) {
  const value = data[field]
  if (!(value instanceof Timestamp)) {
    invalidRecord(`${field} must be a Firestore timestamp.`)
  }
  return createUtcDateTime(value.toDate().toISOString())
}

function timestamp(value: string): Timestamp {
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) {
    throw new Error('A projected timestamp is invalid.')
  }
  return Timestamp.fromMillis(milliseconds)
}

function requireTrainingSchema(data: DocumentData) {
  if (data.schemaVersion !== TRAINING_SCHEMA_VERSION) {
    invalidRecord('the training schema version is unsupported.')
  }
}

function plannedWorkoutFromDocument(
  id: string,
  data: DocumentData | undefined,
): PlannedWorkout | null {
  if (data === undefined) return null
  requireTrainingSchema(data)
  const notes = readOptionalString(data, 'notes')
  const base = {
    id: createPlannedWorkoutId(id),
    userId: createUserId(readString(data, 'userId')),
    planId: createTrainingPlanId(readString(data, 'planId')),
    scheduledDate: createDateOnly(readString(data, 'scheduledDate')),
    phase: readEnum(data, 'phase', TRAINING_PHASES) as TrainingPhase,
    status: readEnum(data, 'status', WORKOUT_STATUSES) as WorkoutStatus,
    ...(notes === undefined ? {} : { notes }),
    createdAt: readTimestamp(data, 'createdAt'),
    updatedAt: readTimestamp(data, 'updatedAt'),
  }
  const kind = readEnum(data, 'kind', WORKOUT_KINDS)
  if (kind === 'rest') return { ...base, kind }

  const targetDistance = readOptionalNumber(data, 'targetDistanceMeters')
  const targetDuration = readOptionalNumber(data, 'targetDurationSeconds')
  const targets = {
    ...(targetDistance === undefined
      ? {}
      : { targetDistance: createDistanceMeters(targetDistance) }),
    ...(targetDuration === undefined
      ? {}
      : { targetDuration: createDurationSeconds(targetDuration) }),
  }
  return kind === 'run'
    ? {
        ...base,
        ...targets,
        kind,
        purpose: readEnum(data, 'purpose', RUN_PURPOSES) as RunPurpose,
      }
    : { ...base, ...targets, kind }
}

function shoeFromDocument(
  id: string,
  data: DocumentData | undefined,
): Shoe | null {
  if (data === undefined) return null
  requireTrainingSchema(data)
  const retiredOn = readOptionalString(data, 'retiredOn')
  return {
    id: createShoeId(id),
    userId: createUserId(readString(data, 'userId')),
    name: readString(data, 'name'),
    startingDistance: createDistanceMeters(
      readNumber(data, 'startingDistanceMeters'),
    ),
    status: readEnum(data, 'status', SHOE_STATUSES) as ShoeStatus,
    ...(retiredOn === undefined
      ? {}
      : { retiredOn: createDateOnly(retiredOn) }),
    createdAt: readTimestamp(data, 'createdAt'),
    updatedAt: readTimestamp(data, 'updatedAt'),
  }
}

function completionGuardFromDocument(
  data: DocumentData | undefined,
): WorkoutCompletionGuardRecordV1 | null {
  if (data === undefined) return null
  if (
    data.schemaVersion !== WORKOUT_COMPLETION_GUARD_SCHEMA_VERSION ||
    data.trainingSchemaVersion !== TRAINING_SCHEMA_VERSION
  ) {
    invalidRecord('the workout-completion guard version is unsupported.')
  }
  return {
    schemaVersion: WORKOUT_COMPLETION_GUARD_SCHEMA_VERSION,
    trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
    userId: createUserId(readString(data, 'userId')),
    planId: createTrainingPlanId(readString(data, 'planId')),
    plannedWorkoutId: createPlannedWorkoutId(
      readString(data, 'plannedWorkoutId'),
    ),
    completedRunId: createCompletedRunId(readString(data, 'completedRunId')),
    commandId: readString(data, 'commandId'),
    createdAt: readTimestamp(data, 'createdAt'),
  }
}

function completedRunDocument(run: CompletedRun): DocumentData {
  return {
    schemaVersion: TRAINING_SCHEMA_VERSION,
    userId: run.userId,
    ...(run.plannedWorkoutPlanId === undefined
      ? {}
      : { plannedWorkoutPlanId: run.plannedWorkoutPlanId }),
    ...(run.plannedWorkoutId === undefined
      ? {}
      : { plannedWorkoutId: run.plannedWorkoutId }),
    ...(run.shoeId === undefined ? {} : { shoeId: run.shoeId }),
    startedAt: timestamp(run.startedAt),
    timeZone: run.timeZone,
    distanceMeters: run.distance,
    durationSeconds: run.duration,
    ...(run.perceivedEffort === undefined
      ? {}
      : { perceivedEffort: run.perceivedEffort }),
    ...(run.unusualPain === undefined
      ? {}
      : { unusualPain: run.unusualPain }),
    ...(run.notes === undefined ? {} : { notes: run.notes }),
    createdAt: timestamp(run.createdAt),
    updatedAt: timestamp(run.updatedAt),
  }
}

function plannedWorkoutDocument(workout: PlannedWorkout): DocumentData {
  return {
    schemaVersion: TRAINING_SCHEMA_VERSION,
    userId: workout.userId,
    planId: workout.planId,
    scheduledDate: workout.scheduledDate,
    phase: workout.phase,
    status: workout.status,
    kind: workout.kind,
    ...(workout.notes === undefined ? {} : { notes: workout.notes }),
    ...(workout.kind === 'run' ? { purpose: workout.purpose } : {}),
    ...(workout.kind === 'rest' || workout.targetDistance === undefined
      ? {}
      : { targetDistanceMeters: workout.targetDistance }),
    ...(workout.kind === 'rest' || workout.targetDuration === undefined
      ? {}
      : { targetDurationSeconds: workout.targetDuration }),
    createdAt: timestamp(workout.createdAt),
    updatedAt: timestamp(workout.updatedAt),
  }
}

function completionGuardDocument(
  guard: WorkoutCompletionGuardRecordV1,
): DocumentData {
  return { ...guard, createdAt: timestamp(guard.createdAt) }
}

function storedRunCompletionResult(data: unknown) {
  if (!isRunCompletionReceiptResult(data)) {
    throw new Error('A stored run-completion receipt is invalid.')
  }
  return data
}

export class FirestoreRunCompletionStore implements RunCompletionStore {
  private readonly createRunId: () => string
  private readonly now: () => Date

  constructor(
    private readonly database: Firestore,
    options: FirestoreRunCompletionStoreOptions = {},
  ) {
    this.createRunId = options.createRunId ?? (() => `run-${randomUUID()}`)
    this.now = options.now ?? (() => new Date())
  }

  async commit(options: {
    envelope: RunCompletionCommandEnvelope
    ownerId: string
  }) {
    const signature = materialCommandSignature(options.envelope)
    const committedAt = this.now().toISOString()
    const serverRunId = this.createRunId()
    const ownerId = createUserId(options.ownerId)
    const receiptReference = this.database.doc(
      materialCommandReceiptPath(options.ownerId, options.envelope.commandId),
    )
    const workoutReference = options.envelope.command.input.plannedWorkout
    const shoeId = options.envelope.command.input.shoeId

    return this.database.runTransaction(async (transaction) => {
      const receiptSnapshot = await transaction.get(receiptReference)
      if (receiptSnapshot.exists) {
        const receipt = receiptSnapshot.data()
        if (!receipt || receipt.signature !== signature) {
          return { kind: 'conflict' as const }
        }
        return {
          kind: 'completed' as const,
          result: storedRunCompletionResult(receipt.result),
        }
      }

      const workoutDocumentReference =
        workoutReference === null
          ? null
          : this.database.doc(
              workoutDocumentPath(
                ownerId,
                workoutReference.planId,
                workoutReference.workoutId,
              ),
            )
      const guardDocumentReference =
        workoutReference === null
          ? null
          : this.database.doc(
              workoutCompletionGuardDocumentPath(
                ownerId,
                workoutReference.planId,
                workoutReference.workoutId,
              ),
            )
      const shoeDocumentReference =
        shoeId === undefined
          ? null
          : this.database.doc(
              shoeDocumentPath(ownerId, shoeId),
            )
      const [workoutSnapshot, guardSnapshot, shoeSnapshot] = await Promise.all([
        workoutDocumentReference === null
          ? Promise.resolve(null)
          : transaction.get(workoutDocumentReference),
        guardDocumentReference === null
          ? Promise.resolve(null)
          : transaction.get(guardDocumentReference),
        shoeDocumentReference === null
          ? Promise.resolve(null)
          : transaction.get(shoeDocumentReference),
      ])

      const decision = projectRunCompletion({
        authenticatedOwnerId: options.ownerId,
        serverRunId,
        committedAt,
        envelope: options.envelope,
        loadedPlannedWorkout:
          workoutSnapshot === null
            ? null
            : plannedWorkoutFromDocument(
                workoutSnapshot.id,
                workoutSnapshot.data(),
              ),
        loadedShoe:
          shoeSnapshot === null
            ? null
            : shoeFromDocument(shoeSnapshot.id, shoeSnapshot.data()),
        loadedCompletionGuard:
          guardSnapshot === null
            ? null
            : completionGuardFromDocument(guardSnapshot.data()),
      })
      if (!decision.ok) {
        return { kind: 'rejected' as const, result: decision.result }
      }

      const projection = decision.projection
      transaction.create(
        this.database.doc(
          runDocumentPath(ownerId, projection.completedRun.entity.id),
        ),
        completedRunDocument(projection.completedRun.entity),
      )
      if (
        projection.completedPlannedWorkout !== null &&
        workoutDocumentReference !== null
      ) {
        transaction.set(
          workoutDocumentReference,
          plannedWorkoutDocument(projection.completedPlannedWorkout.entity),
        )
      }
      if (projection.completionGuard !== null) {
        transaction.create(
          this.database.doc(projection.completionGuard.path),
          completionGuardDocument(projection.completionGuard.record),
        )
      }
      transaction.create(receiptReference, {
        schemaVersion: MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
        signature,
        result: projection.receipt,
        createdAt: timestamp(committedAt),
      })

      return { kind: 'completed' as const, result: projection.receipt }
    })
  }
}
