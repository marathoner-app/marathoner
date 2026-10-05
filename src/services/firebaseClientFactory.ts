import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'

interface FirebaseClient {
  app: FirebaseApp
  auth: Auth
}

const identityFields = ['apiKey', 'appId', 'projectId'] as const

function assertExistingAppMatches(
  app: FirebaseApp,
  expected: FirebaseOptions,
): void {
  for (const field of identityFields) {
    if (app.options[field] !== expected[field]) {
      throw new Error(
        `The existing Firebase app does not match the selected ${field}.`,
      )
    }
  }
}

export function createFirebaseClient(
  config: FirebaseOptions,
  useNativePersistence: boolean,
): FirebaseClient {
  const existingDefaultApp = getApps().find((app) => app.name === '[DEFAULT]')

  if (existingDefaultApp) {
    assertExistingAppMatches(existingDefaultApp, config)
    return {
      app: getApp(),
      auth: getAuth(existingDefaultApp),
    }
  }

  const app = initializeApp(config)
  const auth = useNativePersistence
    ? initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      })
    : getAuth(app)

  return { app, auth }
}
