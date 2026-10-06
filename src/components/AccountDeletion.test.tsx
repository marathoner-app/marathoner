import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AccountDeletionRequestAcceptedResult,
  MaterialCommandResult,
} from '../domain/materialCommands/contract'
import {
  reauthenticateForAccountDeletion,
  resolveAccountDeletionRequest,
  submitAccountDeletionRequest,
} from '../services/accountDeletionService'
import {
  AccountDeletionDialog,
  AccountDeletionReceipt,
} from './AccountDeletion'

vi.mock('../services/accountDeletionService', () => ({
  reauthenticateForAccountDeletion: vi.fn(),
  resolveAccountDeletionRequest: vi.fn(),
  submitAccountDeletionRequest: vi.fn(),
}))

const mockedReauthenticate = vi.mocked(reauthenticateForAccountDeletion)
const mockedResolve = vi.mocked(resolveAccountDeletionRequest)
const mockedSubmit = vi.mocked(submitAccountDeletionRequest)
const supportEmail = 'kevin@marathonerapp.com'
const accepted: AccountDeletionRequestAcceptedResult = {
  status: 'accepted',
  commandId: 'account-delete-11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
  requestedAt: '2026-10-06T12:00:00.000Z',
  completionDueAt: '2026-10-13T12:00:00.000Z',
  accessLocked: true,
}

function renderDialog(
  onAccepted = vi.fn(),
  onClose = vi.fn(),
  unresolvedCommandId: string | null = null,
  onUnresolvedCommandChange = vi.fn(),
) {
  return {
    onAccepted,
    onClose,
    onUnresolvedCommandChange,
    ...render(
      <AccountDeletionDialog
        email="runner@example.com"
        supportEmail={supportEmail}
        unresolvedCommandId={unresolvedCommandId}
        onAccepted={onAccepted}
        onClose={onClose}
        onUnresolvedCommandChange={onUnresolvedCommandChange}
      />,
    ),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedReauthenticate.mockResolvedValue()
  mockedSubmit.mockResolvedValue(accepted)
  mockedResolve.mockResolvedValue(accepted)
})

