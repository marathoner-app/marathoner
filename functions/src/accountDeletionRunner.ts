import {
  FieldValue,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore'

import {
  ACCOUNT_DELETION_MANIFEST_VERSION,
  ACCOUNT_DELETION_RECEIPT_RETENTION_MILLISECONDS,
  ACCOUNT_DELETION_WORKFLOW_SCHEMA_VERSION,
  accountDeletionStageAtLeast,
  isCompletedAccountDeletionReceipt,
  isAccountDeletionRequestId,
  parseActiveAccountDeletionRequest,
  parseCompletedAccountDeletionReceipt,
  type AccountDeletionFailureCode,
  type AccountDeletionProgressStage,
  type ActiveAccountDeletionRequest,
  type CompletedAccountDeletionReceipt,
} from './accountDeletionManifest.js'
import type { AccountAccessManager } from './accountDeletionRequestHandler.js'

export const ACCOUNT_DELETION_RUNNER_STEPS = [
  'validated',
  'access_locked',
  'user_tree_deleted',
  'server_records_deleted',
  'private_records_deleted',
  'membership_removed',
  'manifest_verified',
  'authentication_deleted',
  'completed',
] as const

export type AccountDeletionRunnerStep =
  (typeof ACCOUNT_DELETION_RUNNER_STEPS)[number]

export type AccountDeletionRunnerErrorCode =
  | AccountDeletionFailureCode
  | 'request-invalid'

export type AccountDeletionRunnerLogEntry = Readonly<{
  durationMilliseconds: number
  errorCode?: AccountDeletionRunnerErrorCode
  event: 'account-deletion-runner-step'
  requestId: string
  status: 'completed' | 'failed'
  step: AccountDeletionRunnerStep
}>

export type AccountDeletionRunnerResult = Readonly<{
  completedAt: string
  expiresAt: string
  requestId: string
  status: 'completed' | 'already_completed'
}>

type BeginAttemptResult =
  | { kind: 'active'; request: ActiveAccountDeletionRequest }
  | { kind: 'completed'; receipt: CompletedAccountDeletionReceipt }

export interface AccountDeletionWorkflowStore {
  anonymize(options: {
    completedAt: string
    expiresAt: string
    request: ActiveAccountDeletionRequest
  }): Promise<CompletedAccountDeletionReceipt>
  beginAttempt(requestId: string, now: string): Promise<BeginAttemptResult>
  checkpoint(options: {
    request: ActiveAccountDeletionRequest
    stage: AccountDeletionProgressStage
    updatedAt: string
  }): Promise<void>
  deleteMembership(userId: string): Promise<void>
  deleteServerRecords(userId: string): Promise<void>
  deleteUserTree(userId: string): Promise<void>
  purgeExpiredReceipt(requestId: string, now: string): Promise<void>
  readCompletedReceipt(
    requestId: string,
  ): Promise<CompletedAccountDeletionReceipt | null>
  recordFailure(options: {
    errorCode: AccountDeletionFailureCode
    request: ActiveAccountDeletionRequest
    updatedAt: string
  }): Promise<void>
  verifyManifestEmpty(userId: string): Promise<void>
}

export interface AccountDeletionAuthGateway extends AccountAccessManager {
  deleteIfExists(userId: string): Promise<void>
}

export interface AccountDeletionPrivateRecordGateway {
  deleteDeclaredRecords(requestId: string): Promise<void>
  verifyDeclaredRecordsAbsent(requestId: string): Promise<void>
}

interface AccountDeletionRunnerDependencies {
  accountAccess: AccountDeletionAuthGateway
  afterStep?: (step: AccountDeletionRunnerStep) => Promise<void>
  log: (entry: AccountDeletionRunnerLogEntry) => void
  now: () => Date
  privateRecords: AccountDeletionPrivateRecordGateway
  store: AccountDeletionWorkflowStore
}

class AccountDeletionStepFailure extends Error {
  constructor(
    readonly code: AccountDeletionFailureCode,
    readonly step: AccountDeletionRunnerStep,
  ) {
    super(`Account deletion stopped at ${step}.`)
  }
}

export class AccountDeletionRunnerError extends Error {
  constructor(readonly code: AccountDeletionRunnerErrorCode) {
    super(
      code === 'request-invalid'
        ? 'The protected deletion request is invalid or unavailable.'
        : 'Account deletion stopped safely. Retry the same request ID.',
    )
  }
}

function resultFromReceipt(
  receipt: CompletedAccountDeletionReceipt,
  status: AccountDeletionRunnerResult['status'],
): AccountDeletionRunnerResult {
  return {
    status,
    requestId: receipt.requestId,
    completedAt: receipt.completedAt,
    expiresAt: receipt.expiresAt,
  }
}

function deletionRequestPath(requestId: string): string {
  if (!isAccountDeletionRequestId(requestId)) {
    throw new Error('The account-deletion request ID is invalid.')
  }
  return `accountDeletionRequests/${requestId}`
}

async function documentTreeContainsData(
  reference: DocumentReference,
): Promise<boolean> {
  if ((await reference.get()).exists) return true

  for (const collection of await reference.listCollections()) {
    for (const childReference of await collection.listDocuments()) {
      if (await documentTreeContainsData(childReference)) return true
    }
  }

  return false
}

export class FirestoreAccountDeletionWorkflowStore
  implements AccountDeletionWorkflowStore
{
  constructor(private readonly database: Firestore) {}

  async beginAttempt(requestId: string, now: string): Promise<BeginAttemptResult> {
    const requestReference = this.database.doc(deletionRequestPath(requestId))

    return this.database.runTransaction(async (transaction) => {
      const requestSnapshot = await transaction.get(requestReference)
      const data = requestSnapshot.data()
      if (isCompletedAccountDeletionReceipt(data)) {
        return {
          kind: 'completed' as const,
          receipt: parseCompletedAccountDeletionReceipt(data, requestId),
        }
      }

      const request = parseActiveAccountDeletionRequest(data, requestId)
      const membershipReference = this.database.doc(
        `betaMemberships/${request.userId}`,
      )
      const membershipSnapshot = await transaction.get(membershipReference)
      if (membershipSnapshot.data()?.status === 'approved') {
        throw new Error('The deletion request has an approved membership.')
      }

      transaction.update(requestReference, {
        attemptCount: FieldValue.increment(1),
        lastErrorCode: FieldValue.delete(),
        status: 'deletion_in_progress',
        updatedAt: now,
      })

      return {
        kind: 'active' as const,
        request: {
          ...request,
          attemptCount: request.attemptCount + 1,
          status: 'deletion_in_progress',
          updatedAt: now,
        },
      }
    })
  }

  async checkpoint(options: {
    request: ActiveAccountDeletionRequest
    stage: AccountDeletionProgressStage
    updatedAt: string
  }): Promise<void> {
    const requestReference = this.database.doc(
      deletionRequestPath(options.request.requestId),
    )
    await this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestReference)
      const current = parseActiveAccountDeletionRequest(
        snapshot.data(),
        options.request.requestId,
      )
      if (current.userId !== options.request.userId) {
        throw new Error('The protected deletion owner changed unexpectedly.')
      }
      if (accountDeletionStageAtLeast(current.stage, options.stage)) return
      transaction.update(requestReference, {
        lastErrorCode: FieldValue.delete(),
        stage: options.stage,
        status: 'deletion_in_progress',
        updatedAt: options.updatedAt,
      })
    })
  }

  async recordFailure(options: {
    errorCode: AccountDeletionFailureCode
    request: ActiveAccountDeletionRequest
    updatedAt: string
  }): Promise<void> {
    const requestReference = this.database.doc(
      deletionRequestPath(options.request.requestId),
    )
    await this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestReference)
      if (isCompletedAccountDeletionReceipt(snapshot.data())) return
      const current = parseActiveAccountDeletionRequest(
        snapshot.data(),
        options.request.requestId,
      )
      if (current.userId !== options.request.userId) {
        throw new Error('The protected deletion owner changed unexpectedly.')
      }
      transaction.update(requestReference, {
        lastErrorCode: options.errorCode,
        status: 'deletion_failed',
        updatedAt: options.updatedAt,
      })
    })
  }

  async deleteUserTree(userId: string): Promise<void> {
    await this.database.recursiveDelete(this.database.doc(`users/${userId}`))
  }

  async deleteServerRecords(userId: string): Promise<void> {
    await this.database.recursiveDelete(
      this.database.doc(`materialCommandReceipts/${userId}`),
    )
    await this.database.doc(`materialCommandProofs/${userId}`).delete()
  }

  async deleteMembership(userId: string): Promise<void> {
    await this.database.doc(`betaMemberships/${userId}`).delete()
  }

  async verifyManifestEmpty(userId: string): Promise<void> {
    const references = [
      this.database.doc(`users/${userId}`),
      this.database.doc(`materialCommandReceipts/${userId}`),
      this.database.doc(`materialCommandProofs/${userId}`),
      this.database.doc(`betaMemberships/${userId}`),
    ]
    for (const reference of references) {
      if (await documentTreeContainsData(reference)) {
        throw new Error('The account-deletion manifest is not empty.')
      }
    }
  }

  async anonymize(options: {
    completedAt: string
    expiresAt: string
    request: ActiveAccountDeletionRequest
  }): Promise<CompletedAccountDeletionReceipt> {
    const requestReference = this.database.doc(
      deletionRequestPath(options.request.requestId),
    )
    const receipt: CompletedAccountDeletionReceipt = {
      schemaVersion: ACCOUNT_DELETION_WORKFLOW_SCHEMA_VERSION,
      manifestVersion: ACCOUNT_DELETION_MANIFEST_VERSION,
      requestId: options.request.requestId,
      status: 'completed',
      requestedAt: options.request.requestedAt,
      completedAt: options.completedAt,
      expiresAt: options.expiresAt,
    }

    return this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestReference)
      if (isCompletedAccountDeletionReceipt(snapshot.data())) {
        return parseCompletedAccountDeletionReceipt(
          snapshot.data(),
          options.request.requestId,
        )
      }
      const current = parseActiveAccountDeletionRequest(
        snapshot.data(),
        options.request.requestId,
      )
      if (
        current.userId !== options.request.userId ||
        !accountDeletionStageAtLeast(current.stage, 'authentication_deleted')
      ) {
        throw new Error('The deletion request cannot be anonymized yet.')
      }
      transaction.set(requestReference, receipt)
      return receipt
    })
  }

  async readCompletedReceipt(
    requestId: string,
  ): Promise<CompletedAccountDeletionReceipt | null> {
    const snapshot = await this.database.doc(deletionRequestPath(requestId)).get()
    if (!isCompletedAccountDeletionReceipt(snapshot.data())) return null
    return parseCompletedAccountDeletionReceipt(snapshot.data(), requestId)
  }

  async purgeExpiredReceipt(requestId: string, now: string): Promise<void> {
    const reference = this.database.doc(deletionRequestPath(requestId))
    await this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      const receipt = parseCompletedAccountDeletionReceipt(
        snapshot.data(),
        requestId,
      )
      if (Date.parse(receipt.expiresAt) > Date.parse(now)) {
        throw new Error('The anonymous deletion receipt has not expired.')
      }
      transaction.delete(reference)
    })
  }
}

