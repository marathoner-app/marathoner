import { describe, expect, it, vi } from 'vitest'

import {
  createAccountDeletionRequest,
  materialCommandSignature,
  type AccountDeletionRequestAcceptedResult,
  type AccountDeletionRequestEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import {
  executeAccountDeletionRequest,
  type AccountAccessManager,
  type AccountDeletionRequestStore,
} from './accountDeletionRequestHandler.js'

const ownerId = 'runner-one'
const otherOwnerId = 'runner-two'
const commandId = 'delete-command-0001'
const nowEpochSeconds = 1_800_000_000

class InMemoryDeletionRequestStore implements AccountDeletionRequestStore {
  approvedOwners = new Set([ownerId])
  requestsCreated = 0
  receipts = new Map<
    string,
    {
      authLockStatus: 'complete' | 'pending'
      result: AccountDeletionRequestAcceptedResult
      signature: string
    }
  >()
  lockFailures = new Set<string>()

  async accept(options: {
    envelope: AccountDeletionRequestEnvelope
    ownerId: string
  }) {
    const key = `${options.ownerId}:${options.envelope.commandId}`
    const signature = materialCommandSignature(options.envelope)
    const prior = this.receipts.get(key)
    if (prior) {
      return prior.signature === signature
        ? {
            kind: 'accepted' as const,
            authLockStatus: prior.authLockStatus,
            result: prior.result,
          }
        : { kind: 'conflict' as const }
    }
    if (!this.approvedOwners.has(options.ownerId)) {
      return { kind: 'membership-required' as const }
    }
    this.requestsCreated += 1
    const requestId = `11111111-1111-4111-8111-${String(this.requestsCreated).padStart(12, '0')}`
    const result: AccountDeletionRequestAcceptedResult = {
      status: 'accepted',
      commandId: options.envelope.commandId,
      requestId,
      requestedAt: '2027-01-15T08:00:00.000Z',
      completionDueAt: '2027-01-22T08:00:00.000Z',
      accessLocked: true,
    }
    this.receipts.set(key, {
      authLockStatus: 'pending',
      result,
      signature,
    })
    return { kind: 'accepted' as const, authLockStatus: 'pending' as const, result }
  }

  async markAuthLockComplete(requestId: string) {
    const receipt = [...this.receipts.values()].find(
      (candidate) => candidate.result.requestId === requestId,
    )
    if (!receipt) throw new Error('missing request')
    receipt.authLockStatus = 'complete'
    this.lockFailures.delete(requestId)
  }

  async markAuthLockFailed(requestId: string) {
    this.lockFailures.add(requestId)
  }
}

class InMemoryAccountAccess implements AccountAccessManager {
  calls: string[] = []
  failure: unknown = null

  async disableAndRevoke(requestedOwnerId: string) {
    this.calls.push(requestedOwnerId)
    if (this.failure) throw this.failure
  }
}

function validOptions(data: unknown = createAccountDeletionRequest(commandId)) {
  return {
    authenticatedUser: {
      uid: ownerId,
      emailVerified: true,
      authTimeSeconds: nowEpochSeconds - 60,
    },
    appCheckVerified: true,
    appCheckAlreadyConsumed: false,
    data,
  }
}

function dependencies(store = new InMemoryDeletionRequestStore()) {
  return {
    store,
    accountAccess: new InMemoryAccountAccess(),
    log: vi.fn(),
    nowEpochSeconds: () => nowEpochSeconds,
  }
}

describe('account-deletion request handler', () => {
  it.each([
    [
      'an authenticated user',
      { ...validOptions(), authenticatedUser: null },
      'authentication-required',
    ],
    [
      'a verified app',
      { ...validOptions(), appCheckVerified: false },
      'app-check-required',
    ],
    [
      'an unused App Check token',
      { ...validOptions(), appCheckAlreadyConsumed: true },
      'app-check-token-replayed',
    ],
    [
      'a verified email',
      {
        ...validOptions(),
        authenticatedUser: {
          ...validOptions().authenticatedUser,
          emailVerified: false,
        },
      },
      'verified-email-required',
    ],
    [
      'recent authentication',
      {
        ...validOptions(),
        authenticatedUser: {
          ...validOptions().authenticatedUser,
          authTimeSeconds: nowEpochSeconds - 301,
        },
      },
      'recent-authentication-required',
    ],
  ])('requires %s', async (_, options, code) => {
    const boundary = dependencies()

    await expect(
      executeAccountDeletionRequest(options, boundary),
    ).resolves.toEqual(expect.objectContaining({ code }))
    expect(boundary.store.requestsCreated).toBe(0)
    expect(boundary.accountAccess.calls).toHaveLength(0)
  })

  it('rejects caller-supplied targeting and a non-deletion command', async () => {
    const boundary = dependencies()
    const targeted = {
      ...createAccountDeletionRequest(commandId),
      path: `users/${otherOwnerId}`,
    }

    await expect(
      executeAccountDeletionRequest(validOptions(targeted), boundary),
    ).resolves.toEqual(
      expect.objectContaining({ code: 'target-field-prohibited' }),
    )

    await expect(
      executeAccountDeletionRequest(
        validOptions({
          ...createAccountDeletionRequest(commandId),
          command: {
            type: 'proof.material-command',
            schemaVersion: 1,
            proofVariant: 'default',
          },
        }),
        boundary,
      ),
    ).resolves.toEqual(expect.objectContaining({ code: 'invalid-envelope' }))
    expect(boundary.store.requestsCreated).toBe(0)
  })

  it('requires an approved beta membership', async () => {
    const boundary = dependencies()
    const options = validOptions()
    options.authenticatedUser.uid = otherOwnerId

    await expect(
      executeAccountDeletionRequest(options, boundary),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'authorization_error',
        code: 'approved-beta-membership-required',
      }),
    )
    expect(boundary.store.requestsCreated).toBe(0)
  })

  it('creates one request, locks the authenticated owner, and returns the original receipt', async () => {
    const boundary = dependencies()

    const first = await executeAccountDeletionRequest(validOptions(), boundary)
    const second = await executeAccountDeletionRequest(validOptions(), boundary)

    expect(first).toEqual(second)
    expect(first).toEqual(
      expect.objectContaining({ status: 'accepted', accessLocked: true }),
    )
    expect(boundary.store.requestsCreated).toBe(1)
    expect(boundary.accountAccess.calls).toEqual([ownerId])
  })

  it('keeps an accepted request observable and retries a failed Auth lock', async () => {
    const boundary = dependencies()
    boundary.accountAccess.failure = new Error('private provider detail')

    const accepted = await executeAccountDeletionRequest(validOptions(), boundary)

    expect(accepted).toEqual(expect.objectContaining({ status: 'accepted' }))
    expect(boundary.store.lockFailures).toContain(
      (accepted as AccountDeletionRequestAcceptedResult).requestId,
    )

    boundary.accountAccess.failure = null
    await executeAccountDeletionRequest(validOptions(), boundary)
    expect(boundary.accountAccess.calls).toEqual([ownerId, ownerId])
    expect(boundary.store.lockFailures).not.toContain(
      (accepted as AccountDeletionRequestAcceptedResult).requestId,
    )
  })

  it('logs only fixed outcome metadata', async () => {
    const boundary = dependencies()
    await executeAccountDeletionRequest(validOptions(), boundary)

    expect(boundary.log).toHaveBeenCalledWith({
      event: 'account-deletion-request-result',
      commandType: 'account.request-deletion',
      status: 'accepted',
    })
    const serialized = JSON.stringify(boundary.log.mock.calls)
    expect(serialized).not.toContain(ownerId)
    expect(serialized).not.toContain(commandId)
    expect(serialized).not.toContain('11111111')
  })
})
