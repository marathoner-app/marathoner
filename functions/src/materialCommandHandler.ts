import {
  isProofMaterialCommandEnvelope,
  isMaterialCommandResult,
  materialCommandIdFrom,
  parseMaterialCommand,
  type AccountDeletionRequestAcceptedResult,
  type MaterialCommandCommittedResult,
  type MaterialCommandResult,
  type ProofMaterialCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'

export type MaterialCommandLogEntry = Readonly<{
  event: 'material-command-result' | 'material-command-resolution'
  commandType:
    | 'proof.material-command'
    | 'account.request-deletion'
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
    MaterialCommandCommittedResult | AccountDeletionRequestAcceptedResult | null
  >
}

interface HandlerDependencies {
  log: (entry: MaterialCommandLogEntry) => void
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
