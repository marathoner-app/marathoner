import { describe, expect, it, vi } from 'vitest'

import {
  completeGarminOAuthCallback,
  disconnectGarmin,
  getGarminConnectionStatus,
  sha256Base64Url,
  startGarminOAuth,
  type GarminCallbackReservation,
  type GarminConnectionStatus,
  type GarminDisconnectReservation,
  type GarminOAuthEnvironment,
  type GarminOAuthStore,
  type GarminTokenGrant,
} from './garminOAuthHandler.js'

const ownerId = 'runner-one'
const fixedNow = new Date('2026-11-04T20:00:00.000Z')
const grant: GarminTokenGrant = {
  accessToken: 'private-access-token',
  refreshToken: 'private-refresh-token',
  expiresAt: '2026-11-04T21:00:00.000Z',
}

class InMemoryGarminOAuthStore implements GarminOAuthStore {
  approvedOwners = new Set([ownerId])
  authorizations = new Map<
    string,
    {
      codeDigest?: string
      codeVerifier: string
      environment: GarminOAuthEnvironment
      expiresAt: string
      ownerId: string
      status: 'pending' | 'processing' | 'completed' | 'failed'
    }
  >()
  connections = new Map<
    string,
    {
      connectedAt: string
      environment: GarminOAuthEnvironment
      grant: GarminTokenGrant
      status: 'connected' | 'disconnecting'
    }
  >()

  async createAuthorization(options: {
    createdAt: string
    environment: GarminOAuthEnvironment
    expiresAt: string
    ownerId: string
    stateDigest: string
    codeVerifier: string
  }) {
    if (!this.approvedOwners.has(options.ownerId)) {
      return 'membership-required' as const
    }
    this.authorizations.set(options.stateDigest, {
      codeVerifier: options.codeVerifier,
      environment: options.environment,
      expiresAt: options.expiresAt,
      ownerId: options.ownerId,
      status: 'pending',
    })
    return 'created' as const
  }

  async reserveCallback(options: {
    codeDigest: string
    environment: GarminOAuthEnvironment
    now: string
    stateDigest: string
  }): Promise<GarminCallbackReservation> {
    const state = this.authorizations.get(options.stateDigest)
    if (
      !state ||
      state.environment !== options.environment ||
      state.expiresAt <= options.now
    ) {
      return { kind: 'invalid' }
    }
    if (state.status === 'completed') return { kind: 'completed' }
    if (state.status === 'processing') {
      return state.codeDigest === options.codeDigest
        ? { kind: 'processing' }
        : { kind: 'invalid' }
    }
    if (state.status !== 'pending') return { kind: 'invalid' }
    state.status = 'processing'
    state.codeDigest = options.codeDigest
    return {
      kind: 'reserved',
      ownerId: state.ownerId,
      codeVerifier: state.codeVerifier,
    }
  }

  async completeCallback(options: {
    connectedAt: string
    environment: GarminOAuthEnvironment
    grant: GarminTokenGrant
    ownerId: string
    stateDigest: string
  }) {
    const prior = this.connections.get(options.ownerId)?.grant
    this.connections.set(options.ownerId, {
      connectedAt: options.connectedAt,
      environment: options.environment,
      grant: options.grant,
      status: 'connected',
    })
    const state = this.authorizations.get(options.stateDigest)
    if (!state) throw new Error('missing state')
    state.status = 'completed'
    state.codeVerifier = ''
    return prior ? [prior] : []
  }

  async completePriorGrantRevocations() {}

  async failCallback(options: { failedAt: string; stateDigest: string }) {
    const state = this.authorizations.get(options.stateDigest)
    if (state) state.status = 'failed'
  }

  async readStatus(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
  }): Promise<GarminConnectionStatus> {
    const connection = this.connections.get(options.ownerId)
    if (!connection || connection.environment !== options.environment) {
      return { status: 'disconnected', connectedAt: null }
    }
    return {
      status: connection.status,
      connectedAt: connection.connectedAt,
    }
  }

  async reserveDisconnect(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
  }): Promise<GarminDisconnectReservation> {
    const connection = this.connections.get(options.ownerId)
    if (!connection || connection.environment !== options.environment) {
      return { kind: 'disconnected' }
    }
    if (connection.status === 'disconnecting') {
      return { kind: 'reserved', grants: [connection.grant] }
    }
    connection.status = 'disconnecting'
    return { kind: 'reserved', grants: [connection.grant] }
  }

  async completeDisconnect(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
  }) {
    const connection = this.connections.get(options.ownerId)
    if (connection?.environment === options.environment) {
      this.connections.delete(options.ownerId)
    }
  }
}

