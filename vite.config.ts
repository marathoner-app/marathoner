import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertFunctionsEmulatorForMode,
  resolveAppCheckDebugTokenForMode,
  resolveFirebaseEnvironmentForMode,
  resolveClosedBetaProvisionalMethodologyForMode,
  resolveProvisionalPlanDogfoodForMode,
} from './src/firebaseEnvironment'
import { firebaseProjectConfigurations } from './src/firebaseConfig'
import { parseClosedBetaProvisionalMethodologyManifest } from './src/domain/methodology/closedBetaProvisionalMethodology'

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url))
const internalPlanRulesModuleId = 'virtual:internal-plan-rehearsal-rules'
const resolvedInternalPlanRulesModuleId = `\0${internalPlanRulesModuleId}`
const provisionalPlanDogfoodRulesModuleId =
  'virtual:provisional-plan-dogfood-rules'
const resolvedProvisionalPlanDogfoodRulesModuleId =
  `\0${provisionalPlanDogfoodRulesModuleId}`
const closedBetaProvisionalPlanRulesModuleId =
  'virtual:closed-beta-provisional-plan-rules'
const resolvedClosedBetaProvisionalPlanRulesModuleId =
  `\0${closedBetaProvisionalPlanRulesModuleId}`
const internalAdaptationPacketModuleId =
  'virtual:internal-adaptation-rehearsal-packet'
const resolvedInternalAdaptationPacketModuleId =
  `\0${internalAdaptationPacketModuleId}`
const internalSafetyPacketModuleId =
  'virtual:internal-safety-escalation-packet'
const resolvedInternalSafetyPacketModuleId =
  `\0${internalSafetyPacketModuleId}`
const closedBetaProvisionalMethodologyModuleId =
  'virtual:closed-beta-provisional-methodology-manifest'
const resolvedClosedBetaProvisionalMethodologyModuleId =
  `\0${closedBetaProvisionalMethodologyModuleId}`
const closedBetaProvisionalMethodologyManifestPath = path.join(
  repositoryRoot,
  'docs/methodology/artifacts/closed-beta-provisional-methodology/0.1.0/manifest.json',
)

function loadClosedBetaProvisionalMethodology() {
  const manifestText = readFileSync(
    closedBetaProvisionalMethodologyManifestPath,
    'utf8',
  )
  const manifest = parseClosedBetaProvisionalMethodologyManifest(manifestText)
  for (const artifact of manifest.artifacts) {
    const contents = readFileSync(path.join(repositoryRoot, artifact.sourcePath))
    const digest = createHash('sha256').update(contents).digest('hex')
    if (digest !== artifact.sha256) {
      throw new Error(
        `The pinned ${artifact.kind} artifact no longer matches ${artifact.sourcePath}. Publish a new manifest version instead of changing the pinned set in place.`,
      )
    }
  }

  return { manifest, manifestText }
}

