// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  CreatorRadarEventPublisher,
  CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE,
  WebCryptoSha256Digester,
  bindFirstEligibleTouch,
  consumeInitialReferralClaim,
  JourneyEventFactory,
  deriveCreatorRadarReceiptId,
  type AtomicReferralClaimStore,
  type CreatorRadarEventTransport,
  type GoogleOidcTokenProvider,
} from './index.ts'

const audience = CREATOR_RADAR_DEVELOPMENT_EVENT_AUDIENCE

async function eventFixture() {
  const sha256 = new WebCryptoSha256Digester()
  const store: AtomicReferralClaimStore = {
    async consume() {
      return {
        handoffId: 'hnd_22222222222222222222222222222222',
        referralLinkId: 'ref_fictional-cascade',
        referralLinkVersionId: 'rlv_fictional-cascade-v2',
        referralLinkVersion: 2,
        firstEligibleTouchAt: '2026-08-13T18:00:00.000Z',
        claimExpiresAt: '2026-08-14T18:00:00.000Z',
      }
    },
  }
  const anonymous = await consumeInitialReferralClaim({
    rawToken: '__79_Pv6-fj39vX08_Lx8O_u7ezr6uno5-bl5OPi4eA',
    consumedAt: '2026-08-13T18:00:00.000Z',
    claimStore: store,
    sha256,
  })
  const bound = await bindFirstEligibleTouch({
    journey: anonymous,
    pseudonymousUserId: 'usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    accountCreatedAt: '2026-08-13T18:10:00.000Z',
    bindingStore: { async bind(input) { return input } },
  })
  const factory = new JourneyEventFactory({ sourceApplicationVersion: '0.0.0-test', sha256 })
  return { event: await factory.signup(bound), sha256 }
}

async function receipt(
  eventId: `mev_${string}`,
  sha256: WebCryptoSha256Digester,
  overrides: Record<string, unknown> = {},
) {
  return {
    contractVersion: 'marathoner-creator-attribution-v1.0.0',
    eventId,
    receiptId: await deriveCreatorRadarReceiptId(eventId, (value) => sha256.digestUtf8(value)),
    status: 'matched',
    replayed: false,
    reasonCode: 'matched',
    latencyMilliseconds: 12,
    ...overrides,
  }
}