function dependencies(options: {
  enabled?: boolean
  environment?: GarminOAuthEnvironment
  store?: InMemoryGarminOAuthStore
} = {}) {
  const store = options.store ?? new InMemoryGarminOAuthStore()
  const provider = {
    authorizationUrl: vi.fn(
      ({ codeChallenge, state }) =>
        `https://provider.invalid/authorize?state=${state}&challenge=${codeChallenge}`,
    ),
    exchangeAuthorizationCode: vi.fn(async () => grant),
    revoke: vi.fn(async () => undefined),
  }
  return {
    boundary: {
      enabled: options.enabled ?? true,
      environment: options.environment ?? ('beta' as const),
      log: vi.fn(),
      now: () => fixedNow,
      provider,
      randomBytes: (size: number) => new Uint8Array(size).fill(size),
      store,
    },
    provider,
    store,
  }
}

const authenticatedCaller = { ownerId, appCheckVerified: true }

describe('trusted Garmin OAuth handler', () => {
  it('requires authentication, App Check, activation, and approved membership before issuing state', async () => {
    const missingAuth = dependencies()
    await expect(
      startGarminOAuth(
        { ownerId: null, appCheckVerified: true },
        missingAuth.boundary,
      ),
    ).resolves.toEqual({
      status: 'authentication_error',
      code: 'authentication-required',
    })

    const missingAppCheck = dependencies()
    await expect(
      startGarminOAuth(
        { ownerId, appCheckVerified: false },
        missingAppCheck.boundary,
      ),
    ).resolves.toEqual({
      status: 'authorization_error',
      code: 'app-check-required',
    })

    const disabled = dependencies({ enabled: false })
    await expect(
      startGarminOAuth(authenticatedCaller, disabled.boundary),
    ).resolves.toEqual({
      status: 'unavailable',
      code: 'garmin-oauth-disabled',
    })

    const noMembership = dependencies()
    noMembership.store.approvedOwners.clear()
    await expect(
      startGarminOAuth(authenticatedCaller, noMembership.boundary),
    ).resolves.toEqual({
      status: 'authorization_error',
      code: 'approved-beta-membership-required',
    })
    expect(noMembership.provider.authorizationUrl).not.toHaveBeenCalled()
  })

  it('binds short-lived opaque state and PKCE to the owner and environment', async () => {
    const { boundary, provider, store } = dependencies()

    const result = await startGarminOAuth(authenticatedCaller, boundary)

    expect(result).toEqual({
      status: 'ready',
      authorizationUrl: expect.stringMatching(
        /^https:\/\/provider\.invalid\/authorize\?state=/,
      ),
    })
    expect(provider.authorizationUrl).toHaveBeenCalledWith({
      state: expect.any(String),
      codeChallenge: expect.any(String),
    })
    const [stateDigest, stored] = [...store.authorizations.entries()][0] ?? []
    expect(stateDigest).toHaveLength(43)
    expect(stored).toEqual({
      codeVerifier: expect.any(String),
      environment: 'beta',
      expiresAt: '2026-11-04T20:10:00.000Z',
      ownerId,
      status: 'pending',
    })
    expect(JSON.stringify(stored)).not.toContain(
      provider.authorizationUrl.mock.calls[0]?.[0].state,
    )
  })

  it('rejects expired and cross-environment callbacks before exchange', async () => {
    const { boundary, provider, store } = dependencies()
    const state = 'state-value-that-is-long-enough-for-validation'
    store.authorizations.set(sha256Base64Url(state), {
      codeVerifier: 'verifier',
      environment: 'development',
      expiresAt: '2026-11-04T20:10:00.000Z',
      ownerId,
      status: 'pending',
    })

    await expect(
      completeGarminOAuthCallback(
        { code: 'authorization-code', state },
        boundary,
      ),
    ).resolves.toEqual({ status: 'rejected', code: 'invalid-callback' })
    expect(provider.exchangeAuthorizationCode).not.toHaveBeenCalled()

    store.authorizations.set(sha256Base64Url(state), {
      codeVerifier: 'verifier',
      environment: 'beta',
      expiresAt: '2026-11-04T19:59:59.000Z',
      ownerId,
      status: 'pending',
    })
    await expect(
      completeGarminOAuthCallback(
        { code: 'authorization-code', state },
        boundary,
      ),
    ).resolves.toEqual({ status: 'rejected', code: 'invalid-callback' })
    expect(provider.exchangeAuthorizationCode).not.toHaveBeenCalled()
  })

  it('stores a grant once and makes callback replay deterministic', async () => {
    const { boundary, provider, store } = dependencies()
    const state = 'state-value-that-is-long-enough-for-validation'
    store.authorizations.set(sha256Base64Url(state), {
      codeVerifier: 'private-code-verifier',
      environment: 'beta',
      expiresAt: '2026-11-04T20:10:00.000Z',
      ownerId,
      status: 'pending',
    })

    const first = await completeGarminOAuthCallback(
      { code: 'authorization-code', state },
      boundary,
    )
    const replay = await completeGarminOAuthCallback(
      { code: 'authorization-code', state },
      boundary,
    )

    expect(first).toEqual({ status: 'connected', code: 'connected' })
    expect(replay).toEqual({
      status: 'connected',
      code: 'already-connected',
    })
    expect(provider.exchangeAuthorizationCode).toHaveBeenCalledTimes(1)
    expect(provider.exchangeAuthorizationCode).toHaveBeenCalledWith({
      code: 'authorization-code',
      codeVerifier: 'private-code-verifier',
    })
    await expect(
      getGarminConnectionStatus(authenticatedCaller, boundary),
    ).resolves.toEqual({
      status: 'connected',
      connectedAt: fixedNow.toISOString(),
    })
  })

  it('fails closed without leaking provider details and permits a fresh connection attempt', async () => {
    const { boundary, provider, store } = dependencies()
    const state = 'state-value-that-is-long-enough-for-validation'
    store.authorizations.set(sha256Base64Url(state), {
      codeVerifier: 'private-code-verifier',
      environment: 'beta',
      expiresAt: '2026-11-04T20:10:00.000Z',
      ownerId,
      status: 'pending',
    })
    provider.exchangeAuthorizationCode.mockRejectedValueOnce(
      new Error('secret provider response containing private-access-token'),
    )

    await expect(
      completeGarminOAuthCallback(
        { code: 'authorization-code', state },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'rejected',
      code: 'provider-exchange-failed',
    })
    expect(boundary.log).toHaveBeenLastCalledWith({
      event: 'garmin-oauth-callback',
      status: 'provider_error',
    })
    expect(JSON.stringify(boundary.log.mock.calls)).not.toContain('token')
    expect(store.authorizations.get(sha256Base64Url(state))?.status).toBe(
      'failed',
    )
  })

  it('revokes an exchanged grant when durable owner mapping fails', async () => {
    const { boundary, provider, store } = dependencies()
    const state = 'state-value-that-is-long-enough-for-validation'
    store.authorizations.set(sha256Base64Url(state), {
      codeVerifier: 'private-code-verifier',
      environment: 'beta',
      expiresAt: '2026-11-04T20:10:00.000Z',
      ownerId,
      status: 'pending',
    })
    vi.spyOn(store, 'completeCallback').mockRejectedValueOnce(
      new Error('membership changed'),
    )

    await expect(
      completeGarminOAuthCallback(
        { code: 'authorization-code', state },
        boundary,
      ),
    ).resolves.toEqual({
      status: 'rejected',
      code: 'provider-exchange-failed',
    })
    expect(provider.revoke).toHaveBeenCalledWith(grant)
    expect(store.connections.has(ownerId)).toBe(false)
  })

  it('replaces a current grant and revokes the superseded grant', async () => {
    const { boundary, provider, store } = dependencies()
    const oldGrant = {
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiresAt: '2026-11-04T20:30:00.000Z',
    }
    store.connections.set(ownerId, {
      connectedAt: '2026-11-04T19:00:00.000Z',
      environment: 'beta',
      grant: oldGrant,
      status: 'connected',
    })
    const state = 'state-value-that-is-long-enough-for-validation'
    store.authorizations.set(sha256Base64Url(state), {
      codeVerifier: 'private-code-verifier',
      environment: 'beta',
      expiresAt: '2026-11-04T20:10:00.000Z',
      ownerId,
      status: 'pending',
    })

    await expect(
      completeGarminOAuthCallback(
        { code: 'authorization-code', state },
        boundary,
      ),
    ).resolves.toEqual({ status: 'connected', code: 'connected' })
    expect(provider.revoke).toHaveBeenCalledWith(oldGrant)
    expect(store.connections.get(ownerId)?.grant).toEqual(grant)
  })

  it('revokes and deletes token material, and safely retries a failed revocation', async () => {
    const { boundary, provider, store } = dependencies()
    store.connections.set(ownerId, {
      connectedAt: fixedNow.toISOString(),
      environment: 'beta',
      grant,
      status: 'connected',
    })
    provider.revoke.mockRejectedValueOnce(new Error('provider unavailable'))

    await expect(
      disconnectGarmin(authenticatedCaller, boundary),
    ).resolves.toEqual({
      status: 'unavailable',
      code: 'provider-revocation-failed',
    })
    expect(store.connections.get(ownerId)?.status).toBe('disconnecting')

    await expect(
      disconnectGarmin(authenticatedCaller, boundary),
    ).resolves.toEqual({ status: 'disconnected' })
    expect(provider.revoke).toHaveBeenCalledTimes(2)
    expect(store.connections.has(ownerId)).toBe(false)

    await expect(
      disconnectGarmin(authenticatedCaller, boundary),
    ).resolves.toEqual({ status: 'disconnected' })
    expect(provider.revoke).toHaveBeenCalledTimes(2)
  })
})