function internalRehearsalArtifactsPlugin(
  mode: string,
  provisionalPlanDogfoodEnabled: boolean,
  closedBetaProvisionalMethodologyEnabled: boolean,
) {
  return {
    name: 'internal-rehearsal-artifacts',
    resolveId(id: string) {
      if (id === internalPlanRulesModuleId) {
        return resolvedInternalPlanRulesModuleId
      }
      if (id === provisionalPlanDogfoodRulesModuleId) {
        return resolvedProvisionalPlanDogfoodRulesModuleId
      }
      if (id === closedBetaProvisionalPlanRulesModuleId) {
        return resolvedClosedBetaProvisionalPlanRulesModuleId
      }
      if (id === internalAdaptationPacketModuleId) {
        return resolvedInternalAdaptationPacketModuleId
      }
      if (id === internalSafetyPacketModuleId) {
        return resolvedInternalSafetyPacketModuleId
      }
      if (id === closedBetaProvisionalMethodologyModuleId) {
        return resolvedClosedBetaProvisionalMethodologyModuleId
      }
      return null
    },
    load(id: string) {
      if (
        id !== resolvedInternalPlanRulesModuleId &&
        id !== resolvedProvisionalPlanDogfoodRulesModuleId &&
        id !== resolvedClosedBetaProvisionalPlanRulesModuleId &&
        id !== resolvedInternalAdaptationPacketModuleId &&
        id !== resolvedInternalSafetyPacketModuleId &&
        id !== resolvedClosedBetaProvisionalMethodologyModuleId
      ) {
        return null
      }
      if (id === resolvedClosedBetaProvisionalMethodologyModuleId) {
        if (!closedBetaProvisionalMethodologyEnabled) {
          return 'export default null'
        }

        const { manifestText } = loadClosedBetaProvisionalMethodology()

        return `export default ${JSON.stringify(manifestText)}`
      }
      if (id === resolvedClosedBetaProvisionalPlanRulesModuleId) {
        if (!closedBetaProvisionalMethodologyEnabled) {
          return 'export default null'
        }

        const { manifest } = loadClosedBetaProvisionalMethodology()
        const planArtifact = manifest.artifacts.find(
          (artifact) => artifact.kind === 'plan',
        )
        if (!planArtifact) {
          throw new Error(
            'The closed-beta methodology manifest does not pin a plan artifact.',
          )
        }
        const rulesText = readFileSync(
          path.join(repositoryRoot, planArtifact.sourcePath),
          'utf8',
        )
        return `export default ${JSON.stringify(rulesText)}`
      }
      if (
        id === resolvedProvisionalPlanDogfoodRulesModuleId &&
        !provisionalPlanDogfoodEnabled
      ) {
        return 'export default null'
      }
      if (
        id !== resolvedProvisionalPlanDogfoodRulesModuleId &&
        mode !== 'internal-plan-rehearsal'
      ) {
        return 'export default null'
      }

      if (
        id === resolvedInternalPlanRulesModuleId ||
        id === resolvedProvisionalPlanDogfoodRulesModuleId
      ) {
        const rulesText = readFileSync(
          path.join(
            repositoryRoot,
            'docs/methodology/artifacts/beta-rules/0.2.0-draft/beta-rules.json',
          ),
          'utf8',
        )
        return `export default ${JSON.stringify(rulesText)}`
      }

      if (id === resolvedInternalSafetyPacketModuleId) {
        const rulesText = readFileSync(
          path.join(
            repositoryRoot,
            'docs/methodology/artifacts/beta-safety/0.1.0-draft/beta-safety.json',
          ),
          'utf8',
        )
        const fixturesText = readFileSync(
          path.join(
            repositoryRoot,
            'docs/methodology/artifacts/beta-safety/0.1.0-draft/fixtures.json',
          ),
          'utf8',
        )
        return `export default ${JSON.stringify({ rulesText, fixturesText })}`
      }

      const rulesText = readFileSync(
        path.join(
          repositoryRoot,
          'docs/methodology/artifacts/beta-adaptation/0.2.0-draft/beta-adaptation.json',
        ),
        'utf8',
      )
      const fixturesText = readFileSync(
        path.join(
          repositoryRoot,
          'docs/methodology/artifacts/beta-adaptation/0.2.0-draft/fixtures.json',
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
  const provisionalPlanDogfoodEnabled = resolveProvisionalPlanDogfoodForMode({
    mode,
    environmentName: selectedFirebaseEnvironment.name,
    requested: environment.VITE_PROVISIONAL_PLAN_DOGFOOD,
  })
  const closedBetaProvisionalMethodologyEnabled =
    resolveClosedBetaProvisionalMethodologyForMode({
      mode,
      environmentName: selectedFirebaseEnvironment.name,
      requested:
        environment.VITE_CLOSED_BETA_PROVISIONAL_METHODOLOGY,
    })

  return {
    base: isIosBuild ? './' : '/',
    plugins: [
      internalRehearsalArtifactsPlugin(
        mode,
        provisionalPlanDogfoodEnabled,
        closedBetaProvisionalMethodologyEnabled,
      ),
      react(),
    ],
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
