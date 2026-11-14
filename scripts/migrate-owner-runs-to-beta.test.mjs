import { describe, expect, it } from 'vitest'

import {
  FOUNDING_BETA_OPERATOR_EMAIL,
  FOUNDING_BETA_SOURCE_PROJECT_ID,
  FOUNDING_BETA_TARGET_PROJECT_ID,
} from './migrate-founding-beta-member.mjs'
import {
  assertOwnerRunMigrationPreflight,
  assertOwnerRunMigrationOptions,
  migrationConfirmation,
  ownerRunMigrationManifestName,
  parseOwnerRunMigrationArguments,
  rewriteRunForTarget,
  rollbackConfirmation,
  validateOwnerRunMigrationManifest,
} from './migrate-owner-runs-to-beta.mjs'

const email = 'runner@example.com'
const sourceUid = 'source_UID_123'
const targetUid = 'target_UID_456'

function options(action = 'migrate') {
  return {
    action,
    confirmation:
      action === 'rollback'
        ? rollbackConfirmation(email, sourceUid, targetUid)
        : migrationConfirmation(email, sourceUid, targetUid),
    email,
    operatorEmail: FOUNDING_BETA_OPERATOR_EMAIL,
    sourceProjectId: FOUNDING_BETA_SOURCE_PROJECT_ID,
    sourceUid,
    targetProjectId: FOUNDING_BETA_TARGET_PROJECT_ID,
    targetUid,
  }
}

function runDocument(overrides = {}) {
  return {
    name: `projects/project/databases/(default)/documents/users/${sourceUid}/runs/run-1`,
    fields: {
      schemaVersion: { integerValue: '1' },
      userId: { stringValue: sourceUid },
      startedAt: { timestampValue: '2026-11-01T08:00:00.000Z' },
      timeZone: { stringValue: 'America/Los_Angeles' },
      distanceMeters: { integerValue: '5000' },
      durationSeconds: { integerValue: '1800' },
      notes: { stringValue: 'preserve me' },
      createdAt: { timestampValue: '2026-11-01T09:00:00.000Z' },
      updatedAt: { timestampValue: '2026-11-01T09:00:00.000Z' },
      ...overrides,
    },
  }
}

