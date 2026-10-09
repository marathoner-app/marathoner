import {
  type FirebaseClientConfiguration,
  type FirebaseConfigurationRegistry,
  type FirebaseEnvironmentName,
} from './firebaseConfig'

const environmentNames: FirebaseEnvironmentName[] = ['development', 'beta']
const requiredConfigurationFields: (keyof FirebaseClientConfiguration)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
  'appCheckSiteKey',
]

export interface SelectedFirebaseEnvironment {
  name: FirebaseEnvironmentName
  config: FirebaseClientConfiguration
}

interface FirebaseEnvironmentForModeOptions {
  mode: string
  requestedEnvironment: string | undefined
  iosApiKey?: string | undefined
  registry: FirebaseConfigurationRegistry
}

interface AppCheckDebugTokenForModeOptions {
  mode: string
  environmentName: FirebaseEnvironmentName
  debugToken: string | undefined
  isViteServe: boolean
}

export function assertFirebaseEnvironmentForMode(
  mode: string,
  environmentName: FirebaseEnvironmentName,
) {
  if (
    environmentName === 'beta' &&
    mode !== 'production' &&
    mode !== 'ios-beta'
  ) {
    throw new Error(
      `Firebase environment "beta" cannot run in Vite mode "${mode}". Beta is reserved for an approved production deployment or the explicit ios-beta build.`,
    )
  }
}

export function assertFunctionsEmulatorForMode(
  mode: string,
  emulatorRequested: boolean,
) {
  if (emulatorRequested && mode !== 'development') {
    throw new Error(
      `The Firebase Functions emulator cannot run in Vite mode "${mode}". It is available only to local development.`,
    )
  }
}

export function resolveAppCheckDebugTokenForMode({
  mode,
  environmentName,
  debugToken,
  isViteServe,
}: AppCheckDebugTokenForModeOptions): string | undefined {
  const normalizedDebugToken = debugToken?.trim()

  if (!normalizedDebugToken) return undefined

  if (
    !isViteServe ||
    mode !== 'development' ||
    environmentName !== 'development'
  ) {
    throw new Error(
      'An App Check debug token is allowed only while Vite serves the development Firebase environment locally. Build output must never contain one.',
    )
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedDebugToken)) {
    throw new Error(
      'VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN must contain a fixed Firebase App Check debug token. Boolean debug mode is not allowed.',
    )
  }

  return normalizedDebugToken
}

function isEnvironmentName(value: string): value is FirebaseEnvironmentName {
  return environmentNames.some((name) => name === value)
}

function assertCompleteConfiguration(
  environmentName: FirebaseEnvironmentName,
  config: FirebaseClientConfiguration,
) {
  for (const field of requiredConfigurationFields) {
    if (typeof config[field] !== 'string' || config[field].trim() === '') {
      throw new Error(
        `Firebase environment "${environmentName}" is missing required public field "${field}".`,
      )
    }
  }
}

export function resolveFirebaseEnvironment(
  requestedEnvironment: string | undefined,
  registry: FirebaseConfigurationRegistry,
): SelectedFirebaseEnvironment {
  const environmentName = requestedEnvironment?.trim()

  if (!environmentName) {
    throw new Error(
      'VITE_FIREBASE_ENVIRONMENT is required. Use "development" for local, CI, and the current GitHub Pages prototype.',
    )
  }

  if (!isEnvironmentName(environmentName)) {
    throw new Error(
      `Unsupported Firebase environment "${environmentName}". Expected "development" or "beta".`,
    )
  }

  const config = registry[environmentName]
  if (!config) {
    throw new Error(
      `Firebase environment "${environmentName}" has not been provisioned. Issue #125 must record and review it before selection.`,
    )
  }

  assertCompleteConfiguration(environmentName, config)

  if (
    environmentName === 'beta' &&
    registry.development?.projectId === config.projectId
  ) {
    throw new Error(
      'The beta Firebase environment must not reuse the development project.',
    )
  }

  return { name: environmentName, config }
}

export function resolveFirebaseEnvironmentForMode({
  mode,
  requestedEnvironment,
  iosApiKey,
  registry,
}: FirebaseEnvironmentForModeOptions): SelectedFirebaseEnvironment {
  const selectedEnvironment = resolveFirebaseEnvironment(
    requestedEnvironment,
    registry,
  )
  const normalizedIosApiKey = iosApiKey?.trim()

  assertFirebaseEnvironmentForMode(mode, selectedEnvironment.name)

  const expectedIosEnvironment =
    mode === 'ios-development'
      ? 'development'
      : mode === 'ios-beta'
        ? 'beta'
        : null

  if (expectedIosEnvironment) {
    if (selectedEnvironment.name !== expectedIosEnvironment) {
      throw new Error(
        `The ${mode} build can only use the ${expectedIosEnvironment} Firebase environment.`,
      )
    }

    if (!normalizedIosApiKey) {
      throw new Error(
        `VITE_FIREBASE_IOS_API_KEY is required for the ${mode} build. Put the reviewed ${expectedIosEnvironment}-only key in .env.${mode}.local.`,
      )
    }

    return {
      ...selectedEnvironment,
      config: {
        ...selectedEnvironment.config,
        apiKey: normalizedIosApiKey,
      },
    }
  }

  if (normalizedIosApiKey) {
    throw new Error(
      `VITE_FIREBASE_IOS_API_KEY cannot be used in Vite mode "${mode}". It is reserved for the explicit iOS environment builds.`,
    )
  }

  return selectedEnvironment
}
