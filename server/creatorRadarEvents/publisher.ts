import {
  MARATHONER_ATTRIBUTION_CONTRACT_VERSION,
  CREATOR_RADAR_ACCEPTED_REASON_CODES,
  CREATOR_RADAR_REJECTED_REASON_CODES,
  assertMarathonerAttributionEvent,
  deriveCreatorRadarReceiptId,
  type CreatorRadarEventReceipt,
  type CreatorRadarAcceptedEventReceipt,
  type CreatorRadarRejectedEventReceipt,
  type MarathonerAttributionEvent,
} from './contract.ts'
import { canonicalJson, type Sha256Digester } from './crypto.ts'
import { deriveMarathonerAttributionEventId, type MarathonerAttributionEventWithoutId } from './journey.ts'

export const CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE =
  'https://us-central1-marathoner-creator-radar-dev.cloudfunctions.net/ingestMarathonerEvent' as const

export interface GoogleOidcTokenProvider {
  getIdToken(audience: string): Promise<string>
}

export interface CreatorRadarEventTransport {
  post(input: {
    readonly audience: string
    readonly bearerToken: string
    readonly eventChecksum: string
    readonly event: MarathonerAttributionEvent
  }): Promise<{ readonly status: number; readonly body: unknown }>
}

export interface CreatorRadarEventPublisherOptions {
  readonly audience: string
  readonly oidcTokenProvider: GoogleOidcTokenProvider
  readonly transport: CreatorRadarEventTransport
  readonly sha256: Sha256Digester
}

type PublisherErrorCode =
  | 'invalid-audience'
  | 'invalid-event'
  | 'identity-token-unavailable'
  | 'transport-failed'
  | 'invalid-receipt'
  | 'event-rejected'
  | 'event-conflict'

export class CreatorRadarEventPublisherError extends Error {
  constructor(readonly code: PublisherErrorCode) {
    super(`Creator Radar event publication failed: ${code}.`)
    this.name = 'CreatorRadarEventPublisherError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAcceptedReceipt(
  value: unknown,
  eventId: string,
  expectedReceiptId: string,
): value is CreatorRadarAcceptedEventReceipt {
  if (!isRecord(value)) return false
  const expectedKeys = [
    'contractVersion',
    'eventId',
    'receiptId',
    'status',
    'replayed',
    'reasonCode',
    'latencyMilliseconds',
  ].sort()
  const actualKeys = Object.keys(value).sort()
  return expectedKeys.length === actualKeys.length
    && expectedKeys.every((key, index) => key === actualKeys[index])
    && value.contractVersion === MARATHONER_ATTRIBUTION_CONTRACT_VERSION
    && value.eventId === eventId
    && typeof value.receiptId === 'string'
    && value.receiptId === expectedReceiptId
    && ['matched', 'unmatched'].includes(String(value.status))
    && typeof value.replayed === 'boolean'
    && typeof value.reasonCode === 'string'
    && CREATOR_RADAR_ACCEPTED_REASON_CODES.includes(value.reasonCode as typeof CREATOR_RADAR_ACCEPTED_REASON_CODES[number])
    && typeof value.latencyMilliseconds === 'number'
    && Number.isSafeInteger(value.latencyMilliseconds)
    && value.latencyMilliseconds >= 0
}

function isRejectedReceipt(value: unknown): value is CreatorRadarRejectedEventReceipt {
  if (!isRecord(value)) return false
  return Object.keys(value).sort().join(',') === 'contractVersion,reasonCode,status'
    && value.contractVersion === MARATHONER_ATTRIBUTION_CONTRACT_VERSION
    && value.status === 'rejected'
    && typeof value.reasonCode === 'string'
    && CREATOR_RADAR_REJECTED_REASON_CODES.includes(value.reasonCode as typeof CREATOR_RADAR_REJECTED_REASON_CODES[number])
}

export class CreatorRadarEventPublisher {
  constructor(private readonly options: CreatorRadarEventPublisherOptions) {
    if (options.audience !== CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE) {
      throw new CreatorRadarEventPublisherError('invalid-audience')
    }
  }

  async publish(event: MarathonerAttributionEvent): Promise<CreatorRadarEventReceipt> {
    assertMarathonerAttributionEvent(event)
    const eventWithoutId = Object.fromEntries(
      Object.entries(event).filter(([key]) => key !== 'eventId'),
    ) as MarathonerAttributionEventWithoutId
    const expectedEventId = await deriveMarathonerAttributionEventId(eventWithoutId, this.options.sha256)
    if (event.eventId !== expectedEventId) throw new CreatorRadarEventPublisherError('invalid-event')
    let bearerToken: string
    try {
      bearerToken = await this.options.oidcTokenProvider.getIdToken(CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE)
    } catch {
      throw new CreatorRadarEventPublisherError('identity-token-unavailable')
    }
    if (!bearerToken.trim()) throw new CreatorRadarEventPublisherError('identity-token-unavailable')

    const eventChecksum = await this.options.sha256.digestUtf8(canonicalJson(event))
    let response: Awaited<ReturnType<CreatorRadarEventTransport['post']>>
    try {
      response = await this.options.transport.post({
        audience: CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE,
        bearerToken,
        eventChecksum,
        event,
      })
    } catch {
      throw new CreatorRadarEventPublisherError('transport-failed')
    }

    if (response.status < 200 || response.status >= 300) {
      if (!isRejectedReceipt(response.body)) throw new CreatorRadarEventPublisherError('invalid-receipt')
      if (response.status === 409 && response.body.reasonCode === 'event-conflict') {
        throw new CreatorRadarEventPublisherError('event-conflict')
      }
      throw new CreatorRadarEventPublisherError('event-rejected')
    }
    const expectedReceiptId = await deriveCreatorRadarReceiptId(
      event.eventId,
      (value) => this.options.sha256.digestUtf8(value),
    )
    if (!isAcceptedReceipt(response.body, event.eventId, expectedReceiptId)) {
      throw new CreatorRadarEventPublisherError('invalid-receipt')
    }
    if (response.status === 202 && !response.body.replayed) return response.body
    if (response.status === 200 && response.body.replayed) return response.body
    throw new CreatorRadarEventPublisherError('invalid-receipt')
  }
}
