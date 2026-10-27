import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { recordSlowRunDiagnostic } from '../diagnostics/slowRunDiagnostics'
import SupportDiagnostics from './SupportDiagnostics'

function recordSlowRun() {
  recordSlowRunDiagnostic({
    submission: {
      startedAtMilliseconds: 10,
      durationMilliseconds: 30_000,
      outcome: 'succeeded',
    },
    plannedWorkout: false,
  })
}

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('SupportDiagnostics', () => {
  it('explains when the device has no retained slow-run record', () => {
    render(<SupportDiagnostics />)

    expect(
      screen.getByText(/has not recorded a run save that took longer than five seconds/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Copy slow-run diagnostics' }),
    ).not.toBeInTheDocument()
  })

  it('copies retained privacy-safe diagnostics without developer tools', async () => {
    recordSlowRun()
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(<SupportDiagnostics />)

    await user.click(
      screen.getByRole('button', { name: 'Copy slow-run diagnostics' }),
    )

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0]?.[0]).toContain('"submissionTotal": 30000')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Run diagnostics copied.',
    )
  })

  it('shows selectable diagnostics when clipboard access fails', async () => {
    recordSlowRun()
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
    })
    render(<SupportDiagnostics />)

    await user.click(
      screen.getByRole('button', { name: 'Copy slow-run diagnostics' }),
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Copy the selected diagnostics below.',
    )
    expect(
      (screen.getByLabelText('Slow-run diagnostics') as HTMLTextAreaElement)
        .value,
    ).toContain('"submissionTotal": 30000')
  })
})
