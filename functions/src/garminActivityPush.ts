import { createHash, timingSafeEqual } from 'node:crypto'

import {
  createActivityImportCommand,
  type ActivityImportCommandEnvelope,
  type MaterialCommandResult,
} from '../../src/domain/materialCommands/contract.js'
import { createProviderActivityId } from '../../src/domain/activityImport/contract.js'
import {
  createIanaTimeZone,
  createUtcDateTime,
} from '../../src/domain/training/dates.js'
import {
  createDistanceMeters,
  createDurationSeconds,
  createHeartRateBpm,
} from '../../src/domain/training/units.js'
import type { GarminOAuthEnvironment } from './garminOAuthHandler.js'

const MAX_PUSH_BODY_BYTES = 256 * 1024
const MAX_DELIVERIES_PER_REQUEST = 100
const PUSH_SCHEMA_VERSION = 1
const supportedRunningTypes = new Set([
  'RUNNING',
  'INDOOR_RUNNING',
  'OBSTACLE_RUN',
  'STREET_RUNNING',
  'TRACK_RUNNING',
  'TRAIL_RUNNING',
  'TREADMILL_RUNNING',
  'ULTRA_RUN',
  'VIRTUAL_RUN',
  'WHEELCHAIR_PUSH_RUN',
])

type UnknownRecord = Readonly<Record<string, unknown>>

export type GarminPushActivityDelivery = Readonly<{
  schemaVersion: typeof PUSH_SCHEMA_VERSION
  kind: 'activity'
  deliveryId: string
  providerAccountDigest: string
  providerActivityId: string
  observedAt: string
  startedAt: string
  durationSeconds: number
  distanceMeters: number
  averageHeartRateBpm?: number
  maximumHeartRateBpm?: number
}>

export type GarminPushDeregistrationDelivery = Readonly<{
  schemaVersion: typeof PUSH_SCHEMA_VERSION
  kind: 'deregistration'
  deliveryId: string
  providerAccountDigest: string
  observedAt: string
}>

export type GarminPushPermissionChangeDelivery = Readonly<{
  schemaVersion: typeof PUSH_SCHEMA_VERSION
  kind: 'permission_change'
  deliveryId: string
  providerAccountDigest: string
  observedAt: string
  activityExportGranted: boolean
}>

export type GarminPushDelivery =
  | GarminPushActivityDelivery
  | GarminPushDeregistrationDelivery
  | GarminPushPermissionChangeDelivery

export type GarminPushLogEntry = Readonly<{
  event: 'garmin-activity-push' | 'garmin-activity-processing'
  status:
    | 'accepted'
    | 'authentication_error'
    | 'configuration_error'
    | 'ignored'
    | 'invalid_request'
    | 'processing_error'
    | 'succeeded'
  count?: number
}>

export interface GarminPushStore {
  enqueue(deliveries: readonly GarminPushDelivery[]): Promise<number>
  resolveOwner(options: {
    environment: GarminOAuthEnvironment
    providerAccountDigest: string
  }): Promise<{ ownerId: string; timeZone: string } | null>
  completeDeregistration(options: {
    environment: GarminOAuthEnvironment
    providerAccountDigest: string
  }): Promise<void>
  completeActivityPermissionRevocation(options: {
    environment: GarminOAuthEnvironment
    providerAccountDigest: string
  }): Promise<void>
  markProcessed(options: {
    deliveryId: string
    outcome:
      | 'deregistered'
      | 'ignored'
      | 'imported'
      | 'permission_revoked'
      | 'review_required'
      | 'stale'
    processedAt: string
  }): Promise<void>
}

type ReceiveDependencies = Readonly<{
  clientId: string
  enabled: boolean
  log: (entry: GarminPushLogEntry) => void
  now?: () => Date
  store: Pick<GarminPushStore, 'enqueue'>
  trustedCidrs: readonly string[]
}>

type ProcessDependencies = Readonly<{
  environment: GarminOAuthEnvironment
  log: (entry: GarminPushLogEntry) => void
  now?: () => Date
  store: Omit<GarminPushStore, 'enqueue'>
  submitImport: (
    ownerId: string,
    command: ActivityImportCommandEnvelope,
  ) => Promise<MaterialCommandResult>
}>

export type GarminPushRequest = Readonly<{
  body: unknown
  bodyBytes: number
  clientId: string
  clientIp: string
  contentType: string
  method: string
}>

export type GarminPushResponse = Readonly<{
  httpStatus: 200 | 400 | 401 | 405 | 413 | 503
  status: 'accepted' | 'ignored' | 'rejected' | 'unavailable'
}>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function digest(namespace: string, ...values: string[]): string {
  const hash = createHash('sha256').update(namespace)
  for (const value of values) hash.update('\u0000').update(value)
  return hash.digest('base64url')
}

