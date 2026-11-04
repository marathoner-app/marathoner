export type GarminConnectionStatus = Readonly<{
  status: 'connected' | 'disconnected' | 'disconnecting'
  connectedAt: string | null
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

export type GarminConnectionStatusResult =
  | GarminConnectionStatus
  | Exclude<GarminStartResult, { status: 'ready' }>

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseGarminStartResult(value: unknown): GarminStartResult {
  if (!isRecord(value)) throw new Error('Marathoner returned an invalid Garmin response.')
  if (
    value.status === 'ready' &&
    typeof value.authorizationUrl === 'string' &&
    value.authorizationUrl.startsWith('https://')
  ) {
    return { status: 'ready', authorizationUrl: value.authorizationUrl }
  }
  if (
    (value.status === 'authentication_error' ||
      value.status === 'authorization_error' ||
      value.status === 'unavailable') &&
    (value.code === 'authentication-required' ||
      value.code === 'app-check-required' ||
      value.code === 'approved-beta-membership-required' ||
      value.code === 'garmin-oauth-disabled')
  ) {
    return { status: value.status, code: value.code }
  }
  throw new Error('Marathoner returned an invalid Garmin response.')
}

export function parseGarminConnectionStatusResult(
  value: unknown,
): GarminConnectionStatusResult {
  if (isRecord(value)) {
    if (
      (value.status === 'connected' || value.status === 'disconnecting') &&
      (typeof value.connectedAt === 'string' || value.connectedAt === null)
    ) {
      return { status: value.status, connectedAt: value.connectedAt }
    }
    if (value.status === 'disconnected' && value.connectedAt === null) {
      return { status: 'disconnected', connectedAt: null }
    }
  }
  const failure = parseGarminStartResult(value)
  if (failure.status === 'ready') {
    throw new Error('Marathoner returned an invalid Garmin response.')
  }
  return failure
}

export function parseGarminDisconnectResult(
  value: unknown,
): GarminDisconnectResult {
  if (!isRecord(value)) throw new Error('Marathoner returned an invalid Garmin response.')
  if (value.status === 'disconnected' || value.status === 'pending') {
    return { status: value.status }
  }
  if (
    (value.status === 'authentication_error' ||
      value.status === 'authorization_error' ||
      value.status === 'unavailable') &&
    (value.code === 'authentication-required' ||
      value.code === 'app-check-required' ||
      value.code === 'provider-revocation-failed' ||
      value.code === 'garmin-oauth-disabled')
  ) {
    return { status: value.status, code: value.code }
  }
  throw new Error('Marathoner returned an invalid Garmin response.')
}
