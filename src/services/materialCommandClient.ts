import {
  isMaterialCommandResult,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
} from '../domain/materialCommands/contract'
import { measureOperation } from '../persistence/operationTiming'

export interface MaterialCommandTransport {
  submit(command: MaterialCommandEnvelope): Promise<unknown>
  resolve(commandId: string): Promise<unknown>
}

export interface MaterialCommandClientOptions {
  isOnline: () => boolean
  transport: MaterialCommandTransport
  retryIdempotentSubmissionsOnce?: boolean
  timingNames?: Readonly<{
    firstSubmission: string
    safeRetry: string
    commandResolution: string
  }>
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null
  }
  return typeof error.code === 'string' ? error.code : null
}

function isDefinitiveTransportFailure(error: unknown): boolean {
  const code = errorCode(error)
  return (
    code === 'functions/unauthenticated' ||
    code === 'functions/permission-denied' ||
    code === 'functions/invalid-argument' ||
    code === 'functions/failed-precondition'
  )
}

async function submitWithOneSafeRetry(
  options: MaterialCommandClientOptions,
  command: MaterialCommandEnvelope,
): Promise<unknown> {
  const submit = (name: string | undefined) =>
    name === undefined
      ? options.transport.submit(command)
      : measureOperation(name, () => options.transport.submit(command))
  try {
    return await submit(options.timingNames?.firstSubmission)
  } catch (error) {
    if (isDefinitiveTransportFailure(error)) throw error

    // Material commands are idempotent by command ID. Retrying this exact
    // envelope can recover a pre-request App Check/network failure or retrieve
    // the existing receipt when the first response was lost, without creating
    // the operation twice.
    return submit(options.timingNames?.safeRetry)
  }
}

function firstSubmission(
  options: MaterialCommandClientOptions,
  command: MaterialCommandEnvelope,
): Promise<unknown> {
  const name = options.timingNames?.firstSubmission
  return name === undefined
    ? options.transport.submit(command)
    : measureOperation(name, () => options.transport.submit(command))
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
          await (options.retryIdempotentSubmissionsOnce
            ? submitWithOneSafeRetry(options, command)
            : firstSubmission(options, command)),
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
          await (options.timingNames === undefined
            ? options.transport.resolve(commandId)
            : measureOperation(options.timingNames.commandResolution, () =>
                options.transport.resolve(commandId),
              )),
          commandId,
        )
      } catch (error) {
        return transportFailure(error, commandId)
      }
    },
  }
}