export class AccountDeletionRunner {
  constructor(private readonly dependencies: AccountDeletionRunnerDependencies) {}

  private log(
    requestId: string,
    step: AccountDeletionRunnerStep,
    status: AccountDeletionRunnerLogEntry['status'],
    startedAt: number,
    errorCode?: AccountDeletionRunnerErrorCode,
  ) {
    this.dependencies.log({
      event: 'account-deletion-runner-step',
      requestId,
      step,
      status,
      durationMilliseconds: Math.max(0, Date.now() - startedAt),
      ...(errorCode ? { errorCode } : {}),
    })
  }

  private async afterStep(step: AccountDeletionRunnerStep): Promise<void> {
    if (!this.dependencies.afterStep) return
    try {
      await this.dependencies.afterStep(step)
    } catch {
      throw new AccountDeletionStepFailure('operator-interrupted', step)
    }
  }

  private async performStep(options: {
    errorCode: AccountDeletionFailureCode
    operation: () => Promise<void>
    request: ActiveAccountDeletionRequest
    stage: AccountDeletionProgressStage
    step: AccountDeletionRunnerStep
  }): Promise<void> {
    if (accountDeletionStageAtLeast(options.request.stage, options.stage)) return
    const startedAt = Date.now()
    try {
      await options.operation()
      const updatedAt = this.dependencies.now().toISOString()
      await this.dependencies.store.checkpoint({
        request: options.request,
        stage: options.stage,
        updatedAt,
      })
      options.request.stage = options.stage
      options.request.updatedAt = updatedAt
      this.log(
        options.request.requestId,
        options.step,
        'completed',
        startedAt,
      )
      await this.afterStep(options.step)
    } catch (error) {
      if (error instanceof AccountDeletionStepFailure) throw error
      throw new AccountDeletionStepFailure(options.errorCode, options.step)
    }
  }

