import { describe, expect, it, vi } from 'vitest'

import { GarminRevocationFailure } from './garminOAuthHandler.js'
import { HttpGarminOAuthProvider } from './garminOAuthProvider.js'

function provider(fetchImplementation: typeof fetch) {
  return new HttpGarminOAuthProvider(
    {
      authorizationUrl: 'https://provider.invalid/oauth/authorize',
      tokenUrl: 'https://provider.invalid/oauth/token',
      revocationUrl: 'https://provider.invalid/oauth/revoke',
      userIdUrl: 'https://provider.invalid/user/id',
      clientId: 'server-client-id',
      clientSecret: 'server-client-secret',
      redirectUri: 'https://server.invalid/garminOAuthCallback',
    },
    {
      fetch: fetchImplementation,
      now: () => new Date('2026-11-04T20:00:00.000Z'),
    },
  )
}

describe('Garmin OAuth HTTP provider adapter', () => {
  it('builds an authorization request with state and PKCE', () => {
    const boundary = provider(vi.fn())
    const url = new URL(
      boundary.authorizationUrl({
        state: 'opaque-state',
        codeChallenge: 'pkce-challenge',
      }),
    )

    expect(url.origin + url.pathname).toBe(
      'https://provider.invalid/oauth/authorize',
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'server-client-id',
      redirect_uri: 'https://server.invalid/garminOAuthCallback',
      state: 'opaque-state',
      code_challenge: 'pkce-challenge',
      code_challenge_method: 'S256',
    })
    expect(url.toString()).not.toContain('server-client-secret')
  })

  it('exchanges a code server side and normalizes the token grant', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        }),
      )
      .mockResolvedValueOnce(Response.json({ userId: 'provider-user-id' }))
    const boundary = provider(request)

    await expect(
      boundary.exchangeAuthorizationCode({
        code: 'authorization-code',
        codeVerifier: 'private-verifier',
      }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-11-04T21:00:00.000Z',
      providerUserId: 'provider-user-id',
    })
    const body = request.mock.calls[0]?.[1]?.body as URLSearchParams
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      code: 'authorization-code',
      redirect_uri: 'https://server.invalid/garminOAuthCallback',
      client_id: 'server-client-id',
      client_secret: 'server-client-secret',
      code_verifier: 'private-verifier',
    })
    expect(request.mock.calls[1]?.[0].toString()).toBe(
      'https://provider.invalid/user/id',
    )
    expect(request.mock.calls[1]?.[1]?.headers).toEqual({
      authorization: 'Bearer access-token',
    })
  })

  it('deletes the Garmin registration with the access token', async () => {
    const request = vi.fn(async () => new Response(null, { status: 204 }))
    const boundary = provider(request)
    await expect(
      boundary.revoke({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: null,
      }),
    ).resolves.toEqual({ status: 'revoked', httpStatus: 204 })
    expect(request).toHaveBeenCalledWith(
      new URL('https://provider.invalid/oauth/revoke'),
      {
        method: 'DELETE',
        headers: { authorization: 'Bearer access-token' },
      },
    )
  })

  it('refreshes an expired access grant before retrying registration deletion', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { error: 'invalid_token' },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          access_token: 'replacement-access-token',
          refresh_token: 'replacement-refresh-token',
          expires_in: 3600,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const boundary = provider(request)

    await expect(
      boundary.revoke({
        accessToken: 'expired-access-token',
        refreshToken: 'refresh-token',
        expiresAt: '2026-11-04T19:00:00.000Z',
      }),
    ).resolves.toEqual({ status: 'revoked', httpStatus: 204 })

    expect(request.mock.calls[0]).toEqual([
      new URL('https://provider.invalid/oauth/revoke'),
      {
        method: 'DELETE',
        headers: { authorization: 'Bearer expired-access-token' },
      },
    ])
    const refreshBody = request.mock.calls[1]?.[1]?.body as URLSearchParams
    expect(Object.fromEntries(refreshBody)).toEqual({
      grant_type: 'refresh_token',
      client_id: 'server-client-id',
      client_secret: 'server-client-secret',
      refresh_token: 'refresh-token',
    })
    expect(request.mock.calls[2]?.[1]).toEqual({
      method: 'DELETE',
      headers: { authorization: 'Bearer replacement-access-token' },
    })
  })

  it('treats a documented invalid refresh grant as already invalid', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ error: 'invalid_token' }, { status: 401 }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: 'invalid_grant' }, { status: 400 }),
      )
    const boundary = provider(request)

    await expect(
      boundary.revoke({
        accessToken: 'expired-access-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: '2026-11-04T19:00:00.000Z',
      }),
    ).resolves.toEqual({ status: 'already-invalid', httpStatus: 400 })
  })

  it('returns a refreshed grant when a transient delete must be retried', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ error: 'invalid_token' }, { status: 401 }),
      )
      .mockResolvedValueOnce(
        Response.json({
          access_token: 'replacement-access-token',
          refresh_token: 'replacement-refresh-token',
          expires_in: 3600,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    const boundary = provider(request)

    await expect(
      boundary.revoke({
        accessToken: 'expired-access-token',
        refreshToken: 'refresh-token',
        expiresAt: '2026-11-04T19:00:00.000Z',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GarminRevocationFailure>>({
        category: 'transient',
        httpStatus: 503,
        retryGrant: {
          accessToken: 'replacement-access-token',
          refreshToken: 'replacement-refresh-token',
          expiresAt: '2026-11-04T21:00:00.000Z',
        },
      }),
    )
  })

  it('rejects non-HTTPS configuration', () => {

    expect(
      () =>
        new HttpGarminOAuthProvider({
          authorizationUrl: 'http://provider.invalid/authorize',
          tokenUrl: 'https://provider.invalid/token',
          revocationUrl: 'https://provider.invalid/revoke',
          userIdUrl: 'https://provider.invalid/user/id',
          clientId: 'id',
          clientSecret: 'secret',
          redirectUri: 'https://server.invalid/callback',
        }),
    ).toThrow('must use HTTPS')
  })

  it('revokes an exchanged grant when the server-side user lookup fails', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const boundary = provider(request)

    await expect(
      boundary.exchangeAuthorizationCode({
        code: 'authorization-code',
        codeVerifier: 'private-verifier',
      }),
    ).rejects.toThrow('user lookup')
    expect(request.mock.calls[2]).toEqual([
      new URL('https://provider.invalid/oauth/revoke'),
      {
        method: 'DELETE',
        headers: { authorization: 'Bearer access-token' },
      },
    ])
  })

  it('can build the browser URL without secret access but refuses server exchange', async () => {
    const boundary = new HttpGarminOAuthProvider(
      {
        authorizationUrl: 'https://provider.invalid/authorize',
        tokenUrl: 'https://provider.invalid/token',
        revocationUrl: 'https://provider.invalid/revoke',
        userIdUrl: 'https://provider.invalid/user/id',
        clientId: 'server-client-id',
        clientSecret: '',
        redirectUri: 'https://server.invalid/callback',
      },
      { fetch: vi.fn() },
    )

    expect(
      boundary.authorizationUrl({ state: 'state', codeChallenge: 'challenge' }),
    ).toContain('client_id=server-client-id')
    await expect(
      boundary.exchangeAuthorizationCode({
        code: 'authorization-code',
        codeVerifier: 'verifier',
      }),
    ).rejects.toThrow('client secret')
  })
})
