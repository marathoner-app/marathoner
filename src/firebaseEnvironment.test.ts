import { describe, expect, it } from 'vitest'
import {
  firebaseProjectConfigurations,
  type FirebaseConfigurationRegistry,
} from './firebaseConfig'
import {
  assertFunctionsEmulatorForMode,
  assertFirebaseEnvironmentForMode,
  resolveAppCheckDebugTokenForMode,
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
  it('pins each reviewed web app to its exact App Check registration', () => {
    expect({
      appId: developmentConfig.appId,
      appCheckSiteKey: developmentConfig.appCheckSiteKey,
    }).toEqual({
      appId: '1:677998037771:web:9269b3b5f82909ccc3b00e',
      appCheckSiteKey: '6LcjU-ItAAAAAFduN8dYLc-0HiI1yLtaI0liOX5Q',
    })
    expect({
      appId: betaConfig.appId,
      appCheckSiteKey: betaConfig.appCheckSiteKey,
    }).toEqual({
      appId: '1:156851031272:web:a6ab19f6b760fcf5084d5d',
      appCheckSiteKey: '6Ld7-uEtAAAAAMi5OH-KIzx7e0ZkMm3xrwehkxEl',
    })
  })

  it('allows only a fixed debug token in local development', () => {
    const debugToken = '11111111-1111-4111-8111-111111111111'

    expect(
      resolveAppCheckDebugTokenForMode({
        mode: 'development',
        environmentName: 'development',
        debugToken: ` ${debugToken} `,
        isViteServe: true,
      }),
    ).toBe(debugToken)
    expect(
      resolveAppCheckDebugTokenForMode({
        mode: 'development',
        environmentName: 'development',
        debugToken: undefined,
        isViteServe: true,
      }),
    ).toBeUndefined()
  })

  it.each([
    ['production', 'beta', false],
    ['production', 'development', false],
    ['development', 'development', false],
    ['ios-development', 'development', false],
    ['ios-beta', 'beta', false],
  ] as const)(
    'rejects an App Check debug token for %s/%s when serve=%s',
    (mode, environmentName, isViteServe) => {
      expect(() =>
        resolveAppCheckDebugTokenForMode({
          mode,
          environmentName,
          debugToken: '11111111-1111-4111-8111-111111111111',
          isViteServe,
        }),
      ).toThrow('allowed only while Vite serves the development Firebase environment locally')
    },
  )

  it.each(['true', 'false', 'generate', 'not-a-fixed-token'])(
    'rejects unsafe App Check debug value %s',
    (debugToken) => {
      expect(() =>
        resolveAppCheckDebugTokenForMode({
          mode: 'development',
          environmentName: 'development',
          debugToken,
          isViteServe: true,
        }),
      ).toThrow('must contain a fixed Firebase App Check debug token')
    },
  )

  it('allows the Functions emulator only in local development mode', () => {
    expect(() =>
      assertFunctionsEmulatorForMode('development', true),
    ).not.toThrow()
    expect(() =>
      assertFunctionsEmulatorForMode('production', true),
    ).toThrow('available only to local development')
    expect(() =>
      assertFunctionsEmulatorForMode('ios-development', true),
    ).toThrow('available only to local development')
    expect(() =>
      assertFunctionsEmulatorForMode('production', false),
    ).not.toThrow()
  })

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

  it.each(['development', 'test', 'ios-development'])(
    'prevents beta access in the %s Vite mode',
    (mode) => {
      expect(() => assertFirebaseEnvironmentForMode(mode, 'beta')).toThrow(
        'Beta is reserved for an approved production deployment or the explicit ios-beta build',
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
    expect(() =>
      assertFirebaseEnvironmentForMode('ios-beta', 'beta'),
    ).not.toThrow()
  })

  it('requires an explicit key for the selected iOS development build', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'ios-development',
        requestedEnvironment: 'development',
        iosApiKey: undefined,
      }),
    ).toThrow('VITE_FIREBASE_IOS_API_KEY is required')
  })

  it('selects development with only the reviewed iOS key overridden', () => {
    expect(
      resolveFirebaseEnvironmentForMode({
        mode: 'ios-development',
        requestedEnvironment: 'development',
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

  it('rejects the selected iOS key outside its dedicated mode', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'development',
        requestedEnvironment: 'development',
        iosApiKey: 'reviewed-ios-key',
      }),
    ).toThrow('reserved for the explicit iOS environment builds')
  })

  it('keeps beta unavailable to the selected iOS development build', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'ios-development',
        requestedEnvironment: 'beta',
        iosApiKey: 'reviewed-ios-key',
      }),
    ).toThrow('Beta is reserved for an approved production deployment or the explicit ios-beta build')
  })

  it('requires an explicit key for the selected iOS beta build', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'ios-beta',
        requestedEnvironment: 'beta',
        iosApiKey: undefined,
      }),
    ).toThrow('VITE_FIREBASE_IOS_API_KEY is required for the ios-beta build')
  })

  it('selects beta with only the reviewed iOS key overridden', () => {
    expect(
      resolveFirebaseEnvironmentForMode({
        mode: 'ios-beta',
        requestedEnvironment: 'beta',
        iosApiKey: ' reviewed-beta-ios-key ',
      }),
    ).toEqual({
      name: 'beta',
      config: {
        ...betaConfig,
        apiKey: 'reviewed-beta-ios-key',
      },
    })
  })

  it('keeps development unavailable to the selected iOS beta build', () => {
    expect(() =>
      resolveFirebaseEnvironmentForMode({
        mode: 'ios-beta',
        requestedEnvironment: 'development',
        iosApiKey: 'reviewed-beta-ios-key',
      }),
    ).toThrow('ios-beta build can only use the beta Firebase environment')
  })
})
