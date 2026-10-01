import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertFirebaseEnvironmentForMode,
  resolveFirebaseEnvironment,
} from './src/firebaseEnvironment'

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url))
const capacitorStubRoot = path.resolve(
  repositoryRoot,
  'spikes/mobile/capacitor/stubs',
)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isMobileSpike = mode === 'mobile-spike'
  const environment = loadEnv(mode, repositoryRoot, 'VITE_')
  const selectedFirebaseEnvironment = resolveFirebaseEnvironment(
    environment.VITE_FIREBASE_ENVIRONMENT,
  )

  assertFirebaseEnvironmentForMode(mode, selectedFirebaseEnvironment.name)

  return {
    base: isMobileSpike ? './' : '/marathoner/',
    plugins: [react()],
    assetsInclude: ['src/assets/IMG_0437.JPG'],
    optimizeDeps: {
      entries: ['index.html'],
    },
    resolve: isMobileSpike
      ? {
          alias: [
            {
              find: './auth/AuthProvider.tsx',
              replacement: path.resolve(capacitorStubRoot, 'AuthProvider.tsx'),
            },
            {
              find: './components/PublicAccessNotice',
              replacement: path.resolve(
                capacitorStubRoot,
                'PublicAccessNotice.tsx',
              ),
            },
            {
              find: './training/TrainingDataProvider',
              replacement: path.resolve(
                capacitorStubRoot,
                'TrainingDataProvider.tsx',
              ),
            },
          ],
        }
      : undefined,
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'spikes/mobile/**'],
      setupFiles: './src/test/setup.ts',
    },
  }
})
