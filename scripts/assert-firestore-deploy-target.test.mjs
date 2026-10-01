import { describe, expect, it } from 'vitest'
import { assertFirestoreDeployTarget } from './assert-firestore-deploy-target.mjs'

const projectAliases = {
  development: 'marathoner-development-fixture',
  beta: 'marathoner-beta-fixture',
}

describe('Firestore deployment target guard', () => {
  it('allows the configured environment and project pair', () => {
    expect(() =>
      assertFirestoreDeployTarget({
        actualProjectId: 'marathoner-development-fixture',
        environmentName: 'development',
        projectAliases,
      }),
    ).not.toThrow()
  })

  it('allows the configured beta environment and project pair', () => {
    expect(() =>
      assertFirestoreDeployTarget({
        actualProjectId: 'marathoner-beta-fixture',
        environmentName: 'beta',
        projectAliases,
      }),
    ).not.toThrow()
  })

  it('rejects an unprovisioned beta environment', () => {
    expect(() =>
      assertFirestoreDeployTarget({
        actualProjectId: 'marathoner-beta-fixture',
        environmentName: 'beta',
        projectAliases: {
          development: projectAliases.development,
        },
      }),
    ).toThrow('Firebase environment "beta" is unprovisioned')
  })

  it('rejects a project that does not match the selected environment', () => {
    expect(() =>
      assertFirestoreDeployTarget({
        actualProjectId: 'marathoner-beta-fixture',
        environmentName: 'development',
        projectAliases,
      }),
    ).toThrow('Refusing to deploy development Firestore rules')
  })

  it('rejects a missing CLI project and an unknown environment', () => {
    expect(() =>
      assertFirestoreDeployTarget({
        actualProjectId: undefined,
        environmentName: 'development',
        projectAliases,
      }),
    ).toThrow('GCLOUD_PROJECT is missing')
    expect(() =>
      assertFirestoreDeployTarget({
        actualProjectId: 'marathoner-development-fixture',
        environmentName: 'production',
        projectAliases,
      }),
    ).toThrow('Unknown Firebase environment "production"')
  })
})
