import {
  isRunCompletionCommandEnvelope,
  isRunDeletionCommandEnvelope,
  materialCommandIdFrom,
  parseMaterialCommand,
  type MaterialCommandAuthorizationResult,
  type MaterialCommandUnsupportedVersionResult,
  type MaterialCommandValidationResult,
  type RunCommandStaleRevisionResult,
  type RunCompletionCommandEnvelope,
  type RunCompletionDuplicateResult,
  type RunCompletionReceiptResult,
  type RunDeletionCommandEnvelope,
  type RunDeletionReceiptResult,
} from '../../src/domain/materialCommands/contract.js'
import {
  createUtcDateTime,
  type UtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  type CompletedRunId,
  type PlannedWorkoutId,
  type TrainingPlanId,
  type UserId,
} from '../../src/domain/training/identifiers.js'
import type {
  CompletedRun,
  PlannedWorkout,
  Shoe,
} from '../../src/domain/training/types.js'
import {
  validateCompletedRun,
  validatePlannedWorkout,
  validateShoe,
} from '../../src/domain/training/validation.js'
import {
  runDocumentPath,
  workoutCompletionGuardDocumentPath,
  workoutDocumentPath,
} from '../../src/persistence/firestore/paths.js'
import { TRAINING_SCHEMA_VERSION } from '../../src/persistence/trainingSchema.js'

export const WORKOUT_COMPLETION_GUARD_SCHEMA_VERSION = 1 as const

export interface WorkoutCompletionGuardRecordV1 {
  readonly schemaVersion: typeof WORKOUT_COMPLETION_GUARD_SCHEMA_VERSION
  readonly trainingSchemaVersion: typeof TRAINING_SCHEMA_VERSION
  readonly userId: UserId
  readonly planId: TrainingPlanId
  readonly plannedWorkoutId: PlannedWorkoutId
  readonly completedRunId: CompletedRunId
  readonly commandId: string
  readonly createdAt: UtcDateTime
}

export interface RunCompletionProjection {
  readonly completedRun: {
    readonly path: string
    readonly entity: CompletedRun
  }
  readonly completedPlannedWorkout: {
    readonly path: string
    readonly entity: PlannedWorkout
  } | null
  readonly completionGuard: {
    readonly path: string
    readonly record: WorkoutCompletionGuardRecordV1
  } | null
  readonly receipt: RunCompletionReceiptResult
}

export interface RunDeletionProjection {
  readonly deletedRun: {
    readonly path: string
    readonly id: CompletedRunId
  }
  readonly reopenedPlannedWorkout: {
    readonly path: string
    readonly entity: PlannedWorkout
  } | null
  readonly completionGuardToDelete: {
    readonly path: string
    readonly record: WorkoutCompletionGuardRecordV1
  } | null
  readonly receipt: RunDeletionReceiptResult
}

export type RunCommandProjectionFailureResult =
  | MaterialCommandValidationResult
  | MaterialCommandAuthorizationResult
  | MaterialCommandUnsupportedVersionResult
  | RunCompletionDuplicateResult
  | RunCommandStaleRevisionResult

export type RunCompletionProjectionDecision =
  | { readonly ok: true; readonly projection: RunCompletionProjection }
  | { readonly ok: false; readonly result: RunCommandProjectionFailureResult }

export type RunDeletionProjectionDecision =
  | { readonly ok: true; readonly projection: RunDeletionProjection }
  | { readonly ok: false; readonly result: RunCommandProjectionFailureResult }

export interface RunCompletionProjectionOptions {
  readonly authenticatedOwnerId: string
  readonly serverRunId: string
  readonly committedAt: string
  readonly envelope: unknown
  readonly loadedPlannedWorkout: PlannedWorkout | null
  readonly loadedShoe: Shoe | null
  readonly loadedCompletionGuard: WorkoutCompletionGuardRecordV1 | null
}

export interface RunDeletionProjectionOptions {
  readonly authenticatedOwnerId: string
  readonly deletedAt: string
  readonly envelope: unknown
  readonly loadedRun: CompletedRun | null
  readonly loadedPlannedWorkout: PlannedWorkout | null
  readonly loadedCompletionGuard: WorkoutCompletionGuardRecordV1 | null
}

export class RunCommandProjectionError extends Error {
  constructor(
    readonly code: 'invalid-server-input' | 'invalid-server-record',
    message: string,
  ) {
    super(message)
    this.name = 'RunCommandProjectionError'
  }
}

function projectionError(
  code: RunCommandProjectionError['code'],
  message: string,
): never {
  throw new RunCommandProjectionError(code, message)
}

