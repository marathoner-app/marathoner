// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  JourneyEventFactory,
  MarathonerAttributionValidationError,
  WebCryptoSha256Digester,
  bindFirstEligibleTouch,
  canonicalJson,
  consumeInitialReferralClaim,
  deriveMarathonerAttributionEventId,
  deriveCreatorRadarReceiptId,
  isMarathonerAttributionEvent,
  type AccountBindingRecord,
  type AtomicAccountBindingStore,
  type AtomicReferralClaimStore,
  type ReferralClaimRecord,
} from './index.ts'

const rawToken = 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA'
const firstTouchAt = '2026-08-13T16:00:00.000Z'
const claim: ReferralClaimRecord = {
  handoffId: 'hnd_11111111111111111111111111111111',
  referralLinkId: 'ref_fictional-river',
  referralLinkVersionId: 'rlv_fictional-river-v1',
  referralLinkVersion: 1,
  firstEligibleTouchAt: firstTouchAt,
  claimExpiresAt: '2026-08-14T16:00:00.000Z',
}
const sharedReferralVisitSeed = {
  schemaVersion: 1 as const,
  contractVersion: 'marathoner-creator-attribution-v1.0.0' as const,
  sourceEnvironment: 'development' as const,
  sourceApplicationVersion: '0.0.0-test',
  eventType: 'referralVisit' as const,
  occurredAt: '2026-08-13T16:00:00.000Z',
  handoffId: 'hnd_11111111111111111111111111111111' as const,
  handoffTokenDigest: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  referralLinkId: 'ref_fictional-river' as const,
  referralLinkVersionId: 'rlv_fictional-river-v1' as const,
  referralLinkVersion: 1,
  testMode: true as const,
  data: { routingSurface: 'iosUniversalLink' as const },
}
const sharedReferralVisitEventId = 'mev_02b7512d920c8b48565f4eb96a89b03a' as const

class SingleUseClaimStore implements AtomicReferralClaimStore {
  readonly attempts: Array<{ handoffTokenDigest: string; consumedAt: string }> = []
  private consumed = false

  async consume(input: { handoffTokenDigest: string; consumedAt: string }): Promise<ReferralClaimRecord | null> {
    this.attempts.push(input)
    if (this.consumed) return null
    this.consumed = true
    return claim
  }
}

class InMemoryAtomicAccountBindingStore implements AtomicAccountBindingStore {
  readonly attempts: AccountBindingRecord[] = []
  binding: AccountBindingRecord | null = null

  async bind(input: AccountBindingRecord): Promise<AccountBindingRecord> {
    this.attempts.push(input)
    await Promise.resolve()
    if (this.binding === null) this.binding = input
    return this.binding
  }
}

async function fictionalJourney() {
  const sha256 = new WebCryptoSha256Digester()
  const store = new SingleUseClaimStore()
  const bindingStore = new InMemoryAtomicAccountBindingStore()
  const anonymous = await consumeInitialReferralClaim({
    rawToken,
    consumedAt: firstTouchAt,
    claimStore: store,
    sha256,
  })
  const bound = await bindFirstEligibleTouch({
    journey: anonymous,
    pseudonymousUserId: 'usr_77777777777777777777777777777777',
    accountCreatedAt: '2026-08-13T16:20:00.000Z',
    bindingStore,
  })
  const factory = new JourneyEventFactory({ sourceApplicationVersion: '0.0.0-test', sha256 })
  return { anonymous, bound, bindingStore, factory, sha256, store }
}

