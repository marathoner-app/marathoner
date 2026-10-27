import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertFunctionsEmulatorForMode,
  resolveAppCheckDebugTokenForMode,
  resolveFirebaseEnvironmentForMode,
} from './src/firebaseEnvironment'
import { firebaseProjectConfigurations } from './src/firebaseConfig'

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url))
const internalPlanRulesModuleId = 'virtual:internal-plan-rehearsal-rules'
const resolvedInternalPlanRulesModuleId = `\0${internalPlanRulesModuleId}`
const internalAdaptationPacketModuleId =
  'virtual:internal-adaptation-rehearsal-packet'
const resolvedInternalAdaptationPacketModuleId =
  `\0${internalAdaptationPacketModuleId}`

function internalRehearsalArtifactsPlugin(mode: string) {
  return {
    name: 'internal-rehearsal-artifacts',
    resolveId(id: string) {
      if (id === internalPlanRulesModuleId) {
        return resolvedInternalPlanRulesModuleId
      }
      if (id === internalAdaptationPacketModuleId) {
        return resolvedInternalAdaptationPacketModuleId
      }
      return null
    },
    load(id: string) {
      if (
        id !== resolvedInternalPlanRulesModuleId &&
        id !== resolvedInternalAdaptationPacketModuleId
      ) {
        return null
      }
      if (mode !== 'internal-plan-rehearsal') {
        return 'export default null'
      }

      if (id === resolvedInternalPlanRulesModuleId) {
        const rulesText = readFileSync(
          path.join(
            repositoryRoot,
            'docs/methodology/artifacts/beta-rules/0.1.0-draft/beta-rules.json',
          ),
          'utf8',
        )
        return `export default ${JSON.stringify(rulesText)}`
      }

      const rulesText = readFileSync(
        path.join(
          repositoryRoot,
          'docs/methodology/artifacts/beta-adaptation/0.1.0-draft/beta-adaptation.json',
        ),
        'utf8',
      )
      const fixturesText = readFileSync(
        path.join(
          repositoryRoot,
          'docs/methodology/artifacts/beta-adaptation/0.1.0-draft/fixtures.json',
        ),
        'utf8',
      )
      return `export default ${JSON.stringify({ rulesText, fixturesText })}`
    },
  }
}

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
    base: isIosBuild ? './' : '/',
    plugins: [internalRehearsalArtifactsPlugin(mode), react()],
    optimizeDeps: {
      entries: ['index.html'],
    },
    test: {
      environment: 'jsdom',
      exclude: [
        ...configDefaults.exclude,
        'functions/lib/**',
        'tests/viewport/**',
      ],
      setupFiles: './src/test/setup.ts',
    },
  }
})