function requireOwnerId(value: string): UserId {
  try {
    return createUserId(value)
  } catch {
    return projectionError(
      'invalid-server-input',
      'A valid authenticated owner is required.',
    )
  }
}

function requireRunId(value: string): CompletedRunId {
  try {
    return createCompletedRunId(value)
  } catch {
    return projectionError(
      'invalid-server-input',
      'A valid server-generated completed-run ID is required.',
    )
  }
}

function requireServerTime(value: string, operation: string): UtcDateTime {
  try {
    return createUtcDateTime(value)
  } catch {
    return projectionError(
      'invalid-server-input',
      `A valid server ${operation} timestamp is required.`,
    )
  }
}

function validationResult(
  commandId: string | null,
  code: MaterialCommandValidationResult['code'],
  message: string,
): MaterialCommandValidationResult {
  return { status: 'validation_error', commandId, code, message }
}

function authorizationResult(
  commandId: string,
): MaterialCommandAuthorizationResult {
  return {
    status: 'authorization_error',
    commandId,
    code: 'training-resource-access-denied',
    message: 'The referenced training record is not available to this account.',
  }
}

function parseCompletionEnvelope(
  value: unknown,
):
  | { readonly ok: true; readonly envelope: RunCompletionCommandEnvelope }
  | { readonly ok: false; readonly result: RunCommandProjectionFailureResult } {
  const parsed = parseMaterialCommand(value)
  if (!parsed.ok) return parsed
  if (!isRunCompletionCommandEnvelope(parsed.envelope)) {
    return {
      ok: false,
      result: validationResult(
        parsed.envelope.commandId,
        'invalid-run-completion',
        'A valid completed-run command is required.',
      ),
    }
  }
  return { ok: true, envelope: parsed.envelope }
}

function parseDeletionEnvelope(
  value: unknown,
):
  | { readonly ok: true; readonly envelope: RunDeletionCommandEnvelope }
  | { readonly ok: false; readonly result: RunCommandProjectionFailureResult } {
  const parsed = parseMaterialCommand(value)
  if (!parsed.ok) return parsed
  if (!isRunDeletionCommandEnvelope(parsed.envelope)) {
    return {
      ok: false,
      result: validationResult(
        parsed.envelope.commandId,
        'invalid-run-deletion',
        'A valid completed-run deletion command is required.',
      ),
    }
  }
  return { ok: true, envelope: parsed.envelope }
}

function validateLoadedGuard(record: WorkoutCompletionGuardRecordV1): void {
  if (
    record.schemaVersion !== WORKOUT_COMPLETION_GUARD_SCHEMA_VERSION ||
    record.trainingSchemaVersion !== TRAINING_SCHEMA_VERSION ||
    materialCommandIdFrom({ commandId: record.commandId }) === null ||
    record.userId.length === 0
  ) {
    projectionError(
      'invalid-server-record',
      'The loaded workout-completion guard is invalid.',
    )
  }
  try {
    createUtcDateTime(record.createdAt)
    createUserId(record.userId)
    createTrainingPlanId(record.planId)
    createPlannedWorkoutId(record.plannedWorkoutId)
    createCompletedRunId(record.completedRunId)
  } catch {
    projectionError(
      'invalid-server-record',
      'The loaded workout-completion guard is invalid.',
    )
  }
}

function staleWorkoutResult(
  commandId: string,
  expectedUpdatedAt: UtcDateTime,
  workout: PlannedWorkout,
): RunCommandStaleRevisionResult {
  return {
    status: 'stale_revision',
    commandId,
    code: 'planned-workout-version-changed',
    message: 'The planned workout changed after this command was prepared.',
    planId: workout.planId,
    plannedWorkoutId: workout.id,
    expectedUpdatedAt,
    actualUpdatedAt: workout.updatedAt,
  }
}

function staleRunResult(
  commandId: string,
  expectedUpdatedAt: UtcDateTime,
  run: CompletedRun,
): RunCommandStaleRevisionResult {
  return {
    status: 'stale_revision',
    commandId,
    code: 'completed-run-version-changed',
    message: 'The completed run changed after this command was prepared.',
    completedRunId: run.id,
    expectedUpdatedAt,
    actualUpdatedAt: run.updatedAt,
  }
}

function completedWorkoutEntity(
  workout: PlannedWorkout,
  committedAt: UtcDateTime,
): PlannedWorkout {
  return { ...workout, status: 'completed', updatedAt: committedAt }
}

function reopenedWorkoutEntity(
  workout: PlannedWorkout,
  deletedAt: UtcDateTime,
): PlannedWorkout {
  return { ...workout, status: 'planned', updatedAt: deletedAt }
}

