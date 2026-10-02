import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseOptions,
} from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

const mobileAuthAppName = 'marathoner-expo-auth-spike';

export function createMobileAuth(config: FirebaseOptions): Auth {
  const existingApp = getApps().find((app) => app.name === mobileAuthAppName);

  if (existingApp) {
    return getAuth(getApp(mobileAuthAppName));
  }

  const app = initializeApp(config, mobileAuthAppName);

  return initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}
