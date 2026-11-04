import { describe, expect, it, vi } from 'vitest'

import { HttpGarminOAuthProvider } from './garminOAuthProvider.js'

function provider(fetchImplementation: typeof fetch) {
  return new HttpGarminOAuthProvider(
    {
      authorizationUrl: 'https://provider.invalid/oauth/authorize',
      tokenUrl: 'https://provider.invalid/oauth/token',
      revocationUrl: 'https://provider.invalid/oauth/revoke',
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
    const request = vi.fn(async () =>
      Response.json({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      }),
    )
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
  })

  it('revokes the refresh grant and rejects non-HTTPS configuration', async () => {
    const request = vi.fn(async () => new Response(null, { status: 204 }))
    const boundary = provider(request)
    await boundary.revoke({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: null,
    })
    const body = request.mock.calls[0]?.[1]?.body as URLSearchParams
    expect(Object.fromEntries(body)).toEqual({
      token: 'refresh-token',
      token_type_hint: 'refresh_token',
      client_id: 'server-client-id',
      client_secret: 'server-client-secret',
    })

    expect(
      () =>
        new HttpGarminOAuthProvider({
          authorizationUrl: 'http://provider.invalid/authorize',
          tokenUrl: 'https://provider.invalid/token',
          revocationUrl: 'https://provider.invalid/revoke',
          clientId: 'id',
          clientSecret: 'secret',
          redirectUri: 'https://server.invalid/callback',
        }),
    ).toThrow('must use HTTPS')
  })

  it('can build the browser URL without secret access but refuses server exchange', async () => {
    const boundary = new HttpGarminOAuthProvider(
      {
        authorizationUrl: 'https://provider.invalid/authorize',
        tokenUrl: 'https://provider.invalid/token',
        revocationUrl: 'https://provider.invalid/revoke',
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
