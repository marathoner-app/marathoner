import { createHash, randomBytes } from 'node:crypto'

export const GARMIN_OAUTH_STATE_LIFETIME_MILLISECONDS = 10 * 60 * 1_000

export type GarminOAuthEnvironment = 'beta' | 'development'

export type GarminTokenGrant = Readonly<{
  accessToken: string
  expiresAt: string | null
  refreshToken: string | null
}>

export type GarminConnectionStatus = Readonly<{
  status: 'connected' | 'disconnected' | 'disconnecting'
  connectedAt: string | null
}>

export type GarminOAuthLogEntry = Readonly<{
  event:
    | 'garmin-oauth-start'
    | 'garmin-oauth-callback'
    | 'garmin-oauth-disconnect'
  status:
    | 'accepted'
    | 'authentication_error'
    | 'authorization_error'
    | 'configuration_error'
    | 'invalid_request'
    | 'pending'
    | 'provider_error'
    | 'succeeded'
}>

export interface GarminOAuthProvider {
  authorizationUrl(options: {
    codeChallenge: string
    state: string
  }): string
  exchangeAuthorizationCode(options: {
    code: string
    codeVerifier: string
  }): Promise<GarminTokenGrant>
  revoke(grant: GarminTokenGrant): Promise<void>
}

export type GarminCallbackReservation =
  | {
      kind: 'reserved'
      ownerId: string
      codeVerifier: string
    }
  | { kind: 'completed' }
  | { kind: 'processing' }
  | { kind: 'invalid' }

export type GarminDisconnectReservation =
  | { kind: 'reserved'; grants: readonly GarminTokenGrant[] }
  | { kind: 'disconnected' }
  | { kind: 'processing' }

export interface GarminOAuthStore {
  createAuthorization(options: {
    createdAt: string
    environment: GarminOAuthEnvironment
    expiresAt: string
    ownerId: string
    stateDigest: string
    codeVerifier: string
  }): Promise<'created' | 'membership-required'>
  reserveCallback(options: {
    codeDigest: string
    environment: GarminOAuthEnvironment
    now: string
    stateDigest: string
  }): Promise<GarminCallbackReservation>
  completeCallback(options: {
    connectedAt: string
    environment: GarminOAuthEnvironment
    grant: GarminTokenGrant
    ownerId: string
    stateDigest: string
  }): Promise<readonly GarminTokenGrant[]>
  completePriorGrantRevocations(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
    revokedGrants: readonly GarminTokenGrant[]
  }): Promise<void>
  failCallback(options: {
    failedAt: string
    stateDigest: string
  }): Promise<void>
  readStatus(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
  }): Promise<GarminConnectionStatus>
  reserveDisconnect(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
  }): Promise<GarminDisconnectReservation>
  completeDisconnect(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
  }): Promise<void>
}

type GarminCaller = Readonly<{
  appCheckVerified: boolean
  ownerId: string | null
}>

type GarminAuthenticationFailure = Readonly<{
  status: 'authentication_error' | 'authorization_error'
  code: 'authentication-required' | 'app-check-required'
}>

type GarminOAuthDependencies = Readonly<{
  enabled: boolean
  environment: GarminOAuthEnvironment
  log: (entry: GarminOAuthLogEntry) => void
  now?: () => Date
  provider: GarminOAuthProvider
  randomBytes?: (size: number) => Uint8Array
  store: GarminOAuthStore
}>

export type GarminStartResult =
  | Readonly<{ status: 'ready'; authorizationUrl: string }>
  | Readonly<{
      status: 'authentication_error' | 'authorization_error' | 'unavailable'
      code:
        | 'authentication-required'
        | 'app-check-required'
        | 'approved-beta-membership-required'
        | 'garmin-oauth-disabled'
    }>

export type GarminCallbackResult = Readonly<{
  status: 'connected' | 'pending' | 'rejected' | 'unavailable'
  code:
    | 'connected'
    | 'already-connected'
    | 'callback-processing'
    | 'invalid-callback'
    | 'provider-exchange-failed'
    | 'garmin-oauth-disabled'
}>

