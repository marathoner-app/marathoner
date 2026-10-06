import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_DELETION_EMULATOR_PROJECT,
  accountDeletionConfirmation,
  assertAccountDeletionEmulators,
  assertAccountDeletionOptions,
  parseAccountDeletionArguments,
} from './run-account-deletion.mjs'

const requestId = '11111111-1111-4111-8111-111111111111'

function validArguments(action = 'run') {
  return [
    action,
    '--environment',
    'emulator',
    '--project',
    ACCOUNT_DELETION_EMULATOR_PROJECT,
    '--request',
    requestId,
    '--confirm',
    accountDeletionConfirmation(
      action,
      ACCOUNT_DELETION_EMULATOR_PROJECT,
      requestId,
    ),
  ]
}

describe('account-deletion operator command guard', () => {
  it('accepts only the exact emulator project, request ID, and confirmation', () => {
    const options = parseAccountDeletionArguments(validArguments())
    expect(() => assertAccountDeletionOptions(options)).not.toThrow()
    expect(options).toEqual({
      action: 'run',
      confirmation: `DELETE ${ACCOUNT_DELETION_EMULATOR_PROJECT} ${requestId}`,
      environment: 'emulator',
      projectId: ACCOUNT_DELETION_EMULATOR_PROJECT,
      requestId,
    })
  })

  it.each([
    ['--uid', 'runner-one'],
    ['--email', 'runner@example.test'],
    ['--path', 'users/runner-one'],
  ])('refuses the prohibited %s target', (name, value) => {
    expect(() =>
      parseAccountDeletionArguments([...validArguments(), name, value]),
    ).toThrow()
  })

  it('refuses wildcards, live projects, and inexact confirmations', () => {
    for (const change of [
      { requestId: '*' },
      { environment: 'beta', projectId: 'marathonerapp-beta' },
      { confirmation: 'DELETE EVERYTHING' },
    ]) {
      const options = {
        ...parseAccountDeletionArguments(validArguments()),
        ...change,
      }
      expect(() => assertAccountDeletionOptions(options)).toThrow()
    }
  })

  it('requires the exact local Firestore and Auth emulator endpoints', () => {
    expect(() =>
      assertAccountDeletionEmulators({
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      }),
    ).not.toThrow()
    expect(() =>
      assertAccountDeletionEmulators({
        FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      }),
    ).toThrow('exact local')
  })

  it('guards expired-receipt cleanup with a different typed confirmation', () => {
    const options = parseAccountDeletionArguments(
      validArguments('purge-receipt'),
    )
    expect(options.confirmation).toBe(
      `PURGE ${ACCOUNT_DELETION_EMULATOR_PROJECT} ${requestId}`,
    )
    expect(() => assertAccountDeletionOptions(options)).not.toThrow()
  })
})
