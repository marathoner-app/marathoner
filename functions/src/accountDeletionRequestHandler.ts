import {
  ACCOUNT_DELETION_REQUEST_TYPE,
  isAccountDeletionRequestEnvelope,
  materialCommandIdFrom,
  parseMaterialCommand,
  type AccountDeletionRequestAcceptedResult,
  type AccountDeletionRequestEnvelope,
  type MaterialCommandResult,
} from '../../src/domain/materialCommands/contract.js'

export const RECENT_AUTHENTICATION_MAX_AGE_SECONDS = 5 * 60

export type AccountDeletionRequestLogEntry = Readonly<{
  event: 'account-deletion-request-result'
  commandType: typeof ACCOUNT_DELETION_REQUEST_TYPE | 'unknown'
  status: MaterialCommandResult['status']
}>

export interface AccountDeletionRequestStore {
  accept(options: {
    envelope: AccountDeletionRequestEnvelope
    ownerId: string
  }): Promise<
    | {
        kind: 'accepted'
        authLockStatus: 'complete' | 'pending'
        result: AccountDeletionRequestAcceptedResult
      }
    | { kind: 'conflict' }
    | { kind: 'membership-required' }
  >
  markAuthLockComplete(requestId: string): Promise<void>
  markAuthLockFailed(requestId: string): Promise<void>
}

export interface AccountAccessManager {
  disableAndRevoke(ownerId: string): Promise<void>
}

interface AccountDeletionRequestDependencies {
  accountAccess: AccountAccessManager
  log: (entry: AccountDeletionRequestLogEntry) => void
  nowEpochSeconds: () => number
  store: AccountDeletionRequestStore
}

interface AuthenticatedUser {
  authTimeSeconds: number | null
  emailVerified: boolean
  uid: string
}

function failure(
  status: 'authentication_error' | 'authorization_error',
  commandId: string | null,
  code:
    | 'authentication-required'
    | 'verified-email-required'
    | 'recent-authentication-required'
    | 'app-check-required'
    | 'app-check-token-replayed'
    | 'approved-beta-membership-required',
  message: string,
): MaterialCommandResult {
  return { status, commandId, code, message } as MaterialCommandResult
}

function conflict(commandId: string): MaterialCommandResult {
  return {
    status: 'conflict',
    commandId,
    code: 'command-id-reused',
    message: 'This command ID was already used for a different command.',
  }
}

function outcomeUnknown(commandId: string | null): MaterialCommandResult {
  return {
    status: 'outcome_unknown',
    commandId,
    code: 'resolve-by-command-id',
    message: 'The request outcome is unknown. Resolve its command ID before retrying.',
  }
}

function isRecentAuthentication(
  authTimeSeconds: number | null,
  nowEpochSeconds: number,
): boolean {
  if (!Number.isFinite(authTimeSeconds)) return false
  const ageSeconds = nowEpochSeconds - Number(authTimeSeconds)
  return ageSeconds >= 0 && ageSeconds <= RECENT_AUTHENTICATION_MAX_AGE_SECONDS
}

function logResult(
  dependencies: AccountDeletionRequestDependencies,
  result: MaterialCommandResult,
  commandType: AccountDeletionRequestLogEntry['commandType'],
) {
  dependencies.log({
    event: 'account-deletion-request-result',
    commandType,
    status: result.status,
  })
}

export async function executeAccountDeletionRequest(
  options: {
    appCheckAlreadyConsumed: boolean
    appCheckVerified: boolean
    authenticatedUser: AuthenticatedUser | null
    data: unknown
  },
  dependencies: AccountDeletionRequestDependencies,
): Promise<MaterialCommandResult> {
  const commandId = materialCommandIdFrom(options.data)
  if (!options.authenticatedUser) {
    const result = failure(
      'authentication_error',
      commandId,
      'authentication-required',
      'Sign in before requesting account deletion.',
    )
    logResult(dependencies, result, 'unknown')
    return result
  }
  if (!options.appCheckVerified) {
    const result = failure(
      'authorization_error',
      commandId,
      'app-check-required',
      'Open the supported Marathoner app before retrying this request.',
    )
    logResult(dependencies, result, 'unknown')
    return result
  }
  if (options.appCheckAlreadyConsumed) {
    const result = failure(
      'authorization_error',
      commandId,
      'app-check-token-replayed',
      'Refresh the app session before retrying this request.',
    )
    logResult(dependencies, result, 'unknown')
    return result
  }
  if (!options.authenticatedUser.emailVerified) {
    const result = failure(
      'authentication_error',
      commandId,
      'verified-email-required',
      'Verify the account email before requesting deletion.',
    )
    logResult(dependencies, result, 'unknown')
    return result
  }
  if (
    !isRecentAuthentication(
      options.authenticatedUser.authTimeSeconds,
      dependencies.nowEpochSeconds(),
    )
  ) {
    const result = failure(
      'authentication_error',
      commandId,
      'recent-authentication-required',
      'Re-enter the account password before requesting deletion.',
    )
    logResult(dependencies, result, 'unknown')
    return result
  }

  const parsed = parseMaterialCommand(options.data)
  if (!parsed.ok) {
    logResult(dependencies, parsed.result, 'unknown')
    return parsed.result
  }
  if (!isAccountDeletionRequestEnvelope(parsed.envelope)) {
    const result: MaterialCommandResult = {
      status: 'validation_error',
      commandId: parsed.envelope.commandId,
      code: 'invalid-envelope',
      message: 'The account-deletion endpoint accepts only deletion requests.',
    }
    logResult(dependencies, result, 'unknown')
    return result
  }

  try {
    const accepted = await dependencies.store.accept({
      envelope: parsed.envelope,
      ownerId: options.authenticatedUser.uid,
    })
    if (accepted.kind === 'conflict') {
      const result = conflict(parsed.envelope.commandId)
      logResult(dependencies, result, ACCOUNT_DELETION_REQUEST_TYPE)
      return result
    }
    if (accepted.kind === 'membership-required') {
      const result = failure(
        'authorization_error',
        parsed.envelope.commandId,
        'approved-beta-membership-required',
        'An approved beta membership is required for this deletion request.',
      )
      logResult(dependencies, result, ACCOUNT_DELETION_REQUEST_TYPE)
      return result
    }

    if (accepted.authLockStatus === 'pending') {
      try {
        await dependencies.accountAccess.disableAndRevoke(
          options.authenticatedUser.uid,
        )
        await dependencies.store.markAuthLockComplete(accepted.result.requestId)
      } catch {
        try {
          await dependencies.store.markAuthLockFailed(accepted.result.requestId)
        } catch {
          // The protected request remains pending and visible to the operator.
        }
      }
    }

    logResult(dependencies, accepted.result, ACCOUNT_DELETION_REQUEST_TYPE)
    return accepted.result
  } catch {
    const result = outcomeUnknown(parsed.envelope.commandId)
    logResult(dependencies, result, ACCOUNT_DELETION_REQUEST_TYPE)
    return result
  }
}
