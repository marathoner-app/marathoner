import { describe, expect, it, vi } from 'vitest'

import {
  createProofMaterialCommand,
  type MaterialCommandCommittedResult,
} from '../domain/materialCommands/contract'
import {
  createMaterialCommandClient,
  type MaterialCommandTransport,
} from './materialCommandClient'

const commandId = 'proof-command-0001'
const command = createProofMaterialCommand(commandId)
const committed: MaterialCommandCommittedResult = {
  status: 'committed',
  commandId,
  committedAt: '2026-10-05T00:00:00.000Z',
  proofCount: 1,
}

function transport(): MaterialCommandTransport {
  return {
    submit: vi.fn().mockResolvedValue(committed),
    resolve: vi.fn().mockResolvedValue(committed),
  }
}

describe('material-command web client', () => {
  it('fails visibly while offline and never replays after reconnection', async () => {
    let online = false
    const boundary = transport()
    const client = createMaterialCommandClient({
      isOnline: () => online,
      transport: boundary,
    })

    await expect(client.submit(command)).resolves.toEqual(
      expect.objectContaining({
        status: 'retryable_error',
        message: expect.stringContaining('not queued'),
      }),
    )
    expect(boundary.submit).not.toHaveBeenCalled()

    online = true
    await Promise.resolve()
    expect(boundary.submit).not.toHaveBeenCalled()

    await expect(client.submit(command)).resolves.toEqual(committed)
    expect(boundary.submit).toHaveBeenCalledTimes(1)
  })

  it('marks a timed-out request unknown and resolves it by command ID', async () => {
    const boundary = transport()
    vi.mocked(boundary.submit).mockRejectedValueOnce({
      code: 'functions/deadline-exceeded',
    })
    const client = createMaterialCommandClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submit(command)).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        code: 'resolve-by-command-id',
        commandId,
      }),
    )
    await expect(client.resolve(commandId)).resolves.toEqual(committed)
    expect(boundary.submit).toHaveBeenCalledTimes(1)
    expect(boundary.resolve).toHaveBeenCalledWith(commandId)
  })

  it('maps unavailable transport errors to an explicit retryable result', async () => {
    const boundary = transport()
    vi.mocked(boundary.submit).mockRejectedValueOnce({
      code: 'functions/unavailable',
    })
    const client = createMaterialCommandClient({
      isOnline: () => true,
      transport: boundary,
    })

    await expect(client.submit(command)).resolves.toEqual(
      expect.objectContaining({ status: 'retryable_error' }),
    )
  })
})
