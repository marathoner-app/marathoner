import {
  MARATHONER_ATTRIBUTION_CONTRACT_VERSION,
  MARATHONER_ATTRIBUTION_SCHEMA_VERSION,
  MarathonerAttributionValidationError,
  assertMarathonerAttributionEvent,
  type FirstAuthenticatedNativeUseEvent,
  type FirstLoggedRunEvent,
  type MarathonerAttributionEvent,
  type MeaningfulActivationEvent,
  type OnboardingCompletedEvent,
  type PlanCreatedEvent,
  type ReferralVisitEvent,
  type SignupEvent,
  type StoreHandoffEvent,
} from './contract.ts'
import { canonicalJson, type Sha256Digester } from './crypto.ts'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const MAXIMUM_CLAIM_LIFETIME_MS = 24 * 60 * 60 * 1000
const rawClaimPattern = /^[A-Za-z0-9_-]+$/

export interface ReferralClaimRecord {
  readonly handoffId: `hnd_${string}`
  readonly referralLinkId: `ref_${string}`
  readonly referralLinkVersionId: `rlv_${string}`
  readonly referralLinkVersion: number
  readonly firstEligibleTouchAt: string
  readonly claimExpiresAt: string
}

export interface AtomicReferralClaimStore {
  consume(input: {
    readonly handoffTokenDigest: string
    readonly consumedAt: string
  }): Promise<ReferralClaimRecord | null>
}

export interface AccountBindingRecord {
  readonly handoffId: `hnd_${string}`
  readonly pseudonymousUserId: string
  readonly accountCreatedAt: string
}

export interface AtomicAccountBindingStore {
  bind(input: AccountBindingRecord): Promise<AccountBindingRecord>
}

export interface AnonymousAttributionJourney extends ReferralClaimRecord {
  readonly handoffTokenDigest: string
  readonly acquisitionWindowEndsAt: string
}

export interface BoundAttributionJourney extends AnonymousAttributionJourney {
  readonly pseudonymousUserId: string
  readonly accountCreatedAt: string
  readonly activationWindowEndsAt: string
}

export interface JourneyEventFactoryOptions {
  readonly sourceApplicationVersion: string
  readonly sha256: Sha256Digester
}

interface CommonEventInput {
  readonly eventType: MarathonerAttributionEvent['eventType']
  readonly occurredAt: string
  readonly journey: AnonymousAttributionJourney
  readonly pseudonymousUserId?: string
  readonly handoffTokenDigest?: string
  readonly data: MarathonerAttributionEvent['data']
}

export type MarathonerAttributionEventWithoutId = Omit<MarathonerAttributionEvent, 'eventId'>

export async function deriveMarathonerAttributionEventId(
  eventWithoutId: MarathonerAttributionEventWithoutId,
  sha256: Sha256Digester,
): Promise<`mev_${string}`> {
  const digest = await sha256.digestUtf8(canonicalJson(eventWithoutId))
  return `mev_${digest.slice(0, 32)}`
}

function parseInstant(value: string, code: MarathonerAttributionValidationError['code']): number {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed) || new Date(parsed).toISOString() !== value) {
    throw new MarathonerAttributionValidationError(code)
  }
  return parsed
}

function addThirtyDays(value: string): string {
  return new Date(parseInstant(value, 'invalid-claim') + THIRTY_DAYS_MS).toISOString()
}

function assertInsideWindow(occurredAt: string, startAt: string, endAt: string): void {
  const occurred = parseInstant(occurredAt, 'invalid-event')
  if (occurred < parseInstant(startAt, 'invalid-event') || occurred > parseInstant(endAt, 'invalid-event')) {
    throw new MarathonerAttributionValidationError('outside-attribution-window')
  }
}

function validateRawClaim(rawToken: string): void {
  if (rawToken.length > 684 || !rawClaimPattern.test(rawToken)) {
    throw new MarathonerAttributionValidationError('invalid-claim')
  }
  try {
    const normalized = rawToken.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = globalThis.atob(padded)
    if (decoded.length < 32 || decoded.length > 512) {
      throw new MarathonerAttributionValidationError('invalid-claim')
    }
  } catch (error) {
    if (error instanceof MarathonerAttributionValidationError) throw error
    throw new MarathonerAttributionValidationError('invalid-claim')
  }
}

