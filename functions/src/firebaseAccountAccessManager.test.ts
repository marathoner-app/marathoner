import type { Auth } from 'firebase-admin/auth'
import { describe, expect, it, vi } from 'vitest'

import { FirebaseAccountAccessManager } from './firebaseAccountAccessManager.js'

describe('Firebase account access manager', () => {
  it('disables the account before revoking refresh tokens', async () => {
    const updateUser = vi.fn().mockResolvedValue(undefined)
    const revokeRefreshTokens = vi.fn().mockResolvedValue(undefined)
    const manager = new FirebaseAccountAccessManager({
      updateUser,
      revokeRefreshTokens,
    } as unknown as Auth)

    await manager.disableAndRevoke('runner-one')

    expect(updateUser).toHaveBeenCalledWith('runner-one', { disabled: true })
    expect(revokeRefreshTokens).toHaveBeenCalledWith('runner-one')
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      revokeRefreshTokens.mock.invocationCallOrder[0],
    )
  })

  it('does not revoke tokens when disabling the account fails', async () => {
    const updateUser = vi.fn().mockRejectedValue(new Error('provider failure'))
    const revokeRefreshTokens = vi.fn()
    const manager = new FirebaseAccountAccessManager({
      updateUser,
      revokeRefreshTokens,
    } as unknown as Auth)

    await expect(manager.disableAndRevoke('runner-one')).rejects.toThrow(
      'provider failure',
    )
    expect(revokeRefreshTokens).not.toHaveBeenCalled()
  })
})
