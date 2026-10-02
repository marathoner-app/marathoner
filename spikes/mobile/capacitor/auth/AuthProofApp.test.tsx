import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../../../../src/auth/AuthContext'
import AuthProofApp from './AuthProofApp'

vi.mock('../../../../src/services/authService', () => ({
  signIn: vi.fn(),
}))

function renderProof(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <AuthProofApp />
    </AuthContext.Provider>,
  )
}

describe('Capacitor iOS authentication proof', () => {
  it('shows a loading state until Firebase resolves the session', () => {
    renderProof({ status: 'loading', user: null, logout: vi.fn() })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading your session...',
    )
    expect(
      screen.queryByRole('button', { name: 'Log in' }),
    ).not.toBeInTheDocument()
  })

  it('shows existing-account login only when signed out', () => {
    renderProof({ status: 'signedOut', user: null, logout: vi.fn() })

    expect(
      screen.getByText('Signed out. Use an existing development account.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('shows the account and logs out when signed in', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderProof({
      status: 'signedIn',
      user: { uid: 'runner-1', email: 'runner@example.com' },
      logout,
    })

    expect(screen.getByText('runner@example.com')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Log in' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(logout).toHaveBeenCalledOnce()
  })

  it('shows a calm error when logout fails', async () => {
    const user = userEvent.setup()

    renderProof({
      status: 'signedIn',
      user: { uid: 'runner-1', email: 'runner@example.com' },
      logout: vi.fn().mockRejectedValue(new Error('Network unavailable')),
    })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't log you out. Please try again.",
    )
  })
})
