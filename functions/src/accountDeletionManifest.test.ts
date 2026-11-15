import { describe, expect, it } from 'vitest'

import {
  parseActiveAccountDeletionRequest,
} from './accountDeletionManifest.js'

const requestId = '11111111-1111-4111-8111-111111111111'

function activeRequest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    manifestVersion: 2,
    requestId,
    userId: 'runner-owner',
    commandId: 'delete-command-runner-owner',
    status: 'auth_lock_failed',
    stage: 'membership_locked',
    attemptCount: 1,
    requestedAt: '2027-01-15T08:00:00.000Z',
    completionDueAt: '2027-01-22T08:00:00.000Z',
    updatedAt: '2027-01-15T08:00:00.000Z',
    lastErrorCode: 'auth-admin-failed',
    ...overrides,
  }
}

describe('account-deletion manifest', () => {
  it('accepts a request before Garmin cleanup records provider digests', () => {
    expect(parseActiveAccountDeletionRequest(activeRequest(), requestId)).toEqual(
      expect.objectContaining({ requestId, manifestVersion: 2 }),
    )
  })

  it('accepts the protected Garmin digests persisted during cleanup', () => {
    const digest = 'A'.repeat(43)

    expect(
      parseActiveAccountDeletionRequest(
        activeRequest({ garminProviderAccountDigests: [digest] }),
        requestId,
      ),
    ).toEqual(expect.objectContaining({ garminProviderAccountDigests: [digest] }))
  })

  it('rejects malformed or duplicate Garmin digests', () => {
    expect(() =>
      parseActiveAccountDeletionRequest(
        activeRequest({ garminProviderAccountDigests: ['too-short'] }),
        requestId,
      ),
    ).toThrow('invalid')

    const digest = 'B'.repeat(43)
    expect(() =>
      parseActiveAccountDeletionRequest(
        activeRequest({ garminProviderAccountDigests: [digest, digest] }),
        requestId,
      ),
    ).toThrow('invalid')
  })
})
