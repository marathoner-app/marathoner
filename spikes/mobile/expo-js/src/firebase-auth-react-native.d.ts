import type { Persistence } from 'firebase/auth';

interface ReactNativeAsyncStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

// Firebase exposes this function from its React Native runtime entrypoint, but
// the top-level firebase/auth package points TypeScript at browser-first types.
// Keep this narrow declaration aligned with @firebase/auth's published RN type.
declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