describe('AccountDeletionDialog', () => {
  it('states the full irreversible scope and focuses the dialog heading', () => {
    renderDialog()

    expect(
      screen.getByRole('heading', { name: 'Delete your Marathoner account' }),
    ).toHaveFocus()
    expect(
      screen.getByText(
        /account, runner profile, training plans, workouts, runs, shoes, and beta access/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/access stops as soon/i)).toBeInTheDocument()
    expect(screen.getByText(/seven calendar days/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: supportEmail })).toHaveAttribute(
      'href',
      `mailto:${supportEmail}`,
    )
    expect(
      screen.getByRole('button', {
        name: 'Permanently delete my Marathoner account',
      }),
    ).toBeDisabled()
  })

  it('reauthenticates, clears the password, and disables controls while pending', async () => {
    const user = userEvent.setup()
    let finishReauthentication: (() => void) | undefined
    mockedReauthenticate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishReauthentication = resolve
        }),
    )
    renderDialog()

    const password = screen.getByLabelText(
      'Re-enter the password for runner@example.com',
    )
    await user.type(password, 'private-password')
    await user.click(
      screen.getByRole('button', {
        name: 'Permanently delete my Marathoner account',
      }),
    )

    expect(mockedReauthenticate).toHaveBeenCalledWith('private-password')
    expect(password).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close account settings' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Confirming your password...',
    )

    finishReauthentication?.()

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalledOnce())
    expect(password).toHaveValue('')
  })

  it('shows and focuses a safe reauthentication failure', async () => {
    const user = userEvent.setup()
    mockedReauthenticate.mockRejectedValue(
      new Error('The email or password is incorrect.'),
    )
    renderDialog()

    await user.type(
      screen.getByLabelText('Re-enter the password for runner@example.com'),
      'wrong-password',
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Permanently delete my Marathoner account',
      }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The email or password is incorrect.',
    )
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(mockedSubmit).not.toHaveBeenCalled()
  })

  it('says an offline reauthentication did not save or queue a request', async () => {
    const user = userEvent.setup()
    mockedReauthenticate.mockRejectedValue({
      code: 'network_unavailable',
      message: 'safe service message',
    })
    renderDialog()

    await user.type(
      screen.getByLabelText('Re-enter the password for runner@example.com'),
      'private-password',
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Permanently delete my Marathoner account',
      }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'not saved or queued',
    )
    expect(mockedSubmit).not.toHaveBeenCalled()
  })

  it('says an offline request was not queued', async () => {
    const user = userEvent.setup()
    mockedSubmit.mockResolvedValue({
      status: 'retryable_error',
      commandId: 'account-delete-offline-0001',
      code: 'temporarily-unavailable',
      message:
        'You are offline. This command was not queued; reconnect and try again.',
    })
    const { onAccepted } = renderDialog()

    await user.type(
      screen.getByLabelText('Re-enter the password for runner@example.com'),
      'private-password',
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Permanently delete my Marathoner account',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('not queued')
    expect(onAccepted).not.toHaveBeenCalled()
  })

  it.each([
    [
      'recent-authentication failure',
      {
        status: 'authentication_error',
        commandId: 'account-delete-recent-auth-0001',
        code: 'recent-authentication-required',
        message: 'Reauthenticate.',
      } satisfies MaterialCommandResult,
      'could not confirm a recent sign-in',
    ],
    [
      'denied app session',
      {
        status: 'authorization_error',
        commandId: 'account-delete-app-check-0001',
        code: 'app-check-required',
        message: 'App Check required.',
      } satisfies MaterialCommandResult,
      'could not verify this app session',
    ],
  ])('shows a calm typed state for a %s', async (_, result, message) => {
    const user = userEvent.setup()
    mockedSubmit.mockResolvedValue(result)
    renderDialog()

    await user.type(
      screen.getByLabelText('Re-enter the password for runner@example.com'),
      'private-password',
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Permanently delete my Marathoner account',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('resolves an ambiguous response with the original command ID before acceptance', async () => {
    const user = userEvent.setup()
    mockedSubmit.mockImplementation(async (commandId) => ({
      status: 'outcome_unknown',
      commandId,
      code: 'resolve-by-command-id',
      message: 'Resolve this command.',
    }))
    mockedResolve.mockImplementation(async (commandId) => ({
      ...accepted,
      commandId,
    }))
    const { onAccepted } = renderDialog()

    await user.type(
      screen.getByLabelText('Re-enter the password for runner@example.com'),
      'private-password',
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Permanently delete my Marathoner account',
      }),
    )

    await waitFor(() => expect(onAccepted).toHaveBeenCalledOnce())
    const originalCommandId = mockedSubmit.mock.calls[0][0]
    expect(mockedResolve).toHaveBeenCalledWith(originalCommandId)
    expect(onAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: originalCommandId }),
    )
  })

  it('offers only same-command resolution while an outcome remains unknown', async () => {
    const user = userEvent.setup()
    const unknown = (commandId: string): MaterialCommandResult => ({
      status: 'outcome_unknown',
      commandId,
      code: 'resolve-by-command-id',
      message: 'Resolve this command.',
    })
    mockedSubmit.mockImplementation(async (commandId) => unknown(commandId))
    mockedResolve.mockImplementation(async (commandId) => unknown(commandId))
    const { onUnresolvedCommandChange } = renderDialog()

    await user.type(
      screen.getByLabelText('Re-enter the password for runner@example.com'),
      'private-password',
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Permanently delete my Marathoner account',
      }),
    )

    const checkButton = await screen.findByRole('button', {
      name: 'Check the original request',
    })
    const originalCommandId = mockedSubmit.mock.calls[0][0]
    expect(onUnresolvedCommandChange).toHaveBeenCalledWith(originalCommandId)
    expect(mockedResolve).toHaveBeenLastCalledWith(originalCommandId)
    expect(mockedSubmit).toHaveBeenCalledOnce()

    await user.click(checkButton)

    await waitFor(() => expect(mockedResolve).toHaveBeenCalledTimes(2))
    expect(mockedResolve).toHaveBeenLastCalledWith(originalCommandId)
    expect(mockedSubmit).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('button', {
        name: 'Permanently delete my Marathoner account',
      }),
    ).not.toBeInTheDocument()
  })

  it('restores an unresolved command without offering a new submission', () => {
    const originalCommandId = 'account-delete-existing-0001'
    renderDialog(vi.fn(), vi.fn(), originalCommandId)

    expect(
      screen.getByRole('button', { name: 'Check the original request' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Permanently delete my Marathoner account',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByLabelText('Re-enter the password for runner@example.com'),
    ).toBeDisabled()
  })
})

describe('AccountDeletionReceipt', () => {
  it('honestly labels the request pending and exposes a copyable support receipt', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <AccountDeletionReceipt
        receipt={accepted}
        supportEmail={supportEmail}
        signedOut
        signOutError={null}
        onRetrySignOut={vi.fn()}
        onDone={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Your deletion request is pending' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/deletion is not complete yet/i)).toBeInTheDocument()
    expect(screen.getByText(accepted.requestId)).toBeInTheDocument()
    expect(screen.getByText(/october 13, 2026/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy request ID' }))

    expect(writeText).toHaveBeenCalledWith(accepted.requestId)
    expect(screen.getByRole('status')).toHaveTextContent('Request ID copied.')
  })
})
