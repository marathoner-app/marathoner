import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveFirebaseEnvironmentForMode,
} from './src/firebaseEnvironment'
import { firebaseProjectConfigurations } from './src/firebaseConfig'

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isIosBuild = mode === 'ios-development' || mode === 'ios-beta'
  const environment = loadEnv(mode, repositoryRoot, 'VITE_')
  resolveFirebaseEnvironmentForMode({
    mode,
    requestedEnvironment: environment.VITE_FIREBASE_ENVIRONMENT,
    iosApiKey: environment.VITE_FIREBASE_IOS_API_KEY,
    registry: firebaseProjectConfigurations,
  })

  return {
    base: isIosBuild ? './' : '/marathoner/',
    plugins: [react()],
    assetsInclude: ['src/assets/IMG_0437.JPG'],
    optimizeDeps: {
      entries: ['index.html'],
    },
    test: {
      environment: 'jsdom',
      exclude: configDefaults.exclude,
      setupFiles: './src/test/setup.ts',
    },
  }
})
