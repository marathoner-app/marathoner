import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginButton from './LoginButton'
import { signIn } from '../services/authService'

vi.mock('../services/authService', () => ({
  signIn: vi.fn()
}))

const mockedSignIn = vi.mocked(signIn)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('authentication forms', () => {
  it('shows a rejected login attempt without contacting Firebase', async () => {
    const user = userEvent.setup()
    mockedSignIn.mockRejectedValue(new Error('Invalid credentials'))
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

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
    expect(mockedSignIn).toHaveBeenCalledWith(
      'runner@example.com',
      'bad-password'
    )
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
})
