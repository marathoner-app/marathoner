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
    render(<AppleHealthConnection accountScope="owner-a" />)

    expect(
      await screen.findByText(/Import completed running workouts from the last 30 days/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/does not write to Apple Health/i)).toBeInTheDocument()
    expect(
      screen.getByText(/cannot see whether an individual read permission was denied/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Connect Apple Health' }))
    expect(mockedConnect).toHaveBeenCalledWith('owner-a')
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
    render(<AppleHealthConnection accountScope="owner-a" />)

    await user.click(
      await screen.findByRole('button', { name: 'Check for runs now' }),
    )
    expect(mockedSynchronize).toHaveBeenCalledWith('owner-a')
    expect(await screen.findByText('Apple Health is up to date.')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Stop importing on this iPhone' }),
    )
    expect(mockedDisconnect).toHaveBeenCalledWith('owner-a')
  })

  it('keeps the web product usable without invoking a native permission flow', async () => {
    mockedGetState.mockResolvedValue({
      availability: 'web',
      monitoring: false,
      authorizationRequestStatus: 'unavailable',
    })
    render(<AppleHealthConnection accountScope="owner-a" />)

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
    render(<AppleHealthConnection accountScope="owner-a" />)

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