export function garminProviderAccountDigest(providerUserId: string): string {
  return digest('garmin-provider-account', providerUserId)
}

function providerActivityId(providerUserId: string, summaryId: string): string {
  return digest('garmin-provider-activity', providerUserId, summaryId)
}

function deliveryId(values: readonly string[]): string {
  return digest('garmin-push-delivery', ...values)
}

function ipv4Integer(value: string): number | null {
  const normalized = value.startsWith('::ffff:') ? value.slice(7) : value
  const parts = normalized.split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    result = (result << 8) | octet
  }
  return result >>> 0
}

function ipMatchesCidr(value: string, network: string, prefix: number): boolean {
  const addressValue = ipv4Integer(value)
  const networkValue = ipv4Integer(network)
  if (addressValue === null || networkValue === null) return false
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (addressValue & mask) === (networkValue & mask)
}

export function isTrustedGarminPushIp(
  value: string,
  trustedCidrs: readonly string[],
): boolean {
  return trustedCidrs.some((cidr) => {
    const [network, prefixValue] = cidr.split('/')
    const prefix = Number(prefixValue)
    return (
      network !== undefined &&
      Number.isInteger(prefix) &&
      prefix >= 0 &&
      prefix <= 32 &&
      ipMatchesCidr(value, network, prefix)
    )
  })
}

export function garminPushClientIp(options: {
  directIp: string
  forwardedFor: string
}): string {
  const forwarded = options.forwardedFor
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  if (forwarded.length >= 2) return forwarded[forwarded.length - 2] ?? ''
  return forwarded[0] ?? options.directIp
}

function exactMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  )
}

function nonEmptyString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
    ? value
    : null
}

function safePositiveInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? Number(value)
    : null
}

function safePositiveDistance(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER
    ? Math.round(value)
    : null
}

function safeOptionalHeartRate(value: unknown): number | null {
  if (value === undefined || value === null) return null
  return Number.isSafeInteger(value) && Number(value) >= 20 && Number(value) <= 300
    ? Number(value)
    : Number.NaN
}

function parseActivity(
  value: unknown,
  observedAt: string,
): GarminPushActivityDelivery | 'ignored' | null {
  if (!isRecord(value)) return null
  const userId = nonEmptyString(value.userId, 512)
  const summaryId = nonEmptyString(value.summaryId, 512)
  const activityType = nonEmptyString(value.activityType, 128)
  if (userId === null || summaryId === null || activityType === null) return null
  if (!supportedRunningTypes.has(activityType)) return 'ignored'
  const startTimeInSeconds = safePositiveInteger(value.startTimeInSeconds)
  const durationSeconds = safePositiveInteger(value.durationInSeconds)
  const distanceMeters = safePositiveDistance(value.distanceInMeters)
  const averageHeartRateBpm = safeOptionalHeartRate(
    value.averageHeartRateInBeatsPerMinute,
  )
  const maximumHeartRateBpm = safeOptionalHeartRate(
    value.maxHeartRateInBeatsPerMinute,
  )
  if (
    startTimeInSeconds === null ||
    durationSeconds === null ||
    distanceMeters === null ||
    Number.isNaN(averageHeartRateBpm) ||
    Number.isNaN(maximumHeartRateBpm) ||
    (averageHeartRateBpm !== null &&
      maximumHeartRateBpm !== null &&
      maximumHeartRateBpm < averageHeartRateBpm)
  ) {
    return null
  }
  const accountDigest = garminProviderAccountDigest(userId)
  const activityId = providerActivityId(userId, summaryId)
  const startedAt = new Date(startTimeInSeconds * 1_000).toISOString()
  const id = deliveryId([
    accountDigest,
    activityId,
    startedAt,
    String(durationSeconds),
    String(distanceMeters),
    String(averageHeartRateBpm ?? ''),
    String(maximumHeartRateBpm ?? ''),
  ])
  return {
    schemaVersion: PUSH_SCHEMA_VERSION,
    kind: 'activity',
    deliveryId: id,
    providerAccountDigest: accountDigest,
    providerActivityId: activityId,
    observedAt,
    startedAt,
    durationSeconds,
    distanceMeters,
    ...(averageHeartRateBpm === null ? {} : { averageHeartRateBpm }),
    ...(maximumHeartRateBpm === null ? {} : { maximumHeartRateBpm }),
  }
}

