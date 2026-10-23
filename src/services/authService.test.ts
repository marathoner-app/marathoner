import { FirebaseError } from 'firebase/app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const firebaseAuth = vi.hoisted(() => ({
  EmailAuthProvider: { credential: vi.fn() },
  getIdToken: vi.fn(),
  onAuthStateChanged: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

const testAuth = vi.hoisted(() => ({
  name: 'test-auth',
  currentUser: {
    uid: 'runner-1',
    email: 'runner@example.com' as string | null,
  },
}))

vi.mock('firebase/auth', () => firebaseAuth)
vi.mock('./firebaseClient', () => ({ getFirebaseAuth: () => testAuth }))

import {
  AuthenticationError,
  logOut,
  reauthenticateWithPassword,
  requiresNewSignIn,
  requestPasswordReset,
  signIn,
  subscribeToAuthState,
  toAuthenticationError,
} from './authService'

describe('authentication error mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })
    testAuth.currentUser.email = 'runner@example.com'
    firebaseAuth.getIdToken.mockResolvedValue('valid-token')
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

  it.each([
    'auth/invalid-user-token',
    'auth/user-token-expired',
  ])('maps %s to a new-sign-in requirement', (firebaseCode) => {
    const error = toAuthenticationError(
      new FirebaseError(firebaseCode, 'Firebase implementation detail'),
    )

    expect(error).toMatchObject({
      code: 'session_expired',
      message: 'Your session has ended. Log in again.',
    })
    expect(requiresNewSignIn(error)).toBe(true)
  })

  it('treats a disabled account as requiring a new sign-in', () => {
    expect(requiresNewSignIn(new AuthenticationError('account_disabled'))).toBe(
      true,
    )
    expect(requiresNewSignIn(new AuthenticationError('network_unavailable'))).toBe(
      false,
    )
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

  it('reauthenticates with the current password and force-refreshes the token', async () => {
    const credential = { providerId: 'password' }
    const refreshedUser = { uid: 'runner-1' }
    firebaseAuth.EmailAuthProvider.credential.mockReturnValue(credential)
    firebaseAuth.reauthenticateWithCredential.mockResolvedValue({
      user: refreshedUser,
    })
    firebaseAuth.getIdToken.mockResolvedValue('fresh-token')

    await reauthenticateWithPassword('correct horse battery staple')

    expect(firebaseAuth.EmailAuthProvider.credential).toHaveBeenCalledWith(
      'runner@example.com',
      'correct horse battery staple',
    )
    expect(firebaseAuth.reauthenticateWithCredential).toHaveBeenCalledWith(
      testAuth.currentUser,
      credential,
    )
    expect(firebaseAuth.getIdToken).toHaveBeenCalledWith(refreshedUser, true)
  })

  it('does not attempt password reauthentication without a current email user', async () => {
    testAuth.currentUser.email = null

    await expect(
      reauthenticateWithPassword('not-used'),
    ).rejects.toMatchObject({ code: 'unknown' })
    expect(firebaseAuth.reauthenticateWithCredential).not.toHaveBeenCalled()
  })

  it('requests a password-reset email through Firebase', async () => {
    firebaseAuth.sendPasswordResetEmail.mockResolvedValue(undefined)

    await requestPasswordReset('runner@example.com')

    expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith(
      testAuth,
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

  it('validates a restored user before publishing the session', async () => {
    const onChange = vi.fn()
    const onError = vi.fn()
    const unsubscribe = vi.fn()
    let receiveUser: ((user: typeof testAuth.currentUser | null) => void) | undefined
    firebaseAuth.onAuthStateChanged.mockImplementation(
      (_auth, onUser: (user: typeof testAuth.currentUser | null) => void) => {
        receiveUser = onUser
        return unsubscribe
      },
    )

    const stop = subscribeToAuthState(onChange, onError)
    receiveUser?.(testAuth.currentUser)

    expect(onChange).not.toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        uid: 'runner-1',
        email: 'runner@example.com',
      }),
    )
    expect(firebaseAuth.getIdToken).toHaveBeenCalledWith(testAuth.currentUser, true)
    expect(onError).not.toHaveBeenCalled()

    stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('uses the cached token when the device is known to be offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    })
    const onChange = vi.fn()
    let receiveUser: ((user: typeof testAuth.currentUser | null) => void) | undefined
    firebaseAuth.onAuthStateChanged.mockImplementation(
      (_auth, onUser: (user: typeof testAuth.currentUser | null) => void) => {
        receiveUser = onUser
        return vi.fn()
      },
    )

    subscribeToAuthState(onChange)
    receiveUser?.(testAuth.currentUser)

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    expect(firebaseAuth.getIdToken).toHaveBeenCalledWith(testAuth.currentUser, false)
  })

  it('explains an unexpected signed-out startup after a validated session', async () => {
    const firstOnChange = vi.fn()
    let receiveFirstUser:
      | ((user: typeof testAuth.currentUser | null) => void)
      | undefined
    firebaseAuth.onAuthStateChanged.mockImplementationOnce(
      (_auth, onUser: (user: typeof testAuth.currentUser | null) => void) => {
        receiveFirstUser = onUser
        return vi.fn()
      },
    )

    subscribeToAuthState(firstOnChange)
    receiveFirstUser?.(testAuth.currentUser)
    await vi.waitFor(() => expect(firstOnChange).toHaveBeenCalledOnce())

    const secondOnChange = vi.fn()
    const secondOnError = vi.fn()
    let receiveSecondUser:
      | ((user: typeof testAuth.currentUser | null) => void)
      | undefined
    firebaseAuth.onAuthStateChanged.mockImplementationOnce(
      (_auth, onUser: (user: typeof testAuth.currentUser | null) => void) => {
        receiveSecondUser = onUser
        return vi.fn()
      },
    )

    subscribeToAuthState(secondOnChange, secondOnError)
    receiveSecondUser?.(null)

    expect(secondOnError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'session_expired',
        message: 'Your session has ended. Log in again.',
      }),
    )
    expect(secondOnChange).not.toHaveBeenCalled()
  })

  it('does not report an expected explicit logout as an expired session', async () => {
    const firstOnChange = vi.fn()
    let receiveFirstUser:
      | ((user: typeof testAuth.currentUser | null) => void)
      | undefined
    firebaseAuth.onAuthStateChanged.mockImplementationOnce(
      (_auth, onUser: (user: typeof testAuth.currentUser | null) => void) => {
        receiveFirstUser = onUser
        return vi.fn()
      },
    )
    subscribeToAuthState(firstOnChange)
    receiveFirstUser?.(testAuth.currentUser)
    await vi.waitFor(() => expect(firstOnChange).toHaveBeenCalledOnce())

    firebaseAuth.signOut.mockResolvedValue(undefined)
    await logOut()

    const onChange = vi.fn()
    const onError = vi.fn()
    let receiveSignedOutUser:
      | ((user: typeof testAuth.currentUser | null) => void)
      | undefined
    firebaseAuth.onAuthStateChanged.mockImplementationOnce(
      (_auth, onUser: (user: typeof testAuth.currentUser | null) => void) => {
        receiveSignedOutUser = onUser
        return vi.fn()
      },
    )
    subscribeToAuthState(onChange, onError)
    receiveSignedOutUser?.(null)

    expect(onChange).toHaveBeenCalledWith(null)
    expect(onError).not.toHaveBeenCalled()
  })

  it.each([
    ['auth/user-token-expired', 'session_expired'],
    ['auth/invalid-user-token', 'session_expired'],
    ['auth/user-not-found', 'session_expired'],
    ['auth/user-disabled', 'account_disabled'],
    ['auth/network-request-failed', 'network_unavailable'],
  ])(
    'maps restored-session failure %s without publishing participant state',
    async (firebaseCode, expectedCode) => {
      const onChange = vi.fn()
      const onError = vi.fn()
      let receiveUser:
        | ((user: typeof testAuth.currentUser | null) => void)
        | undefined
      firebaseAuth.getIdToken.mockRejectedValue(
        new FirebaseError(firebaseCode, 'Firebase implementation detail'),
      )
      firebaseAuth.onAuthStateChanged.mockImplementation(
        (_auth, onUser: (user: typeof testAuth.currentUser | null) => void) => {
          receiveUser = onUser
          return vi.fn()
        },
      )

      subscribeToAuthState(onChange, onError)
      receiveUser?.(testAuth.currentUser)

      await vi.waitFor(() =>
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({ code: expectedCode }),
        ),
      )
      expect(onChange).not.toHaveBeenCalled()
    },
  )

  it('ignores a token validation result superseded by sign-out', async () => {
    const onChange = vi.fn()
    let receiveUser: ((user: typeof testAuth.currentUser | null) => void) | undefined
    let resolveToken: ((token: string) => void) | undefined
    firebaseAuth.getIdToken.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveToken = resolve
        }),
    )
    firebaseAuth.onAuthStateChanged.mockImplementation(
      (_auth, onUser: (user: typeof testAuth.currentUser | null) => void) => {
        receiveUser = onUser
        return vi.fn()
      },
    )

    subscribeToAuthState(onChange)
    receiveUser?.(testAuth.currentUser)
    receiveUser?.(null)
    resolveToken?.('late-token')
    await Promise.resolve()

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('ignores a token validation failure superseded by a newer user', async () => {
    const onChange = vi.fn()
    const onError = vi.fn()
    const replacementUser = {
      uid: 'runner-2',
      email: 'runner-2@example.com',
    }
    let receiveUser:
      | ((user: typeof testAuth.currentUser | null) => void)
      | undefined
    let rejectFirstValidation: ((error: unknown) => void) | undefined
    firebaseAuth.getIdToken
      .mockImplementationOnce(
        () =>
          new Promise<string>((_resolve, reject) => {
            rejectFirstValidation = reject
          }),
      )
      .mockResolvedValueOnce('replacement-token')
    firebaseAuth.onAuthStateChanged.mockImplementation(
      (_auth, onUser: (user: typeof testAuth.currentUser | null) => void) => {
        receiveUser = onUser
        return vi.fn()
      },
    )

    subscribeToAuthState(onChange, onError)
    receiveUser?.(testAuth.currentUser)
    receiveUser?.(replacementUser)
    rejectFirstValidation?.(
      new FirebaseError('auth/user-token-expired', 'stale failure'),
    )

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        uid: 'runner-2',
        email: 'runner-2@example.com',
      }),
    )
    expect(onError).not.toHaveBeenCalled()
  })
})
