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
  it('stays out of normal account settings when there is no support evidence', () => {
    const { container } = render(<SupportDiagnostics />)

    expect(container).toBeEmptyDOMElement()
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

    await user.click(screen.getByText('Run-save troubleshooting'))
    await user.click(
      screen.getByRole('button', { name: 'Copy troubleshooting information' }),
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

    await user.click(screen.getByText('Run-save troubleshooting'))
    await user.click(
      screen.getByRole('button', { name: 'Copy troubleshooting information' }),
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Copy the selected diagnostics below.',
    )
    expect(
      (screen.getByLabelText('Troubleshooting information') as HTMLTextAreaElement)
        .value,
    ).toContain('"submissionTotal": 30000')
  })
})
