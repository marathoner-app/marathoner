import { describe, expect, it } from 'vitest'
import {
  firebaseProjectConfigurations,
  type FirebaseConfigurationRegistry,
} from './firebaseConfig'
import {
  assertFirebaseEnvironmentForMode,
  resolveFirebaseEnvironment as resolveFirebaseEnvironmentWithRegistry,
  resolveFirebaseEnvironmentForMode as resolveFirebaseEnvironmentForModeWithRegistry,
} from './firebaseEnvironment'

type ModeOptions = Parameters<
  typeof resolveFirebaseEnvironmentForModeWithRegistry
>[0]

function resolveFirebaseEnvironment(
  requestedEnvironment: string | undefined,
  registry: FirebaseConfigurationRegistry = firebaseProjectConfigurations,
) {
  return resolveFirebaseEnvironmentWithRegistry(requestedEnvironment, registry)
}

function resolveFirebaseEnvironmentForMode(
  options: Omit<ModeOptions, 'registry'> & {
    registry?: FirebaseConfigurationRegistry
  },
) {
  return resolveFirebaseEnvironmentForModeWithRegistry({
    ...options,
    registry: options.registry ?? firebaseProjectConfigurations,
  })
}

const developmentConfig = firebaseProjectConfigurations.development
const betaConfig = firebaseProjectConfigurations.beta

describe('Firebase environment selection', () => {
  it('selects the audited development project explicitly', () => {
    expect(resolveFirebaseEnvironment('development')).toEqual({
      name: 'development',
      config: developmentConfig,
    })
  })

  it.each([undefined, '', '   '])(
    'rejects a missing environment selection (%s)',
    (selection) => {
      expect(() => resolveFirebaseEnvironment(selection)).toThrow(
        'VITE_FIREBASE_ENVIRONMENT is required',
      )
    },
  )

  it('rejects an unknown environment selection', () => {
    expect(() => resolveFirebaseEnvironment('production')).toThrow(
      'Unsupported Firebase environment "production"',
    )
  })

  it('selects the distinct beta project explicitly', () => {
    expect(resolveFirebaseEnvironment('beta')).toEqual({
      name: 'beta',
      config: betaConfig,
    })
    expect(betaConfig.projectId).not.toBe(developmentConfig.projectId)
  })

  it('fails closed when a registry leaves beta unprovisioned', () => {
    const registry: FirebaseConfigurationRegistry = {
      development: developmentConfig,
      beta: null,
    }

    expect(() => resolveFirebaseEnvironment('beta', registry)).toThrow(
      'Firebase environment "beta" has not been provisioned',
    )
  })

  it('rejects incomplete public configuration', () => {
    const registry: FirebaseConfigurationRegistry = {
      development: {
        ...developmentConfig,
        appId: '',
      },
      beta: null,
    }

    expect(() => resolveFirebaseEnvironment('development', registry)).toThrow(
      'missing required public field "appId"',
    )
  })

  it('rejects a beta environment that reuses the development project', () => {
    const registry: FirebaseConfigurationRegistry = {
      development: developmentConfig,
      beta: {
        ...developmentConfig,
        appId: 'separate-app-id-is-not-a-separate-project',
      },
    }

    expect(() => resolveFirebaseEnvironment('beta', registry)).toThrow(
      'must not reuse the development project',
    )
  })

  it.each(['development', 'test', 'mobile-spike'])(
    'prevents beta access in the %s Vite mode',
    (mode) => {
      expect(() => assertFirebaseEnvironmentForMode(mode, 'beta')).toThrow(
        'Beta is reserved for an approved production deployment',
      )
    },
  )

  it('allows development in every mode and reserves beta for production', () => {
    expect(() =>
      assertFirebaseEnvironmentForMode('development', 'development'),
    ).not.toThrow()
    expect(() =>
      assertFirebaseEnvironmentForMode('production', 'beta'),
    ).not.toThrow()
  })

  it.each(['mobile-auth-spike', 'mobile-shared-record-spike'])(
    'requires a dedicated API key for the isolated %s build',
    (mode) => {
      expect(() =>
        resolveFirebaseEnvironmentForMode({
          mode,
          requestedEnvironment: 'development',
          mobileApiKey: undefined,
        }),
      ).toThrow('VITE_FIREBASE_MOBILE_API_KEY is required')
    },
  )

  it('overrides only the API key for the mobile auth build', () => {
    const result = resolveFirebaseEnvironmentForMode({
      mode: 'mobile-auth-spike',
      requestedEnvironment: 'development',
      mobileApiKey: ' mobile-spike-key ',
    })

    expect(result).toEqual({
      name: 'development',
      config: {
        ...developmentConfig,
        apiKey: 'mobile-spike-key',
      },
    })
  })

  it('overrides only the API key for the mobile shared-record build', () => {
    const result = resolveFirebaseEnvironmentForMode({
      mode: 'mobile-shared-record-spike',
      requestedEnvironment: 'development',
      mobileApiKey: ' mobile-spike-key ',
    })

    expect(result).toEqual({
      name: 'development',
      config: {
        ...developmentConfig,
        apiKey: 'mobile-spike-key',
      },
    })
  })

  it('rejects the mobile API key outside the isolated auth build', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'development',
        requestedEnvironment: 'development',
        mobileApiKey: 'mobile-spike-key',
      }),
    ).toThrow('reserved for isolated mobile Firebase spike builds')
  })

  it('keeps beta unavailable to the mobile auth build', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'mobile-auth-spike',
        requestedEnvironment: 'beta',
        mobileApiKey: 'mobile-spike-key',
      }),
    ).toThrow('Beta is reserved for an approved production deployment')
  })

  it('keeps beta unavailable to the mobile shared-record build', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'mobile-shared-record-spike',
        requestedEnvironment: 'beta',
        mobileApiKey: 'mobile-spike-key',
      }),
    ).toThrow('Beta is reserved for an approved production deployment')
  })

  it('requires an explicit key for the selected iOS development build', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'ios-development',
        requestedEnvironment: 'development',
        mobileApiKey: undefined,
        iosApiKey: undefined,
      }),
    ).toThrow('VITE_FIREBASE_IOS_API_KEY is required')
  })

  it('selects development with only the reviewed iOS key overridden', () => {
    expect(
      resolveFirebaseEnvironmentForMode({
        mode: 'ios-development',
        requestedEnvironment: 'development',
        mobileApiKey: undefined,
        iosApiKey: ' reviewed-ios-key ',
      }),
    ).toEqual({
      name: 'development',
      config: {
        ...developmentConfig,
        apiKey: 'reviewed-ios-key',
      },
    })
  })

  it('rejects the disposable spike key in the selected iOS build', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'ios-development',
        requestedEnvironment: 'development',
        mobileApiKey: 'spike-key',
        iosApiKey: 'reviewed-ios-key',
      }),
    ).toThrow('belongs only to the disposable mobile spikes')
  })

  it('rejects the selected iOS key outside its dedicated mode', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'development',
        requestedEnvironment: 'development',
        mobileApiKey: undefined,
        iosApiKey: 'reviewed-ios-key',
      }),
    ).toThrow('reserved for the selected iOS development build')
  })

  it('keeps beta unavailable to the selected iOS development build', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'ios-development',
        requestedEnvironment: 'beta',
        mobileApiKey: undefined,
        iosApiKey: 'reviewed-ios-key',
      }),
    ).toThrow('Beta is reserved for an approved production deployment')
  })
})
