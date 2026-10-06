import {
  createAccountDeletionRequest,
  type MaterialCommandResult,
} from '../domain/materialCommands/contract'
import { reauthenticateWithPassword } from './authService'

export const reauthenticateForAccountDeletion = (
  password: string,
): Promise<void> => reauthenticateWithPassword(password)

export async function submitAccountDeletionRequest(
  commandId: string,
): Promise<MaterialCommandResult> {
  const { accountDeletionCommandClient } = await import(
    './firebaseAccountDeletionClient'
  )
  return accountDeletionCommandClient.submit(
    createAccountDeletionRequest(commandId),
  )
}

export async function resolveAccountDeletionRequest(
  commandId: string,
): Promise<MaterialCommandResult> {
  const { accountDeletionCommandClient } = await import(
    './firebaseAccountDeletionClient'
  )
  return accountDeletionCommandClient.resolve(commandId)
}
