import { describe, expect, it } from 'vitest'

import {
  FOUNDING_BETA_OPERATOR_EMAIL,
  FOUNDING_BETA_SOURCE_PROJECT_ID,
  FOUNDING_BETA_TARGET_PROJECT_ID,
  assertFoundingBetaMigrationOptions,
  foundingBetaMigrationManifestName,
  migrationConfirmation,
  parseFoundingBetaMigrationArguments,
  rollbackConfirmation,
  validateFoundingBetaMigrationManifest,
} from './migrate-founding-beta-member.mjs'

const email = 'runner@example.com'

function options(action = 'migrate') {
  return {
    action,
    confirmation:
      action === 'rollback'
        ? rollbackConfirmation(email)
        : migrationConfirmation(email),
    email,
    operatorEmail: FOUNDING_BETA_OPERATOR_EMAIL,
    sourceProjectId: FOUNDING_BETA_SOURCE_PROJECT_ID,
    targetProjectId: FOUNDING_BETA_TARGET_PROJECT_ID,
  }
}

describe('founding-beta member migration', () => {
  it('parses only an explicit source, target, action, and participant email', () => {
    expect(
      parseFoundingBetaMigrationArguments([
        'inspect',
        '--email',
        'Runner@Example.com',
        '--source-project',
        FOUNDING_BETA_SOURCE_PROJECT_ID,
        '--target-project',
        FOUNDING_BETA_TARGET_PROJECT_ID,
      ]),
    ).toEqual({
      action: 'inspect',
      confirmation: undefined,
      email,
      sourceProjectId: FOUNDING_BETA_SOURCE_PROJECT_ID,
      targetProjectId: FOUNDING_BETA_TARGET_PROJECT_ID,
    })
    expect(() => parseFoundingBetaMigrationArguments(['copy'])).toThrow(
      'Use inspect, migrate, or rollback',
    )
    expect(() =>
      parseFoundingBetaMigrationArguments(['inspect', '--email', 'not-email']),
    ).toThrow('valid --email')
  })

  it('requires the fixed project direction, operator, and email-specific phrase', () => {
    expect(() => assertFoundingBetaMigrationOptions(options())).not.toThrow()
    expect(() =>
      assertFoundingBetaMigrationOptions({
        ...options(),
        sourceProjectId: FOUNDING_BETA_TARGET_PROJECT_ID,
      }),
    ).toThrow('expected the development project')
    expect(() =>
      assertFoundingBetaMigrationOptions({
        ...options(),
        targetProjectId: FOUNDING_BETA_SOURCE_PROJECT_ID,
      }),
    ).toThrow('expected the beta project')
    expect(() =>
      assertFoundingBetaMigrationOptions({
        ...options(),
        operatorEmail: 'personal@example.com',
      }),
    ).toThrow('dedicated beta operator')
    expect(() =>
      assertFoundingBetaMigrationOptions({
        ...options(),
        confirmation: migrationConfirmation('someone-else@example.com'),
      }),
    ).toThrow(migrationConfirmation(email))
    expect(() =>
      assertFoundingBetaMigrationOptions(options('rollback')),
    ).not.toThrow()
  })

  it('uses an ignored, email-specific local rollback manifest', () => {
    expect(foundingBetaMigrationManifestName('Runner+One@Example.com')).toBe(
      '.founding-beta-migration-runner-one-example-com.local',
    )
  })

  it('accepts only a manifest limited to the selected UID and membership', () => {
    const manifest = {
      createdAt: '2026-11-13T00:00:00.000Z',
      createdDocumentPaths: [
        'users/source-uid',
        'users/source-uid/runs/run-1',
        'betaMemberships/source-uid',
      ],
      email,
      schemaVersion: 1,
      sourceProjectId: FOUNDING_BETA_SOURCE_PROJECT_ID,
      targetProjectId: FOUNDING_BETA_TARGET_PROJECT_ID,
      uid: 'source-uid',
    }
    expect(validateFoundingBetaMigrationManifest(manifest, email)).toEqual(
      manifest,
    )
    expect(() =>
      validateFoundingBetaMigrationManifest(
        {
          ...manifest,
          createdDocumentPaths: ['users/someone-else/runs/run-1'],
        },
        email,
      ),
    ).toThrow('manifest is invalid')
    expect(() =>
      validateFoundingBetaMigrationManifest(
        { ...manifest, createdDocumentPaths: ['users/source-uid'] },
        email,
      ),
    ).toThrow('manifest is invalid')
  })
})
