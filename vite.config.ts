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
const capacitorStubRoot = path.resolve(
  repositoryRoot,
  'spikes/mobile/capacitor/stubs',
)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isIosDevelopment = mode === 'ios-development'
  const isMobileSpike = mode === 'mobile-spike'
  const isMobileAuthSpike = mode === 'mobile-auth-spike'
  const isMobileSharedRecordSpike = mode === 'mobile-shared-record-spike'
  const isWebSharedRecordSpike = mode === 'web-shared-record-spike'
  const isSharedRecordSpike =
    isMobileSharedRecordSpike || isWebSharedRecordSpike
  const environment = loadEnv(mode, repositoryRoot, 'VITE_')
  resolveFirebaseEnvironmentForMode({
    mode,
    requestedEnvironment: environment.VITE_FIREBASE_ENVIRONMENT,
    mobileApiKey: environment.VITE_FIREBASE_MOBILE_API_KEY,
    iosApiKey: environment.VITE_FIREBASE_IOS_API_KEY,
    registry: firebaseProjectConfigurations,
  })

  return {
    base:
      isIosDevelopment ||
      isMobileSpike ||
      isMobileAuthSpike ||
      isSharedRecordSpike
        ? './'
        : '/marathoner/',
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
      : isMobileAuthSpike || isSharedRecordSpike
        ? {
            alias: [
              {
                find: './App.tsx',
                replacement: path.resolve(
                  repositoryRoot,
                  isSharedRecordSpike
                    ? 'spikes/mobile/shared-record/SharedRecordProofApp.tsx'
                    : 'spikes/mobile/capacitor/auth/AuthProofApp.tsx',
                ),
              },
              ...(isMobileAuthSpike || isMobileSharedRecordSpike
                ? [
                    {
                      find: '../selectedFirebaseEnvironment',
                      replacement: path.resolve(
                        repositoryRoot,
                        'spikes/mobile/capacitor/auth/selectedFirebaseEnvironment.ts',
                      ),
                    },
                    {
                      find: './firebaseClient',
                      replacement: path.resolve(
                        repositoryRoot,
                        'spikes/mobile/capacitor/auth/firebaseClient.ts',
                      ),
                    },
                  ]
                : []),
            ],
          }
        : undefined,
    test: {
      environment: 'jsdom',
      exclude: [
        ...configDefaults.exclude,
        'spikes/mobile/expo-js/**',
        'spikes/mobile/capacitor/test/**',
      ],
      setupFiles: './src/test/setup.ts',
    },
  }
})
