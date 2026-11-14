import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  connectHealthKit,
  disconnectHealthKit,
  getHealthKitConnectionState,
  synchronizeHealthKit,
} from '../services/healthKitImport'
import AppleHealthConnection from './AppleHealthConnection'

vi.mock('../services/healthKitImport', () => ({
  connectHealthKit: vi.fn(),
  disconnectHealthKit: vi.fn(),
  getHealthKitConnectionState: vi.fn(),
  synchronizeHealthKit: vi.fn(),
}))

const mockedGetState = vi.mocked(getHealthKitConnectionState)
const mockedConnect = vi.mocked(connectHealthKit)
const mockedSynchronize = vi.mocked(synchronizeHealthKit)
const mockedDisconnect = vi.mocked(disconnectHealthKit)

const emptySummary = {
  created: 0,
  updated: 0,
  unchanged: 0,
  deleted: 0,
  reviewRequired: 0,
  failed: 0,
  skipped: 0,
}

const accountScope = {
  current: 'firebase-project:beta-project:user:owner-a',
  legacy: 'owner-a',
}

describe('AppleHealthConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetState.mockResolvedValue({
      availability: 'disconnected',
      monitoring: false,
      authorizationRequestStatus: 'should_request',
    })
    mockedConnect.mockResolvedValue({ ...emptySummary, created: 2 })
    mockedSynchronize.mockResolvedValue(emptySummary)
    mockedDisconnect.mockResolvedValue()
  })

  it('explains the narrow read scope before opening the system permission sheet', async () => {
    const user = userEvent.setup()
    render(<AppleHealthConnection accountScope={accountScope} />)

    expect(
      await screen.findByText(/Import completed running workouts from the last 30 days/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/does not write to Apple Health/i)).toBeInTheDocument()
    expect(
      screen.getByText(/cannot see whether an individual read permission was denied/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Connect Apple Health' }))
    expect(mockedConnect).toHaveBeenCalledWith(accountScope)
    expect(
      await screen.findByText('2 Apple Health workout changes are now in Marathoner.'),
    ).toBeInTheDocument()
  })

  it('offers manual synchronization and a truthful local disconnect', async () => {
    const user = userEvent.setup()
    mockedGetState.mockResolvedValue({
      availability: 'enabled',
      monitoring: true,
      authorizationRequestStatus: 'unnecessary',
    })
    render(<AppleHealthConnection accountScope={accountScope} />)

    await user.click(
      await screen.findByRole('button', { name: 'Check for runs now' }),
    )
    expect(mockedSynchronize).toHaveBeenCalledWith(accountScope)
    expect(
      await screen.findByText('No new Apple Health workout changes were found.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/does not confirm that every prior workout/i),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Stop importing on this iPhone' }),
    )
    expect(mockedDisconnect).toHaveBeenCalledWith(accountScope)
  })

  it('offers the heart-rate permission upgrade for an existing connection', async () => {
    const user = userEvent.setup()
    mockedGetState.mockResolvedValue({
      availability: 'enabled',
      monitoring: true,
      authorizationRequestStatus: 'should_request',
    })
    render(<AppleHealthConnection accountScope={accountScope} />)

    await user.click(
      await screen.findByRole('button', { name: 'Allow workout heart rate' }),
    )

    expect(mockedConnect).toHaveBeenCalledWith(accountScope)
    expect(
      screen.getByText(/without creating duplicate runs/i),
    ).toBeInTheDocument()
  })

  it('explains when a possible duplicate was safely held back', async () => {
    const user = userEvent.setup()
    mockedGetState.mockResolvedValue({
      availability: 'enabled',
      monitoring: true,
      authorizationRequestStatus: 'unnecessary',
    })
    mockedSynchronize.mockResolvedValue({
      ...emptySummary,
      reviewRequired: 1,
    })
    render(<AppleHealthConnection accountScope={accountScope} />)

    await user.click(
      await screen.findByRole('button', { name: 'Check for runs now' }),
    )

    expect(
      await screen.findByText(
        '0 workout changes were saved. Marathoner held back 1 possible duplicate, so no second run was added.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Keep existing run' }),
    ).toBeEnabled()
    await user.click(
      screen.getByRole('button', { name: 'They were separate runs' }),
    )
    expect(
      await screen.findByText(
        'Open Track and log the other run manually. Marathoner did not add a duplicate.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Keep existing run' }),
    ).not.toBeInTheDocument()
  })

  it('can keep the existing run after a possible duplicate is held back', async () => {
    const user = userEvent.setup()
    mockedGetState.mockResolvedValue({
      availability: 'enabled',
      monitoring: true,
      authorizationRequestStatus: 'unnecessary',
    })
    mockedSynchronize.mockResolvedValue({
      ...emptySummary,
      reviewRequired: 1,
    })
    render(<AppleHealthConnection accountScope={accountScope} />)

    await user.click(
      await screen.findByRole('button', { name: 'Check for runs now' }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Keep existing run' }),
    )

    expect(
      await screen.findByText(
        'Kept the existing run. Marathoner did not add a duplicate.',
      ),
    ).toBeInTheDocument()
  })

  it('keeps the web product usable without invoking a native permission flow', async () => {
    mockedGetState.mockResolvedValue({
      availability: 'web',
      monitoring: false,
      authorizationRequestStatus: 'unavailable',
    })
    render(<AppleHealthConnection accountScope={accountScope} />)

    expect(
      await screen.findByText(/available in the Marathoner app on iPhone/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Connect Apple Health' }),
    ).not.toBeInTheDocument()
  })

  it('reports native failures without closing account settings', async () => {
    const user = userEvent.setup()
    mockedConnect.mockRejectedValue(new Error('Apple Health is unavailable.'))
    render(<AppleHealthConnection accountScope={accountScope} />)

    await user.click(
      await screen.findByRole('button', { name: 'Connect Apple Health' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Apple Health is unavailable.',
    )
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Apple Health workouts' }),
      ).toBeInTheDocument()
    })
  })
})
