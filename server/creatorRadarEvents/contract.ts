export const MARATHONER_ATTRIBUTION_CONTRACT_VERSION = 'marathoner-creator-attribution-v1.0.0' as const
export const MARATHONER_ATTRIBUTION_SCHEMA_VERSION = 1 as const

export const MARATHONER_ATTRIBUTION_EVENT_TYPES = [
  'referralVisit',
  'storeHandoff',
  'firstAuthenticatedNativeUse',
  'signup',
  'onboardingCompleted',
  'planCreated',
  'firstLoggedRun',
  'meaningfulActivation',
] as const

export type MarathonerAttributionEventType = typeof MARATHONER_ATTRIBUTION_EVENT_TYPES[number]

interface EventBase<Type extends MarathonerAttributionEventType, Data> {
  readonly schemaVersion: 1
  readonly contractVersion: typeof MARATHONER_ATTRIBUTION_CONTRACT_VERSION
  readonly sourceEnvironment: 'development'
  readonly sourceApplicationVersion: string
  readonly eventId: `mev_${string}`
  readonly eventType: Type
  readonly occurredAt: string
  readonly handoffId: `hnd_${string}`
  readonly referralLinkId: `ref_${string}`
  readonly referralLinkVersionId: `rlv_${string}`
  readonly referralLinkVersion: number
  readonly testMode: true
  readonly data: Data
}

interface PreAccountEventBase<Type extends 'referralVisit' | 'storeHandoff', Data>
  extends EventBase<Type, Data> {
  readonly handoffTokenDigest: string
}

interface AccountEventBase<Type extends Exclude<MarathonerAttributionEventType, 'referralVisit' | 'storeHandoff' | 'signup'>, Data>
  extends EventBase<Type, Data> {
  readonly pseudonymousUserId: string
}

export type ReferralVisitEvent = PreAccountEventBase<'referralVisit', {
  readonly routingSurface: 'web' | 'iosUniversalLink' | 'androidAppLink'
}>

export type StoreHandoffEvent = PreAccountEventBase<'storeHandoff', {
  readonly store: 'appleAppStore' | 'googlePlay'
  readonly attributionCapability: 'aggregate-corroboration-only'
}>

export interface SignupEvent extends EventBase<'signup', {
  readonly accountCreatedAt: string
}> {
  readonly pseudonymousUserId: string
  readonly handoffTokenDigest: string
}

export type FirstAuthenticatedNativeUseEvent = AccountEventBase<'firstAuthenticatedNativeUse', {
  readonly platform: 'ios' | 'android'
  readonly installProof: false
}>

export type OnboardingCompletedEvent = AccountEventBase<'onboardingCompleted', {
  readonly completedAt: string
}>

export type PlanCreatedEvent = AccountEventBase<'planCreated', {
  readonly planCreatedAt: string
}>

export type FirstLoggedRunEvent = AccountEventBase<'firstLoggedRun', {
  readonly runLoggedAt: string
}>

export type MeaningfulActivationEvent = AccountEventBase<'meaningfulActivation', {
  readonly criterion: 'onboarding-and-plan-and-first-run'
  readonly qualifiedAt: string
}>

export type MarathonerAttributionEvent =
  | ReferralVisitEvent
  | StoreHandoffEvent
  | FirstAuthenticatedNativeUseEvent
  | SignupEvent
  | OnboardingCompletedEvent
  | PlanCreatedEvent
  | FirstLoggedRunEvent
  | MeaningfulActivationEvent

export type CreatorRadarReceiptStatus = 'matched' | 'unmatched' | 'rejected'

export const CREATOR_RADAR_ACCEPTED_REASON_CODES = [
  'matched',
  'awaiting-referral-visit',
  'awaiting-signup',
  'awaiting-onboarding',
  'awaiting-plan',
  'awaiting-first-run',
  'handoff-digest-mismatch',
  'handoff-expired',
  'account-window-expired',
  'link-inactive',
  'link-version-mismatch',
  'identity-conflict',
  'stage-already-credited',
] as const

