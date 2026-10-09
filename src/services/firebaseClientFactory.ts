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

export interface FirebaseClient {
  app: FirebaseApp
  auth: Auth
}

type AppCheckInitializer = (app: FirebaseApp) => Promise<void>

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

export async function createFirebaseClient(
  config: FirebaseOptions,
  useNativePersistence: boolean,
  initializeAppCheck: AppCheckInitializer,
): Promise<FirebaseClient> {
  const existingDefaultApp = getApps().find((app) => app.name === '[DEFAULT]')
  let app: FirebaseApp

  if (existingDefaultApp) {
    assertExistingAppMatches(existingDefaultApp, config)
    app = getApp()
  } else {
    app = initializeApp(config)
  }

  await initializeAppCheck(app)

  const auth = useNativePersistence
    ? initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      })
    : getAuth(app)

  return { app, auth }
}
