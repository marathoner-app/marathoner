/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_ENVIRONMENT?: 'development' | 'beta'
  readonly VITE_FIREBASE_FUNCTIONS_EMULATOR?: 'true' | 'false'
  readonly VITE_FIREBASE_IOS_API_KEY?: string
  readonly VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?: string
  readonly VITE_FIREBASE_NATIVE_APP_CHECK_DEBUG?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
