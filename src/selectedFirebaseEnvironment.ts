import { resolveFirebaseEnvironment } from './firebaseEnvironment'

export const selectedFirebaseEnvironment = resolveFirebaseEnvironment(
  import.meta.env.VITE_FIREBASE_ENVIRONMENT,
)
