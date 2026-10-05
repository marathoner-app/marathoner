import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions'

import type { MaterialCommandEnvelope } from '../domain/materialCommands/contract'
import { firebaseApp } from './firebaseClient'
import {
  createMaterialCommandClient,
  type MaterialCommandTransport,
} from './materialCommandClient'

const functions = getFunctions(firebaseApp, 'us-central1')

if (import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}

const submitCallable = httpsCallable<MaterialCommandEnvelope, unknown>(
  functions,
  'submitMaterialCommand',
)
const resolveCallable = httpsCallable<{ commandId: string }, unknown>(
  functions,
  'resolveMaterialCommand',
)

const transport: MaterialCommandTransport = {
  async submit(command) {
    return (await submitCallable(command)).data
  },
  async resolve(commandId) {
    return (await resolveCallable({ commandId })).data
  },
}

export const materialCommandClient = createMaterialCommandClient({
  isOnline: () => navigator.onLine,
  transport,
})
