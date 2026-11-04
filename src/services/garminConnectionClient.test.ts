import { describe, expect, it } from 'vitest'

import { createGarminConnectionClient } from './garminConnectionClient'

describe('Garmin connection client', () => {
  it('accepts the narrow public connection contracts', async () => {
    const client = createGarminConnectionClient({
      start: async () => ({
        status: 'ready',
        authorizationUrl: 'https://provider.invalid/authorize',
      }),
      getStatus: async () => ({
        status: 'connected',
        connectedAt: '2026-11-04T20:00:00.000Z',
      }),
      disconnect: async () => ({ status: 'disconnected' }),
    })

    await expect(client.start()).resolves.toEqual({
      status: 'ready',
      authorizationUrl: 'https://provider.invalid/authorize',
    })
    await expect(client.getStatus()).resolves.toEqual({
      status: 'connected',
      connectedAt: '2026-11-04T20:00:00.000Z',
    })
    await expect(client.disconnect()).resolves.toEqual({
      status: 'disconnected',
    })
  })

  it('rejects provider details and malformed responses at the client boundary', async () => {
    const client = createGarminConnectionClient({
      start: async () => ({ status: 'ready', authorizationUrl: 'javascript:bad' }),
      getStatus: async () => ({
        status: 'connected',
        connectedAt: '2026-11-04T20:00:00.000Z',
        accessToken: 'must-not-reach-ui',
      }),
      disconnect: async () => ({ status: 'unknown' }),
    })

    await expect(client.start()).rejects.toThrow('invalid Garmin response')
    await expect(client.getStatus()).resolves.toEqual({
      status: 'connected',
      connectedAt: '2026-11-04T20:00:00.000Z',
    })
    await expect(client.disconnect()).rejects.toThrow('invalid Garmin response')
  })
})
