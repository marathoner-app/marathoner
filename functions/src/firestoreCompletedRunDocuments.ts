import { Timestamp, type DocumentData } from 'firebase-admin/firestore'

import { RUN_PERCEIVED_EFFORTS } from '../../src/domain/materialCommands/contract.js'
import {
  createDateOnly,
  createIanaTimeZone,
  createUtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createShoeId,
  createTrainingPlanId,
  createUserId,
} from '../../src/domain/training/identifiers.js'
import type {
  CompletedRun,
  PerceivedEffort,
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
import { TRAINING_SCHEMA_VERSION } from '../../src/persistence/trainingSchema.js'
import {
  WORKOUT_COMPLETION_GUARD_SCHEMA_VERSION,
  type WorkoutCompletionGuardRecordV1,
} from './completedRunCommandProjection.js'

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

function readOptionalBoolean(
  data: DocumentData,
  field: string,
): boolean | undefined {
  const value = data[field]
  if (value === undefined) return undefined
  return typeof value === 'boolean'
    ? value
    : invalidRecord(`${field} must be a boolean.`)
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

export function adminTimestamp(value: string): Timestamp {
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

export function plannedWorkoutFromAdminDocument(
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

export function shoeFromAdminDocument(
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

export function completedRunFromAdminDocument(
  id: string,
  data: DocumentData | undefined,
): CompletedRun | null {
  if (data === undefined) return null
  requireTrainingSchema(data)
  const plannedWorkoutPlanId = readOptionalString(
    data,
    'plannedWorkoutPlanId',
  )
  const plannedWorkoutId = readOptionalString(data, 'plannedWorkoutId')
  const shoeId = readOptionalString(data, 'shoeId')
  const perceivedEffort = readOptionalString(data, 'perceivedEffort')
  const unusualPain = readOptionalBoolean(data, 'unusualPain')
  const notes = readOptionalString(data, 'notes')
  return {
    id: createCompletedRunId(id),
    userId: createUserId(readString(data, 'userId')),
    ...(plannedWorkoutPlanId === undefined
      ? {}
      : {
          plannedWorkoutPlanId: createTrainingPlanId(plannedWorkoutPlanId),
        }),
    ...(plannedWorkoutId === undefined
      ? {}
      : { plannedWorkoutId: createPlannedWorkoutId(plannedWorkoutId) }),
    ...(shoeId === undefined ? {} : { shoeId: createShoeId(shoeId) }),
    startedAt: readTimestamp(data, 'startedAt'),
    timeZone: createIanaTimeZone(readString(data, 'timeZone')),
    distance: createDistanceMeters(readNumber(data, 'distanceMeters')),
    duration: createDurationSeconds(readNumber(data, 'durationSeconds')),
    ...(perceivedEffort === undefined
      ? {}
      : {
          perceivedEffort: readEnum(
            data,
            'perceivedEffort',
            RUN_PERCEIVED_EFFORTS,
          ) as PerceivedEffort,
        }),
    ...(unusualPain === undefined ? {} : { unusualPain }),
    ...(notes === undefined ? {} : { notes }),
    createdAt: readTimestamp(data, 'createdAt'),
    updatedAt: readTimestamp(data, 'updatedAt'),
  }
}

export function completionGuardFromAdminDocument(
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

export function completedRunAdminDocument(run: CompletedRun): DocumentData {
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
    startedAt: adminTimestamp(run.startedAt),
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
    createdAt: adminTimestamp(run.createdAt),
    updatedAt: adminTimestamp(run.updatedAt),
  }
}

export function plannedWorkoutAdminDocument(
  workout: PlannedWorkout,
): DocumentData {
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
    createdAt: adminTimestamp(workout.createdAt),
    updatedAt: adminTimestamp(workout.updatedAt),
  }
}

export function completionGuardAdminDocument(
  guard: WorkoutCompletionGuardRecordV1,
): DocumentData {
  return { ...guard, createdAt: adminTimestamp(guard.createdAt) }
}
