import { describe, expect, it } from 'vitest'

import {
  PHYSICAL_SMOKE_CREATE_CONFIRMATION,
  PHYSICAL_SMOKE_DELETE_CONFIRMATION,
  parsePhysicalSmokeArguments,
  physicalSmokeDocumentPaths,
  physicalSmokeFixtures,
  validatePhysicalSmokeManifest,
} from './manage-beta-ios-smoke.mjs'

function validManifest() {
  return {
    accounts: physicalSmokeFixtures().map(({ email, role, uid }) => ({
      email,
      password: 'fixture-password-longer-than-20-characters',
      role,
      uid,
    })),
    createdAt: '2026-10-05T00:00:00.000Z',
    projectId: 'marathonerapp-beta',
    schemaVersion: 1,
  }
}

describe('beta iOS physical smoke fixture manager', () => {
  it('accepts only explicit prepare and cleanup arguments', () => {
    expect(
      parsePhysicalSmokeArguments([
        'prepare',
        '--project',
        'marathonerapp-beta',
        '--confirm',
        PHYSICAL_SMOKE_CREATE_CONFIRMATION,
      ]),
    ).toEqual({
      action: 'prepare',
      confirmation: PHYSICAL_SMOKE_CREATE_CONFIRMATION,
      projectId: 'marathonerapp-beta',
    })
    expect(
      parsePhysicalSmokeArguments([
        'cleanup',
        '--project',
        'marathonerapp-beta',
        '--confirm',
        PHYSICAL_SMOKE_DELETE_CONFIRMATION,
      ]).action,
    ).toBe('cleanup')
    expect(() => parsePhysicalSmokeArguments(['inspect'])).toThrow(
      'Use prepare or cleanup',
    )
  })

  it('uses only the fixed approved and unapproved fictional identities', () => {
    expect(physicalSmokeFixtures()).toEqual([
      expect.objectContaining({
        emailVerified: true,
        membership: true,
        role: 'approved',
      }),
      expect.objectContaining({
        emailVerified: true,
        membership: false,
        role: 'unapproved',
      }),
    ])
    expect(physicalSmokeDocumentPaths()).toEqual([
      'betaMemberships/beta-fixture-approved',
      'betaMemberships/beta-fixture-unapproved',
    ])
  })

  it('accepts only the exact local fixture manifest', () => {
    expect(validatePhysicalSmokeManifest(validManifest())).toEqual(
      validManifest(),
    )
    expect(() =>
      validatePhysicalSmokeManifest({
        ...validManifest(),
        projectId: 'marathoner-d9bf9',
      }),
    ).toThrow('manifest is invalid')

    const changed = validManifest()
    changed.accounts[0].email = 'participant@example.com'
    expect(() => validatePhysicalSmokeManifest(changed)).toThrow(
      'invalid approved fixture',
    )
  })
})