function projectCompletedRun(
  envelope: RunCompletionCommandEnvelope,
  ownerId: UserId,
  runId: CompletedRunId,
  committedAt: UtcDateTime,
): CompletedRun {
  const input = envelope.command.input
  const run: CompletedRun = {
    id: runId,
    userId: ownerId,
    ...(input.plannedWorkout === null
      ? {}
      : {
          plannedWorkoutPlanId: input.plannedWorkout.planId,
          plannedWorkoutId: input.plannedWorkout.workoutId,
        }),
    ...(input.shoeId === undefined ? {} : { shoeId: input.shoeId }),
    startedAt: input.startedAt,
    timeZone: input.timeZone,
    distance: input.distance,
    duration: input.duration,
    ...(input.perceivedEffort === undefined
      ? {}
      : { perceivedEffort: input.perceivedEffort }),
    ...(input.unusualPain === undefined
      ? {}
      : { unusualPain: input.unusualPain }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    createdAt: committedAt,
    updatedAt: committedAt,
  }
  if (validateCompletedRun(run).length > 0) {
    projectionError(
      'invalid-server-record',
      'The validated command did not project a valid completed run.',
    )
  }
  return run
}

function requireValidLoadedWorkout(workout: PlannedWorkout): void {
  if (validatePlannedWorkout(workout).length > 0) {
    projectionError(
      'invalid-server-record',
      'The loaded planned workout is invalid.',
    )
  }
}

function requireValidLoadedRun(run: CompletedRun): void {
  if (validateCompletedRun(run).length > 0) {
    projectionError('invalid-server-record', 'The loaded completed run is invalid.')
  }
}

function requireValidLoadedShoe(shoe: Shoe): void {
  if (validateShoe(shoe).length > 0) {
    projectionError('invalid-server-record', 'The loaded shoe is invalid.')
  }
}

export function projectRunCompletion(
  options: RunCompletionProjectionOptions,
): RunCompletionProjectionDecision {
  const parsed = parseCompletionEnvelope(options.envelope)
  if (!parsed.ok) return parsed
  const envelope = parsed.envelope
  const ownerId = requireOwnerId(options.authenticatedOwnerId)
  const runId = requireRunId(options.serverRunId)
  const committedAt = requireServerTime(options.committedAt, 'commit')
  const reference = envelope.command.input.plannedWorkout

  if (Date.parse(envelope.command.input.startedAt) > Date.parse(committedAt)) {
    return {
      ok: false,
      result: validationResult(
        envelope.commandId,
        'invalid-run-completion',
        'A completed run cannot start in the future.',
      ),
    }
  }

  let completedWorkout: PlannedWorkout | null = null
  let completionGuard: WorkoutCompletionGuardRecordV1 | null = null

  if (reference === null) {
    if (
      options.loadedPlannedWorkout !== null ||
      options.loadedCompletionGuard !== null
    ) {
      projectionError(
        'invalid-server-input',
        'An unplanned run cannot receive server-loaded workout state.',
      )
    }
  } else {
    const workout = options.loadedPlannedWorkout
    if (workout === null) {
      return {
        ok: false,
        result: validationResult(
          envelope.commandId,
          'planned-workout-not-completable',
          'The referenced planned workout is not available for completion.',
        ),
      }
    }
    if (workout.userId !== ownerId) {
      return { ok: false, result: authorizationResult(envelope.commandId) }
    }
    requireValidLoadedWorkout(workout)
    if (workout.planId !== reference.planId || workout.id !== reference.workoutId) {
      return {
        ok: false,
        result: validationResult(
          envelope.commandId,
          'planned-workout-not-completable',
          'The loaded workout does not match the requested association.',
        ),
      }
    }

    const loadedGuard = options.loadedCompletionGuard
    if (loadedGuard !== null) {
      validateLoadedGuard(loadedGuard)
      if (loadedGuard.userId !== ownerId) {
        return { ok: false, result: authorizationResult(envelope.commandId) }
      }
      if (
        loadedGuard.planId !== reference.planId ||
        loadedGuard.plannedWorkoutId !== reference.workoutId
      ) {
        projectionError(
          'invalid-server-record',
          'The loaded completion guard does not match its workout identity.',
        )
      }
      return {
        ok: false,
        result: {
          status: 'conflict',
          commandId: envelope.commandId,
          code: 'planned-workout-already-completed',
          message: 'This planned workout already has a completed run.',
          planId: reference.planId,
          plannedWorkoutId: reference.workoutId,
          completedRunId: loadedGuard.completedRunId,
        },
      }
    }

    if (workout.updatedAt !== reference.expectedUpdatedAt) {
      return {
        ok: false,
        result: staleWorkoutResult(
          envelope.commandId,
          reference.expectedUpdatedAt,
          workout,
        ),
      }
    }
    if (Date.parse(committedAt) < Date.parse(workout.updatedAt)) {
      projectionError(
        'invalid-server-input',
        'Server commit time cannot precede the loaded workout version.',
      )
    }
    if (workout.kind === 'rest' || workout.status !== 'planned') {
      return {
        ok: false,
        result: validationResult(
          envelope.commandId,
          'planned-workout-not-completable',
          'Only a current planned run or walk-run can be completed.',
        ),
      }
    }

    completedWorkout = completedWorkoutEntity(workout, committedAt)
    completionGuard = {
      schemaVersion: WORKOUT_COMPLETION_GUARD_SCHEMA_VERSION,
      trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
      userId: ownerId,
      planId: reference.planId,
      plannedWorkoutId: reference.workoutId,
      completedRunId: runId,
      commandId: envelope.commandId,
      createdAt: committedAt,
    }
  }

  const shoeId = envelope.command.input.shoeId
  if (shoeId === undefined) {
    if (options.loadedShoe !== null) {
      projectionError(
        'invalid-server-input',
        'A shoeless run cannot receive a server-loaded shoe.',
      )
    }
  } else {
    const shoe = options.loadedShoe
    if (shoe === null || shoe.id !== shoeId) {
      return {
        ok: false,
        result: validationResult(
          envelope.commandId,
          'shoe-not-available',
          'The selected shoe is not available for this completion.',
        ),
      }
    }
    if (shoe.userId !== ownerId) {
      return { ok: false, result: authorizationResult(envelope.commandId) }
    }
    requireValidLoadedShoe(shoe)
    if (shoe.status !== 'active') {
      return {
        ok: false,
        result: validationResult(
          envelope.commandId,
          'shoe-not-available',
          'The selected shoe is not active.',
        ),
      }
    }
  }

  const run = projectCompletedRun(envelope, ownerId, runId, committedAt)
  const completedPlannedWorkout =
    completedWorkout === null
      ? null
      : {
          planId: completedWorkout.planId,
          workoutId: completedWorkout.id,
          updatedAt: completedWorkout.updatedAt,
        }
  const receipt: RunCompletionReceiptResult = {
    status: 'run_completed',
    commandId: envelope.commandId,
    completedRunId: run.id,
    completedRunUpdatedAt: run.updatedAt,
    completedPlannedWorkout,
  }

  return {
    ok: true,
    projection: {
      completedRun: {
        path: runDocumentPath(ownerId, run.id),
        entity: run,
      },
      completedPlannedWorkout:
        completedWorkout === null
          ? null
          : {
              path: workoutDocumentPath(
                ownerId,
                completedWorkout.planId,
                completedWorkout.id,
              ),
              entity: completedWorkout,
            },
      completionGuard:
        completionGuard === null
          ? null
          : {
              path: workoutCompletionGuardDocumentPath(
                ownerId,
                completionGuard.planId,
                completionGuard.plannedWorkoutId,
              ),
              record: completionGuard,
            },
      receipt,
    },
  }
}

function associationMatchesDeletion(
  envelope: RunDeletionCommandEnvelope,
  run: CompletedRun,
): boolean {
  const reference = envelope.command.plannedWorkout
  const hasPlan = run.plannedWorkoutPlanId !== undefined
  const hasWorkout = run.plannedWorkoutId !== undefined
  if (hasPlan !== hasWorkout) return false
  if (!hasPlan || !hasWorkout) return reference === null
  return (
    reference !== null &&
    reference.planId === run.plannedWorkoutPlanId &&
    reference.workoutId === run.plannedWorkoutId
  )
}

export function projectRunDeletion(
  options: RunDeletionProjectionOptions,
): RunDeletionProjectionDecision {
  const parsed = parseDeletionEnvelope(options.envelope)
  if (!parsed.ok) return parsed
  const envelope = parsed.envelope
  const ownerId = requireOwnerId(options.authenticatedOwnerId)
  const deletedAt = requireServerTime(options.deletedAt, 'deletion')
  const run = options.loadedRun

  if (run === null || run.id !== envelope.command.completedRunId) {
    return {
      ok: false,
      result: validationResult(
        envelope.commandId,
        'invalid-run-deletion',
        'The completed run is not available for deletion.',
      ),
    }
  }
  if (run.userId !== ownerId) {
    return { ok: false, result: authorizationResult(envelope.commandId) }
  }
  requireValidLoadedRun(run)
  if (run.updatedAt !== envelope.command.expectedCompletedRunUpdatedAt) {
    return {
      ok: false,
      result: staleRunResult(
        envelope.commandId,
        envelope.command.expectedCompletedRunUpdatedAt,
        run,
      ),
    }
  }
  if (Date.parse(deletedAt) < Date.parse(run.updatedAt)) {
    projectionError(
      'invalid-server-input',
      'Server deletion time cannot precede the loaded run version.',
    )
  }
  if (!associationMatchesDeletion(envelope, run)) {
    return {
      ok: false,
      result: validationResult(
        envelope.commandId,
        'invalid-run-deletion',
        'The requested workout association does not match the loaded run.',
      ),
    }
  }

  const reference = envelope.command.plannedWorkout
  let reopenedWorkout: PlannedWorkout | null = null
  let completionGuardToDelete: WorkoutCompletionGuardRecordV1 | null = null

  if (reference === null) {
    if (
      options.loadedPlannedWorkout !== null ||
      options.loadedCompletionGuard !== null
    ) {
      projectionError(
        'invalid-server-input',
        'An unplanned run cannot receive server-loaded workout state.',
      )
    }
  } else {
    const workout = options.loadedPlannedWorkout
    if (workout === null) {
      return {
        ok: false,
        result: validationResult(
          envelope.commandId,
          'invalid-run-deletion',
          'The linked planned workout is not available for reopening.',
        ),
      }
    }
    if (workout.userId !== ownerId) {
      return { ok: false, result: authorizationResult(envelope.commandId) }
    }
    requireValidLoadedWorkout(workout)
    if (workout.planId !== reference.planId || workout.id !== reference.workoutId) {
      return {
        ok: false,
        result: validationResult(
          envelope.commandId,
          'invalid-run-deletion',
          'The loaded workout does not match the deleted run.',
        ),
      }
    }
    if (workout.updatedAt !== reference.expectedUpdatedAt) {
      return {
        ok: false,
        result: staleWorkoutResult(
          envelope.commandId,
          reference.expectedUpdatedAt,
          workout,
        ),
      }
    }
    if (Date.parse(deletedAt) < Date.parse(workout.updatedAt)) {
      projectionError(
        'invalid-server-input',
        'Server deletion time cannot precede the loaded workout version.',
      )
    }
    if (workout.kind === 'rest' || workout.status !== 'completed') {
      return {
        ok: false,
        result: validationResult(
          envelope.commandId,
          'invalid-run-deletion',
          'Only the completed workout linked to this run can be reopened.',
        ),
      }
    }

    const guard = options.loadedCompletionGuard
    if (guard === null) {
      return {
        ok: false,
        result: validationResult(
          envelope.commandId,
          'invalid-run-deletion',
          'The workout completion cannot be uniquely linked to this run.',
        ),
      }
    }
    validateLoadedGuard(guard)
    if (guard.userId !== ownerId) {
      return { ok: false, result: authorizationResult(envelope.commandId) }
    }
    if (
      guard.planId !== reference.planId ||
      guard.plannedWorkoutId !== reference.workoutId ||
      guard.completedRunId !== run.id
    ) {
      return {
        ok: false,
        result: validationResult(
          envelope.commandId,
          'invalid-run-deletion',
          'The workout completion guard does not identify this run.',
        ),
      }
    }

    reopenedWorkout = reopenedWorkoutEntity(workout, deletedAt)
    completionGuardToDelete = guard
  }

  const receipt: RunDeletionReceiptResult = {
    status: 'run_deleted',
    commandId: envelope.commandId,
    completedRunId: run.id,
    deletedAt,
    reopenedPlannedWorkout:
      reopenedWorkout === null
        ? null
        : {
            planId: reopenedWorkout.planId,
            workoutId: reopenedWorkout.id,
            updatedAt: reopenedWorkout.updatedAt,
          },
  }

  return {
    ok: true,
    projection: {
      deletedRun: {
        path: runDocumentPath(ownerId, run.id),
        id: run.id,
      },
      reopenedPlannedWorkout:
        reopenedWorkout === null
          ? null
          : {
              path: workoutDocumentPath(
                ownerId,
                reopenedWorkout.planId,
                reopenedWorkout.id,
              ),
              entity: reopenedWorkout,
            },
      completionGuardToDelete:
        completionGuardToDelete === null
          ? null
          : {
              path: workoutCompletionGuardDocumentPath(
                ownerId,
                completionGuardToDelete.planId,
                completionGuardToDelete.plannedWorkoutId,
              ),
              record: completionGuardToDelete,
            },
      receipt,
    },
  }
}
