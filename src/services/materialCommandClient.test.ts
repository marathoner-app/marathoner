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

  it('retries the exact idempotent command once after a timed-out response', async () => {
    const boundary = transport()
    vi.mocked(boundary.submit)
      .mockRejectedValueOnce({ code: 'functions/deadline-exceeded' })
      .mockResolvedValueOnce(committed)
    const client = createMaterialCommandClient({
      isOnline: () => true,
      transport: boundary,
      retryIdempotentSubmissionsOnce: true,
    })

    await expect(client.submit(command)).resolves.toEqual(committed)
    expect(boundary.submit).toHaveBeenCalledTimes(2)
    expect(boundary.submit).toHaveBeenNthCalledWith(1, command)
    expect(boundary.submit).toHaveBeenNthCalledWith(2, command)
  })

  it('marks the outcome unknown when both safe attempts fail', async () => {
    const boundary = transport()
    vi.mocked(boundary.submit).mockRejectedValue({
      code: 'functions/deadline-exceeded',
    })
    const client = createMaterialCommandClient({
      isOnline: () => true,
      transport: boundary,
      retryIdempotentSubmissionsOnce: true,
    })

    await expect(client.submit(command)).resolves.toEqual(
      expect.objectContaining({
        status: 'outcome_unknown',
        code: 'resolve-by-command-id',
        commandId,
      }),
    )
    expect(boundary.submit).toHaveBeenCalledTimes(2)
  })

  it('does not retry a definitive authentication failure', async () => {
    const boundary = transport()
    vi.mocked(boundary.submit).mockRejectedValueOnce({
      code: 'functions/unauthenticated',
    })
    const client = createMaterialCommandClient({
      isOnline: () => true,
      transport: boundary,
      retryIdempotentSubmissionsOnce: true,
    })

    await expect(client.submit(command)).resolves.toEqual(
      expect.objectContaining({ status: 'authentication_error' }),
    )
    expect(boundary.submit).toHaveBeenCalledTimes(1)
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
    expect(boundary.submit).toHaveBeenCalledTimes(1)
  })
})
