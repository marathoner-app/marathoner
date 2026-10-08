import {
  isMaterialCommandResult,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
} from '../domain/materialCommands/contract'

export interface MaterialCommandTransport {
  submit(command: MaterialCommandEnvelope): Promise<unknown>
  resolve(commandId: string): Promise<unknown>
}

export interface MaterialCommandClientOptions {
  isOnline: () => boolean
  transport: MaterialCommandTransport
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null
  }
  return typeof error.code === 'string' ? error.code : null
}

function offlineResult(commandId: string): MaterialCommandResult {
  return {
    status: 'retryable_error',
    commandId,
    code: 'temporarily-unavailable',
    message: 'You are offline. This command was not queued; reconnect and try again.',
  }
}

function transportFailure(
  error: unknown,
  commandId: string,
): MaterialCommandResult {
  const code = errorCode(error)
  if (code === 'functions/unauthenticated') {
    return {
      status: 'authentication_error',
      commandId,
      code: 'authentication-required',
      message: 'Sign in before submitting this command.',
    }
  }
  if (
    code === 'functions/unavailable' ||
    code === 'functions/resource-exhausted'
  ) {
    return {
      status: 'retryable_error',
      commandId,
      code: 'temporarily-unavailable',
      message: 'The command service is temporarily unavailable. Retry shortly.',
    }
  }
  return {
    status: 'outcome_unknown',
    commandId,
    code: 'resolve-by-command-id',
    message: 'The command outcome is unknown. Resolve its command ID before retrying.',
  }
}

function validatedResult(value: unknown, commandId: string) {
  return isMaterialCommandResult(value) && value.commandId === commandId
    ? value
    : transportFailure({ code: 'functions/internal' }, commandId)
}

export function createMaterialCommandClient(
  options: MaterialCommandClientOptions,
) {
  return {
    async submit(
      command: MaterialCommandEnvelope,
    ): Promise<MaterialCommandResult> {
      if (!options.isOnline()) return offlineResult(command.commandId)
      try {
        return validatedResult(
          await options.transport.submit(command),
          command.commandId,
        )
      } catch (error) {
        return transportFailure(error, command.commandId)
      }
    },

    async resolve(commandId: string): Promise<MaterialCommandResult> {
      if (!options.isOnline()) return offlineResult(commandId)
      try {
        return validatedResult(
          await options.transport.resolve(commandId),
          commandId,
        )
      } catch (error) {
        return transportFailure(error, commandId)
      }
    },
  }
}
