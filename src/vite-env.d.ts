/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_ENVIRONMENT?: 'development' | 'beta'
  readonly VITE_FIREBASE_IOS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