  async run(requestId: string): Promise<AccountDeletionRunnerResult> {
    if (!isAccountDeletionRequestId(requestId)) {
      throw new AccountDeletionRunnerError('request-invalid')
    }
    const validationStartedAt = Date.now()
    let request: ActiveAccountDeletionRequest | null = null
    let failedStep: AccountDeletionRunnerStep = 'validated'

    try {
      const beginning = await this.dependencies.store.beginAttempt(
        requestId,
        this.dependencies.now().toISOString(),
      )
      if (beginning.kind === 'completed') {
        return resultFromReceipt(beginning.receipt, 'already_completed')
      }
      request = beginning.request
      this.log(requestId, 'validated', 'completed', validationStartedAt)
      await this.afterStep('validated')

      failedStep = 'access_locked'
      await this.performStep({
        request,
        stage: 'access_locked',
        step: 'access_locked',
        errorCode: 'access-lock-failed',
        operation: () =>
          this.dependencies.accountAccess.disableAndRevoke(request!.userId),
      })

      failedStep = 'user_tree_deleted'
      await this.performStep({
        request,
        stage: 'user_tree_deleted',
        step: 'user_tree_deleted',
        errorCode: 'user-tree-delete-failed',
        operation: () => this.dependencies.store.deleteUserTree(request!.userId),
      })

      failedStep = 'server_records_deleted'
      await this.performStep({
        request,
        stage: 'server_records_deleted',
        step: 'server_records_deleted',
        errorCode: 'server-record-delete-failed',
        operation: () =>
          this.dependencies.store.deleteServerRecords(request!.userId),
      })

      failedStep = 'private_records_deleted'
      await this.performStep({
        request,
        stage: 'private_records_deleted',
        step: 'private_records_deleted',
        errorCode: 'private-record-delete-failed',
        operation: () =>
          this.dependencies.privateRecords.deleteDeclaredRecords(requestId),
      })

      failedStep = 'membership_removed'
      await this.performStep({
        request,
        stage: 'membership_removed',
        step: 'membership_removed',
        errorCode: 'membership-delete-failed',
        operation: () =>
          this.dependencies.store.deleteMembership(request!.userId),
      })

      failedStep = 'manifest_verified'
      await this.performStep({
        request,
        stage: 'manifest_verified',
        step: 'manifest_verified',
        errorCode: 'manifest-verification-failed',
        operation: async () => {
          await this.dependencies.store.verifyManifestEmpty(request!.userId)
          await this.dependencies.privateRecords.verifyDeclaredRecordsAbsent(
            requestId,
          )
        },
      })

      failedStep = 'authentication_deleted'
      await this.performStep({
        request,
        stage: 'authentication_deleted',
        step: 'authentication_deleted',
        errorCode: 'authentication-delete-failed',
        operation: () =>
          this.dependencies.accountAccess.deleteIfExists(request!.userId),
      })

      failedStep = 'completed'
      const completionStartedAt = Date.now()
      const completedAtDate = this.dependencies.now()
      const receipt = await this.dependencies.store.anonymize({
        request,
        completedAt: completedAtDate.toISOString(),
        expiresAt: new Date(
          completedAtDate.getTime() +
            ACCOUNT_DELETION_RECEIPT_RETENTION_MILLISECONDS,
        ).toISOString(),
      })
      this.log(requestId, 'completed', 'completed', completionStartedAt)
      await this.afterStep('completed')
      return resultFromReceipt(receipt, 'completed')
    } catch (error) {
      const completed = await this.dependencies.store
        .readCompletedReceipt(requestId)
        .catch(() => null)
      if (completed) return resultFromReceipt(completed, 'completed')

      const failure =
        error instanceof AccountDeletionStepFailure
          ? error
          : new AccountDeletionStepFailure(
              failedStep === 'completed'
                ? 'receipt-anonymization-failed'
                : 'operator-interrupted',
              failedStep,
            )
      if (request) {
        await this.dependencies.store
          .recordFailure({
            request,
            errorCode: failure.code,
            updatedAt: this.dependencies.now().toISOString(),
          })
          .catch(() => undefined)
      }
      const publicErrorCode = request ? failure.code : 'request-invalid'
      this.log(
        requestId,
        failure.step,
        'failed',
        validationStartedAt,
        publicErrorCode,
      )
      throw new AccountDeletionRunnerError(publicErrorCode)
    }
  }

  async purgeExpiredReceipt(requestId: string): Promise<void> {
    if (!isAccountDeletionRequestId(requestId)) {
      throw new AccountDeletionRunnerError('request-invalid')
    }
    await this.dependencies.store.purgeExpiredReceipt(
      requestId,
      this.dependencies.now().toISOString(),
    )
  }
}
