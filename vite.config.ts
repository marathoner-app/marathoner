import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertFunctionsEmulatorForMode,
  resolveAppCheckDebugTokenForMode,
  resolveFirebaseEnvironmentForMode,
} from './src/firebaseEnvironment'
import { firebaseProjectConfigurations } from './src/firebaseConfig'

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isIosBuild = mode === 'ios-development' || mode === 'ios-beta'
  const environment = loadEnv(mode, repositoryRoot, 'VITE_')
  assertFunctionsEmulatorForMode(
    mode,
    environment.VITE_FIREBASE_FUNCTIONS_EMULATOR === 'true',
  )
  const selectedFirebaseEnvironment = resolveFirebaseEnvironmentForMode({
    mode,
    requestedEnvironment: environment.VITE_FIREBASE_ENVIRONMENT,
    iosApiKey: environment.VITE_FIREBASE_IOS_API_KEY,
    registry: firebaseProjectConfigurations,
  })
  resolveAppCheckDebugTokenForMode({
    mode,
    environmentName: selectedFirebaseEnvironment.name,
    debugToken: environment.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN,
    isViteServe: command === 'serve',
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
      exclude: [...configDefaults.exclude, 'functions/lib/**'],
      setupFiles: './src/test/setup.ts',
    },
  }
})