export const CREATOR_RADAR_REJECTED_REASON_CODES = [
  'method-not-allowed',
  'content-type-required',
  'request-size-invalid',
  'event-checksum-invalid',
  'invalid-contract',
  'prohibited-field',
  'event-conflict',
  'capacity-exceeded',
  'runtime-disabled',
  'invalid-request',
  'internal-error',
] as const

export type CreatorRadarAcceptedReasonCode = typeof CREATOR_RADAR_ACCEPTED_REASON_CODES[number]
export type CreatorRadarRejectedReasonCode = typeof CREATOR_RADAR_REJECTED_REASON_CODES[number]

export async function deriveCreatorRadarReceiptId(
  eventId: `mev_${string}`,
  digestUtf8: (value: string) => Promise<string>,
): Promise<`mrc_${string}`> {
  if (!/^mev_[0-9a-f]{32}$/.test(eventId)) throw new TypeError('Invalid Marathoner event ID.')
  const digest = await digestUtf8(eventId)
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new TypeError('Invalid SHA-256 digest.')
  return `mrc_${digest.slice(0, 32)}`
}

export interface CreatorRadarAcceptedEventReceipt {
  readonly contractVersion: typeof MARATHONER_ATTRIBUTION_CONTRACT_VERSION
  readonly eventId: `mev_${string}`
  readonly receiptId: `mrc_${string}`
  readonly status: Exclude<CreatorRadarReceiptStatus, 'rejected'>
  readonly replayed: boolean
  readonly reasonCode: CreatorRadarAcceptedReasonCode
  readonly latencyMilliseconds: number
}

export interface CreatorRadarRejectedEventReceipt {
  readonly contractVersion: typeof MARATHONER_ATTRIBUTION_CONTRACT_VERSION
  readonly status: 'rejected'
  readonly reasonCode: CreatorRadarRejectedReasonCode
}

export type CreatorRadarEventReceipt = CreatorRadarAcceptedEventReceipt | CreatorRadarRejectedEventReceipt

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(record: UnknownRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort()
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index])
}

function isUtcInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  return !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value
}

const eventIdPattern = /^mev_[0-9a-f]{32}$/
const handoffIdPattern = /^hnd_[0-9a-f]{32}$/
const referralLinkIdPattern = /^ref_[a-z0-9][a-z0-9_-]{2,62}$/
const referralLinkVersionIdPattern = /^rlv_[a-z0-9][a-z0-9_-]{2,62}$/
const digestPattern = /^[0-9a-f]{64}$/
const pseudonymousUserIdPattern = /^usr_[0-9a-f]{32}$/
const applicationVersionPattern = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,63}$/

const commonKeys = [
  'schemaVersion',
  'contractVersion',
  'sourceEnvironment',
  'sourceApplicationVersion',
  'eventId',
  'eventType',
  'occurredAt',
  'handoffId',
  'referralLinkId',
  'referralLinkVersionId',
  'referralLinkVersion',
  'testMode',
  'data',
] as const

function validCommon(record: UnknownRecord): boolean {
  return record.schemaVersion === MARATHONER_ATTRIBUTION_SCHEMA_VERSION
    && record.contractVersion === MARATHONER_ATTRIBUTION_CONTRACT_VERSION
    && record.sourceEnvironment === 'development'
    && typeof record.sourceApplicationVersion === 'string'
    && applicationVersionPattern.test(record.sourceApplicationVersion)
    && typeof record.eventId === 'string'
    && eventIdPattern.test(record.eventId)
    && typeof record.eventType === 'string'
    && MARATHONER_ATTRIBUTION_EVENT_TYPES.includes(record.eventType as MarathonerAttributionEventType)
    && isUtcInstant(record.occurredAt)
    && typeof record.handoffId === 'string'
    && handoffIdPattern.test(record.handoffId)
    && typeof record.referralLinkId === 'string'
    && referralLinkIdPattern.test(record.referralLinkId)
    && typeof record.referralLinkVersionId === 'string'
    && referralLinkVersionIdPattern.test(record.referralLinkVersionId)
    && Number.isSafeInteger(record.referralLinkVersion)
    && Number(record.referralLinkVersion) > 0
    && record.testMode === true
    && isRecord(record.data)
}

