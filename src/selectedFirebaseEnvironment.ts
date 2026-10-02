import { resolveFirebaseEnvironmentForMode } from './firebaseEnvironment'

export const selectedFirebaseEnvironment = resolveFirebaseEnvironmentForMode({
  mode: import.meta.env.MODE,
  requestedEnvironment: import.meta.env.VITE_FIREBASE_ENVIRONMENT,
  mobileApiKey: import.meta.env.VITE_FIREBASE_MOBILE_API_KEY,
})
