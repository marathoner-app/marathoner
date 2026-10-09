import {
  betaFirebaseClientConfiguration,
  developmentFirebaseClientConfiguration,
  firebaseProjectConfigurations,
  type FirebaseConfigurationRegistry,
} from './firebaseConfig'
import {
  resolveAppCheckDebugTokenForMode,
  resolveFirebaseEnvironmentForMode,
} from './firebaseEnvironment'

function registryForMode(mode: string): FirebaseConfigurationRegistry {
  if (mode === 'ios-development') {
    return {
      development: developmentFirebaseClientConfiguration,
      beta: null,
    }
  }

  if (mode === 'ios-beta') {
    return {
      development: null,
      beta: betaFirebaseClientConfiguration,
    }
  }

  return firebaseProjectConfigurations
}

const registry = registryForMode(import.meta.env.MODE)

export const selectedFirebaseEnvironment = resolveFirebaseEnvironmentForMode({
  mode: import.meta.env.MODE,
  requestedEnvironment: import.meta.env.VITE_FIREBASE_ENVIRONMENT,
  iosApiKey: import.meta.env.VITE_FIREBASE_IOS_API_KEY,
  registry,
})

export const selectedAppCheckDebugToken = resolveAppCheckDebugTokenForMode({
  mode: import.meta.env.MODE,
  environmentName: selectedFirebaseEnvironment.name,
  debugToken: import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN,
  isViteServe: import.meta.env.DEV,
})
