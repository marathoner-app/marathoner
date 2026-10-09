import {
  createRunCompletionCommand,
  createRunDeletionCommand,
  isRunCompletionDuplicateResult,
  isRunCommandStaleRevisionResult,
  type CompletedRunStaleRevisionResult,
  type CompletedRunCommandInputV1,
  type MaterialCommandAuthenticationResult,
  type MaterialCommandAuthorizationResult,
  type MaterialCommandIdConflictResult,
  type MaterialCommandOutcomeUnknownResult,
  type MaterialCommandResult,
  type MaterialCommandRetryableResult,
  type MaterialCommandUnsupportedVersionResult,
  type MaterialCommandValidationResult,
  type PlannedWorkoutCommandReferenceV1,
  type PlannedWorkoutStaleRevisionResult,
  type RunCompletionDuplicateResult,
  type RunCompletionReceiptResult,
  type RunDeletionReceiptResult,
} from '../domain/materialCommands/contract'
import type { UtcDateTime } from '../domain/training/dates'
import type { CompletedRunId } from '../domain/training/identifiers'
import {
  createMaterialCommandClient,
  type MaterialCommandClientOptions,
} from './materialCommandClient'

export interface RunCompletionSubmission {
  commandId: string
  input: CompletedRunCommandInputV1
}

export interface RunDeletionSubmission {
  commandId: string
  completedRunId: CompletedRunId
  expectedCompletedRunUpdatedAt: UtcDateTime
  plannedWorkout: PlannedWorkoutCommandReferenceV1 | null
}

type SharedRunCommandFailureResult =
  | MaterialCommandValidationResult
  | MaterialCommandAuthenticationResult
  | MaterialCommandAuthorizationResult
  | MaterialCommandUnsupportedVersionResult
  | MaterialCommandIdConflictResult
  | MaterialCommandRetryableResult
  | MaterialCommandOutcomeUnknownResult

export type RunCompletionClientFailureResult =
  | SharedRunCommandFailureResult
  | RunCompletionDuplicateResult
  | PlannedWorkoutStaleRevisionResult

export type RunDeletionClientFailureResult =
  | SharedRunCommandFailureResult
  | CompletedRunStaleRevisionResult
  | PlannedWorkoutStaleRevisionResult

export type RunCompletionClientResult =
  | RunCompletionReceiptResult
  | RunCompletionClientFailureResult

export type RunDeletionClientResult =
  | RunDeletionReceiptResult
  | RunDeletionClientFailureResult

export interface CompletedRunCommandClient {
  submitCompletion(
    submission: RunCompletionSubmission,
  ): Promise<RunCompletionClientResult>
  submitDeletion(
    submission: RunDeletionSubmission,
  ): Promise<RunDeletionClientResult>
  resolveCompletion(commandId: string): Promise<RunCompletionClientResult>
  resolveDeletion(commandId: string): Promise<RunDeletionClientResult>
}

function unknownOutcome(commandId: string): MaterialCommandOutcomeUnknownResult {
  return {
    status: 'outcome_unknown',
    commandId,
    code: 'resolve-by-command-id',
    message:
      'The completed-run command outcome is unknown. Resolve its command ID before retrying.',
  }
}

function mapSharedFailure(
  result: MaterialCommandResult,
  commandId: string,
): SharedRunCommandFailureResult {
  switch (result.status) {
    case 'committed':
    case 'accepted':
    case 'plan_approved':
    case 'run_completed':
    case 'run_deleted':
      return unknownOutcome(commandId)
    case 'stale_revision':
      return unknownOutcome(commandId)
    case 'conflict':
      return result.code === 'command-id-reused'
        ? result
        : unknownOutcome(commandId)
    default:
      return result
  }
}

function mapCompletionResult(
  result: MaterialCommandResult,
  commandId: string,
): RunCompletionClientResult {
  if (result.status === 'run_completed') return result
  if (isRunCompletionDuplicateResult(result)) return result
  if (
    isRunCommandStaleRevisionResult(result) &&
    result.code === 'planned-workout-version-changed'
  ) {
    return result
  }
  return mapSharedFailure(result, commandId)
}

function mapDeletionResult(
  result: MaterialCommandResult,
  commandId: string,
): RunDeletionClientResult {
  if (result.status === 'run_deleted') return result
  if (isRunCommandStaleRevisionResult(result)) return result
  return mapSharedFailure(result, commandId)
}

export function createCompletedRunCommandClient(
  options: MaterialCommandClientOptions,
): CompletedRunCommandClient {
  const materialCommandClient = createMaterialCommandClient(options)

  return {
    async submitCompletion(submission) {
      const command = createRunCompletionCommand(
        submission.commandId,
        submission.input,
      )
      return mapCompletionResult(
        await materialCommandClient.submit(command),
        submission.commandId,
      )
    },

    async submitDeletion(submission) {
      const command = createRunDeletionCommand(submission.commandId, {
        completedRunId: submission.completedRunId,
        expectedCompletedRunUpdatedAt:
          submission.expectedCompletedRunUpdatedAt,
        plannedWorkout: submission.plannedWorkout,
      })
      return mapDeletionResult(
        await materialCommandClient.submit(command),
        submission.commandId,
      )
    },

    async resolveCompletion(commandId) {
      return mapCompletionResult(
        await materialCommandClient.resolve(commandId),
        commandId,
      )
    },

    async resolveDeletion(commandId) {
      return mapDeletionResult(
        await materialCommandClient.resolve(commandId),
        commandId,
      )
    },
  }
}
