import { FirebaseError } from 'firebase/app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const firebaseAuth = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('firebase/auth', () => firebaseAuth)
vi.mock('./firebaseClient', () => ({ auth: { name: 'test-auth' } }))

import {
  AuthenticationError,
  requestPasswordReset,
  signIn,
  toAuthenticationError,
} from './authService'

describe('authentication error mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['auth/invalid-email', 'invalid_email', 'Enter a valid email address.'],
    [
      'auth/weak-password',
      'weak_password',
      'Choose a stronger password that meets the password requirements.',
    ],
    [
      'auth/password-does-not-meet-requirements',
      'weak_password',
      'Choose a stronger password that meets the password requirements.',
    ],
    [
      'auth/email-already-in-use',
      'email_in_use',
      'An account already uses this email address. Try logging in instead.',
    ],
    [
      'auth/invalid-credential',
      'invalid_credentials',
      'The email or password is incorrect.',
    ],
    [
      'auth/network-request-failed',
      'network_unavailable',
      'We could not reach Marathoner. Check your connection and try again.',
    ],
  ])(
    'maps %s without exposing its Firebase message',
    (firebaseCode, code, message) => {
      const rawError = new FirebaseError(firebaseCode, 'Firebase implementation detail')

      expect(toAuthenticationError(rawError)).toMatchObject({
        name: 'AuthenticationError',
        code,
        firebaseCode,
        message,
        cause: rawError,
      })
    },
  )

  it('uses a safe fallback for an unexpected failure', () => {
    const rawError = new Error('private implementation detail')

    expect(toAuthenticationError(rawError)).toMatchObject({
      code: 'unknown',
      message: 'We could not complete that request. Please try again.',
      cause: rawError,
    })
  })

  it('preserves an already mapped authentication error', () => {
    const mappedError = new AuthenticationError('too_many_requests')

    expect(toAuthenticationError(mappedError)).toBe(mappedError)
  })

  it('maps a rejected Firebase sign-in at the service boundary', async () => {
    const rawError = new FirebaseError(
      'auth/invalid-credential',
      'Firebase implementation detail',
    )
    firebaseAuth.signInWithEmailAndPassword.mockRejectedValue(rawError)

    await expect(signIn('runner@example.com', 'incorrect')).rejects.toMatchObject({
      name: 'AuthenticationError',
      code: 'invalid_credentials',
      firebaseCode: 'auth/invalid-credential',
      message: 'The email or password is incorrect.',
      cause: rawError,
    })
  })

  it('requests a password-reset email through Firebase', async () => {
    firebaseAuth.sendPasswordResetEmail.mockResolvedValue(undefined)

    await requestPasswordReset('runner@example.com')

    expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith(
      { name: 'test-auth' },
      'runner@example.com',
    )
  })

  it('does not reveal a missing password-reset account', async () => {
    firebaseAuth.sendPasswordResetEmail.mockRejectedValue(
      new FirebaseError('auth/user-not-found', 'Firebase implementation detail'),
    )

    await expect(
      requestPasswordReset('missing@example.com'),
    ).resolves.toBeUndefined()
  })

  it('maps an actionable password-reset failure', async () => {
    const rawError = new FirebaseError(
      'auth/network-request-failed',
      'Firebase implementation detail',
    )
    firebaseAuth.sendPasswordResetEmail.mockRejectedValue(rawError)

    await expect(
      requestPasswordReset('runner@example.com'),
    ).rejects.toMatchObject({
      code: 'network_unavailable',
      message:
        'We could not reach Marathoner. Check your connection and try again.',
      cause: rawError,
    })
  })
})
