import { describe, expect, it } from 'vitest'

import {
  FOUNDING_BETA_OPERATOR_EMAIL,
  FOUNDING_BETA_TARGET_PROJECT_ID,
} from './migrate-founding-beta-member.mjs'
import {
  assertActivityImportReconciliationBoundary,
  parseActivityImportReconciliationArguments,
} from './reconcile-activity-import-duplicates.mjs'

const ownerEmail = 'runner@example.com'
const ownerUid = 'runner_UID_123'

function argumentsFor(action = 'inspect') {
  return [
    action,
    '--project',
    FOUNDING_BETA_TARGET_PROJECT_ID,
    '--owner-email',
    ownerEmail,
    '--owner-uid',
    ownerUid,
    ...(action === 'apply'
      ? [
          '--confirm',
          'RECONCILE-ACTIVITY-IMPORT-DUPLICATES:0123456789abcdef01234567',
        ]
      : []),
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
  it('parses only the exact dry-run and apply boundaries', () => {
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
    expect(() =>
      parseActivityImportReconciliationArguments([
        ...argumentsFor(),
        '--owner-uid',
        ownerUid,
      ]),
    ).toThrow('exact and unique')
    expect(() =>
      parseActivityImportReconciliationArguments(argumentsFor('delete')),
    ).toThrow('Use inspect or apply')
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
  })
})
