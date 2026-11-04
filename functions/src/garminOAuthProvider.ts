import type {
  GarminConnectionGrant,
  GarminOAuthProvider,
  GarminTokenGrant,
} from './garminOAuthHandler.js'

type GarminOAuthProviderConfiguration = Readonly<{
  authorizationUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
  revocationUrl: string
  tokenUrl: string
  userIdUrl: string
}>

function configuredUrl(value: string, label: string): URL {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${label} is not configured as an absolute URL.`)
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS.`)
  }
  return parsed
}

function nonEmpty(value: string, label: string): string {
  if (value.trim() === '') throw new Error(`${label} is not configured.`)
  return value
}

function tokenGrant(
  value: unknown,
  now: Date,
): GarminTokenGrant {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The OAuth provider returned an invalid token response.')
  }
  const response = value as Record<string, unknown>
  if (
    typeof response.access_token !== 'string' ||
    response.access_token.length === 0
  ) {
    throw new Error('The OAuth provider returned no access token.')
  }
  const refreshToken =
    typeof response.refresh_token === 'string' &&
    response.refresh_token.length > 0
      ? response.refresh_token
      : null
  const expiresAt =
    typeof response.expires_in === 'number' &&
    Number.isFinite(response.expires_in) &&
    response.expires_in > 0
      ? new Date(now.getTime() + response.expires_in * 1_000).toISOString()
      : null
  return {
    accessToken: response.access_token,
    refreshToken,
    expiresAt,
  }
}

function providerUserId(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The OAuth provider returned an invalid user response.')
  }
  const userId = (value as Record<string, unknown>).userId
  if (
    typeof userId !== 'string' ||
    userId.trim() === '' ||
    userId.length > 512
  ) {
    throw new Error('The OAuth provider returned no usable user identifier.')
  }
  return userId
}

export class HttpGarminOAuthProvider implements GarminOAuthProvider {
  private readonly authorizationEndpoint: URL
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string
  private readonly revocationEndpoint: URL
  private readonly tokenEndpoint: URL
  private readonly userIdEndpoint: URL

  constructor(
    configuration: GarminOAuthProviderConfiguration,
    private readonly options: {
      fetch?: typeof fetch
      now?: () => Date
    } = {},
  ) {
    this.authorizationEndpoint = configuredUrl(
      configuration.authorizationUrl,
      'The authorization endpoint',
    )
    this.tokenEndpoint = configuredUrl(
      configuration.tokenUrl,
      'The token endpoint',
    )
    this.revocationEndpoint = configuredUrl(
      configuration.revocationUrl,
      'The revocation endpoint',
    )
    this.userIdEndpoint = configuredUrl(
      configuration.userIdUrl,
      'The user ID endpoint',
    )
    configuredUrl(configuration.redirectUri, 'The OAuth redirect URI')
    this.clientId = nonEmpty(configuration.clientId, 'The OAuth client ID')
    this.clientSecret = configuration.clientSecret
    this.redirectUri = configuration.redirectUri
  }

  authorizationUrl(options: {
    codeChallenge: string
    state: string
  }): string {
    const url = new URL(this.authorizationEndpoint)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('redirect_uri', this.redirectUri)
    url.searchParams.set('state', options.state)
    url.searchParams.set('code_challenge', options.codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
    return url.toString()
  }

  async exchangeAuthorizationCode(options: {
    code: string
    codeVerifier: string
  }): Promise<GarminConnectionGrant> {
    const request = this.options.fetch ?? fetch
    const clientSecret = nonEmpty(
      this.clientSecret,
      'The OAuth client secret',
    )
    const response = await request(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: options.code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: clientSecret,
        code_verifier: options.codeVerifier,
      }),
    })
    if (!response.ok) {
      throw new Error('The OAuth provider rejected the token exchange.')
    }
    const tokenResponse = await response.json()
    const rawGrant = tokenGrant(
      tokenResponse,
      this.options.now?.() ?? new Date(),
    )
    try {
      const userResponse = await request(this.userIdEndpoint, {
        headers: { authorization: `Bearer ${rawGrant.accessToken}` },
      })
      if (!userResponse.ok) {
        throw new Error('The OAuth provider rejected the user lookup.')
      }
      return {
        ...rawGrant,
        providerUserId: providerUserId(await userResponse.json()),
      }
    } catch (error) {
      try {
        await this.revoke(rawGrant)
      } catch {
        // The unusable grant was never mapped to an owner. A later provider
        // cleanup cannot safely recover it, so this best-effort call is the
        // only permitted custody path.
      }
      throw error
    }
  }

  async revoke(grant: GarminTokenGrant): Promise<void> {
    const request = this.options.fetch ?? fetch
    const clientSecret = nonEmpty(
      this.clientSecret,
      'The OAuth client secret',
    )
    const response = await request(this.revocationEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: grant.refreshToken ?? grant.accessToken,
        token_type_hint: grant.refreshToken ? 'refresh_token' : 'access_token',
        client_id: this.clientId,
        client_secret: clientSecret,
      }),
    })
    if (!response.ok) {
      throw new Error('The OAuth provider rejected grant revocation.')
    }
  }
}
