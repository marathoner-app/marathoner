import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions'

import { createGarminConnectionClient } from './garminConnectionClient'
import { getFirebaseApp } from './firebaseClient'

let callables: {
  start: ReturnType<typeof httpsCallable<Record<string, never>, unknown>>
  getStatus: ReturnType<typeof httpsCallable<Record<string, never>, unknown>>
  disconnect: ReturnType<typeof httpsCallable<Record<string, never>, unknown>>
} | null = null

function getCallables() {
  if (callables !== null) return callables

  const functions = getFunctions(getFirebaseApp(), 'us-central1')
  if (import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === 'true') {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  }
  callables = {
    start: httpsCallable(functions, 'startGarminConnection'),
    getStatus: httpsCallable(functions, 'getGarminConnection'),
    disconnect: httpsCallable(functions, 'disconnectGarminConnection'),
  }
  return callables
}

export const firebaseGarminConnectionClient = createGarminConnectionClient({
  async start() {
    return (await getCallables().start({})).data
  },
  async getStatus() {
    return (await getCallables().getStatus({})).data
  },
  async disconnect() {
    return (await getCallables().disconnect({})).data
  },
})
