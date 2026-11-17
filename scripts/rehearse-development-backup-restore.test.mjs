import { describe, expect, it } from 'vitest'

import {
  DEVELOPMENT_BACKUP_OPERATOR_EMAIL,
  DEVELOPMENT_BACKUP_PROJECT_ID,
  DEVELOPMENT_BACKUP_SCHEMA_VERSION,
  assertDevelopmentBackupOptions,
  cleanupConfirmation,
  developmentRestoreManifestName,
  parseDevelopmentBackupArguments,
  resolveLocalArtifactPath,
  restoreConfirmation,
  rewriteSnapshotForTarget,
  snapshotDigest,
  validateDevelopmentSnapshot,
  validateRestoreManifest,
} from './rehearse-development-backup-restore.mjs'

const sourceEmail = 'owner@example.com'
const sourceUid = 'source_UID_123'
const targetEmail = 'backup-restore-fixture@marathonerapp.com'
const targetUid = 'target_UID_456'

function options(action = 'restore') {
  return {
    action,
    confirmation:
      action === 'cleanup'
        ? cleanupConfirmation(targetUid)
        : restoreConfirmation(sourceUid, targetUid),
    input: '.development-backup.local',
    operatorEmail: DEVELOPMENT_BACKUP_OPERATOR_EMAIL,
    projectId: DEVELOPMENT_BACKUP_PROJECT_ID,
    sourceEmail,
    sourceUid,
    targetEmail,
    targetUid,
  }
}

function snapshot() {
  const value = {
    documents: [
      {
        documentPath: `users/${sourceUid}`,
        fields: {
          userId: { stringValue: sourceUid },
          nested: {
            mapValue: {
              fields: {
                ownerPath: { stringValue: `users/${sourceUid}/runs/run-one` },
              },
            },
          },
        },
      },
      {
        documentPath: `users/${sourceUid}/runs/run-one`,
        fields: {
          userId: { stringValue: sourceUid },
          crossProviderFingerprint: {
            stringValue: `cross-provider-duplicate-fingerprint@1|${sourceUid}|running|2026-11-17T08:00:00.000Z|1800|5000|America%2FLos_Angeles`,
          },
          profile: {
            referenceValue: `projects/demo/databases/(default)/documents/users/${sourceUid}`,
          },
        },
      },
    ],
    excludedCollections: ['providerConnections'],
    exportedAt: '2026-11-17T20:00:00.000Z',
    projectId: DEVELOPMENT_BACKUP_PROJECT_ID,
    schemaVersion: DEVELOPMENT_BACKUP_SCHEMA_VERSION,
    sourceEmail,
    sourceUid,
  }
  return { ...value, digest: snapshotDigest(value) }
}

