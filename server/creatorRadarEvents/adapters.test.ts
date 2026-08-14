// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE,
  GoogleMetadataOidcTokenProvider,
  HttpsCreatorRadarEventTransport,
  JourneyEventFactory,
  WebCryptoSha256Digester,
  bindFirstEligibleTouch,
  canonicalJson,
  consumeInitialReferralClaim,
  type ServerFetch,
} from './index.ts'

const fixedNow = Date.parse('2026-08-13T20:00:00.000Z')

function headers(values: Record<string, string> = {}): Pick<Headers, 'get'> {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]))
  return { get(name: string) { return normalized.get(name.toLowerCase()) ?? null } }
}

function base64Url(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function identityToken(overrides: Record<string, unknown> = {}): string {
  const nowSeconds = Math.floor(fixedNow / 1_000)
  return [
    base64Url({ alg: 'RS256', typ: 'JWT', kid: 'fictional' }),
    base64Url({
      aud: CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE,
      iss: 'https://accounts.google.com',
      sub: '100000000000000000001',
      email: 'creator-radar-events-dev@marathoner-d9bf9.iam.gserviceaccount.com',
      email_verified: true,
      iat: nowSeconds - 1,
      exp: nowSeconds + 3_600,
      ...overrides,
    }),
    'fictional_signature',
  ].join('.')
}

async function eventFixture() {
  const sha256 = new WebCryptoSha256Digester()
  const anonymous = await consumeInitialReferralClaim({
    rawToken: 'AAcOFRwjKjE4P0ZNVFtiaXB3foWMk5qhqK-2vcTL0tk',
    consumedAt: '2026-08-13T19:00:00.000Z',
    sha256,
    claimStore: {
      async consume() {
        return {
          handoffId: 'hnd_44444444444444444444444444444444' as const,
          referralLinkId: 'ref_fictional-mesa' as const,
          referralLinkVersionId: 'rlv_fictional-mesa-v1' as const,
          referralLinkVersion: 1,
          firstEligibleTouchAt: '2026-08-13T19:00:00.000Z',
          claimExpiresAt: '2026-08-14T19:00:00.000Z',
        }
      },
    },
  })
  const bound = await bindFirstEligibleTouch({
    journey: anonymous,
    pseudonymousUserId: 'usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    accountCreatedAt: '2026-08-13T19:10:00.000Z',
    bindingStore: { async bind(input) { return input } },
  })
  const factory = new JourneyEventFactory({ sourceApplicationVersion: '0.0.0-test', sha256 })
  return { event: await factory.signup(bound), sha256 }
}

describe('GoogleMetadataOidcTokenProvider', () => {
  it('makes one exact metadata request and accepts a bounded token for the pinned audience', async () => {
    const token = identityToken()
    const fetch = vi.fn<ServerFetch>(async () => ({
      status: 200,
      headers: headers({ 'content-length': String(token.length) }),
      async text() { return token },
    }))
    const provider = new GoogleMetadataOidcTokenProvider({ fetch, now: () => fixedNow })

    await expect(provider.getIdToken(CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE)).resolves.toBe(token)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE)}&format=full`,
      expect.objectContaining({
        method: 'GET',
        headers: { 'Metadata-Flavor': 'Google' },
        redirect: 'error',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('does not call metadata for an audience mismatch and rejects malformed or mis-audienced JWTs', async () => {
    const fetch = vi.fn<ServerFetch>(async () => ({
      status: 200,
      headers: headers(),
      async text() { return identityToken({ aud: 'https://example.test' }) },
    }))
    const provider = new GoogleMetadataOidcTokenProvider({ fetch, now: () => fixedNow })
    await expect(provider.getIdToken(`${CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE}/`))
      .rejects.toMatchObject({ code: 'invalid-audience' })
    expect(fetch).not.toHaveBeenCalled()

    await expect(provider.getIdToken(CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE))
      .rejects.toMatchObject({ code: 'invalid-identity-token' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('uses no automatic retry on metadata failure or oversized body', async () => {
    const unavailable = vi.fn<ServerFetch>(async () => { throw new Error('fictional unavailable') })
    const provider = new GoogleMetadataOidcTokenProvider({ fetch: unavailable, now: () => fixedNow })
    await expect(provider.getIdToken(CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE))
      .rejects.toMatchObject({ code: 'metadata-request-failed' })
    expect(unavailable).toHaveBeenCalledTimes(1)

    const oversized = vi.fn<ServerFetch>(async () => ({
      status: 200,
      headers: headers({ 'content-length': '8193' }),
      async text() { throw new Error('body must not be read') },
    }))
    await expect(new GoogleMetadataOidcTokenProvider({ fetch: oversized, now: () => fixedNow })
      .getIdToken(CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE))
      .rejects.toMatchObject({ code: 'response-too-large' })
    expect(oversized).toHaveBeenCalledTimes(1)
  })
})

describe('HttpsCreatorRadarEventTransport', () => {
  it('posts one canonical privacy-minimal event with exact auth, checksum, and request controls', async () => {
    const { event, sha256 } = await eventFixture()
    const checksum = await sha256.digestUtf8(canonicalJson(event))
    const receiptBody = JSON.stringify({
      contractVersion: event.contractVersion,
      eventId: event.eventId,
      receiptId: 'mrc_55555555555555555555555555555555',
      status: 'matched',
      replayed: false,
      reasonCode: 'matched',
      latencyMilliseconds: 12,
    })
    const fetch = vi.fn<ServerFetch>(async () => ({
      status: 202,
      headers: headers({ 'content-type': 'application/json', 'content-length': String(receiptBody.length) }),
      async text() { return receiptBody },
    }))
    const transport = new HttpsCreatorRadarEventTransport({ fetch })

    await expect(transport.post({
      audience: CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE,
      bearerToken: 'fictional.identity.token',
      eventChecksum: checksum,
      event,
    })).resolves.toEqual({ status: 202, body: JSON.parse(receiptBody) })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE, expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Bearer fictional.identity.token',
        'Content-Type': 'application/json',
        'X-Marathoner-Event-Checksum': checksum,
      },
      body: canonicalJson(event),
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      signal: expect.any(AbortSignal),
    }))
    expect(canonicalJson(event)).not.toMatch(/fictional\.identity\.token|email|workout|distance|pace|health|goal|firebase/i)
  })

  it('rejects audience drift before fetch and makes no automatic retry after fetch failure', async () => {
    const { event, sha256 } = await eventFixture()
    const checksum = await sha256.digestUtf8(canonicalJson(event))
    const fetch = vi.fn<ServerFetch>(async () => { throw new Error('fictional failure') })
    const transport = new HttpsCreatorRadarEventTransport({ fetch })

    await expect(transport.post({
      audience: `${CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE}/`,
      bearerToken: identityToken(),
      eventChecksum: checksum,
      event,
    })).rejects.toMatchObject({ code: 'invalid-audience' })
    expect(fetch).not.toHaveBeenCalled()

    await expect(transport.post({
      audience: CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE,
      bearerToken: identityToken(),
      eventChecksum: checksum,
      event,
    })).rejects.toMatchObject({ code: 'event-request-failed' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('fails closed on oversized or non-JSON receipts', async () => {
    const { event, sha256 } = await eventFixture()
    const checksum = await sha256.digestUtf8(canonicalJson(event))
    const cases = [
      { headers: headers({ 'content-type': 'application/json', 'content-length': '16385' }), body: '{}' },
      { headers: headers({ 'content-type': 'text/html' }), body: '<html></html>' },
      { headers: headers({ 'content-type': 'application/json' }), body: 'not-json' },
    ]
    for (const current of cases) {
      const fetch = vi.fn<ServerFetch>(async () => ({ status: 500, headers: current.headers, async text() { return current.body } }))
      const transport = new HttpsCreatorRadarEventTransport({ fetch })
      await expect(transport.post({
        audience: CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE,
        bearerToken: identityToken(),
        eventChecksum: checksum,
        event,
      })).rejects.toBeInstanceOf(Error)
      expect(fetch).toHaveBeenCalledTimes(1)
    }
  })
})
