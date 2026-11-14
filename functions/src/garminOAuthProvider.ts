import type {
  GarminConnectionGrant,
  GarminOAuthProvider,
  GarminRevocationOutcome,
  GarminTokenGrant,
} from './garminOAuthHandler.js'
import { GarminRevocationFailure } from './garminOAuthHandler.js'

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

async function providerErrorCode(response: Response): Promise<string | null> {
  try {
    const value = await response.clone().json()
    if (typeof value !== 'object' || value === null) return null
    const error = (value as Record<string, unknown>).error
    if (error === 'invalid_grant' || error === 'invalid_token') return error
    const errorMessage = (value as Record<string, unknown>).errorMessage
    return errorMessage === 'Unable to read oAuth header'
      ? 'invalid_token'
      : null
  } catch {
    return null
  }
}

function failureCategory(
  httpStatus: number,
): GarminRevocationFailure['category'] {
  return httpStatus === 429 || httpStatus >= 500
    ? 'transient'
    : 'provider-rejected'
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

  async revoke(grant: GarminTokenGrant): Promise<GarminRevocationOutcome> {
    const request = this.options.fetch ?? fetch
    const deleteRegistration = async (accessToken: string) => {
      try {
        return await request(this.revocationEndpoint, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${accessToken}` },
        })
      } catch {
        throw new GarminRevocationFailure({
          category: 'transient',
          httpStatus: null,
        })
      }
    }

    const initialDelete = await deleteRegistration(grant.accessToken)
    if (initialDelete.ok) {
      return { status: 'revoked', httpStatus: initialDelete.status }
    }
    if (initialDelete.status === 404 || initialDelete.status === 410) {
      return { status: 'already-invalid', httpStatus: initialDelete.status }
    }

    const initialError = await providerErrorCode(initialDelete)
    const accessGrantIsInvalid =
      initialDelete.status === 401 || initialError === 'invalid_token'
    if (!accessGrantIsInvalid) {
      throw new GarminRevocationFailure({
        category: failureCategory(initialDelete.status),
        httpStatus: initialDelete.status,
      })
    }
    if (grant.refreshToken === null) {
      return { status: 'already-invalid', httpStatus: initialDelete.status }
    }

    const clientSecret = nonEmpty(this.clientSecret, 'The OAuth client secret')
    let refreshResponse: Response
    try {
      refreshResponse = await request(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: clientSecret,
          refresh_token: grant.refreshToken,
        }),
      })
    } catch {
      throw new GarminRevocationFailure({
        category: 'transient',
        httpStatus: null,
      })
    }
    if (!refreshResponse.ok) {
      const refreshError = await providerErrorCode(refreshResponse)
      if (refreshError === 'invalid_grant' || refreshError === 'invalid_token') {
        return {
          status: 'already-invalid',
          httpStatus: refreshResponse.status,
        }
      }
      throw new GarminRevocationFailure({
        category: failureCategory(refreshResponse.status),
        httpStatus: refreshResponse.status,
      })
    }

    let refreshedGrant: GarminTokenGrant
    try {
      refreshedGrant = tokenGrant(
        await refreshResponse.json(),
        this.options.now?.() ?? new Date(),
      )
      if (refreshedGrant.refreshToken === null) {
        throw new Error('The OAuth provider returned no refresh token.')
      }
    } catch {
      throw new GarminRevocationFailure({
        category: 'provider-rejected',
        httpStatus: refreshResponse.status,
      })
    }

    let refreshedDelete: Response
    try {
      refreshedDelete = await request(this.revocationEndpoint, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${refreshedGrant.accessToken}` },
      })
    } catch {
      throw new GarminRevocationFailure({
        category: 'transient',
        httpStatus: null,
        retryGrant: refreshedGrant,
      })
    }
    if (refreshedDelete.ok) {
      return { status: 'revoked', httpStatus: refreshedDelete.status }
    }
    const refreshedError = await providerErrorCode(refreshedDelete)
    if (
      refreshedDelete.status === 404 ||
      refreshedDelete.status === 410 ||
      refreshedDelete.status === 401 ||
      refreshedError === 'invalid_token'
    ) {
      return {
        status: 'already-invalid',
        httpStatus: refreshedDelete.status,
      }
    }
    throw new GarminRevocationFailure({
      category: failureCategory(refreshedDelete.status),
      httpStatus: refreshedDelete.status,
      retryGrant: refreshedGrant,
    })
  }
}
