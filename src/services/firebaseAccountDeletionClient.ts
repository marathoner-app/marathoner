import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions'

import {
  createAccountDeletionRequest,
  type AccountDeletionRequestEnvelope,
} from '../domain/materialCommands/contract'
import { getFirebaseApp } from './firebaseClient'
import {
  createMaterialCommandClient,
  type MaterialCommandTransport,
} from './materialCommandClient'

let requestDeletionCallable: ReturnType<
  typeof httpsCallable<AccountDeletionRequestEnvelope, unknown>
> | null = null

function getRequestDeletionCallable() {
  if (requestDeletionCallable !== null) return requestDeletionCallable

  const functions = getFunctions(getFirebaseApp(), 'us-central1')

  if (import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === 'true') {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  }

  requestDeletionCallable = httpsCallable<
    AccountDeletionRequestEnvelope,
    unknown
  >(functions, 'requestAccountDeletion')
  return requestDeletionCallable
}

const transport: MaterialCommandTransport = {
  async submit(command) {
    return (await getRequestDeletionCallable()(command as AccountDeletionRequestEnvelope))
      .data
  },
  async resolve(commandId) {
    return (await getRequestDeletionCallable()(createAccountDeletionRequest(commandId)))
      .data
  },
}

export const accountDeletionCommandClient = createMaterialCommandClient({
  isOnline: () => navigator.onLine,
  transport,
})
