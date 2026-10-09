import {
  isProofMaterialCommandEnvelope,
  isPlanApprovalCommandEnvelope,
  isRunCompletionCommandEnvelope,
  isRunDeletionCommandEnvelope,
  isMaterialCommandResult,
  materialCommandIdFrom,
  parseMaterialCommand,
  type AccountDeletionRequestAcceptedResult,
  type MaterialCommandCommittedResult,
  type MaterialCommandResult,
  type PlanApprovalCommandEnvelope,
  type PlanApprovalReceiptResult,
  type PlanApprovalStaleRevisionResult,
  type ProofMaterialCommandEnvelope,
  type RunCompletionCommandEnvelope,
  type RunCompletionReceiptResult,
  type RunDeletionCommandEnvelope,
  type RunDeletionReceiptResult,
} from '../../src/domain/materialCommands/contract.js'
import type { RunCommandProjectionFailureResult } from './completedRunCommandProjection.js'
import {
  evaluatePlanApprovalArtifactPolicy,
  PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY,
  type PlanApprovalArtifactPolicyRecord,
} from './planApprovalArtifactPolicy.js'

export type MaterialCommandLogEntry = Readonly<{
  event: 'material-command-result' | 'material-command-resolution'
  commandType:
    | 'proof.material-command'
    | 'account.request-deletion'
    | 'plan.approve-generated'
    | 'run.complete'
    | 'run.delete'
    | 'unknown'
  status: MaterialCommandResult['status']
}>

