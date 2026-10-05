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

export function assertFirebaseEnvironmentForMode(
  mode: string,
  environmentName: FirebaseEnvironmentName,
) {
  if (environmentName === 'beta' && mode !== 'production') {
    throw new Error(
      `Firebase environment "beta" cannot run in Vite mode "${mode}". Beta is reserved for an approved production deployment.`,
    )
  }
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

  if (mode === 'ios-development') {
    if (selectedEnvironment.name !== 'development') {
      throw new Error(
        'The selected iOS development build can only use the development Firebase environment.',
      )
    }

    if (!normalizedIosApiKey) {
      throw new Error(
        'VITE_FIREBASE_IOS_API_KEY is required for the ios-development build. Put the reviewed development-only key in .env.ios-development.local.',
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
      `VITE_FIREBASE_IOS_API_KEY cannot be used in Vite mode "${mode}". It is reserved for the selected iOS development build.`,
    )
  }

  return selectedEnvironment
}
