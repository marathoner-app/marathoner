import type { MarathonerAttributionEvent } from './contract.ts'
import { canonicalJson } from './crypto.ts'
import {
  CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE,
  type CreatorRadarEventTransport,
  type GoogleOidcTokenProvider,
} from './publisher.ts'

const metadataIdentityBaseUrl =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity'
const exactCallerServiceAccount = 'creator-radar-events-dev@marathoner-d9bf9.iam.gserviceaccount.com'
const maximumIdentityTokenBytes = 8_192
const maximumReceiptBytes = 16_384
const defaultTimeoutMilliseconds = 5_000

interface FetchResponse {
  readonly status: number
  readonly headers: Pick<Headers, 'get'>
  text(): Promise<string>
}

export type ServerFetch = (url: string, init: RequestInit) => Promise<FetchResponse>

type AdapterErrorCode =
  | 'invalid-audience'
  | 'invalid-checksum'
  | 'invalid-identity-token'
  | 'metadata-request-failed'
  | 'event-request-failed'
  | 'response-too-large'
  | 'invalid-json-response'

export class CreatorRadarAdapterError extends Error {
  constructor(readonly code: AdapterErrorCode) {
    super(`Creator Radar server adapter failed: ${code}.`)
    this.name = 'CreatorRadarAdapterError'
  }
}

function boundedByteLength(value: string, maximum: number): boolean {
  return new TextEncoder().encode(value).byteLength <= maximum
}

async function readBoundedText(response: FetchResponse, maximum: number): Promise<string> {
  const contentLength = response.headers.get('content-length')
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > maximum)) {
    throw new CreatorRadarAdapterError('response-too-large')
  }
  const body = await response.text()
  if (!boundedByteLength(body, maximum)) throw new CreatorRadarAdapterError('response-too-large')
  return body
}

async function withinTimeout<T>(
  timeoutMilliseconds: number,
  operation: (signal: AbortSignal) => Promise<T>,
  failureCode: 'metadata-request-failed' | 'event-request-failed',
): Promise<T> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMilliseconds)
  try {
    return await operation(controller.signal)
  } catch (error) {
    if (error instanceof CreatorRadarAdapterError) throw error
    throw new CreatorRadarAdapterError(failureCode)
  } finally {
    globalThis.clearTimeout(timer)
  }
}

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = globalThis.atob(padded)
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function isValidMetadataIdentityToken(token: string, nowEpochSeconds: number): boolean {
  if (!boundedByteLength(token, maximumIdentityTokenBytes)) return false
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return false
  const header = decodeBase64UrlJson(parts[0] ?? '')
  const payload = decodeBase64UrlJson(parts[1] ?? '')
  if (header === null || payload === null) return false
  return header.alg === 'RS256'
    && header.typ === 'JWT'
    && typeof header.kid === 'string'
    && /^[A-Za-z0-9_-]+$/.test(header.kid)
    && payload.aud === CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE
    && (payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com')
    && typeof payload.sub === 'string'
    && /^\d+$/.test(payload.sub)
    && payload.email === exactCallerServiceAccount
    && payload.email_verified === true
    && typeof payload.iat === 'number'
    && Number.isSafeInteger(payload.iat)
    && payload.iat <= nowEpochSeconds + 60
    && typeof payload.exp === 'number'
    && Number.isSafeInteger(payload.exp)
    && payload.exp > nowEpochSeconds
    && payload.exp <= nowEpochSeconds + 3_700
}

export interface GoogleMetadataOidcTokenProviderOptions {
  readonly fetch?: ServerFetch
  readonly timeoutMilliseconds?: number
  readonly now?: () => number
}

export class GoogleMetadataOidcTokenProvider implements GoogleOidcTokenProvider {
  private readonly fetch: ServerFetch
  private readonly timeoutMilliseconds: number
  private readonly now: () => number

  constructor(options: GoogleMetadataOidcTokenProviderOptions = {}) {
    this.fetch = options.fetch ?? globalThis.fetch
    this.timeoutMilliseconds = options.timeoutMilliseconds ?? defaultTimeoutMilliseconds
    this.now = options.now ?? Date.now
  }

  async getIdToken(audience: string): Promise<string> {
    if (audience !== CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE) {
      throw new CreatorRadarAdapterError('invalid-audience')
    }
    const url = `${metadataIdentityBaseUrl}?audience=${encodeURIComponent(CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE)}&format=full`
    const token = await withinTimeout(this.timeoutMilliseconds, async (signal) => {
      const response = await this.fetch(url, {
        method: 'GET',
        headers: { 'Metadata-Flavor': 'Google' },
        redirect: 'error',
        cache: 'no-store',
        signal,
      })
      if (response.status !== 200) throw new CreatorRadarAdapterError('metadata-request-failed')
      return (await readBoundedText(response, maximumIdentityTokenBytes)).trim()
    }, 'metadata-request-failed')

    if (!isValidMetadataIdentityToken(token, Math.floor(this.now() / 1_000))) {
      throw new CreatorRadarAdapterError('invalid-identity-token')
    }
    return token
  }
}

export interface HttpsCreatorRadarEventTransportOptions {
  readonly fetch?: ServerFetch
  readonly timeoutMilliseconds?: number
}

export class HttpsCreatorRadarEventTransport implements CreatorRadarEventTransport {
  private readonly fetch: ServerFetch
  private readonly timeoutMilliseconds: number

  constructor(options: HttpsCreatorRadarEventTransportOptions = {}) {
    this.fetch = options.fetch ?? globalThis.fetch
    this.timeoutMilliseconds = options.timeoutMilliseconds ?? defaultTimeoutMilliseconds
  }

  async post(input: {
    readonly audience: string
    readonly bearerToken: string
    readonly eventChecksum: string
    readonly event: MarathonerAttributionEvent
  }): Promise<{ readonly status: number; readonly body: unknown }> {
    if (input.audience !== CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE) {
      throw new CreatorRadarAdapterError('invalid-audience')
    }
    if (!/^[0-9a-f]{64}$/.test(input.eventChecksum)) {
      throw new CreatorRadarAdapterError('invalid-checksum')
    }
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(input.bearerToken)) {
      throw new CreatorRadarAdapterError('invalid-identity-token')
    }
    const body = canonicalJson(input.event)
    if (!boundedByteLength(body, maximumReceiptBytes)) {
      throw new CreatorRadarAdapterError('event-request-failed')
    }

    return withinTimeout(this.timeoutMilliseconds, async (signal) => {
      const response = await this.fetch(CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.bearerToken}`,
          'Content-Type': 'application/json',
          'X-Marathoner-Event-Checksum': input.eventChecksum,
        },
        body,
        redirect: 'error',
        cache: 'no-store',
        credentials: 'omit',
        signal,
      })
      const contentType = response.headers.get('content-type')
      if (contentType === null || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
        throw new CreatorRadarAdapterError('invalid-json-response')
      }
      const responseBody = await readBoundedText(response, maximumReceiptBytes)
      try {
        return { status: response.status, body: JSON.parse(responseBody) as unknown }
      } catch {
        throw new CreatorRadarAdapterError('invalid-json-response')
      }
    }, 'event-request-failed')
  }
}
