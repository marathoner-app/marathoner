import { createCompletedRunCommandClient } from './completedRunCommandClient'
import { firebaseMaterialCommandTransport } from './firebaseMaterialCommandClient'

export const firebaseCompletedRunCommandClient =
  createCompletedRunCommandClient({
    isOnline: () => navigator.onLine,
    transport: firebaseMaterialCommandTransport,
  })