describe('Marathoner Creator Radar attribution journey', () => {
  it('creates the complete fictional v1 journey without an install claim or private runner data', async () => {
    const { anonymous, bound, factory } = await fictionalJourney()
    const events = await Promise.all([
      factory.referralVisit(anonymous, '2026-08-13T16:00:00.000Z', 'iosUniversalLink'),
      factory.storeHandoff(anonymous, '2026-08-13T16:03:00.000Z', 'appleAppStore'),
      factory.signup(bound),
      factory.firstAuthenticatedNativeUse(bound, '2026-08-13T16:22:00.000Z', 'ios'),
      factory.onboardingCompleted(bound, '2026-08-13T16:30:00.000Z'),
      factory.planCreated(bound, '2026-08-13T16:40:00.000Z'),
      factory.firstLoggedRun(bound, '2026-08-14T14:00:00.000Z'),
      factory.meaningfulActivation(bound, '2026-08-14T14:01:00.000Z'),
    ])

    expect(events.map((event) => event.eventType)).toEqual([
      'referralVisit',
      'storeHandoff',
      'signup',
      'firstAuthenticatedNativeUse',
      'onboardingCompleted',
      'planCreated',
      'firstLoggedRun',
      'meaningfulActivation',
    ])
    expect(events.every(isMarathonerAttributionEvent)).toBe(true)
    expect(events[3]?.data).toEqual({ platform: 'ios', installProof: false })
    expect(JSON.stringify(events)).not.toContain(rawToken)
    expect(JSON.stringify(events)).not.toMatch(/email|name|workout|distance|pace|health|goal|firebase/i)
    expect(JSON.stringify(events)).not.toContain('installProof":true')
    expect(events.slice(3).every((event) => !('handoffTokenDigest' in event))).toBe(true)
  })

  it('digests the raw claim before atomic consumption and never returns the raw token', async () => {
    const sha256 = new WebCryptoSha256Digester()
    const store = new SingleUseClaimStore()
    const journey = await consumeInitialReferralClaim({ rawToken, consumedAt: firstTouchAt, claimStore: store, sha256 })

    expect(store.attempts).toEqual([{
      handoffTokenDigest: await sha256.digestUtf8(rawToken),
      consumedAt: firstTouchAt,
    }])
    expect(journey.handoffTokenDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(canonicalJson(journey)).not.toContain(rawToken)
    expect(journey).not.toHaveProperty('rawToken')

    await expect(consumeInitialReferralClaim({ rawToken, consumedAt: firstTouchAt, claimStore: store, sha256 }))
      .rejects.toMatchObject({ code: 'claim-unavailable' })
  })

  it('requires at least 32 decoded bytes of URL-safe claim material', async () => {
    const store = new SingleUseClaimStore()
    const sha256 = new WebCryptoSha256Digester()
    await expect(consumeInitialReferralClaim({ rawToken: 'too-short', consumedAt: firstTouchAt, claimStore: store, sha256 }))
      .rejects.toEqual(new MarathonerAttributionValidationError('invalid-claim'))
    await expect(consumeInitialReferralClaim({ rawToken: `${'a'.repeat(40)}!`, consumedAt: firstTouchAt, claimStore: store, sha256 }))
      .rejects.toMatchObject({ code: 'invalid-claim' })
    await expect(consumeInitialReferralClaim({ rawToken: 'a'.repeat(42), consumedAt: firstTouchAt, claimStore: store, sha256 }))
      .rejects.toMatchObject({ code: 'invalid-claim' })
    expect(store.attempts).toHaveLength(0)
  })

  it('pins first eligible touch and enforces independent 30-day acquisition and activation windows', async () => {
    const { anonymous, factory } = await fictionalJourney()
    expect(anonymous.acquisitionWindowEndsAt).toBe('2026-09-12T16:00:00.000Z')

    const boundary = await bindFirstEligibleTouch({
      journey: anonymous,
      pseudonymousUserId: 'usr_88888888888888888888888888888888',
      accountCreatedAt: anonymous.acquisitionWindowEndsAt,
      bindingStore: new InMemoryAtomicAccountBindingStore(),
    })
    expect(boundary.activationWindowEndsAt).toBe('2026-10-12T16:00:00.000Z')
    await expect(factory.meaningfulActivation(boundary, boundary.activationWindowEndsAt)).resolves.toBeTruthy()
    await expect(factory.meaningfulActivation(boundary, '2026-10-12T16:00:00.001Z'))
      .rejects.toMatchObject({ code: 'outside-attribution-window' })
    await expect(bindFirstEligibleTouch({
      journey: anonymous,
      pseudonymousUserId: 'usr_99999999999999999999999999999999',
      accountCreatedAt: '2026-09-12T16:00:00.001Z',
      bindingStore: new InMemoryAtomicAccountBindingStore(),
    })).rejects.toMatchObject({ code: 'outside-attribution-window' })
  })

  it('atomically binds one account and permits only an exact idempotent retry', async () => {
    const { anonymous } = await fictionalJourney()
    const bindingStore = new InMemoryAtomicAccountBindingStore()
    const first = bindFirstEligibleTouch({
      journey: anonymous,
      pseudonymousUserId: 'usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      accountCreatedAt: '2026-08-13T16:20:00.000Z',
      bindingStore,
    })
    const conflicting = bindFirstEligibleTouch({
      journey: anonymous,
      pseudonymousUserId: 'usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      accountCreatedAt: '2026-08-13T16:21:00.000Z',
      bindingStore,
    })

    const concurrent = await Promise.allSettled([first, conflicting])
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(concurrent.find((result) => result.status === 'rejected'))
      .toMatchObject({ reason: { code: 'binding-conflict' } })

    const persisted = bindingStore.binding
    expect(persisted).not.toBeNull()
    if (persisted === null) throw new Error('The fictional binding store did not persist a winner.')
    const exactRetry = await bindFirstEligibleTouch({
      journey: anonymous,
      pseudonymousUserId: persisted.pseudonymousUserId,
      accountCreatedAt: persisted.accountCreatedAt,
      bindingStore,
    })
    expect(exactRetry).toMatchObject(persisted)
    await expect(bindFirstEligibleTouch({
      journey: anonymous,
      pseudonymousUserId: persisted.pseudonymousUserId,
      accountCreatedAt: '2026-08-13T16:22:00.000Z',
      bindingStore,
    })).rejects.toMatchObject({ code: 'binding-conflict' })
    await expect(bindFirstEligibleTouch({
      journey: anonymous,
      pseudonymousUserId: persisted.pseudonymousUserId === 'usr_cccccccccccccccccccccccccccccccc'
        ? 'usr_dddddddddddddddddddddddddddddddd'
        : 'usr_cccccccccccccccccccccccccccccccc',
      accountCreatedAt: persisted.accountCreatedAt,
      bindingStore,
    })).rejects.toMatchObject({ code: 'binding-conflict' })
    expect(bindingStore.attempts).toHaveLength(5)
    expect(bindingStore.attempts.every((attempt) => (
      Object.keys(attempt).sort().join(',') === 'accountCreatedAt,handoffId,pseudonymousUserId'
    ))).toBe(true)
    expect(JSON.stringify(bindingStore.attempts)).not.toContain(rawToken)
    expect(JSON.stringify(bindingStore.attempts)).not.toContain(anonymous.handoffTokenDigest)
  })

  it('derives stable event IDs for retries and different IDs for different immutable facts', async () => {
    const { bound, factory } = await fictionalJourney()
    const first = await factory.planCreated(bound, '2026-08-13T16:40:00.000Z')
    const retry = await factory.planCreated(bound, '2026-08-13T16:40:00.000Z')
    const later = await factory.planCreated(bound, '2026-08-13T16:41:00.000Z')
    expect(first.eventId).toMatch(/^mev_[0-9a-f]{32}$/)
    expect(retry).toEqual(first)
    expect(later.eventId).not.toBe(first.eventId)
  })

  it('rejects unknown envelope or event-data fields', async () => {
    const { anonymous, bound, factory } = await fictionalJourney()
    const event = await factory.firstLoggedRun(bound, '2026-08-14T14:00:00.000Z')
    const preAccount = await factory.referralVisit(anonymous, firstTouchAt, 'web')
    expect(isMarathonerAttributionEvent({ ...event, email: 'runner@example.test' })).toBe(false)
    expect(isMarathonerAttributionEvent({ ...event, data: { ...event.data, distanceMiles: 3 } })).toBe(false)
    expect(isMarathonerAttributionEvent({ ...event, eventType: 'install' })).toBe(false)
    expect(isMarathonerAttributionEvent({ ...event,
      data: { runLoggedAt: '2026-08-14T14:00:00.001Z' } })).toBe(false)
    expect(isMarathonerAttributionEvent({
      ...preAccount,
      pseudonymousUserId: 'usr_77777777777777777777777777777777',
    })).toBe(false)
    expect(isMarathonerAttributionEvent({
      ...preAccount,
      pseudonymousUserId: undefined,
    })).toBe(false)
    expect(isMarathonerAttributionEvent({ ...preAccount, referralLinkId: 'ref_Abc' })).toBe(false)
    expect(isMarathonerAttributionEvent({ ...preAccount, referralLinkId: 'ref_ab' })).toBe(false)
    expect(isMarathonerAttributionEvent({ ...preAccount, referralLinkId: `ref_${'a'.repeat(64)}` })).toBe(false)
    expect(isMarathonerAttributionEvent({ ...preAccount, referralLinkVersionId: 'rlv_Abc' })).toBe(false)
    expect(isMarathonerAttributionEvent({ ...preAccount, referralLinkVersionId: 'rlv_ab' })).toBe(false)
    expect(isMarathonerAttributionEvent({ ...preAccount, referralLinkVersionId: `rlv_${'a'.repeat(64)}` })).toBe(false)
  })

  it('uses real SHA-256 and stable key ordering', async () => {
    const sha256 = new WebCryptoSha256Digester()
    expect(await sha256.digestUtf8('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(canonicalJson({ z: 1, a: { y: true, b: 'x' } })).toBe('{"a":{"b":"x","y":true},"z":1}')
  })

  it('byte-matches the shared cross-repository referral-visit fixture', async () => {
    const sha256 = new WebCryptoSha256Digester()
    const canonicalFixture = canonicalJson(sharedReferralVisitSeed)
    expect(canonicalFixture).toBe('{"contractVersion":"marathoner-creator-attribution-v1.0.0","data":{"routingSurface":"iosUniversalLink"},"eventType":"referralVisit","handoffId":"hnd_11111111111111111111111111111111","handoffTokenDigest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","occurredAt":"2026-08-13T16:00:00.000Z","referralLinkId":"ref_fictional-river","referralLinkVersion":1,"referralLinkVersionId":"rlv_fictional-river-v1","schemaVersion":1,"sourceApplicationVersion":"0.0.0-test","sourceEnvironment":"development","testMode":true}')
    expect(new TextEncoder().encode(canonicalFixture)).toHaveLength(531)
    await expect(sha256.digestUtf8(canonicalFixture))
      .resolves.toBe('02b7512d920c8b48565f4eb96a89b03ab9c32dccea0ad90b54ece647fb5161d4')
    await expect(deriveMarathonerAttributionEventId(sharedReferralVisitSeed, sha256))
      .resolves.toBe(sharedReferralVisitEventId)
    await expect(deriveCreatorRadarReceiptId(
      sharedReferralVisitEventId,
      (value) => sha256.digestUtf8(value),
    )).resolves.toBe('mrc_392556f1e84d3c267db6c2ff4c4ef71f')
  })

  it('byte-matches the shared full-event checksum fixture after adding the derived event ID', async () => {
    const sha256 = new WebCryptoSha256Digester()
    const canonicalEvent = canonicalJson({
      ...sharedReferralVisitSeed,
      eventId: sharedReferralVisitEventId,
    })

    expect(canonicalEvent).toBe('{"contractVersion":"marathoner-creator-attribution-v1.0.0","data":{"routingSurface":"iosUniversalLink"},"eventId":"mev_02b7512d920c8b48565f4eb96a89b03a","eventType":"referralVisit","handoffId":"hnd_11111111111111111111111111111111","handoffTokenDigest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","occurredAt":"2026-08-13T16:00:00.000Z","referralLinkId":"ref_fictional-river","referralLinkVersion":1,"referralLinkVersionId":"rlv_fictional-river-v1","schemaVersion":1,"sourceApplicationVersion":"0.0.0-test","sourceEnvironment":"development","testMode":true}')
    expect(new TextEncoder().encode(canonicalEvent)).toHaveLength(580)
    await expect(sha256.digestUtf8(canonicalEvent))
      .resolves.toBe('f7311218dca3ebce297796fb7802ebad5dc08f3d4b50f68dcc93fc443edf08d5')
  })
})
