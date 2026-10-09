import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FirebaseBootstrapGate from './FirebaseBootstrapGate'

vi.mock('../services/nativeStartup', () => ({
  releaseNativeStartupOverlayAfterPaint: vi.fn(() => () => undefined),
}))

describe('Firebase bootstrap gate', () => {
  it('does not expose the application before App Check startup succeeds', async () => {
    let finishInitialization: (() => void) | undefined
    const initialize = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishInitialization = resolve
        }),
    )

    render(
      <FirebaseBootstrapGate initialize={initialize}>
        <p>Protected application</p>
      </FirebaseBootstrapGate>,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Verifying this Marathoner app...',
    )
    expect(screen.queryByText('Protected application')).not.toBeInTheDocument()

    finishInitialization?.()

    expect(await screen.findByText('Protected application')).toBeInTheDocument()
  })

  it('shows an accessible failure with support and retries', async () => {
    const user = userEvent.setup()
    const initialize = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('provider details stay internal'))
      .mockResolvedValueOnce()

    render(
      <FirebaseBootstrapGate initialize={initialize}>
        <p>Protected application</p>
      </FirebaseBootstrapGate>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Marathoner couldn't verify this app")
    expect(alert).not.toHaveTextContent('provider details stay internal')
    expect(screen.getByRole('link', { name: 'Marathoner support' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:kevin@marathonerapp.com'),
    )

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Protected application')).toBeInTheDocument()
    expect(initialize).toHaveBeenCalledTimes(2)
  })
})
