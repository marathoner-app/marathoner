import { describe, expect, it, vi } from 'vitest'

import {
  createProofMaterialCommand,
  materialCommandSignature,
  type MaterialCommandCommittedResult,
  type MaterialCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import {
  executeMaterialCommand,
  resolveMaterialCommand,
  type MaterialCommandStore,
} from './materialCommandHandler.js'

const ownerId = 'runner-one'
const commandId = 'proof-command-0001'

class InMemoryMaterialCommandStore implements MaterialCommandStore {
  proofCount = 0
  receipts = new Map<
    string,
    { signature: string; result: MaterialCommandCommittedResult }
  >()
  failure: unknown = null

  async commitProof(options: {
    envelope: MaterialCommandEnvelope
    ownerId: string
  }) {
    if (this.failure) throw this.failure
    const key = `${options.ownerId}:${options.envelope.commandId}`
    const signature = materialCommandSignature(options.envelope)
    const prior = this.receipts.get(key)
    if (prior) {
      return prior.signature === signature
        ? { kind: 'committed' as const, result: prior.result }
        : { kind: 'conflict' as const }
    }
    this.proofCount += 1
    const result: MaterialCommandCommittedResult = {
      status: 'committed',
      commandId: options.envelope.commandId,
      committedAt: '2026-10-05T00:00:00.000Z',
      proofCount: this.proofCount,
    }
    this.receipts.set(key, { signature, result })
    return { kind: 'committed' as const, result }
  }

  async resolve(options: { commandId: string; ownerId: string }) {
    if (this.failure) throw this.failure
    return this.receipts.get(`${options.ownerId}:${options.commandId}`)?.result ?? null
  }
}

function dependencies(store = new InMemoryMaterialCommandStore()) {
  return { store, log: vi.fn() }
}

describe('material-command handler', () => {
  it('requires authentication and rejects a payload-supplied owner', async () => {
    const boundary = dependencies()
    await expect(
      executeMaterialCommand(
        { authenticatedUserId: null, data: createProofMaterialCommand(commandId) },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'authentication_error' }),
    )

    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: {
            ...createProofMaterialCommand(commandId),
            userId: 'runner-two',
          },
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'validation_error',
        code: 'ownership-field-prohibited',
      }),
    )
    expect(boundary.store.proofCount).toBe(0)
  })

  it('returns the original result for a repeated command without a second effect', async () => {
    const boundary = dependencies()
    const command = createProofMaterialCommand(commandId)

    const first = await executeMaterialCommand(
      { authenticatedUserId: ownerId, data: command },
      boundary,
    )
    const second = await executeMaterialCommand(
      { authenticatedUserId: ownerId, data: command },
      boundary,
    )

    expect(first).toEqual(second)
    expect(first).toEqual(
      expect.objectContaining({ status: 'committed', proofCount: 1 }),
    )
    expect(boundary.store.proofCount).toBe(1)
  })

  it('rejects one command ID reused for a different supported command', async () => {
    const boundary = dependencies()
    await executeMaterialCommand(
      {
        authenticatedUserId: ownerId,
        data: createProofMaterialCommand(commandId, 'default'),
      },
      boundary,
    )

    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: createProofMaterialCommand(commandId, 'alternate'),
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ status: 'conflict', code: 'command-id-reused' }),
    )
    expect(boundary.store.proofCount).toBe(1)
  })

  it('returns typed version, retryable, and outcome-unknown results', async () => {
    const boundary = dependencies()
    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: {
            ...createProofMaterialCommand(commandId),
            appProtocolVersion: 2,
          },
        },
        boundary,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'unsupported_version',
        code: 'unsupported-app-protocol-version',
      }),
    )

    boundary.store.failure = { code: 14 }
    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: createProofMaterialCommand(commandId),
        },
        boundary,
      ),
    ).resolves.toEqual(expect.objectContaining({ status: 'retryable_error' }))

    boundary.store.failure = new Error('unknown failure')
    await expect(
      executeMaterialCommand(
        {
          authenticatedUserId: ownerId,
          data: createProofMaterialCommand(commandId),
        },
        boundary,
      ),
    ).resolves.toEqual(expect.objectContaining({ status: 'outcome_unknown' }))
  })

  it('resolves a committed command by authenticated owner and keeps logs redacted', async () => {
    const boundary = dependencies()
    const command = createProofMaterialCommand(commandId)
    const committed = await executeMaterialCommand(
      { authenticatedUserId: ownerId, data: command },
      boundary,
    )
    await executeMaterialCommand(
      {
        authenticatedUserId: ownerId,
        data: { ...command, note: 'private participant note' },
      },
      boundary,
    )
    const resolved = await resolveMaterialCommand(
      { authenticatedUserId: ownerId, data: { commandId } },
      boundary,
    )

    expect(resolved).toEqual(committed)
    const serializedLogs = JSON.stringify(boundary.log.mock.calls)
    expect(serializedLogs).not.toContain(ownerId)
    expect(serializedLogs).not.toContain(commandId)
    expect(serializedLogs).not.toContain('payload')
    expect(serializedLogs).not.toContain('private participant note')
  })
})
