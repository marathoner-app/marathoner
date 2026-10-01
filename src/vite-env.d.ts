/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_ENVIRONMENT?: 'development' | 'beta'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
