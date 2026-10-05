import { Capacitor } from '@capacitor/core'
import { selectedFirebaseEnvironment } from '../selectedFirebaseEnvironment'
import { createFirebaseClient } from './firebaseClientFactory'

const firebaseClient = createFirebaseClient(
  selectedFirebaseEnvironment.config,
  Capacitor.isNativePlatform(),
)

export const firebaseApp = firebaseClient.app
export const auth = firebaseClient.auth
