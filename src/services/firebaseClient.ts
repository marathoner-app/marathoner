import { Capacitor } from '@capacitor/core'
import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import {
  selectedAppCheckDebugToken,
  selectedFirebaseEnvironment,
} from '../selectedFirebaseEnvironment'
import { initializeAppCheckBeforeServices } from './appCheckBootstrap'
import {
  createFirebaseClient,
  type FirebaseClient,
} from './firebaseClientFactory'

let firebaseClient: FirebaseClient | null = null
let firebaseClientInitialization: Promise<FirebaseClient> | null = null

export async function initializeFirebaseClient(): Promise<FirebaseClient> {
  if (firebaseClient !== null) return firebaseClient

  firebaseClientInitialization ??= createFirebaseClient(
    selectedFirebaseEnvironment.config,
    Capacitor.isNativePlatform(),
    (app) =>
      initializeAppCheckBeforeServices({
        app,
        appCheckSiteKey:
          selectedFirebaseEnvironment.config.appCheckSiteKey,
        debugToken: selectedAppCheckDebugToken,
        isNativePlatform: Capacitor.isNativePlatform(),
      }),
  )

  try {
    firebaseClient = await firebaseClientInitialization
    return firebaseClient
  } catch (error) {
    firebaseClientInitialization = null
    throw error
  }
}

function requireFirebaseClient(): FirebaseClient {
  if (firebaseClient === null) {
    throw new Error(
      'Firebase services were requested before App Check startup completed.',
    )
  }

  return firebaseClient
}

export function getFirebaseApp(): FirebaseApp {
  return requireFirebaseClient().app
}

export function getFirebaseAuth(): Auth {
  return requireFirebaseClient().auth
}