function parseDeregistration(
  value: unknown,
  observedAt: string,
): GarminPushDeregistrationDelivery | null {
  if (!isRecord(value)) return null
  const userId = nonEmptyString(value.userId, 512)
  if (userId === null) return null
  const accountDigest = garminProviderAccountDigest(userId)
  return {
    schemaVersion: PUSH_SCHEMA_VERSION,
    kind: 'deregistration',
    deliveryId: deliveryId([accountDigest, 'deregistration']),
    providerAccountDigest: accountDigest,
    observedAt,
  }
}

function parsePermissionChange(
  value: unknown,
  observedAt: string,
): GarminPushPermissionChangeDelivery | null {
  if (!isRecord(value)) return null
  const userId = nonEmptyString(value.userId, 512)
  const summaryId = nonEmptyString(value.summaryId, 512)
  const changeTimeInSeconds = safePositiveInteger(value.changeTimeInSeconds)
  if (
    userId === null ||
    summaryId === null ||
    changeTimeInSeconds === null ||
    !Array.isArray(value.permissions) ||
    value.permissions.length > 100 ||
    value.permissions.some(
      (permission) => nonEmptyString(permission, 128) === null,
    )
  ) {
    return null
  }
  const accountDigest = garminProviderAccountDigest(userId)
  const activityExportGranted = value.permissions.includes('ACTIVITY_EXPORT')
  return {
    schemaVersion: PUSH_SCHEMA_VERSION,
    kind: 'permission_change',
    deliveryId: deliveryId([
      accountDigest,
      'permission_change',
      summaryId,
      String(changeTimeInSeconds),
      String(activityExportGranted),
    ]),
    providerAccountDigest: accountDigest,
    observedAt,
    activityExportGranted,
  }
}

function parseDeliveries(
  body: unknown,
  observedAt: string,
): { deliveries: GarminPushDelivery[]; invalid: boolean } {
  if (!isRecord(body)) return { deliveries: [], invalid: true }
  const activities = [
    ...(Array.isArray(body.activities) ? body.activities : []),
    ...(Array.isArray(body.manuallyUpdatedActivities)
      ? body.manuallyUpdatedActivities
      : []),
  ]
  const deregistrations = Array.isArray(body.deregistrations)
    ? body.deregistrations
    : []
  if (
    body.userPermissionsChange !== undefined &&
    !Array.isArray(body.userPermissionsChange)
  ) {
    return { deliveries: [], invalid: true }
  }
  const permissionChanges = Array.isArray(body.userPermissionsChange)
    ? body.userPermissionsChange
    : []
  if (
    activities.length + deregistrations.length + permissionChanges.length >
    MAX_DELIVERIES_PER_REQUEST
  ) {
    return { deliveries: [], invalid: true }
  }
  const deliveries: GarminPushDelivery[] = []
  for (const activity of activities) {
    const parsed = parseActivity(activity, observedAt)
    if (parsed === null) return { deliveries: [], invalid: true }
    if (parsed !== 'ignored') deliveries.push(parsed)
  }
  for (const deregistration of deregistrations) {
    const parsed = parseDeregistration(deregistration, observedAt)
    if (parsed === null) return { deliveries: [], invalid: true }
    deliveries.push(parsed)
  }
  for (const permissionChange of permissionChanges) {
    const parsed = parsePermissionChange(permissionChange, observedAt)
    if (parsed === null) return { deliveries: [], invalid: true }
    deliveries.push(parsed)
  }
  return { deliveries, invalid: false }
}

export async function receiveGarminActivityPush(
  request: GarminPushRequest,
  dependencies: ReceiveDependencies,
): Promise<GarminPushResponse> {
  if (request.method !== 'POST') {
    dependencies.log({ event: 'garmin-activity-push', status: 'invalid_request' })
    return { httpStatus: 405, status: 'rejected' }
  }
  if (!dependencies.enabled) {
    dependencies.log({
      event: 'garmin-activity-push',
      status: 'configuration_error',
    })
    return { httpStatus: 503, status: 'unavailable' }
  }
  if (
    dependencies.clientId.trim() === '' ||
    !exactMatch(request.clientId, dependencies.clientId) ||
    !isTrustedGarminPushIp(request.clientIp, dependencies.trustedCidrs)
  ) {
    dependencies.log({
      event: 'garmin-activity-push',
      status: 'authentication_error',
    })
    return { httpStatus: 401, status: 'rejected' }
  }
  if (request.bodyBytes > MAX_PUSH_BODY_BYTES) {
    dependencies.log({ event: 'garmin-activity-push', status: 'invalid_request' })
    return { httpStatus: 413, status: 'rejected' }
  }
  if (!request.contentType.toLowerCase().startsWith('application/json')) {
    dependencies.log({ event: 'garmin-activity-push', status: 'invalid_request' })
    return { httpStatus: 400, status: 'rejected' }
  }
  const observedAt = (dependencies.now?.() ?? new Date()).toISOString()
  const parsed = parseDeliveries(request.body, observedAt)
  if (parsed.invalid) {
    dependencies.log({ event: 'garmin-activity-push', status: 'invalid_request' })
    return { httpStatus: 400, status: 'rejected' }
  }
  if (parsed.deliveries.length === 0) {
    dependencies.log({
      event: 'garmin-activity-push',
      status: 'ignored',
      count: 0,
    })
    return { httpStatus: 200, status: 'ignored' }
  }
  const accepted = await dependencies.store.enqueue(parsed.deliveries)
  dependencies.log({
    event: 'garmin-activity-push',
    status: 'accepted',
    count: accepted,
  })
  return { httpStatus: 200, status: 'accepted' }
}