describe('development backup and restore rehearsal', () => {
  it('parses explicit boundaries and rejects duplicate options', () => {
    expect(parseDevelopmentBackupArguments([
      'export',
      '--project',
      DEVELOPMENT_BACKUP_PROJECT_ID,
      '--source-email',
      'Owner@Example.com',
      '--source-uid',
      sourceUid,
      '--output',
      '.development-backup.local',
    ])).toMatchObject({
      action: 'export',
      output: '.development-backup.local',
      sourceEmail,
      sourceUid,
    })
    expect(() => parseDevelopmentBackupArguments([
      'export',
      '--project',
      DEVELOPMENT_BACKUP_PROJECT_ID,
      '--project',
      DEVELOPMENT_BACKUP_PROJECT_ID,
    ])).toThrow('unique')
  })

  it('allows only development, the dedicated operator, and a fictional target', () => {
    expect(() => assertDevelopmentBackupOptions(options())).not.toThrow()
    expect(() => assertDevelopmentBackupOptions({
      ...options(),
      projectId: 'marathonerapp-beta',
    })).toThrow('outside the development project')
    expect(() => assertDevelopmentBackupOptions({
      ...options(),
      operatorEmail: 'owner@example.com',
    })).toThrow('dedicated development operator')
    expect(() => assertDevelopmentBackupOptions({
      ...options(),
      targetEmail: 'real-runner@example.com',
    })).toThrow('fictional')
    expect(() => assertDevelopmentBackupOptions({
      ...options(),
      confirmation: restoreConfirmation(targetUid, sourceUid),
    })).toThrow('Restore requires')
    expect(() => assertDevelopmentBackupOptions(options('cleanup'))).not.toThrow()
  })

  it('keeps local artifacts ignored and inside the repository', () => {
    expect(resolveLocalArtifactPath('/repo', '.backup.local', '--output')).toBe(
      '/repo/.backup.local',
    )
    expect(() => resolveLocalArtifactPath('/repo', '../backup.local', '--output')).toThrow(
      'inside the repository',
    )
    expect(() => resolveLocalArtifactPath('/repo', 'backup.json', '--output')).toThrow(
      'ignored',
    )
    expect(developmentRestoreManifestName(targetEmail)).toBe(
      '.development-backup-restore-backup-restore-fixture-marathonerapp-com.local',
    )
  })

  it('validates snapshot identity, inventory exclusions, and digest', () => {
    expect(validateDevelopmentSnapshot(snapshot(), {
      projectId: DEVELOPMENT_BACKUP_PROJECT_ID,
      sourceEmail,
      sourceUid,
    })).toEqual(snapshot())
    expect(() => validateDevelopmentSnapshot({
      ...snapshot(),
      excludedCollections: ['unknownCollection'],
    }, {
      projectId: DEVELOPMENT_BACKUP_PROJECT_ID,
      sourceEmail,
      sourceUid,
    })).toThrow('snapshot is invalid')
    expect(() => validateDevelopmentSnapshot({
      ...snapshot(),
      documents: snapshot().documents.slice(0, 1),
    }, {
      projectId: DEVELOPMENT_BACKUP_PROJECT_ID,
      sourceEmail,
      sourceUid,
    })).toThrow('snapshot is invalid')
    const excludedPath = snapshot()
    excludedPath.documents[1].documentPath =
      `users/${sourceUid}/providerConnections/garmin`
    excludedPath.digest = snapshotDigest(excludedPath)
    expect(() => validateDevelopmentSnapshot(excludedPath, {
      projectId: DEVELOPMENT_BACKUP_PROJECT_ID,
      sourceEmail,
      sourceUid,
    })).toThrow('snapshot is invalid')
  })

  it('rewrites paths and nested owner values without changing training IDs', () => {
    expect(rewriteSnapshotForTarget(snapshot(), targetUid)).toEqual([
      {
        documentPath: `users/${targetUid}`,
        fields: {
          userId: { stringValue: targetUid },
          nested: {
            mapValue: {
              fields: {
                ownerPath: { stringValue: `users/${targetUid}/runs/run-one` },
              },
            },
          },
        },
      },
      {
        documentPath: `users/${targetUid}/runs/run-one`,
        fields: {
          userId: { stringValue: targetUid },
          crossProviderFingerprint: {
            stringValue: `cross-provider-duplicate-fingerprint@1|${targetUid}|running|2026-11-17T08:00:00.000Z|1800|5000|America%2FLos_Angeles`,
          },
          profile: {
            referenceValue: `projects/demo/databases/(default)/documents/users/${targetUid}`,
          },
        },
      },
    ])
    const unsupported = snapshot()
    unsupported.documents[0].fields.note = {
      stringValue: `owner-${sourceUid}`,
    }
    expect(() => rewriteSnapshotForTarget(unsupported, targetUid)).toThrow(
      'unsupported string field',
    )
    const malformedFingerprint = snapshot()
    malformedFingerprint.documents[1].fields.crossProviderFingerprint = {
      stringValue: `unknown-fingerprint@1|${sourceUid}`,
    }
    expect(() =>
      rewriteSnapshotForTarget(malformedFingerprint, targetUid),
    ).toThrow('unsupported string field')
  })

  it('validates a cleanup manifest only inside the exact target tree', () => {
    const manifest = {
      createdDocuments: [
        {
          documentPath: `users/${targetUid}/runs/run-one`,
          updateTime: '2026-11-17T20:01:00.000Z',
        },
      ],
      projectId: DEVELOPMENT_BACKUP_PROJECT_ID,
      restoredAt: '2026-11-17T20:00:00.000Z',
      schemaVersion: DEVELOPMENT_BACKUP_SCHEMA_VERSION,
      snapshotDigest: snapshot().digest,
      sourceUid,
      targetUid,
    }
    expect(validateRestoreManifest(manifest, {
      snapshotDigest: snapshot().digest,
      sourceUid,
      targetUid,
    })).toEqual(manifest)
    expect(() => validateRestoreManifest({
      ...manifest,
      createdDocuments: [{
        documentPath: 'users/someone-else/runs/run-one',
        updateTime: '2026-11-17T20:01:00.000Z',
      }],
    }, {
      snapshotDigest: snapshot().digest,
      sourceUid,
      targetUid,
    })).toThrow('manifest is invalid')
  })
})