export async function consumeInitialReferralClaim(input: {
  readonly rawToken: string
  readonly consumedAt: string
  readonly claimStore: AtomicReferralClaimStore
  readonly sha256: Sha256Digester
}): Promise<AnonymousAttributionJourney> {
  validateRawClaim(input.rawToken)
  parseInstant(input.consumedAt, 'invalid-claim')
  const handoffTokenDigest = await input.sha256.digestUtf8(input.rawToken)
  const claimed = await input.claimStore.consume({ handoffTokenDigest, consumedAt: input.consumedAt })
  if (claimed === null) throw new MarathonerAttributionValidationError('claim-unavailable')

  const touch = parseInstant(claimed.firstEligibleTouchAt, 'invalid-claim')
  const expiry = parseInstant(claimed.claimExpiresAt, 'invalid-claim')
  const consumed = parseInstant(input.consumedAt, 'invalid-claim')
  if (expiry <= touch || expiry - touch > MAXIMUM_CLAIM_LIFETIME_MS || consumed < touch || consumed > expiry) {
    throw new MarathonerAttributionValidationError('claim-unavailable')
  }

  return {
    ...claimed,
    handoffTokenDigest,
    acquisitionWindowEndsAt: addThirtyDays(claimed.firstEligibleTouchAt),
  }
}

export async function bindFirstEligibleTouch(input: {
  readonly journey: AnonymousAttributionJourney
  readonly pseudonymousUserId: string
  readonly accountCreatedAt: string
  readonly bindingStore: AtomicAccountBindingStore
}): Promise<BoundAttributionJourney> {
  assertInsideWindow(
    input.accountCreatedAt,
    input.journey.firstEligibleTouchAt,
    input.journey.acquisitionWindowEndsAt,
  )
  if (!/^hnd_[0-9a-f]{32}$/.test(input.journey.handoffId)
    || !/^usr_[0-9a-f]{32}$/.test(input.pseudonymousUserId)) {
    throw new MarathonerAttributionValidationError('invalid-event')
  }
  const requestedBinding: AccountBindingRecord = {
    handoffId: input.journey.handoffId,
    pseudonymousUserId: input.pseudonymousUserId,
    accountCreatedAt: input.accountCreatedAt,
  }
  let persistedBinding: AccountBindingRecord
  try {
    persistedBinding = await input.bindingStore.bind(requestedBinding)
  } catch {
    throw new MarathonerAttributionValidationError('binding-unavailable')
  }
  if (persistedBinding.handoffId !== requestedBinding.handoffId
    || persistedBinding.pseudonymousUserId !== requestedBinding.pseudonymousUserId
    || persistedBinding.accountCreatedAt !== requestedBinding.accountCreatedAt) {
    throw new MarathonerAttributionValidationError('binding-conflict')
  }
  return {
    ...input.journey,
    pseudonymousUserId: input.pseudonymousUserId,
    accountCreatedAt: input.accountCreatedAt,
    activationWindowEndsAt: addThirtyDays(input.accountCreatedAt),
  }
}

export class JourneyEventFactory {
  constructor(private readonly options: JourneyEventFactoryOptions) {}

  async referralVisit(
    journey: AnonymousAttributionJourney,
    occurredAt: string,
    routingSurface: ReferralVisitEvent['data']['routingSurface'],
  ): Promise<ReferralVisitEvent> {
    assertInsideWindow(occurredAt, journey.firstEligibleTouchAt, journey.acquisitionWindowEndsAt)
    return this.create({ eventType: 'referralVisit', occurredAt, journey, handoffTokenDigest: journey.handoffTokenDigest, data: { routingSurface } }) as Promise<ReferralVisitEvent>
  }