export async function processGarminPushDelivery(
  delivery: GarminPushDelivery,
  dependencies: ProcessDependencies,
): Promise<void> {
  const processedAt = (dependencies.now?.() ?? new Date()).toISOString()
  if (delivery.kind === 'deregistration') {
    await dependencies.store.completeDeregistration({
      environment: dependencies.environment,
      providerAccountDigest: delivery.providerAccountDigest,
    })
    await dependencies.store.markProcessed({
      deliveryId: delivery.deliveryId,
      outcome: 'deregistered',
      processedAt,
    })
    dependencies.log({
      event: 'garmin-activity-processing',
      status: 'succeeded',
      count: 1,
    })
    return
  }
  if (delivery.kind === 'permission_change') {
    if (!delivery.activityExportGranted) {
      await dependencies.store.completeActivityPermissionRevocation({
        environment: dependencies.environment,
        providerAccountDigest: delivery.providerAccountDigest,
      })
    }
    await dependencies.store.markProcessed({
      deliveryId: delivery.deliveryId,
      outcome: delivery.activityExportGranted
        ? 'ignored'
        : 'permission_revoked',
      processedAt,
    })
    dependencies.log({
      event: 'garmin-activity-processing',
      status: delivery.activityExportGranted ? 'ignored' : 'succeeded',
      count: 1,
    })
    return
  }
  const owner = await dependencies.store.resolveOwner({
    environment: dependencies.environment,
    providerAccountDigest: delivery.providerAccountDigest,
  })
  if (owner === null) {
    await dependencies.store.markProcessed({
      deliveryId: delivery.deliveryId,
      outcome: 'ignored',
      processedAt,
    })
    dependencies.log({
      event: 'garmin-activity-processing',
      status: 'ignored',
      count: 1,
    })
    return
  }
  const command = createActivityImportCommand(`garmin-push-${delivery.deliveryId}`, {
    schemaVersion: 'completed-activity-import@1',
    operation: 'upsert',
    provider: 'garmin_connect',
    providerActivityId: createProviderActivityId(delivery.providerActivityId),
    observedAt: createUtcDateTime(delivery.observedAt),
    providerUpdatedAt: null,
    activityType: 'running',
    startedAt: createUtcDateTime(delivery.startedAt),
    endedAt: null,
    durationSeconds: createDurationSeconds(delivery.durationSeconds),
    timeZone: createIanaTimeZone(owner.timeZone),
    distanceMeters: createDistanceMeters(delivery.distanceMeters),
    ...(delivery.averageHeartRateBpm === undefined
      ? {}
      : {
          averageHeartRateBpm: createHeartRateBpm(
            delivery.averageHeartRateBpm,
          ),
        }),
    ...(delivery.maximumHeartRateBpm === undefined
      ? {}
      : {
          maximumHeartRateBpm: createHeartRateBpm(
            delivery.maximumHeartRateBpm,
          ),
        }),
    reportedOrigin: 'garmin',
  })
  const result = await dependencies.submitImport(owner.ownerId, command)
  const outcome =
    result.status === 'activity_imported'
      ? 'imported'
      : result.status === 'activity_import_review_required'
        ? 'review_required'
        : result.status === 'stale_revision'
          ? 'stale'
          : null
  if (outcome === null) {
    dependencies.log({
      event: 'garmin-activity-processing',
      status: 'processing_error',
    })
    throw new Error('The normalized Garmin activity was not accepted.')
  }
  await dependencies.store.markProcessed({
    deliveryId: delivery.deliveryId,
    outcome,
    processedAt,
  })
  dependencies.log({
    event: 'garmin-activity-processing',
    status: 'succeeded',
    count: 1,
  })
}
