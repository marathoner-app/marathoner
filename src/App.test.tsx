import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findBetaBlockingAccessibilityViolations } from './test/accessibility'
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import App from './App'
import AuthProvider, { authSessionTimeoutMs } from './auth/AuthProvider'
import { staleNoticeDelayMs } from './training/useDelayedStaleNotice'
import {
  createDateOnly,
  createDistanceMeters,
  createIanaTimeZone,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  type PlannedWorkout,
  type TrainingPlan,
  type UserProfile
} from './domain/training'
import {
  AuthenticationError,
  logOut,
  subscribeToAuthState,
  type AuthUser
} from './services/authService'
import {
  reauthenticateForAccountDeletion,
  resolveAccountDeletionRequest,
  submitAccountDeletionRequest
} from './services/accountDeletionService'
import type { AccountDeletionRequestAcceptedResult } from './domain/materialCommands/contract'

type MockMotionProps = {
  animate?: unknown
  children?: ReactNode
  exit?: unknown
  initial?: unknown
  transition?: { duration?: number }
}

vi.mock('framer-motion', async () => {
  const { createElement, forwardRef } = await import('react')
  const motionElement = (element: 'button' | 'div' | 'main' | 'section') =>
    forwardRef<
      HTMLElement,
      MockMotionProps & HTMLAttributes<HTMLElement>
    >(function MotionElement(
      { animate, children, exit, initial, transition, ...props },
      ref
    ) {
      void animate
      void exit
      void initial
      return createElement(
        element,
        { ...props, 'data-motion-duration': transition?.duration, ref },
        children
      )
    })

  return {
    useReducedMotion: () => true,
    motion: {
      button: motionElement('button'),
      div: motionElement('div'),
      main: motionElement('main'),
      section: motionElement('section')
    }
  }
})

vi.mock('./services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/authService')>()

  return {
    ...actual,
    logOut: vi.fn(),
    reauthenticateWithPassword: vi.fn(),
    signIn: vi.fn(),
    subscribeToAuthState: vi.fn()
  }
})

vi.mock('./services/accountDeletionService', () => ({
  reauthenticateForAccountDeletion: vi.fn(),
  resolveAccountDeletionRequest: vi.fn(),
  submitAccountDeletionRequest: vi.fn()
}))

vi.mock('./training/TrainingDataProvider', () => ({
  default: function MockTrainingDataProvider({
    children
  }: {
    children: ReactNode
  }) {
    useEffect(
      () => () => {
        sessionLifecycleEvents.push('training-provider-unmounted')
      },
      []
    )

    return <div data-testid="training-data-provider">{children}</div>
  }
}))

vi.mock('./recommendations/RecommendationEvidenceProvider', () => ({
  default: function MockRecommendationEvidenceProvider({
    ownerId,
    children
  }: {
    ownerId: string
    children: ReactNode
  }) {
    const instanceId = useRef(0)
    if (instanceId.current === 0) {
      recommendationProviderInstanceSequence += 1
      instanceId.current = recommendationProviderInstanceSequence
    }

    return (
      <div
        data-testid="recommendation-evidence-provider"
        data-owner-id={ownerId}
        data-instance-id={instanceId.current}
      >
        {children}
      </div>
    )
  }
}))

vi.mock('./components/RecommendationDecisionSurface', () => ({
  default: function MockRecommendationDecisionSurface() {
    return <div data-testid="recommendation-decision-surface" />
  }
}))

const trainingMock = vi.hoisted(() => ({
  status: 'current' as 'current' | 'stale',
  staleReasons: [] as ('cache_only' | 'pending_writes')[],
  profile: null as object | null,
  activePlanState: null as object | null,
  plans: [] as object[],
  workouts: [] as object[],
  saveProfile: vi.fn(),
  reload: vi.fn()
}))

