import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions'

import {
  createAccountDeletionRequest,
  type AccountDeletionRequestEnvelope,
} from '../domain/materialCommands/contract'
import { firebaseApp } from './firebaseClient'
import {
  createMaterialCommandClient,
  type MaterialCommandTransport,
} from './materialCommandClient'

const functions = getFunctions(firebaseApp, 'us-central1')

if (import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}

const requestDeletionCallable = httpsCallable<
  AccountDeletionRequestEnvelope,
  unknown
>(functions, 'requestAccountDeletion')

const transport: MaterialCommandTransport = {
  async submit(command) {
    return (await requestDeletionCallable(command as AccountDeletionRequestEnvelope))
      .data
  },
  async resolve(commandId) {
    return (await requestDeletionCallable(createAccountDeletionRequest(commandId)))
      .data
  },
}

export const accountDeletionCommandClient = createMaterialCommandClient({
  isOnline: () => navigator.onLine,
  transport,
})
