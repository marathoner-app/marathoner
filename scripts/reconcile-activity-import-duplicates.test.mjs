import { describe, expect, it } from 'vitest'

import {
  FOUNDING_BETA_OPERATOR_EMAIL,
  FOUNDING_BETA_TARGET_PROJECT_ID,
} from './migrate-founding-beta-member.mjs'
import {
  assertActivityImportReconciliationBoundary,
  parseActivityImportReconciliationArguments,
  withFirebaseCliApplicationDefaultCredential,
} from './reconcile-activity-import-duplicates.mjs'

const ownerEmail = 'runner@example.com'
const ownerUid = 'runner_UID_123'

function argumentsFor(action = 'inspect') {
  const confirmation =
    action === 'apply'
      ? 'RECONCILE-ACTIVITY-IMPORT-DUPLICATES:0123456789abcdef01234567'
      : action === 'apply-orphan'
        ? 'NORMALIZE-ORPHAN-ACTIVITY-IMPORT:0123456789abcdef01234567'
        : undefined
  return [
    action,
    '--project',
    FOUNDING_BETA_TARGET_PROJECT_ID,
    '--owner-email',
    ownerEmail,
    '--owner-uid',
    ownerUid,
    ...(confirmation === undefined ? [] : ['--confirm', confirmation]),
  ]
}

function boundary(action = 'inspect') {
  return {
    ...parseActivityImportReconciliationArguments(argumentsFor(action)),
    operatorEmail: FOUNDING_BETA_OPERATOR_EMAIL,
    ownerAccount: {
      disabled: false,
      email: ownerEmail,
      emailVerified: true,
      localId: ownerUid,
    },
  }
}

