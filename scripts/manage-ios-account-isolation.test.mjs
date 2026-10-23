import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_ISOLATION_CONFIRMATIONS,
  DEVELOPMENT_PROJECT_ID,
  accountIsolationDocumentPaths,
  accountIsolationDocuments,
  assertAccountIsolationOptions,
  createAccountIsolationFixtures,
  parseAccountIsolationArguments,
  validateAccountIsolationManifest,
} from './manage-ios-account-isolation.mjs'

function validManifest() {
  return {
    accounts: createAccountIsolationFixtures().map(({ email, role, uid }) => ({
      email,
      password: 'fixture-password-longer-than-20-characters',
      role,
      uid,
    })),
    createdAt: '2026-10-23T00:00:00.000Z',
    projectId: DEVELOPMENT_PROJECT_ID,
    schemaVersion: 1,
  }
}

describe('iOS account-isolation fixture manager', () => {
  it.each(Object.entries(ACCOUNT_ISOLATION_CONFIRMATIONS))(
    'accepts the explicit %s action and confirmation',
    (action, confirmation) => {
      expect(
        parseAccountIsolationArguments([
          action,
          '--project',
          DEVELOPMENT_PROJECT_ID,
          '--confirm',
          confirmation,
        ]),
      ).toEqual({ action, confirmation, projectId: DEVELOPMENT_PROJECT_ID })
    },
  )

  it('rejects unsupported actions', () => {
    expect(() => parseAccountIsolationArguments(['inspect'])).toThrow(
      'Use prepare, disable-b, enable-b, or cleanup',
    )
  })

  it('requires the exact development project, operator, and action phrase', () => {
    const options = {
      action: 'prepare',
      confirmation: ACCOUNT_ISOLATION_CONFIRMATIONS.prepare,
      operatorEmail: 'kevin-admin@marathonerapp.com',
      projectId: DEVELOPMENT_PROJECT_ID,
    }
    expect(() => assertAccountIsolationOptions(options)).not.toThrow()
    expect(() =>
      assertAccountIsolationOptions({
        ...options,
        projectId: 'marathonerapp-beta',
      }),
    ).toThrow('expected the development project')
    expect(() =>
      assertAccountIsolationOptions({
        ...options,
        operatorEmail: 'personal@example.com',
      }),
    ).toThrow('expected the dedicated operator')
    expect(() =>
      assertAccountIsolationOptions({
        ...options,
        confirmation: 'yes',
      }),
    ).toThrow(ACCOUNT_ISOLATION_CONFIRMATIONS.prepare)
  })

  it('creates two random, verified, fictional identities', () => {
    const first = createAccountIsolationFixtures()
    const second = createAccountIsolationFixtures()

    expect(first.map(({ role }) => role)).toEqual(['account-a', 'account-b'])
    expect(first.every(({ emailVerified }) => emailVerified)).toBe(true)
    expect(first.every(({ email, uid }) =>
      email.startsWith('ios-isolation-') &&
      email.endsWith('@marathonerapp.com') &&
      uid.startsWith('ios-isolation-'),
    )).toBe(true)
    expect(first.map(({ uid }) => uid)).not.toEqual(second.map(({ uid }) => uid))
  })

  it('accepts only a safe local manifest for the development project', () => {
    const manifest = validManifest()
    expect(validateAccountIsolationManifest(manifest)).toEqual(manifest)
    expect(() =>
      validateAccountIsolationManifest({
        ...manifest,
        projectId: 'marathonerapp-beta',
      }),
    ).toThrow('manifest is invalid')

    manifest.accounts[0].email = 'participant@example.com'
    expect(() => validateAccountIsolationManifest(manifest)).toThrow(
      'invalid account-a fixture',
    )
  })

  it('creates exact profile, shoe, and run documents for each account', () => {
    const accounts = createAccountIsolationFixtures()
    expect(accountIsolationDocumentPaths(accounts)).toEqual(
      accounts.flatMap(({ uid }) => [
        `users/${uid}`,
        `users/${uid}/shoes/isolation-shoe`,
        `users/${uid}/runs/isolation-sample-run`,
      ]),
    )

    const accountADocuments = accountIsolationDocuments(
      accounts[0],
      '2026-10-23T00:00:00.000Z',
    )
    const accountBDocuments = accountIsolationDocuments(
      accounts[1],
      '2026-10-23T00:00:00.000Z',
    )
    expect(accountADocuments).toHaveLength(3)
    expect(accountBDocuments).toHaveLength(3)
    expect(accountADocuments[0].fields.displayName).toEqual({
      stringValue: 'Isolation Runner A',
    })
    expect(accountBDocuments[2].fields.distanceMeters).toEqual({
      integerValue: '8000',
    })
  })
})