vi.mock('./training/useTrainingData', () => ({
  useTrainingData: () => ({
    status: trainingMock.status,
    error: null,
    profile: trainingMock.profile,
    activePlanState: trainingMock.activePlanState,
    plans: trainingMock.plans,
    workouts: trainingMock.workouts,
    runs: [],
    shoes: [],
    canWrite: trainingMock.status === 'current',
    staleReasons:
      trainingMock.status === 'stale' ? trainingMock.staleReasons : [],
    lastServerConfirmedAt: null,
    reload: trainingMock.reload,
    saveProfile: trainingMock.saveProfile,
    createShoe: vi.fn(),
    retireShoe: vi.fn(),
    createRun: vi.fn(),
    updateRun: vi.fn(),
    deleteRun: vi.fn()
  })
}))

const mockedLogOut = vi.mocked(logOut)
const mockedSubscribeToAuthState = vi.mocked(subscribeToAuthState)
const mockedDeletionReauthentication = vi.mocked(
  reauthenticateForAccountDeletion
)
const mockedDeletionSubmission = vi.mocked(submitAccountDeletionRequest)
const mockedDeletionResolution = vi.mocked(resolveAccountDeletionRequest)
const signedInUser: AuthUser = {
  uid: 'runner-1',
  email: 'runner@example.com'
}
const timestamp = createUtcDateTime('2026-10-05T12:00:00Z')
const completeRunnerProfile: UserProfile = {
  id: createUserId('runner-1'),
  preferredDistanceUnit: 'mile',
  timeZone: createIanaTimeZone('America/Los_Angeles'),
  experienceLevel: 'consistent',
  consistentRunningWeeks: 12,
  targetRace: { kind: 'date', date: createDateOnly('2027-05-02') },
  currentWeeklyDistance: createDistanceMeters(32_187),
  currentRunningFrequencyDaysPerWeek: 4,
  longestRecentRunDistance: createDistanceMeters(16_093),
  availableTrainingDays: ['tuesday', 'thursday', 'saturday', 'sunday'],
  preferredLongRunDay: 'sunday',
  completionGoal: 'complete_first_marathon',
  createdAt: timestamp,
  updatedAt: timestamp
}
const activePlan: TrainingPlan = {
  id: createTrainingPlanId('plan-1'),
  userId: createUserId('runner-1'),
  name: 'First Marathon Journey',
  startDate: createDateOnly('2030-01-01'),
  targetRaceDate: createDateOnly('2030-05-05'),
  status: 'active',
  createdAt: timestamp,
  updatedAt: timestamp
}
const upcomingWorkout: PlannedWorkout = {
  id: createPlannedWorkoutId('workout-1'),
  userId: createUserId('runner-1'),
  planId: activePlan.id,
  scheduledDate: createDateOnly('2030-01-02'),
  phase: 'base_building',
  status: 'planned',
  kind: 'run',
  purpose: 'easy',
  targetDistance: createDistanceMeters(5_000),
  createdAt: timestamp,
  updatedAt: timestamp
}
const acceptedDeletion: AccountDeletionRequestAcceptedResult = {
  status: 'accepted',
  commandId: 'account-delete-11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
  requestedAt: '2026-10-06T12:00:00.000Z',
  completionDueAt: '2026-10-13T12:00:00.000Z',
  accessLocked: true
}

let emitAuthState: (user: AuthUser | null) => void
let emitAuthError: (error: Error) => void
let unsubscribe: () => void
type AuthSubscription = {
  onChange: (user: AuthUser | null) => void
  onError: (error: Error) => void
}
let authSubscriptions: AuthSubscription[]
let sessionLifecycleEvents: string[]
let recommendationProviderInstanceSequence: number

const sectionTransitions = [
  ['Plan', 'Plan Your Workouts'],
  ['Track', 'Track Your Runs'],
  ['Analyze', 'Analyze Your Progress']
] as const

function renderApp() {
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}

function renderSignedInApp() {
  const view = renderApp()

  act(() => {
    emitAuthState(signedInUser)
  })

  return view
}