describe('activity-import duplicate reconciliation operator', () => {
  it('parses only the exact duplicate and orphan dry-run/apply boundaries', () => {
    expect(
      parseActivityImportReconciliationArguments(argumentsFor()),
    ).toEqual({
      action: 'inspect',
      confirmation: undefined,
      ownerEmail,
      ownerUid,
      projectId: FOUNDING_BETA_TARGET_PROJECT_ID,
    })
    expect(
      parseActivityImportReconciliationArguments(argumentsFor('apply')),
    ).toEqual({
      action: 'apply',
      confirmation:
        'RECONCILE-ACTIVITY-IMPORT-DUPLICATES:0123456789abcdef01234567',
      ownerEmail,
      ownerUid,
      projectId: FOUNDING_BETA_TARGET_PROJECT_ID,
    })
    expect(
      parseActivityImportReconciliationArguments(
        argumentsFor('inspect-orphan'),
      ),
    ).toEqual({
      action: 'inspect-orphan',
      confirmation: undefined,
      ownerEmail,
      ownerUid,
      projectId: FOUNDING_BETA_TARGET_PROJECT_ID,
    })
    expect(
      parseActivityImportReconciliationArguments(argumentsFor('apply-orphan')),
    ).toEqual({
      action: 'apply-orphan',
      confirmation:
        'NORMALIZE-ORPHAN-ACTIVITY-IMPORT:0123456789abcdef01234567',
      ownerEmail,
      ownerUid,
      projectId: FOUNDING_BETA_TARGET_PROJECT_ID,
    })
    expect(() =>
      parseActivityImportReconciliationArguments([
        ...argumentsFor(),
        '--owner-uid',
        ownerUid,
      ]),
    ).toThrow('exact and unique')
    expect(() =>
      parseActivityImportReconciliationArguments(argumentsFor('delete')),
    ).toThrow('Use inspect, apply, inspect-orphan, or apply-orphan')
  })

  it('requires the beta project, dedicated operator, and verified exact owner', () => {
    expect(() => assertActivityImportReconciliationBoundary(boundary())).not.toThrow()
    expect(() =>
      assertActivityImportReconciliationBoundary({
        ...boundary(),
        projectId: 'another-project',
      }),
    ).toThrow('only for the beta project')
    expect(() =>
      assertActivityImportReconciliationBoundary({
        ...boundary(),
        operatorEmail: 'personal@example.com',
      }),
    ).toThrow('dedicated beta operator')
    expect(() =>
      assertActivityImportReconciliationBoundary({
        ...boundary(),
        ownerAccount: { ...boundary().ownerAccount, localId: 'other_UID_456' },
      }),
    ).toThrow('owner account boundary')
  })

  it('requires the exact current dry-run confirmation shape for apply', () => {
    expect(() =>
      assertActivityImportReconciliationBoundary(boundary('apply')),
    ).not.toThrow()
    expect(() =>
      assertActivityImportReconciliationBoundary({
        ...boundary('apply'),
        confirmation: 'RECONCILE-ACTIVITY-IMPORT-DUPLICATES:wrong',
      }),
    ).toThrow('exact confirmation')
    expect(() =>
      assertActivityImportReconciliationBoundary(boundary('apply-orphan')),
    ).not.toThrow()
    expect(() =>
      assertActivityImportReconciliationBoundary({
        ...boundary('apply-orphan'),
        confirmation:
          'RECONCILE-ACTIVITY-IMPORT-DUPLICATES:0123456789abcdef01234567',
      }),
    ).toThrow('current orphan dry run')
  })

  it('uses a permission-restricted temporary ADC and cleans it after success', async () => {
    const environment = { GOOGLE_APPLICATION_CREDENTIALS: '/existing/adc.json' }
    const writes = []
    const removals = []

    const result = await withFirebaseCliApplicationDefaultCredential(
      { tokens: { refresh_token: 'operator-refresh-token' } },
      async () => {
        expect(environment.GOOGLE_APPLICATION_CREDENTIALS).toBe(
          '/temporary/operator/application-default-credentials.json',
        )
        return 'completed'
      },
      {
        clientId: () => 'firebase-cli-client-id',
        clientSecret: () => 'firebase-cli-client-secret',
        environment,
        makeTempDirectory: async () => '/temporary/operator',
        removeDirectory: async (...arguments_) => removals.push(arguments_),
        writeCredentialFile: async (...arguments_) => writes.push(arguments_),
      },
    )

    expect(result).toBe('completed')
    expect(environment.GOOGLE_APPLICATION_CREDENTIALS).toBe('/existing/adc.json')
    expect(writes).toHaveLength(1)
    expect(writes[0][0]).toBe(
      '/temporary/operator/application-default-credentials.json',
    )
    expect(JSON.parse(writes[0][1])).toEqual({
      client_id: 'firebase-cli-client-id',
      client_secret: 'firebase-cli-client-secret',
      refresh_token: 'operator-refresh-token',
      type: 'authorized_user',
    })
    expect(writes[0][2]).toEqual({
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    expect(removals).toEqual([
      ['/temporary/operator', { force: true, recursive: true }],
    ])
  })

  it('restores an absent ADC environment and cleans it after failure', async () => {
    const environment = {}
    const removals = []

    await expect(
      withFirebaseCliApplicationDefaultCredential(
        { tokens: { refresh_token: 'operator-refresh-token' } },
        async () => {
          expect(environment.GOOGLE_APPLICATION_CREDENTIALS).toBe(
            '/temporary/operator/application-default-credentials.json',
          )
          throw new Error('inspection failed')
        },
        {
          clientId: () => 'firebase-cli-client-id',
          clientSecret: () => 'firebase-cli-client-secret',
          environment,
          makeTempDirectory: async () => '/temporary/operator',
          removeDirectory: async (...arguments_) => removals.push(arguments_),
          writeCredentialFile: async () => undefined,
        },
      ),
    ).rejects.toThrow('inspection failed')

    expect(environment).not.toHaveProperty('GOOGLE_APPLICATION_CREDENTIALS')
    expect(removals).toEqual([
      ['/temporary/operator', { force: true, recursive: true }],
    ])
  })

  it('refuses to create ADC without the selected Firebase CLI refresh token', async () => {
    await expect(
      withFirebaseCliApplicationDefaultCredential({}, async () => undefined),
    ).rejects.toThrow('operator refresh token')
  })
})
