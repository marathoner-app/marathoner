import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GarminConnectionClient } from '../services/garminConnectionClient'
import { findBetaBlockingAccessibilityViolations } from '../test/accessibility'
import GarminConnection from './GarminConnection'

function client(
  overrides: Partial<GarminConnectionClient> = {},
): GarminConnectionClient {
  return {
    start: vi.fn<GarminConnectionClient['start']>(async () => ({
      status: 'ready',
      authorizationUrl: 'https://provider.invalid/authorize',
    })),
    getStatus: vi.fn<GarminConnectionClient['getStatus']>(async () => ({
      status: 'disconnected',
      connectedAt: null,
    })),
    disconnect: vi.fn<GarminConnectionClient['disconnect']>(async () => ({
      status: 'disconnected',
    })),
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GarminConnection', () => {
  it('explains the narrow import scope before connection', async () => {
    render(<GarminConnection accountScope="runner-one" client={client()} />)

    expect(await screen.findByRole('button', { name: 'Connect Garmin' })).toBeEnabled()
    expect(screen.getByText(/completed running activities automatically/i)).toBeInTheDocument()
    expect(screen.getByText(/does not import routes or all-day health data/i)).toBeInTheDocument()
    expect(screen.queryByText(/webhook|provider id|token/i)).not.toBeInTheDocument()
  })

  it('opens approval in a new tab and checks the same server connection afterward', async () => {
    const user = userEvent.setup()
    const getStatus = vi
      .fn<GarminConnectionClient['getStatus']>()
      .mockResolvedValueOnce({ status: 'disconnected', connectedAt: null })
      .mockResolvedValueOnce({
        status: 'connected',
        connectedAt: '2026-11-04T20:00:00.000Z',
      })
    const start = vi.fn<GarminConnectionClient['start']>(async () => ({
      status: 'ready',
      authorizationUrl: 'https://provider.invalid/authorize',
    }))
    const replace = vi.fn()
    vi.spyOn(window, 'open').mockReturnValue({
      close: vi.fn(),
      location: { replace },
      opener: window,
    } as unknown as Window)
    render(
      <GarminConnection
        accountScope="runner-one"
        client={client({ getStatus, start })}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'Connect Garmin' }))

    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(start).toHaveBeenCalledOnce()
    expect(replace).toHaveBeenCalledWith('https://provider.invalid/authorize')
    expect(screen.getByRole('status')).toHaveTextContent(/return here and check/i)

    await user.click(screen.getByRole('button', { name: 'Check connection' }))

    expect(await screen.findByText(/completed running activities will appear/i)).toBeInTheDocument()
    expect(getStatus).toHaveBeenCalledTimes(2)
  })

  it('does not create an authorization request when the browser blocks the new tab', async () => {
    const user = userEvent.setup()
    const start = vi.fn<GarminConnectionClient['start']>()
    vi.spyOn(window, 'open').mockReturnValue(null)
    render(
      <GarminConnection
        accountScope="runner-one"
        client={client({ start })}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'Connect Garmin' }))

    expect(start).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/allow marathoner to open/i)
  })

  it('warns against duplicate manual logging and offers truthful reconnection', async () => {
    const user = userEvent.setup()
    render(
      <GarminConnection
        accountScope="runner-one"
        client={client({
          getStatus: async () => ({
            status: 'connected',
            connectedAt: '2026-11-04T20:00:00.000Z',
          }),
        })}
      />,
    )

    await user.click(await screen.findByText('A run is missing'))

    expect(screen.getByText(/wait a few minutes and check Track again/i)).toBeInTheDocument()
    expect(screen.getByText(/could create a duplicate/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reconnect Garmin' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /check for runs now/i })).not.toBeInTheDocument()
  })

  it('keeps a failed disconnect recoverable without claiming access was removed', async () => {
    const user = userEvent.setup()
    const disconnect = vi.fn<GarminConnectionClient['disconnect']>(async () => ({
      status: 'unavailable',
      code: 'provider-revocation-failed',
    }))
    render(
      <GarminConnection
        accountScope="runner-one"
        client={client({
          getStatus: async () => ({
            status: 'connected',
            connectedAt: null,
          }),
          disconnect,
        })}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'Disconnect Garmin' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/still being disconnected/i)
    expect(
      screen.getByRole('button', { name: 'Finish disconnecting Garmin' }),
    ).toBeEnabled()
    expect(screen.queryByText(/access has been removed/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Finish disconnecting Garmin' }))
    expect(disconnect).toHaveBeenCalledTimes(2)
  })

  it('shows a calm unavailable state when direct import is disabled', async () => {
    render(
      <GarminConnection
        accountScope="runner-one"
        client={client({
          getStatus: async () => ({
            status: 'unavailable',
            code: 'garmin-oauth-disabled',
          }),
        })}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText(/not available in this build yet/i)).toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: 'Connect Garmin' })).not.toBeInTheDocument()
  })

  it('has no beta-blocking accessibility violations in the connected state', async () => {
    render(
      <GarminConnection
        accountScope="runner-one"
        client={client({
          getStatus: async () => ({
            status: 'connected',
            connectedAt: '2026-11-04T20:00:00.000Z',
          }),
        })}
      />,
    )

    await screen.findByRole('button', { name: 'Disconnect Garmin' })
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([])
  })
})