beforeEach(() => {
  vi.clearAllMocks()
  authSubscriptions = []
  sessionLifecycleEvents = []
  recommendationProviderInstanceSequence = 0
  trainingMock.status = 'current'
  trainingMock.staleReasons = []
  trainingMock.profile = completeRunnerProfile
  trainingMock.plans = []
  trainingMock.workouts = []
  trainingMock.saveProfile.mockResolvedValue(completeRunnerProfile)
  unsubscribe = vi.fn()
  mockedLogOut.mockResolvedValue()
  mockedDeletionReauthentication.mockResolvedValue()
  mockedDeletionSubmission.mockResolvedValue(acceptedDeletion)
  mockedDeletionResolution.mockResolvedValue(acceptedDeletion)
  mockedSubscribeToAuthState.mockImplementation((onChange, onError) => {
    emitAuthState = onChange
    emitAuthError = onError ?? (() => undefined)
    authSubscriptions.push({
      onChange,
      onError: onError ?? (() => undefined)
    })
    return unsubscribe
  })
})

describe('App authentication state', () => {
  it('shows loading while Firebase resolves the session and cleans up its listener', () => {
    const { unmount } = renderApp()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading your session...'
    )
    expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()

    unmount()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('closes registration and explains the public prototype before login', () => {
    renderApp()

    act(() => {
      emitAuthState(null)
    })

    expect(
      screen.getByRole('heading', { name: 'New account registration is closed.' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('public-landing-page')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign up/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Access' })).toHaveAttribute(
      'href',
      '#access-status'
    )
    expect(screen.getByRole('link', { name: 'Privacy and data' })).toHaveAttribute(
      'href',
      '#privacy-data-use'
    )
    expect(
      screen.getByRole('link', { name: 'Support and deletion' })
    ).toHaveAttribute('href', '#support-requests')
    expect(
      screen.getByRole('link', { name: 'email Marathoner support' })
    ).toHaveAttribute(
      'href',
      'mailto:kevin@marathonerapp.com?subject=Marathoner%20account%20support%20request'
    )
    expect(
      screen.getByText(/training methodology and safety guidance have not yet/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Training sections' })
    ).not.toBeInTheDocument()
  })

  it('updates the UI when Firebase reports a signed-in session', () => {
    renderApp()

    act(() => {
      emitAuthState(null)
    })
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()

    act(() => {
      emitAuthState(signedInUser)
    })

    expect(screen.getByText('Signed in as runner@example.com')).toBeInTheDocument()
    expect(screen.queryByTestId('public-landing-page')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Training sections' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Log in' })
    ).not.toBeInTheDocument()
  })

  it('scopes the recommendation path to the current signed-in owner', () => {
    renderApp()

    act(() => {
      emitAuthState(null)
    })
    expect(
      screen.queryByTestId('recommendation-evidence-provider')
    ).not.toBeInTheDocument()

    act(() => {
      emitAuthState(signedInUser)
    })
    const firstProvider = screen.getByTestId(
      'recommendation-evidence-provider'
    )
    expect(firstProvider).toHaveAttribute('data-owner-id', 'runner-1')
    expect(firstProvider).toHaveAttribute('data-instance-id', '1')
    expect(
      screen.getByTestId('recommendation-decision-surface')
    ).toBeInTheDocument()

    act(() => {
      emitAuthState({ uid: 'runner-2', email: 'second@example.com' })
    })
    const secondProvider = screen.getByTestId(
      'recommendation-evidence-provider'
    )
    expect(secondProvider).toHaveAttribute('data-owner-id', 'runner-2')
    expect(secondProvider).toHaveAttribute('data-instance-id', '2')

    act(() => {
      emitAuthState(null)
    })
    expect(
      screen.queryByTestId('recommendation-evidence-provider')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('recommendation-decision-surface')
    ).not.toBeInTheDocument()
  })

  it('returns to signed-out UI after logout', async () => {
    const user = userEvent.setup()
    renderSignedInApp()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(mockedLogOut).toHaveBeenCalledOnce()

    act(() => {
      emitAuthState(null)
    })

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Training sections' })
    ).not.toBeInTheDocument()
  })

  it('hides participant state while logout is awaiting Firebase', async () => {
    const user = userEvent.setup()
    let resolveLogout: (() => void) | undefined
    mockedLogOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve
        })
    )
    renderSignedInApp()

    expect(screen.getByTestId('training-data-provider')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('status')).toHaveTextContent('Signing out...')
    expect(screen.queryByTestId('training-data-provider')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Training sections' })
    ).not.toBeInTheDocument()

    act(() => {
      resolveLogout?.()
      emitAuthState(null)
    })

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('unmounts training state before ending the Firebase session', async () => {
    const user = userEvent.setup()
    mockedLogOut.mockImplementation(async () => {
      sessionLifecycleEvents.push('firebase-sign-out')
    })
    renderSignedInApp()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() =>
      expect(sessionLifecycleEvents).toEqual([
        'training-provider-unmounted',
        'firebase-sign-out'
      ])
    )
  })

  it('shows a calm error when logout fails', async () => {
    const user = userEvent.setup()
    mockedLogOut.mockRejectedValue(new Error('Network unavailable'))
    renderSignedInApp()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't log you out. Please try again."
    )
    expect(screen.getByTestId('training-data-provider')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Training sections' })
    ).toBeInTheDocument()
  })

  it('opens account settings and restores focus when the dialog closes', async () => {
    const user = userEvent.setup()
    renderSignedInApp()

    const settingsButton = screen.getByRole('button', {
      name: 'Account settings'
    })
    await user.click(settingsButton)

    expect(
      screen.getByRole('dialog', { name: 'Account settings' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Account settings' })
    ).toHaveFocus()

    await user.click(
      screen.getByRole('button', { name: 'Close account settings' })
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(settingsButton).toHaveFocus()
  })

  it('hides and unmounts participant state before signing out an accepted deletion', async () => {
    const user = userEvent.setup()
    renderSignedInApp()

    expect(screen.getByTestId('training-data-provider')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Account settings' }))
    await user.type(
      screen.getByLabelText('Re-enter the password for runner@example.com'),
      'private-password'
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Permanently delete my Marathoner account'
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Your deletion request is pending'
      })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('training-data-provider')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Training sections' })
    ).not.toBeInTheDocument()
    expect(mockedLogOut).toHaveBeenCalledOnce()

    act(() => {
      emitAuthState(null)
    })

    expect(
      screen.getByRole('button', { name: 'Return to sign in' })
    ).toBeInTheDocument()
  })

  it('preserves an ambiguous command when account settings is closed and reopened', async () => {
    const user = userEvent.setup()
    const unknownResult = (commandId: string) => ({
      status: 'outcome_unknown' as const,
      commandId,
      code: 'resolve-by-command-id' as const,
      message: 'Resolve the original command.'
    })
    mockedDeletionSubmission.mockImplementation(async (commandId) =>
      unknownResult(commandId)
    )
    mockedDeletionResolution.mockImplementation(async (commandId) =>
      unknownResult(commandId)
    )
    renderSignedInApp()

    await user.click(screen.getByRole('button', { name: 'Account settings' }))
    await user.type(
      screen.getByLabelText('Re-enter the password for runner@example.com'),
      'private-password'
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Permanently delete my Marathoner account'
      })
    )

    expect(
      await screen.findByRole('button', { name: 'Check the original request' })
    ).toBeInTheDocument()
    const originalCommandId = mockedDeletionSubmission.mock.calls[0][0]
    await user.click(
      screen.getByRole('button', { name: 'Close account settings' })
    )
    await user.click(screen.getByRole('button', { name: 'Account settings' }))

    expect(
      screen.getByRole('button', { name: 'Check the original request' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Permanently delete my Marathoner account'
      })
    ).not.toBeInTheDocument()
    expect(mockedDeletionSubmission).toHaveBeenCalledOnce()

    await user.click(
      screen.getByRole('button', { name: 'Check the original request' })
    )

    await waitFor(() =>
      expect(mockedDeletionResolution).toHaveBeenLastCalledWith(
        originalCommandId
      )
    )
  })

  it('shows a retryable error when authentication restoration fails', () => {
    renderApp()

    act(() => {
      emitAuthError(new Error('Unable to restore session'))
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't restore your session. Check your connection and try again."
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('Loading your session...')).not.toBeInTheDocument()
  })

  it.each(['session_expired', 'account_disabled'] as const)(
    'returns %s sessions to signed-out UI with a recovery notice and no participant data',
    (errorCode) => {
      renderSignedInApp()

      act(() => {
        emitAuthError(new AuthenticationError(errorCode))
      })

      act(() => {
        emitAuthState(null)
      })

      expect(mockedLogOut).toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(
        errorCode === 'session_expired'
          ? 'Your session has ended. Log in again.'
          : 'This account is disabled. Contact support if you need help.'
      )
      expect(
        screen.queryByTestId('training-data-provider')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('navigation', { name: 'Training sections' })
      ).not.toBeInTheDocument()
    }
  )

  it('times out a stalled authentication subscription and retries it', () => {
    vi.useFakeTimers()

    try {
      renderApp()

      act(() => {
        vi.advanceTimersByTime(authSessionTimeoutMs)
      })

      expect(screen.getByRole('alert')).toHaveTextContent(
        "We couldn't restore your session. Check your connection and try again."
      )

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

      expect(mockedSubscribeToAuthState).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('status')).toHaveTextContent(
        'Loading your session...'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores a late user callback from a replaced authentication subscription', () => {
    renderApp()
    const replacedSubscription = authSubscriptions[0]

    act(() => {
      replacedSubscription.onError(new Error('Unable to restore session'))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    const currentSubscription = authSubscriptions[1]
    act(() => {
      currentSubscription.onChange(signedInUser)
      replacedSubscription.onChange({
        uid: 'old-runner',
        email: 'old-runner@example.com'
      })
    })

    expect(screen.getByText('Signed in as runner@example.com')).toBeInTheDocument()
    expect(screen.queryByText(/old-runner@example.com/i)).not.toBeInTheDocument()
  })

  it('ignores a late error callback from a replaced authentication subscription', () => {
    renderApp()
    const replacedSubscription = authSubscriptions[0]

    act(() => {
      replacedSubscription.onError(new Error('Unable to restore session'))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    const currentSubscription = authSubscriptions[1]
    act(() => {
      currentSubscription.onChange(signedInUser)
      replacedSubscription.onError(new Error('Stale listener failure'))
    })

    expect(screen.getByText('Signed in as runner@example.com')).toBeInTheDocument()
    expect(
      screen.queryByText(/we couldn't restore your session/i)
    ).not.toBeInTheDocument()
  })
})

describe('App training sections', () => {
  it('has no beta-blocking accessibility violations across the signed-in shell', async () => {
    const user = userEvent.setup()
    renderSignedInApp()

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([])

    for (const [sectionName, sectionHeading] of sectionTransitions) {
      await user.click(screen.getByRole('button', { name: sectionName }))

      expect(
        screen.getByRole('region', { name: sectionHeading })
      ).toBeInTheDocument()
      expect(await findBetaBlockingAccessibilityViolations()).toEqual([])

      await user.click(
        screen.getByRole('button', {
          name: `Close ${sectionHeading} panel`
        })
      )
    }
  })

  it('opens incomplete runner setup on entry and lets the runner resume later', async () => {
    const user = userEvent.setup()
    trainingMock.profile = null
    renderSignedInApp()

    expect(
      screen.getByRole('dialog', { name: 'Tell us where you are starting' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Training sections' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue later' }))

    const resumeSetup = screen.getByRole('button', {
      name: 'Resume runner setup'
    })
    await waitFor(() => expect(resumeSetup).toHaveFocus())
    expect(
      screen.getByRole('navigation', { name: 'Training sections' })
    ).toBeInTheDocument()

    await user.click(resumeSetup)

    expect(
      screen.getByRole('dialog', { name: 'Tell us where you are starting' })
    ).toBeInTheDocument()
  })

  it('keeps a legacy runner setup draft mounted while its profile write converges', async () => {
    const user = userEvent.setup()
    const legacyProfile = {
      ...completeRunnerProfile,
      consistentRunningWeeks: undefined
    }
    const updatedProfile = {
      ...completeRunnerProfile,
      consistentRunningWeeks: 12,
      updatedAt: createUtcDateTime('2026-10-28T20:00:00Z')
    }
    let resolveSave!: (profile: UserProfile) => void
    const pendingSave = new Promise<UserProfile>((resolve) => {
      resolveSave = resolve
    })
    trainingMock.profile = legacyProfile
    trainingMock.saveProfile.mockReturnValueOnce(pendingSave)
    const view = renderSignedInApp()

    await user.type(
      screen.getByLabelText(/How many consecutive weeks/i),
      '12'
    )
    await user.click(screen.getByRole('button', { name: 'Complete setup' }))

    trainingMock.status = 'stale'
    trainingMock.staleReasons = ['pending_writes']
    view.rerender(
      <AuthProvider>
        <App />
      </AuthProvider>
    )

    expect(
      screen.getByRole('dialog', { name: 'Tell us where you are starting' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/How many consecutive weeks/i)).toHaveValue(12)
    for (const savingButton of screen.getAllByRole('button', { name: 'Saving…' })) {
      expect(savingButton).toBeDisabled()
    }

    trainingMock.status = 'current'
    trainingMock.staleReasons = []
    trainingMock.profile = updatedProfile
    view.rerender(
      <AuthProvider>
        <App />
      </AuthProvider>
    )
    resolveSave(updatedProfile)

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Tell us where you are starting' })
      ).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole('button', { name: 'Edit runner profile' })
    ).toBeInTheDocument()
  })

  it('renders the signed-in training companion screen', () => {
    renderSignedInApp()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Marathoner.' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Welcome to your training companion')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Track' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument()
    for (const sectionName of ['Plan', 'Track', 'Analyze']) {
      const sectionTrigger = screen.getByRole('button', { name: sectionName })
      expect(sectionTrigger).not.toHaveAttribute('aria-expanded')
      expect(sectionTrigger).not.toHaveAttribute('aria-controls')
    }
  })

  it('returns focus to the runner profile trigger after canceling setup', async () => {
    const user = userEvent.setup()
    renderSignedInApp()

    const editProfile = screen.getByRole('button', {
      name: 'Edit runner profile'
    })
    await user.click(editProfile)
    expect(
      screen.getByRole('dialog', { name: 'Review your starting point' })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit runner profile' })
      ).toHaveFocus()
    )
  })

  it('keeps a reconnecting snapshot readable without flashing technical recovery UI', () => {
    vi.useFakeTimers()

    try {
      trainingMock.status = 'stale'
      trainingMock.staleReasons = ['cache_only']
      renderSignedInApp()

      expect(
        screen.queryByText(/Marathoner is reconnecting/i)
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Edit runner profile' })
      ).toBeDisabled()
      expect(
        screen.getByRole('navigation', { name: 'Training sections' })
      ).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(staleNoticeDelayMs)
      })

      expect(
        screen.getByText(/Marathoner is reconnecting/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/editing will resume automatically/i)
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /retry|check/i })).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Track' }))
      expect(document.querySelector('fieldset.training-read-only')).toBeDisabled()
      expect(
        screen.getByText(/Marathoner is reconnecting/i)
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('never presents pending listener metadata as a global user action', () => {
    vi.useFakeTimers()

    try {
      trainingMock.status = 'stale'
      trainingMock.staleReasons = ['pending_writes']
      renderSignedInApp()

      act(() => {
        vi.advanceTimersByTime(staleNoticeDelayMs * 2)
      })

      expect(
        screen.queryByText(/saving|server|snapshot|reconnecting/i)
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /retry|check/i })).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Track' }))
      expect(document.querySelector('fieldset.training-read-only')).toBeDisabled()
      expect(
        screen.queryByText(/saving|server|snapshot|reconnecting/i)
      ).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels the reconnecting notice when freshness returns in time', () => {
    vi.useFakeTimers()

    try {
      trainingMock.status = 'stale'
      trainingMock.staleReasons = ['cache_only']
      const view = renderSignedInApp()

      act(() => {
        vi.advanceTimersByTime(staleNoticeDelayMs - 1)
      })
      trainingMock.status = 'current'
      trainingMock.staleReasons = []
      view.rerender(
        <AuthProvider>
          <App />
        </AuthProvider>
      )
      act(() => {
        vi.advanceTimersByTime(1)
      })

      expect(
        screen.queryByText(/Marathoner is reconnecting/i)
      ).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens Plan from the persisted next-workout summary', async () => {
    const user = userEvent.setup()
    trainingMock.plans = [activePlan]
    trainingMock.workouts = [upcomingWorkout]
    renderSignedInApp()

    expect(
      screen.getByRole('heading', { name: 'Easy run' })
    ).toBeInTheDocument()
    expect(screen.getByText('3.1 mi')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open Plan' }))

    expect(
      screen.getByRole('region', { name: 'Plan Your Workouts' })
    ).toBeInTheDocument()
  })

  it.each(sectionTransitions)(
    'opens and closes the %s section',
    async (sectionName, sectionHeading) => {
      const user = userEvent.setup()
      renderSignedInApp()

      const sectionTrigger = screen.getByRole('button', { name: sectionName })
      await user.click(sectionTrigger)

      expect(
        screen.getByRole('heading', { level: 1, name: sectionHeading })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('region', { name: sectionHeading })
      ).toBeInTheDocument()
      const animatedElements = document.querySelectorAll(
        '[data-motion-duration]'
      )
      expect(animatedElements.length).toBeGreaterThan(0)
      for (const animatedElement of animatedElements) {
        expect(animatedElement).toHaveAttribute('data-motion-duration', '0')
      }
      expect(
        screen.queryByRole('heading', { level: 1, name: 'Marathoner.' })
      ).not.toBeInTheDocument()

      const closeButton = screen.getByRole('button', {
        name: `Close ${sectionHeading} panel`
      })
      expect(closeButton).toHaveFocus()
      await user.click(closeButton)

      expect(
        screen.getByRole('heading', { level: 1, name: 'Marathoner.' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { level: 1, name: sectionHeading })
      ).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: sectionName })).toHaveFocus()
    }
  )

  it('keeps training navigation available and marks the active section', async () => {
    const user = userEvent.setup()
    renderSignedInApp()

    await user.click(screen.getByRole('button', { name: 'Plan' }))

    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(
      screen.getByRole('region', { name: 'Plan Your Workouts' })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Track' }))

    expect(screen.getByRole('button', { name: 'Plan' })).not.toHaveAttribute(
      'aria-current'
    )
    expect(screen.getByRole('button', { name: 'Track' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(
      screen.queryByRole('region', { name: 'Plan Your Workouts' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Track Your Runs' })
    ).toBeInTheDocument()
  })

  it('opens and closes a section with the keyboard', async () => {
    const user = userEvent.setup()
    renderSignedInApp()

    const planTrigger = screen.getByRole('button', { name: 'Plan' })
    planTrigger.focus()

    await user.keyboard('{Enter}')

    expect(
      screen.getByRole('region', { name: 'Plan Your Workouts' })
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('region', { name: 'Plan Your Workouts' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveFocus()
  })

  it('keeps panel controls outside the section trigger buttons', async () => {
    const user = userEvent.setup()
    renderSignedInApp()

    await user.click(screen.getByRole('button', { name: 'Track' }))

    expect(
      document.querySelector(
        'button button, button input, button select, button textarea, button a[href]'
      )
    ).toBeNull()
  })
})