  async storeHandoff(
    journey: AnonymousAttributionJourney,
    occurredAt: string,
    store: StoreHandoffEvent['data']['store'],
  ): Promise<StoreHandoffEvent> {
    assertInsideWindow(occurredAt, journey.firstEligibleTouchAt, journey.acquisitionWindowEndsAt)
    return this.create({ eventType: 'storeHandoff', occurredAt, journey, handoffTokenDigest: journey.handoffTokenDigest, data: { store, attributionCapability: 'aggregate-corroboration-only' } }) as Promise<StoreHandoffEvent>
  }

  signup(journey: BoundAttributionJourney): Promise<SignupEvent> {
    return this.create({ eventType: 'signup', occurredAt: journey.accountCreatedAt, journey, pseudonymousUserId: journey.pseudonymousUserId, handoffTokenDigest: journey.handoffTokenDigest, data: { accountCreatedAt: journey.accountCreatedAt } }) as Promise<SignupEvent>
  }

  async firstAuthenticatedNativeUse(
    journey: BoundAttributionJourney,
    occurredAt: string,
    platform: FirstAuthenticatedNativeUseEvent['data']['platform'],
  ): Promise<FirstAuthenticatedNativeUseEvent> {
    return this.activationEvent(journey, occurredAt, 'firstAuthenticatedNativeUse', { platform, installProof: false }) as Promise<FirstAuthenticatedNativeUseEvent>
  }

  async onboardingCompleted(journey: BoundAttributionJourney, occurredAt: string): Promise<OnboardingCompletedEvent> {
    return this.activationEvent(journey, occurredAt, 'onboardingCompleted', { completedAt: occurredAt }) as Promise<OnboardingCompletedEvent>
  }

  async planCreated(journey: BoundAttributionJourney, occurredAt: string): Promise<PlanCreatedEvent> {
    return this.activationEvent(journey, occurredAt, 'planCreated', { planCreatedAt: occurredAt }) as Promise<PlanCreatedEvent>
  }

  async firstLoggedRun(journey: BoundAttributionJourney, occurredAt: string): Promise<FirstLoggedRunEvent> {
    return this.activationEvent(journey, occurredAt, 'firstLoggedRun', { runLoggedAt: occurredAt }) as Promise<FirstLoggedRunEvent>
  }

  async meaningfulActivation(journey: BoundAttributionJourney, occurredAt: string): Promise<MeaningfulActivationEvent> {
    return this.activationEvent(journey, occurredAt, 'meaningfulActivation', { criterion: 'onboarding-and-plan-and-first-run', qualifiedAt: occurredAt }) as Promise<MeaningfulActivationEvent>
  }

  private async activationEvent(
    journey: BoundAttributionJourney,
    occurredAt: string,
    eventType: Exclude<MarathonerAttributionEvent['eventType'], 'referralVisit' | 'storeHandoff' | 'signup'>,
    data: MarathonerAttributionEvent['data'],
  ): Promise<MarathonerAttributionEvent> {
    assertInsideWindow(occurredAt, journey.accountCreatedAt, journey.activationWindowEndsAt)
    return this.create({ eventType, occurredAt, journey, pseudonymousUserId: journey.pseudonymousUserId, data })
  }

  private async create(input: CommonEventInput): Promise<MarathonerAttributionEvent> {
    const withoutEventId = {
      schemaVersion: MARATHONER_ATTRIBUTION_SCHEMA_VERSION,
      contractVersion: MARATHONER_ATTRIBUTION_CONTRACT_VERSION,
      sourceEnvironment: 'development' as const,
      sourceApplicationVersion: this.options.sourceApplicationVersion,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      ...(input.pseudonymousUserId === undefined ? {} : { pseudonymousUserId: input.pseudonymousUserId }),
      handoffId: input.journey.handoffId,
      ...(input.handoffTokenDigest === undefined ? {} : { handoffTokenDigest: input.handoffTokenDigest }),
      referralLinkId: input.journey.referralLinkId,
      referralLinkVersionId: input.journey.referralLinkVersionId,
      referralLinkVersion: input.journey.referralLinkVersion,
      testMode: true as const,
      data: input.data,
    }
    const eventId = await deriveMarathonerAttributionEventId(withoutEventId, this.options.sha256)
    const event = { ...withoutEventId, eventId }
    assertMarathonerAttributionEvent(event)
    return event
  }
}
