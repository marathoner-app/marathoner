import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../../../src/auth/AuthContext'

const client = vi.hoisted(() => ({
  delete: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
}))

vi.mock('./webSharedRecordClient', () => ({
  sharedRecordClient: client,
}))

vi.mock('../../../src/services/authService', () => ({
  signIn: vi.fn(),
}))

import SharedRecordProofApp from './SharedRecordProofApp'
import { sharedRecordSourceForMode } from './sourceClient'

const sampleRecord = {
  schemaVersion: 1 as const,
  recordType: 'shared_training_record_proof' as const,
  userId: 'runner-1',
  sampleRunId: 'issue-87-sample-run' as never,
  distanceMeters: 5000 as never,
  sourceClient: 'web' as const,
}

function renderProof(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <SharedRecordProofApp />
    </AuthContext.Provider>,
  )
}

describe('shared iOS and web record proof', () => {
  beforeEach(() => {
    client.delete.mockReset()
    client.read.mockReset()
    client.write.mockReset()
  })

  it('maps only the mobile build to the Capacitor writer', () => {
    expect(sharedRecordSourceForMode('mobile-shared-record-spike')).toBe(
      'capacitor',
    )
    expect(sharedRecordSourceForMode('web-shared-record-spike')).toBe('web')
  })

  it('loads an empty owner record, writes it, and removes it', async () => {
    client.read.mockResolvedValueOnce(null)
    client.write.mockResolvedValueOnce(sampleRecord)
    client.delete.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()

    renderProof({
      status: 'signedIn',
      user: { uid: 'runner-1', email: 'runner@example.com' },
      logout: vi.fn(),
    })

    expect(await screen.findByText('No sample record exists.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Write as web' }))

    expect(client.write).toHaveBeenCalledWith('runner-1', 'web')
    expect(await screen.findByText('issue-87-sample-run')).toBeInTheDocument()
    expect(screen.getByText('5000 meters')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete sample' }))

    expect(client.delete).toHaveBeenCalledWith('runner-1')
    expect(await screen.findByText('No sample record exists.')).toBeInTheDocument()
  })

  it('shows a calm error when the owner read is denied or unavailable', async () => {
    client.read.mockRejectedValueOnce(new Error('permission denied'))

    renderProof({
      status: 'signedIn',
      user: { uid: 'runner-1', email: 'runner@example.com' },
      logout: vi.fn(),
    })

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The sample record request failed. Check the network and retry.',
      ),
    )
  })
})
