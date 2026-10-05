import {
  developmentFirebaseClientConfiguration,
  firebaseProjectConfigurations,
  type FirebaseConfigurationRegistry,
} from './firebaseConfig'
import { resolveFirebaseEnvironmentForMode } from './firebaseEnvironment'

const registry: FirebaseConfigurationRegistry =
  import.meta.env.MODE === 'ios-development'
    ? {
        development: developmentFirebaseClientConfiguration,
        beta: null,
      }
    : firebaseProjectConfigurations

export const selectedFirebaseEnvironment = resolveFirebaseEnvironmentForMode({
  mode: import.meta.env.MODE,
  requestedEnvironment: import.meta.env.VITE_FIREBASE_ENVIRONMENT,
  iosApiKey: import.meta.env.VITE_FIREBASE_IOS_API_KEY,
  registry,
})