function validPseudonymousUserId(value: unknown): value is string {
  return typeof value === 'string' && pseudonymousUserIdPattern.test(value)
}

function validData(record: UnknownRecord): boolean {
  if (!isRecord(record.data)) return false

  switch (record.eventType) {
    case 'referralVisit':
      return hasExactKeys(record.data, ['routingSurface'])
        && ['web', 'iosUniversalLink', 'androidAppLink'].includes(String(record.data.routingSurface))
    case 'storeHandoff':
      return hasExactKeys(record.data, ['store', 'attributionCapability'])
        && ['appleAppStore', 'googlePlay'].includes(String(record.data.store))
        && record.data.attributionCapability === 'aggregate-corroboration-only'
    case 'firstAuthenticatedNativeUse':
      return hasExactKeys(record.data, ['platform', 'installProof'])
        && ['ios', 'android'].includes(String(record.data.platform))
        && record.data.installProof === false
    case 'signup':
      return hasExactKeys(record.data, ['accountCreatedAt']) && isUtcInstant(record.data.accountCreatedAt)
        && record.data.accountCreatedAt === record.occurredAt
    case 'onboardingCompleted':
      return hasExactKeys(record.data, ['completedAt']) && isUtcInstant(record.data.completedAt)
        && record.data.completedAt === record.occurredAt
    case 'planCreated':
      return hasExactKeys(record.data, ['planCreatedAt']) && isUtcInstant(record.data.planCreatedAt)
        && record.data.planCreatedAt === record.occurredAt
    case 'firstLoggedRun':
      return hasExactKeys(record.data, ['runLoggedAt']) && isUtcInstant(record.data.runLoggedAt)
        && record.data.runLoggedAt === record.occurredAt
    case 'meaningfulActivation':
      return hasExactKeys(record.data, ['criterion', 'qualifiedAt'])
        && record.data.criterion === 'onboarding-and-plan-and-first-run'
        && isUtcInstant(record.data.qualifiedAt)
        && record.data.qualifiedAt === record.occurredAt
    default:
      return false
  }
}

export function isMarathonerAttributionEvent(value: unknown): value is MarathonerAttributionEvent {
  if (!isRecord(value) || !validCommon(value) || !validData(value)) return false

  const isPreAccount = value.eventType === 'referralVisit' || value.eventType === 'storeHandoff'
  const includesDigest = isPreAccount || value.eventType === 'signup'
  const expectedKeys = [
    ...commonKeys,
    ...(!isPreAccount ? ['pseudonymousUserId'] : []),
    ...(includesDigest ? ['handoffTokenDigest'] : []),
  ]

  if (!hasExactKeys(value, expectedKeys)) return false
  if (!isPreAccount && !validPseudonymousUserId(value.pseudonymousUserId)) return false
  if (includesDigest && (typeof value.handoffTokenDigest !== 'string' || !digestPattern.test(value.handoffTokenDigest))) return false
  return true
}

export function assertMarathonerAttributionEvent(value: unknown): asserts value is MarathonerAttributionEvent {
  if (!isMarathonerAttributionEvent(value)) {
    throw new MarathonerAttributionValidationError('invalid-event')
  }
}

export class MarathonerAttributionValidationError extends Error {
  constructor(readonly code: 'invalid-event' | 'invalid-claim' | 'claim-unavailable' | 'outside-attribution-window' | 'binding-conflict' | 'binding-unavailable') {
    super(`Marathoner attribution validation failed: ${code}.`)
    this.name = 'MarathonerAttributionValidationError'
  }
}
