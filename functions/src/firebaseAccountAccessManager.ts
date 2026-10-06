import type { Auth } from 'firebase-admin/auth'

import type { AccountAccessManager } from './accountDeletionRequestHandler.js'

export class FirebaseAccountAccessManager implements AccountAccessManager {
  constructor(private readonly auth: Auth) {}

  async disableAndRevoke(ownerId: string): Promise<void> {
    await this.auth.updateUser(ownerId, { disabled: true })
    await this.auth.revokeRefreshTokens(ownerId)
  }
}
