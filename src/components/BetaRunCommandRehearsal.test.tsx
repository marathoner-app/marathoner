import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type {
  MaterialCommandAuthorizationResult,
  MaterialCommandRetryableResult,
  RunCompletionReceiptResult,
  RunDeletionReceiptResult,
  RunUpdateReceiptResult,
} from '../domain/materialCommands/contract'
import { createUtcDateTime } from '../domain/training/dates'
import { createCompletedRunId } from '../domain/training/identifiers'
import type { CompletedRunCommandClient } from '../services/completedRunCommandClient'
import { BetaRunCommandRehearsal } from './BetaRunCommandRehearsal'

const completedRunId = createCompletedRunId('beta-rehearsal-run-0001')
const completionReceipt: RunCompletionReceiptResult = {
  status: 'run_completed',
  commandId: 'beta-rehearsal-complete-receipt-0001',
  completedRunId,
  completedRunUpdatedAt: createUtcDateTime('2026-10-22T20:00:00.000Z'),
  completedPlannedWorkout: null,
}
const deletionReceipt: RunDeletionReceiptResult = {
  status: 'run_deleted',
  commandId: 'beta-rehearsal-delete-receipt-0001',
  completedRunId,
  deletedAt: createUtcDateTime('2026-10-22T20:01:00.000Z'),
  reopenedPlannedWorkout: null,
}
const updateReceipt: RunUpdateReceiptResult = {
  status: 'run_updated',
  commandId: 'beta-rehearsal-update-receipt-0001',
  completedRunId,
  completedRunUpdatedAt: createUtcDateTime('2026-10-22T20:02:00.000Z'),
  reopenedPlannedWorkout: null,
  completedPlannedWorkout: null,
}

function client(options?: {
  completion?: Awaited<
    ReturnType<CompletedRunCommandClient['submitCompletion']>
  >
  deletion?: Awaited<ReturnType<CompletedRunCommandClient['submitDeletion']>>
}) {
  return {
    submitCompletion: vi
      .fn<CompletedRunCommandClient['submitCompletion']>()
      .mockResolvedValue(options?.completion ?? completionReceipt),
    submitDeletion: vi
      .fn<CompletedRunCommandClient['submitDeletion']>()
      .mockResolvedValue(options?.deletion ?? deletionReceipt),
    submitUpdate: vi
      .fn<CompletedRunCommandClient['submitUpdate']>()
      .mockResolvedValue(updateReceipt),
    resolveCompletion: vi
      .fn<CompletedRunCommandClient['resolveCompletion']>()
      .mockResolvedValue(options?.completion ?? completionReceipt),
    resolveDeletion: vi
      .fn<CompletedRunCommandClient['resolveDeletion']>()
      .mockResolvedValue(options?.deletion ?? deletionReceipt),
    resolveUpdate: vi
      .fn<CompletedRunCommandClient['resolveUpdate']>()
      .mockResolvedValue(updateReceipt),
  } satisfies CompletedRunCommandClient
}

describe('BetaRunCommandRehearsal', () => {
  it('creates, observes, deletes, and observes cleanup without displaying identifiers', async () => {
    const user = userEvent.setup()
    const commandClient = client()
    const view = render(
      <BetaRunCommandRehearsal
        client={commandClient}
        completedRunIds={[]}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Run reversible beta check' }),
    )

    expect(
      await screen.findByText(/waiting for the signed-in run listener/i),
    ).toBeInTheDocument()
    expect(commandClient.submitCompletion).toHaveBeenCalledWith({
      commandId: expect.stringMatching(/^beta-rehearsal-complete-/),
      input: {
        plannedWorkout: null,
        startedAt: expect.stringMatching(/Z$/),
        timeZone: expect.any(String),
        distance: 5_000,
        duration: 1_800,
        perceivedEffort: 'about_right',
        unusualPain: false,
      },
    })
    expect(commandClient.submitDeletion).not.toHaveBeenCalled()

    view.rerender(
      <BetaRunCommandRehearsal
        client={commandClient}
        completedRunIds={[completedRunId]}
      />,
    )

    await waitFor(() => expect(commandClient.submitDeletion).toHaveBeenCalled())
    expect(commandClient.submitDeletion).toHaveBeenCalledWith({
      commandId: expect.stringMatching(/^beta-rehearsal-delete-/),
      completedRunId,
      expectedCompletedRunUpdatedAt:
        completionReceipt.completedRunUpdatedAt,
      plannedWorkout: null,
    })
    expect(
      await screen.findByText(/waiting for the listener to confirm cleanup/i),
    ).toBeInTheDocument()

    view.rerender(
      <BetaRunCommandRehearsal
        client={commandClient}
        completedRunIds={[]}
      />,
    )

    expect(
      await screen.findByText(/create, listener convergence, delete, and cleanup all succeeded/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(completedRunId)).not.toBeInTheDocument()
    expect(
      screen.queryByText(completionReceipt.commandId),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(deletionReceipt.commandId),
    ).not.toBeInTheDocument()
  })

  it('shows only a typed App Check failure and never the command ID', async () => {
    const user = userEvent.setup()
    const denied: MaterialCommandAuthorizationResult = {
      status: 'authorization_error',
      commandId: 'beta-rehearsal-sensitive-command-id',
      code: 'app-check-required',
      message: 'App Check required.',
    }
    const commandClient = client({ completion: denied })

    render(
      <BetaRunCommandRehearsal
        client={commandClient}
        completedRunIds={[]}
      />,
    )
    await user.click(
      screen.getByRole('button', { name: 'Run reversible beta check' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'authorization_error / app-check-required',
    )
    expect(
      screen.queryByText('beta-rehearsal-sensitive-command-id'),
    ).not.toBeInTheDocument()
    expect(commandClient.submitDeletion).not.toHaveBeenCalled()
  })

  it('retries cleanup with the exact deletion command and receipt', async () => {
    const user = userEvent.setup()
    const retryable: MaterialCommandRetryableResult = {
      status: 'retryable_error',
      commandId: 'beta-rehearsal-delete-receipt-0002',
      code: 'temporarily-unavailable',
      message: 'The command could not be confirmed.',
    }
    const commandClient = client()
    commandClient.submitDeletion
      .mockResolvedValueOnce(retryable)
      .mockResolvedValueOnce(deletionReceipt)
    const view = render(
      <BetaRunCommandRehearsal
        client={commandClient}
        completedRunIds={[]}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Run reversible beta check' }),
    )
    await screen.findByText(/waiting for the signed-in run listener/i)
    view.rerender(
      <BetaRunCommandRehearsal
        client={commandClient}
        completedRunIds={[completedRunId]}
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'retryable_error / temporarily-unavailable',
    )
    const firstDeletion = commandClient.submitDeletion.mock.calls[0][0]
    await user.click(
      screen.getByRole('button', { name: 'Retry synthetic-run cleanup' }),
    )

    expect(commandClient.submitDeletion).toHaveBeenCalledTimes(2)
    expect(commandClient.submitDeletion.mock.calls[1][0]).toEqual(
      firstDeletion,
    )
    await screen.findByText(/waiting for the listener to confirm cleanup/i)
    view.rerender(
      <BetaRunCommandRehearsal
        client={commandClient}
        completedRunIds={[]}
      />,
    )
    expect(
      await screen.findByText(/create, listener convergence, delete, and cleanup all succeeded/i),
    ).toBeInTheDocument()
  })
})