export type GarminDisconnectResult =
  | Readonly<{ status: 'disconnected' | 'pending' }>
  | Readonly<{
      status: 'authentication_error' | 'authorization_error' | 'unavailable'
      code:
        | 'authentication-required'
        | 'app-check-required'
        | 'provider-revocation-failed'
        | 'garmin-oauth-disabled'
    }>

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

export function sha256Base64Url(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}

function now(dependencies: GarminOAuthDependencies): Date {
  return dependencies.now?.() ?? new Date()
}

function authenticate(
  caller: GarminCaller,
  log: GarminOAuthDependencies['log'],
  event: GarminOAuthLogEntry['event'],
): GarminAuthenticationFailure | null {
  if (caller.ownerId === null) {
    log({ event, status: 'authentication_error' })
    return {
      status: 'authentication_error',
      code: 'authentication-required',
    }
  }
  if (!caller.appCheckVerified) {
    log({ event, status: 'authorization_error' })
    return { status: 'authorization_error', code: 'app-check-required' }
  }
  return null
}

export async function startGarminOAuth(
  caller: GarminCaller,
  dependencies: GarminOAuthDependencies,
): Promise<GarminStartResult> {
  const authentication = authenticate(
    caller,
    dependencies.log,
    'garmin-oauth-start',
  )
  if (authentication) return authentication
  if (!dependencies.enabled) {
    dependencies.log({
      event: 'garmin-oauth-start',
      status: 'configuration_error',
    })
    return { status: 'unavailable', code: 'garmin-oauth-disabled' }
  }

  const random = dependencies.randomBytes ?? randomBytes
  const state = base64Url(random(32))
  const codeVerifier = base64Url(random(48))
  const createdAt = now(dependencies)
  const outcome = await dependencies.store.createAuthorization({
    createdAt: createdAt.toISOString(),
    environment: dependencies.environment,
    expiresAt: new Date(
      createdAt.getTime() + GARMIN_OAUTH_STATE_LIFETIME_MILLISECONDS,
    ).toISOString(),
    ownerId: caller.ownerId as string,
    stateDigest: sha256Base64Url(state),
    codeVerifier,
  })
  if (outcome === 'membership-required') {
    dependencies.log({
      event: 'garmin-oauth-start',
      status: 'authorization_error',
    })
    return {
      status: 'authorization_error',
      code: 'approved-beta-membership-required',
    }
  }

  dependencies.log({ event: 'garmin-oauth-start', status: 'accepted' })
  return {
    status: 'ready',
    authorizationUrl: dependencies.provider.authorizationUrl({
      codeChallenge: sha256Base64Url(codeVerifier),
      state,
    }),
  }
}