export interface MaterialCommandStore {
  commitProof(options: {
    envelope: ProofMaterialCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'committed'; result: MaterialCommandCommittedResult }
    | { kind: 'conflict' }
  >
  resolve(options: {
    commandId: string
    ownerId: string
  }): Promise<
    | MaterialCommandCommittedResult
    | AccountDeletionRequestAcceptedResult
    | PlanApprovalReceiptResult
    | RunCompletionReceiptResult
    | RunDeletionReceiptResult
    | null
  >
}

export interface RunCompletionStore {
  commit(options: {
    envelope: RunCompletionCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'completed'; result: RunCompletionReceiptResult }
    | { kind: 'rejected'; result: RunCommandProjectionFailureResult }
    | { kind: 'conflict' }
  >
}

export interface RunDeletionStore {
  commit(options: {
    envelope: RunDeletionCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'deleted'; result: RunDeletionReceiptResult }
    | { kind: 'rejected'; result: RunCommandProjectionFailureResult }
    | { kind: 'conflict' }
  >
}

export interface PlanApprovalStore {
  commit(options: {
    artifactPolicyRecord: PlanApprovalArtifactPolicyRecord
    envelope: PlanApprovalCommandEnvelope
    ownerId: string
  }): Promise<
    | { kind: 'approved'; result: PlanApprovalReceiptResult }
    | { kind: 'stale'; result: PlanApprovalStaleRevisionResult }
    | { kind: 'conflict' }
  >
}

export interface PlanApprovalHandlerDependencies {
  policyRecords: readonly PlanApprovalArtifactPolicyRecord[]
  store: PlanApprovalStore
  supportedScopeId: string | null
}

export interface HandlerDependencies {
  log: (entry: MaterialCommandLogEntry) => void
  planApproval?: PlanApprovalHandlerDependencies
  runCompletion?: { store: RunCompletionStore }
  runDeletion?: { store: RunDeletionStore }
  store: MaterialCommandStore
}

function authenticationResult(commandId: string | null): MaterialCommandResult {
  return {
    status: 'authentication_error',
    commandId,
    code: 'authentication-required',
    message: 'Sign in before submitting this command.',
  }
}

function conflictResult(commandId: string): MaterialCommandResult {
  return {
    status: 'conflict',
    commandId,
    code: 'command-id-reused',
    message: 'This command ID was already used for a different command.',
  }
}

function artifactNotApprovedResult(commandId: string): MaterialCommandResult {
  return {
    status: 'authorization_error',
    commandId,
    code: 'plan-artifact-not-approved',
    message: 'This generated plan is not approved for the active participant scope.',
  }
}

function runCommandNotEnabledResult(commandId: string): MaterialCommandResult {
  return {
    status: 'authorization_error',
    commandId,
    code: 'approved-beta-membership-required',
    message: 'Completed-run commands are not enabled in this environment.',
  }
}

function retryableResult(commandId: string | null): MaterialCommandResult {
  return {
    status: 'retryable_error',
    commandId,
    code: 'temporarily-unavailable',
    message: 'The command service is temporarily unavailable. Retry shortly.',
  }
}

function outcomeUnknownResult(commandId: string | null): MaterialCommandResult {
  return {
    status: 'outcome_unknown',
    commandId,
    code: 'resolve-by-command-id',
    message: 'The command outcome is unknown. Resolve its command ID before retrying.',
  }
}

function errorCode(error: unknown): string | number | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null
  }
  return typeof error.code === 'string' || typeof error.code === 'number'
    ? error.code
    : null
}

function failureFor(error: unknown, commandId: string | null) {
  const code = errorCode(error)
  if (
    code === 'aborted' ||
    code === 10 ||
    code === 'unavailable' ||
    code === 14 ||
    code === 'resource-exhausted' ||
    code === 8
  ) {
    return retryableResult(commandId)
  }
  return outcomeUnknownResult(commandId)
}

function logResult(
  dependencies: HandlerDependencies,
  event: MaterialCommandLogEntry['event'],
  result: MaterialCommandResult,
  commandType: MaterialCommandLogEntry['commandType'],
) {
  dependencies.log({ event, commandType, status: result.status })
}

export async function executeMaterialCommand(
  options: {
    authenticatedUserId: string | null
    data: unknown
  },
  dependencies: HandlerDependencies,
): Promise<MaterialCommandResult> {
  const commandId = materialCommandIdFrom(options.data)
  if (!options.authenticatedUserId) {
    const result = authenticationResult(commandId)
    logResult(dependencies, 'material-command-result', result, 'unknown')
    return result
  }

  const parsed = parseMaterialCommand(options.data)
  if (!parsed.ok) {
    logResult(dependencies, 'material-command-result', parsed.result, 'unknown')
    return parsed.result
  }
  if (isPlanApprovalCommandEnvelope(parsed.envelope)) {
    const planApproval = dependencies.planApproval
    const policyDecision = evaluatePlanApprovalArtifactPolicy(parsed.envelope, {
      supportedScopeId: planApproval?.supportedScopeId ?? null,
      records:
        planApproval?.policyRecords ??
        PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY,
    })
    if (!policyDecision.allowed || !planApproval) {
      const result = artifactNotApprovedResult(parsed.envelope.commandId)
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }

    try {
      const stored = await planApproval.store.commit({
        artifactPolicyRecord: policyDecision.record,
        envelope: parsed.envelope,
        ownerId: options.authenticatedUserId,
      })
      const result =
        stored.kind === 'conflict'
          ? conflictResult(parsed.envelope.commandId)
          : stored.result
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    } catch (error) {
      const result = failureFor(error, parsed.envelope.commandId)
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }
  }
  if (isRunCompletionCommandEnvelope(parsed.envelope)) {
    const runCompletion = dependencies.runCompletion
    if (!runCompletion) {
      const result = runCommandNotEnabledResult(parsed.envelope.commandId)
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }

    try {
      const stored = await runCompletion.store.commit({
        envelope: parsed.envelope,
        ownerId: options.authenticatedUserId,
      })
      const result =
        stored.kind === 'conflict'
          ? conflictResult(parsed.envelope.commandId)
          : stored.result
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    } catch (error) {
      const result = failureFor(error, parsed.envelope.commandId)
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }
  }
  if (isRunDeletionCommandEnvelope(parsed.envelope)) {
    const runDeletion = dependencies.runDeletion
    if (!runDeletion) {
      const result = runCommandNotEnabledResult(parsed.envelope.commandId)
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }

    try {
      const stored = await runDeletion.store.commit({
        envelope: parsed.envelope,
        ownerId: options.authenticatedUserId,
      })
      const result =
        stored.kind === 'conflict'
          ? conflictResult(parsed.envelope.commandId)
          : stored.result
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    } catch (error) {
      const result = failureFor(error, parsed.envelope.commandId)
      logResult(
        dependencies,
        'material-command-result',
        result,
        parsed.envelope.command.type,
      )
      return result
    }
  }
  if (!isProofMaterialCommandEnvelope(parsed.envelope)) {
    const result: MaterialCommandResult = {
      status: 'validation_error',
      commandId: parsed.envelope.commandId,
      code: 'invalid-envelope',
      message: 'Use the account-deletion endpoint for this command.',
    }
    logResult(dependencies, 'material-command-result', result, 'unknown')
    return result
  }

  try {
    const stored = await dependencies.store.commitProof({
      envelope: parsed.envelope,
      ownerId: options.authenticatedUserId,
    })
    const result =
      stored.kind === 'committed'
        ? stored.result
        : conflictResult(parsed.envelope.commandId)
    logResult(
      dependencies,
      'material-command-result',
      result,
      parsed.envelope.command.type,
    )
    return result
  } catch (error) {
    const result = failureFor(error, parsed.envelope.commandId)
    logResult(
      dependencies,
      'material-command-result',
      result,
      parsed.envelope.command.type,
    )
    return result
  }
}

export async function resolveMaterialCommand(
  options: {
    authenticatedUserId: string | null
    data: unknown
  },
  dependencies: HandlerDependencies,
): Promise<MaterialCommandResult> {
  const commandId = materialCommandIdFrom(options.data)
  if (!options.authenticatedUserId) {
    const result = authenticationResult(commandId)
    logResult(dependencies, 'material-command-resolution', result, 'unknown')
    return result
  }
  if (commandId === null) {
    const result: MaterialCommandResult = {
      status: 'validation_error',
      commandId: null,
      code: 'invalid-envelope',
      message: 'A valid command ID is required for resolution.',
    }
    logResult(dependencies, 'material-command-resolution', result, 'unknown')
    return result
  }

  try {
    const stored = await dependencies.store.resolve({
      commandId,
      ownerId: options.authenticatedUserId,
    })
    const result =
      stored && isMaterialCommandResult(stored)
        ? stored
        : outcomeUnknownResult(commandId)
    logResult(
      dependencies,
      'material-command-resolution',
      result,
      stored?.status === 'accepted'
        ? 'account.request-deletion'
        : stored?.status === 'plan_approved'
          ? 'plan.approve-generated'
          : stored?.status === 'run_completed'
            ? 'run.complete'
            : stored?.status === 'run_deleted'
              ? 'run.delete'
              : stored
                ? 'proof.material-command'
                : 'unknown',
    )
    return result
  } catch (error) {
    const result = failureFor(error, commandId)
    logResult(dependencies, 'material-command-resolution', result, 'unknown')
    return result
  }
}
