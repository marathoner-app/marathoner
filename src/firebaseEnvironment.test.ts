import { describe, expect, it } from 'vitest'
import {
  firebaseProjectConfigurations,
  type FirebaseConfigurationRegistry,
} from './firebaseConfig'
import {
  assertFirebaseEnvironmentForMode,
  resolveFirebaseEnvironment,
} from './firebaseEnvironment'

const developmentConfig = firebaseProjectConfigurations.development

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

  it('fails closed while the beta project is unprovisioned', () => {
    expect(() => resolveFirebaseEnvironment('beta')).toThrow(
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
})
