import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import App from './App'
import AuthProvider, { authSessionTimeoutMs } from './auth/AuthProvider'
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

vi.mock('framer-motion', () => ({
  useReducedMotion: () => true,
  motion: {
    button: 'button',
    div: 'div',
    main: ({ children }: { children?: ReactNode }) => <main>{children}</main>,
    section: 'section'
  }
}))

vi.mock('./services/authService', () => ({
  logOut: vi.fn(),
  reauthenticateWithPassword: vi.fn(),
  signIn: vi.fn(),
  subscribeToAuthState: vi.fn()
}))

vi.mock('./services/accountDeletionService', () => ({
  reauthenticateForAccountDeletion: vi.fn(),
  resolveAccountDeletionRequest: vi.fn(),
  submitAccountDeletionRequest: vi.fn()
}))

vi.mock('./training/TrainingDataProvider', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="training-data-provider">{children}</div>
  )
}))

const trainingMock = vi.hoisted(() => ({
  profile: null as object | null,
  plans: [] as object[],
  workouts: [] as object[],
  saveProfile: vi.fn(),
  reload: vi.fn()
}))

vi.mock('./training/useTrainingData', () => ({
  useTrainingData: () => ({
    status: 'ready',
    error: null,
    profile: trainingMock.profile,
    plans: trainingMock.plans,
    workouts: trainingMock.workouts,
    runs: [],
    shoes: [],
    reload: trainingMock.reload,
    saveProfile: trainingMock.saveProfile,
    createShoe: vi.fn(),
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
let unsubscribe: ReturnType<typeof vi.fn>

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
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Training sections' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Log in' })
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

  it('shows a calm error when logout fails', async () => {
    const user = userEvent.setup()
    mockedLogOut.mockRejectedValue(new Error('Network unavailable'))
    renderSignedInApp()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't log you out. Please try again."
    )
  })

  it('opens account settings and restores focus when the dialog closes', async () => {
    const user = userEvent.setup()
    renderSignedInApp()

    const settingsButton = screen.getByRole('button', {
      name: 'Account settings'
    })
    await user.click(settingsButton)

    expect(
      screen.getByRole('dialog', { name: 'Delete your Marathoner account' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Delete your Marathoner account' })
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
})

describe('App training sections', () => {
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

    expect(screen.getByRole('button', { name: 'Resume runner setup' })).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Training sections' })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resume runner setup' }))

    expect(
      screen.getByRole('dialog', { name: 'Tell us where you are starting' })
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