export async function completeGarminOAuthCallback(
  input: Readonly<{ code: string; state: string }>,
  dependencies: GarminOAuthDependencies,
): Promise<GarminCallbackResult> {
  if (!dependencies.enabled) {
    dependencies.log({
      event: 'garmin-oauth-callback',
      status: 'configuration_error',
    })
    return { status: 'unavailable', code: 'garmin-oauth-disabled' }
  }
  if (
    input.code.length < 8 ||
    input.code.length > 4_096 ||
    input.state.length < 32 ||
    input.state.length > 256 ||
    !/^[A-Za-z0-9_-]+$/.test(input.state)
  ) {
    dependencies.log({
      event: 'garmin-oauth-callback',
      status: 'invalid_request',
    })
    return { status: 'rejected', code: 'invalid-callback' }
  }

  const stateDigest = sha256Base64Url(input.state)
  const reservation = await dependencies.store.reserveCallback({
    codeDigest: sha256Base64Url(input.code),
    environment: dependencies.environment,
    now: now(dependencies).toISOString(),
    stateDigest,
  })
  if (reservation.kind === 'invalid') {
    dependencies.log({
      event: 'garmin-oauth-callback',
      status: 'invalid_request',
    })
    return { status: 'rejected', code: 'invalid-callback' }
  }
  if (reservation.kind === 'completed') {
    dependencies.log({ event: 'garmin-oauth-callback', status: 'succeeded' })
    return { status: 'connected', code: 'already-connected' }
  }
  if (reservation.kind === 'processing') {
    dependencies.log({ event: 'garmin-oauth-callback', status: 'pending' })
    return { status: 'pending', code: 'callback-processing' }
  }

  let exchangedGrant: GarminTokenGrant | null = null
  try {
    exchangedGrant = await dependencies.provider.exchangeAuthorizationCode({
      code: input.code,
      codeVerifier: reservation.codeVerifier,
    })
    const priorGrants = await dependencies.store.completeCallback({
      connectedAt: now(dependencies).toISOString(),
      environment: dependencies.environment,
      grant: exchangedGrant,
      ownerId: reservation.ownerId,
      stateDigest,
    })
    if (priorGrants.length > 0) {
      try {
        for (const priorGrant of priorGrants) {
          await dependencies.provider.revoke(priorGrant)
        }
        await dependencies.store.completePriorGrantRevocations({
          environment: dependencies.environment,
          ownerId: reservation.ownerId,
          revokedGrants: priorGrants,
        })
      } catch {
        // The old grant stays in trusted custody for the next reconnect or
        // disconnect attempt. It is never returned to the client.
      }
    }
    dependencies.log({ event: 'garmin-oauth-callback', status: 'succeeded' })
    return { status: 'connected', code: 'connected' }
  } catch {
    if (exchangedGrant) {
      try {
        await dependencies.provider.revoke(exchangedGrant)
      } catch {
        // The original failure remains authoritative and no private provider
        // detail is returned or logged.
      }
    }
    try {
      await dependencies.store.failCallback({
        failedAt: now(dependencies).toISOString(),
        stateDigest,
      })
    } catch {
      // Return the fixed failure contract even when the receipt cannot be
      // updated. No provider or owner detail is exposed.
    }
    dependencies.log({
      event: 'garmin-oauth-callback',
      status: 'provider_error',
    })
    return { status: 'rejected', code: 'provider-exchange-failed' }
  }
}

export async function getGarminConnectionStatus(
  caller: GarminCaller,
  dependencies: GarminOAuthDependencies,
): Promise<GarminConnectionStatus | GarminStartResult> {
  const authentication = authenticate(
    caller,
    dependencies.log,
    'garmin-oauth-start',
  )
  if (authentication) return authentication
  if (!dependencies.enabled) {
    return { status: 'unavailable', code: 'garmin-oauth-disabled' }
  }
  return dependencies.store.readStatus({
    environment: dependencies.environment,
    ownerId: caller.ownerId as string,
  })
}

export async function disconnectGarmin(
  caller: GarminCaller,
  dependencies: GarminOAuthDependencies,
): Promise<GarminDisconnectResult> {
  const authentication = authenticate(
    caller,
    dependencies.log,
    'garmin-oauth-disconnect',
  )
  if (authentication) return authentication
  if (!dependencies.enabled) {
    dependencies.log({
      event: 'garmin-oauth-disconnect',
      status: 'configuration_error',
    })
    return { status: 'unavailable', code: 'garmin-oauth-disabled' }
  }

  const reservation = await dependencies.store.reserveDisconnect({
    environment: dependencies.environment,
    ownerId: caller.ownerId as string,
  })
  if (reservation.kind === 'disconnected') {
    dependencies.log({
      event: 'garmin-oauth-disconnect',
      status: 'succeeded',
    })
    return { status: 'disconnected' }
  }
  if (reservation.kind === 'processing') {
    dependencies.log({ event: 'garmin-oauth-disconnect', status: 'pending' })
    return { status: 'pending' }
  }

  try {
    for (const grant of reservation.grants) {
      await dependencies.provider.revoke(grant)
    }
    await dependencies.store.completeDisconnect({
      environment: dependencies.environment,
      ownerId: caller.ownerId as string,
    })
    dependencies.log({
      event: 'garmin-oauth-disconnect',
      status: 'succeeded',
    })
    return { status: 'disconnected' }
  } catch {
    dependencies.log({
      event: 'garmin-oauth-disconnect',
      status: 'provider_error',
    })
    return { status: 'unavailable', code: 'provider-revocation-failed' }
  }
}