describe('owner run beta migration', () => {
  it('parses the complete explicit account and project boundary', () => {
    expect(
      parseOwnerRunMigrationArguments([
        'inspect',
        '--email',
        'Runner@Example.com',
        '--source-project',
        FOUNDING_BETA_SOURCE_PROJECT_ID,
        '--source-uid',
        sourceUid,
        '--target-project',
        FOUNDING_BETA_TARGET_PROJECT_ID,
        '--target-uid',
        targetUid,
      ]),
    ).toEqual({
      action: 'inspect',
      confirmation: undefined,
      email,
      sourceProjectId: FOUNDING_BETA_SOURCE_PROJECT_ID,
      sourceUid,
      targetProjectId: FOUNDING_BETA_TARGET_PROJECT_ID,
      targetUid,
    })
    expect(() => parseOwnerRunMigrationArguments(['copy'])).toThrow(
      'Use inspect, migrate, or rollback',
    )
    expect(() =>
      parseOwnerRunMigrationArguments([
        'inspect',
        '--email',
        email,
        '--email',
        email,
      ]),
    ).toThrow('unique')
  })

  it('requires fixed projects, operator, distinct UIDs, and exact phrases', () => {
    expect(() => assertOwnerRunMigrationOptions(options())).not.toThrow()
    expect(() =>
      assertOwnerRunMigrationOptions({
        ...options(),
        sourceProjectId: FOUNDING_BETA_TARGET_PROJECT_ID,
      }),
    ).toThrow('non-development')
    expect(() =>
      assertOwnerRunMigrationOptions({
        ...options(),
        operatorEmail: 'personal@example.com',
      }),
    ).toThrow('dedicated beta operator')
    expect(() =>
      assertOwnerRunMigrationOptions({
        ...options(),
        targetUid: sourceUid,
      }),
    ).toThrow('Distinct valid')
    expect(() =>
      assertOwnerRunMigrationOptions({
        ...options(),
        confirmation: migrationConfirmation(email, targetUid, sourceUid),
      }),
    ).toThrow('Migration requires')
    expect(() => assertOwnerRunMigrationOptions(options('rollback'))).not.toThrow()
  })

  it('rewrites only the owner and destination path', () => {
    const rewritten = rewriteRunForTarget(runDocument(), sourceUid, targetUid)
    expect(rewritten).toEqual({
      documentPath: `users/${targetUid}/runs/run-1`,
      fields: {
        ...runDocument().fields,
        userId: { stringValue: targetUid },
      },
      runId: 'run-1',
    })
    expect(rewritten.fields.notes).toEqual({ stringValue: 'preserve me' })
  })

  it('refuses crossed owners, invalid fields, and plan-linked runs', () => {
    expect(() =>
      rewriteRunForTarget(
        { ...runDocument(), name: runDocument().name.replace(sourceUid, 'another_UID') },
        sourceUid,
        targetUid,
      ),
    ).toThrow('crossed')
    expect(() =>
      rewriteRunForTarget(
        runDocument({ userId: { stringValue: 'another_UID' } }),
        sourceUid,
        targetUid,
      ),
    ).toThrow('mismatched userId')
    expect(() =>
      rewriteRunForTarget(
        runDocument({ plannedWorkoutId: { stringValue: 'workout-1' } }),
        sourceUid,
        targetUid,
      ),
    ).toThrow('linked to a plan')
    expect(() =>
      rewriteRunForTarget(runDocument({ distanceMeters: {} }), sourceUid, targetUid),
    ).toThrow('invalid distanceMeters')
  })

  it('requires eligible accounts, an approved target, source runs, and an empty target', () => {
    const boundary = {
      membership: {
        fields: {
          status: { stringValue: 'approved' },
          userId: { stringValue: targetUid },
        },
      },
      sourceAccount: {
        disabled: false,
        emailVerified: true,
        localId: sourceUid,
      },
      sourceRuns: [runDocument()],
      sourceUid,
      targetAccount: {
        disabled: false,
        emailVerified: true,
        localId: targetUid,
      },
      targetProfile: { fields: { schemaVersion: { integerValue: '1' } } },
      targetRuns: [],
      targetUid,
    }
    expect(assertOwnerRunMigrationPreflight(boundary).rewrittenRuns).toHaveLength(1)
    expect(() =>
      assertOwnerRunMigrationPreflight({
        ...boundary,
        targetRuns: [runDocument()],
      }),
    ).toThrow('target run collection is not empty')
    expect(() =>
      assertOwnerRunMigrationPreflight({
        ...boundary,
        membership: null,
      }),
    ).toThrow('membership is not approved')
    expect(() =>
      assertOwnerRunMigrationPreflight({
        ...boundary,
        sourceRuns: [],
      }),
    ).toThrow('source run collection is empty')
  })

  it('uses an ignored participant-specific local manifest name', () => {
    expect(ownerRunMigrationManifestName('Runner+One@Example.com')).toBe(
      '.owner-run-migration-runner-one-example-com.local',
    )
  })

  it('validates rollback paths and write versions inside the target owner', () => {
    const manifest = {
      createdAt: '2026-11-13T00:00:00.000Z',
      createdDocuments: [
        {
          documentPath: `users/${targetUid}/runs/run-1`,
          updateTime: '2026-11-13T00:01:00.000Z',
        },
      ],
      email,
      schemaVersion: 1,
      sourceProjectId: FOUNDING_BETA_SOURCE_PROJECT_ID,
      sourceUid,
      targetProjectId: FOUNDING_BETA_TARGET_PROJECT_ID,
      targetUid,
    }
    expect(
      validateOwnerRunMigrationManifest(manifest, { email, sourceUid, targetUid }),
    ).toEqual(manifest)
    expect(() =>
      validateOwnerRunMigrationManifest(
        {
          ...manifest,
          createdDocuments: [
            {
              documentPath: 'users/someone-else/runs/run-1',
              updateTime: '2026-11-13T00:01:00.000Z',
            },
          ],
        },
        { email, sourceUid, targetUid },
      ),
    ).toThrow('manifest is invalid')
    expect(() =>
      validateOwnerRunMigrationManifest(
        {
          ...manifest,
          createdDocuments: [
            {
              documentPath: `users/${targetUid}/runs/run-1`,
              updateTime: 'not-a-time',
            },
          ],
        },
        { email, sourceUid, targetUid },
      ),
    ).toThrow('manifest is invalid')
  })
})
