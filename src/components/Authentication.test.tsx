import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginButton from './LoginButton'
import { requestPasswordReset, signIn } from '../services/authService'

vi.mock('../services/authService', () => ({
  requestPasswordReset: vi.fn(),
  signIn: vi.fn()
}))

const mockedRequestPasswordReset = vi.mocked(requestPasswordReset)
const mockedSignIn = vi.mocked(signIn)
type SignInResult = Awaited<ReturnType<typeof signIn>>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('authentication forms', () => {
  it('shows a safe rejected-login message and clears it when credentials change', async () => {
    const user = userEvent.setup()
    mockedSignIn.mockRejectedValue(
      new Error('The email or password is incorrect.')
    )
    render(<LoginButton />)

    const loginButton = screen.getByRole('button', { name: 'Log in' })
    await user.click(loginButton)

    expect(loginButton).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('dialog', { name: 'Existing account login' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveFocus()
    await user.type(
      screen.getByLabelText('Email'),
      'runner@example.com'
    )
    await user.type(screen.getByLabelText('Password'), 'bad-password{Enter}')

    expect(
      await screen.findByText('The email or password is incorrect.')
    ).toBeInTheDocument()
    expect(mockedSignIn).toHaveBeenCalledWith(
      'runner@example.com',
      'bad-password'
    )
    expect(screen.getByLabelText('Password')).toHaveFocus()

    await user.type(screen.getByLabelText('Password'), '!')

    expect(
      screen.queryByText('The email or password is incorrect.')
    ).not.toBeInTheDocument()
  })

  it('names the login fields and follows a predictable keyboard order', async () => {
    const user = userEvent.setup()
    render(<LoginButton />)

    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const form = screen.getByRole('form', { name: 'Existing account login' })
    const email = screen.getByRole('textbox', { name: 'Email' })
    const password = screen.getByLabelText('Password')
    const submit = within(form).getByRole('button', { name: 'Log in' })

    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(email).toHaveFocus()

    await user.tab()
    expect(password).toHaveFocus()
    await user.tab()
    expect(submit).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toHaveFocus()
  })

  it('prevents duplicate login requests while authentication is pending', async () => {
    const user = userEvent.setup()
    let resolveLogin: ((user: SignInResult) => void) | undefined
    mockedSignIn.mockImplementation(
      () =>
        new Promise<SignInResult>((resolve) => {
          resolveLogin = resolve
        })
    )
    render(<LoginButton />)

    await user.click(screen.getByRole('button', { name: 'Log in' }))
    await user.type(screen.getByLabelText('Email'), 'runner@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    const form = screen.getByRole('form', { name: 'Existing account login' })
    await user.dblClick(within(form).getByRole('button', { name: 'Log in' }))

    expect(mockedSignIn).toHaveBeenCalledTimes(1)
    expect(mockedSignIn).toHaveBeenCalledWith(
      'runner@example.com',
      'correct-password'
    )
    expect(form).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled()

    resolveLogin?.({ uid: 'runner-id' } as SignInResult)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes with Escape and restores focus to the login trigger', async () => {
    const user = userEvent.setup()
    render(<LoginButton />)

    const loginButton = screen.getByRole('button', { name: 'Log in' })
    await user.click(loginButton)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(loginButton).toHaveFocus())
  })

  it('requests a reset and shows an account-safe success message', async () => {
    const user = userEvent.setup()
    mockedRequestPasswordReset.mockResolvedValue()
    render(<LoginButton />)

    await user.click(screen.getByRole('button', { name: 'Log in' }))
    await user.type(screen.getByLabelText('Email'), ' runner@example.com ')
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))

    expect(
      screen.getByRole('dialog', { name: 'Reset your password' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(mockedRequestPasswordReset).toHaveBeenCalledWith(
      'runner@example.com'
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account exists for that email address, a password reset link will arrive shortly.'
    )
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('rejects an invalid reset email before contacting Firebase', async () => {
    const user = userEvent.setup()
    render(<LoginButton />)

    await user.click(screen.getByRole('button', { name: 'Log in' }))
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a valid email address.'
    )
    expect(screen.getByLabelText('Email')).toHaveFocus()
    expect(mockedRequestPasswordReset).not.toHaveBeenCalled()
  })

  it('shows a mapped reset failure without exposing Firebase details', async () => {
    const user = userEvent.setup()
    mockedRequestPasswordReset.mockRejectedValue(
      new Error(
        'We could not reach Marathoner. Check your connection and try again.'
      )
    )
    render(<LoginButton />)

    await user.click(screen.getByRole('button', { name: 'Log in' }))
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await user.type(screen.getByLabelText('Email'), 'runner@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not reach Marathoner. Check your connection and try again.'
    )
    expect(screen.queryByText(/Firebase/)).not.toBeInTheDocument()
  })

  it('prevents duplicate reset requests while one is pending', async () => {
    const user = userEvent.setup()
    let resolveRequest: (() => void) | undefined
    mockedRequestPasswordReset.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve
        })
    )
    render(<LoginButton />)

    await user.click(screen.getByRole('button', { name: 'Log in' }))
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await user.type(screen.getByLabelText('Email'), 'runner@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    const pendingButton = screen.getByRole('button', { name: 'Sending...' })
    expect(pendingButton).toBeDisabled()
    await user.click(pendingButton)
    expect(mockedRequestPasswordReset).toHaveBeenCalledTimes(1)

    resolveRequest?.()
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account exists for that email address'
    )
  })
})
