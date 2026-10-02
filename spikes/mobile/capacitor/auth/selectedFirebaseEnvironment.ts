import { developmentFirebaseClientIdentity } from '../../../../src/firebaseConfig'

const mobileApiKey = import.meta.env.VITE_FIREBASE_MOBILE_API_KEY?.trim()

if (!mobileApiKey) {
  throw new Error(
    'The Capacitor authentication proof requires VITE_FIREBASE_MOBILE_API_KEY.',
  )
}

export const selectedFirebaseEnvironment = {
  name: 'development',
  config: {
    apiKey: mobileApiKey,
    ...developmentFirebaseClientIdentity,
  },
} as const
