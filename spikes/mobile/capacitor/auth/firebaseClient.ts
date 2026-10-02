import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseOptions,
} from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'
import { selectedFirebaseEnvironment } from './selectedFirebaseEnvironment'

const mobileAuthAppName = 'marathoner-capacitor-auth-spike'

export function createMobileAuth(config: FirebaseOptions): Auth {
  const existingApp = getApps().find((app) => app.name === mobileAuthAppName)

  if (existingApp) {
    return getAuth(getApp(mobileAuthAppName))
  }

  const app = initializeApp(config, mobileAuthAppName)

  return initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  })
}

export const auth = createMobileAuth(selectedFirebaseEnvironment.config)
export const firebaseApp = getApp(mobileAuthAppName)
