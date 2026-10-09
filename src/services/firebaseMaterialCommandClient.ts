import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions'

import type { MaterialCommandEnvelope } from '../domain/materialCommands/contract'
import { getFirebaseApp } from './firebaseClient'
import {
  createMaterialCommandClient,
  type MaterialCommandTransport,
} from './materialCommandClient'

let callables: {
  submit: ReturnType<typeof httpsCallable<MaterialCommandEnvelope, unknown>>
  resolve: ReturnType<typeof httpsCallable<{ commandId: string }, unknown>>
} | null = null

function getCallables() {
  if (callables !== null) return callables

  const functions = getFunctions(getFirebaseApp(), 'us-central1')

  if (import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === 'true') {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  }

  callables = {
    submit: httpsCallable<MaterialCommandEnvelope, unknown>(
      functions,
      'submitMaterialCommand',
    ),
    resolve: httpsCallable<{ commandId: string }, unknown>(
      functions,
      'resolveMaterialCommand',
    ),
  }
  return callables
}

const transport: MaterialCommandTransport = {
  async submit(command) {
    return (await getCallables().submit(command)).data
  },
  async resolve(commandId) {
    return (await getCallables().resolve({ commandId })).data
  },
}

export const materialCommandClient = createMaterialCommandClient({
  isOnline: () => navigator.onLine,
  transport,
})