describe('CreatorRadarEventPublisher', () => {
  it('uses the exact audience for keyless OIDC and accepts one new receipt', async () => {
    const { event, sha256 } = await eventFixture()
    const getIdToken = vi.fn(async () => 'short-lived-fictional-oidc-token')
    const post = vi.fn(async (input: Parameters<CreatorRadarEventTransport['post']>[0]) => ({
      status: 202,
      body: await receipt(input.event.eventId, sha256),
    }))
    const publisher = new CreatorRadarEventPublisher({
      audience,
      oidcTokenProvider: { getIdToken },
      transport: { post },
      sha256,
    })

    await expect(publisher.publish(event)).resolves.toMatchObject({ status: 'matched', replayed: false })
    expect(getIdToken).toHaveBeenCalledExactlyOnceWith(audience)
    expect(post).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      audience,
      bearerToken: 'short-lived-fictional-oidc-token',
      event,
      eventChecksum: expect.stringMatching(/^[0-9a-f]{64}$/),
    }))
    expect(JSON.stringify(event)).not.toContain('oidc-token')
  })

  it('does not retry automatically and preserves the exact event ID and checksum on an explicit retry', async () => {
    const { event, sha256 } = await eventFixture()
    const attempts: Array<Parameters<CreatorRadarEventTransport['post']>[0]> = []
    const transport: CreatorRadarEventTransport = {
      async post(input) {
        attempts.push(input)
        if (attempts.length === 1) throw new Error('fictional timeout after no response')
        return { status: 200, body: await receipt(input.event.eventId, sha256, { replayed: true }) }
      },
    }
    const oidcTokenProvider: GoogleOidcTokenProvider = { async getIdToken() { return 'fictional-token' } }
    const publisher = new CreatorRadarEventPublisher({ audience, oidcTokenProvider, transport, sha256 })

    await expect(publisher.publish(event)).rejects.toMatchObject({ code: 'transport-failed' })
    expect(attempts).toHaveLength(1)
    await expect(publisher.publish(event)).resolves.toMatchObject({ replayed: true })
    expect(attempts).toHaveLength(2)
    expect(attempts[1]?.event.eventId).toBe(attempts[0]?.event.eventId)
    expect(attempts[1]?.eventChecksum).toBe(attempts[0]?.eventChecksum)
  })

  it('fails closed on missing identity, conflicting content, rejection, and malformed receipts', async () => {
    const { event, sha256 } = await eventFixture()
    const cases = [
      { token: '', status: 202, body: await receipt(event.eventId, sha256), code: 'identity-token-unavailable' },
      { token: 'token', status: 409, body: { contractVersion: event.contractVersion, status: 'rejected', reasonCode: 'event-conflict' }, code: 'event-conflict' },
      { token: 'token', status: 400, body: { contractVersion: event.contractVersion, status: 'rejected', reasonCode: 'invalid-contract' }, code: 'event-rejected' },
      { token: 'token', status: 400, body: { contractVersion: event.contractVersion, status: 'rejected', reasonCode: 'event-checksum-invalid' }, code: 'event-rejected' },
      { token: 'token', status: 202, body: { ...await receipt(event.eventId, sha256), surprise: true }, code: 'invalid-receipt' },
      { token: 'token', status: 202, body: await receipt(event.eventId, sha256, { status: 'unmatched', reasonCode: 'not-a-safe-code' }), code: 'invalid-receipt' },
      { token: 'token', status: 202, body: await receipt(event.eventId, sha256, { receiptId: 'mrc_00000000000000000000000000000000' }), code: 'invalid-receipt' },
    ] as const

    for (const current of cases) {
      const publisher = new CreatorRadarEventPublisher({
        audience,
        oidcTokenProvider: { async getIdToken() { return current.token } },
        transport: { async post() { return { status: current.status, body: current.body } } },
        sha256,
      })
      await expect(publisher.publish(event)).rejects.toMatchObject({ code: current.code })
    }
  })

  it('rejects every audience near-miss before requesting identity or transport', async () => {
    const getIdToken = vi.fn(async () => 'token')
    const post = vi.fn(async () => { throw new Error('must not run') })
    const transport: CreatorRadarEventTransport = { post }
    const sha256 = new WebCryptoSha256Digester()
    for (const invalid of [
      audience.replace('https:', 'http:'),
      audience.replace('us-central1-', 'us-east1-'),
      audience.replace('marathoner-creator-radar-dev', 'marathoner-creator-radar-prod'),
      `${audience}/`,
      `${audience}?audience=other`,
      `${audience}Different`,
      'not-a-url',
    ]) {
      expect(() => new CreatorRadarEventPublisher({ audience: invalid, oidcTokenProvider: { getIdToken }, transport, sha256 }))
        .toThrowError(expect.objectContaining({ code: 'invalid-audience' }))
    }
    expect(getIdToken).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  it('rejects a well-shaped but non-deterministic event ID before identity or transport', async () => {
    const { event, sha256 } = await eventFixture()
    const getIdToken = vi.fn(async () => 'token')
    const post = vi.fn(async () => { throw new Error('must not run') })
    const publisher = new CreatorRadarEventPublisher({
      audience,
      oidcTokenProvider: { getIdToken },
      transport: { post },
      sha256,
    })
    await expect(publisher.publish({ ...event, eventId: 'mev_00000000000000000000000000000000' }))
      .rejects.toMatchObject({ code: 'invalid-event' })
    expect(getIdToken).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })
})
