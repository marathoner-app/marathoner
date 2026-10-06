import type { DocumentData } from 'firebase-admin/firestore'

export const ACCOUNT_DELETION_WORKFLOW_SCHEMA_VERSION = 1
export const ACCOUNT_DELETION_MANIFEST_VERSION = 1
export const ACCOUNT_DELETION_RECEIPT_RETENTION_MILLISECONDS =
  30 * 24 * 60 * 60 * 1_000

export const ACCOUNT_DELETION_PROGRESS_STAGES = [
  'membership_locked',
  'access_locked',
  'user_tree_deleted',
  'server_records_deleted',
  'private_records_deleted',
  'membership_removed',
  'manifest_verified',
  'authentication_deleted',
] as const

export type AccountDeletionProgressStage =
  (typeof ACCOUNT_DELETION_PROGRESS_STAGES)[number]

export const ACCOUNT_DELETION_FAILURE_CODES = [
  'auth-admin-failed',
  'access-lock-failed',
  'user-tree-delete-failed',
  'server-record-delete-failed',
  'private-record-delete-failed',
  'membership-delete-failed',
  'manifest-verification-failed',
  'authentication-delete-failed',
  'receipt-anonymization-failed',
  'operator-interrupted',
] as const

export type AccountDeletionFailureCode =
  (typeof ACCOUNT_DELETION_FAILURE_CODES)[number]

const activeStatuses = new Set([
  'auth_lock_pending',
  'auth_lock_failed',
  'access_locked',
  'deletion_in_progress',
  'deletion_failed',
])
const accountDeletionRequestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export interface ActiveAccountDeletionRequest {
  attemptCount: number
  commandId: string
  completionDueAt: string
  manifestVersion: typeof ACCOUNT_DELETION_MANIFEST_VERSION
  requestId: string
  requestedAt: string
  schemaVersion: typeof ACCOUNT_DELETION_WORKFLOW_SCHEMA_VERSION
  stage: AccountDeletionProgressStage
  status: string
  updatedAt: string
  userId: string
}

export interface CompletedAccountDeletionReceipt {
  completedAt: string
  expiresAt: string
  manifestVersion: typeof ACCOUNT_DELETION_MANIFEST_VERSION
  requestId: string
  requestedAt: string
  schemaVersion: typeof ACCOUNT_DELETION_WORKFLOW_SCHEMA_VERSION
  status: 'completed'
}

export function isAccountDeletionRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' && accountDeletionRequestIdPattern.test(value)
  )
}

function hasExactKeys(data: DocumentData, keys: readonly string[]): boolean {
  const actual = Object.keys(data).sort()
  const expected = [...keys].sort()
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  )
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  )
}

function isProgressStage(value: unknown): value is AccountDeletionProgressStage {
  return ACCOUNT_DELETION_PROGRESS_STAGES.includes(
    value as AccountDeletionProgressStage,
  )
}

export function parseActiveAccountDeletionRequest(
  data: DocumentData | undefined,
  expectedRequestId: string,
): ActiveAccountDeletionRequest {
  const allowedKeys = [
    'attemptCount',
    'commandId',
    'completionDueAt',
    'lastErrorCode',
    'manifestVersion',
    'requestId',
    'requestedAt',
    'schemaVersion',
    'stage',
    'status',
    'updatedAt',
    'userId',
  ]
  const requiredKeys = allowedKeys.filter((key) => key !== 'lastErrorCode')
  if (
    !data ||
    !requiredKeys.every((key) => key in data) ||
    !Object.keys(data).every((key) => allowedKeys.includes(key)) ||
    data.schemaVersion !== ACCOUNT_DELETION_WORKFLOW_SCHEMA_VERSION ||
    data.manifestVersion !== ACCOUNT_DELETION_MANIFEST_VERSION ||
    !isAccountDeletionRequestId(expectedRequestId) ||
    data.requestId !== expectedRequestId ||
    typeof data.userId !== 'string' ||
    data.userId.length === 0 ||
    data.userId.length > 128 ||
    typeof data.commandId !== 'string' ||
    data.commandId.length < 8 ||
    data.commandId.length > 128 ||
    !activeStatuses.has(data.status) ||
    !isProgressStage(data.stage) ||
    !Number.isInteger(data.attemptCount) ||
    data.attemptCount < 0 ||
    !isIsoTimestamp(data.requestedAt) ||
    !isIsoTimestamp(data.completionDueAt) ||
    !isIsoTimestamp(data.updatedAt) ||
    ('lastErrorCode' in data &&
      !ACCOUNT_DELETION_FAILURE_CODES.includes(data.lastErrorCode))
  ) {
    throw new Error('The protected account-deletion request is invalid.')
  }

  return data as ActiveAccountDeletionRequest
}

export function parseCompletedAccountDeletionReceipt(
  data: DocumentData | undefined,
  expectedRequestId: string,
): CompletedAccountDeletionReceipt {
  if (
    !data ||
    !hasExactKeys(data, [
      'completedAt',
      'expiresAt',
      'manifestVersion',
      'requestId',
      'requestedAt',
      'schemaVersion',
      'status',
    ]) ||
    data.schemaVersion !== ACCOUNT_DELETION_WORKFLOW_SCHEMA_VERSION ||
    data.manifestVersion !== ACCOUNT_DELETION_MANIFEST_VERSION ||
    !isAccountDeletionRequestId(expectedRequestId) ||
    data.requestId !== expectedRequestId ||
    data.status !== 'completed' ||
    !isIsoTimestamp(data.requestedAt) ||
    !isIsoTimestamp(data.completedAt) ||
    !isIsoTimestamp(data.expiresAt)
  ) {
    throw new Error('The anonymous account-deletion receipt is invalid.')
  }

  return data as CompletedAccountDeletionReceipt
}

export function isCompletedAccountDeletionReceipt(
  data: DocumentData | undefined,
): boolean {
  return data?.status === 'completed'
}

export function accountDeletionStageAtLeast(
  current: AccountDeletionProgressStage,
  expected: AccountDeletionProgressStage,
): boolean {
  return (
    ACCOUNT_DELETION_PROGRESS_STAGES.indexOf(current) >=
    ACCOUNT_DELETION_PROGRESS_STAGES.indexOf(expected)
  )
}
