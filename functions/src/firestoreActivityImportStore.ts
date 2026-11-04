import { createHash, randomUUID } from 'node:crypto'

import type { DocumentData, Firestore } from 'firebase-admin/firestore'

import {
  assessCrossProviderDuplicate,
  createCrossProviderDuplicateFingerprint,
  createProviderActivityIdentityKey,
  parseCompletedActivityImportEvent,
  resolveActivityDurationSeconds,
  resolveProviderActivityEvent,
  type CompletedActivityImportEventV1,
  type CompletedActivityUpsertV1,
  type CrossProviderDuplicateAssessment,
} from '../../src/domain/activityImport/contract.js'
import {
  isActivityImportReceiptResult,
  isActivityImportReviewRequiredResult,
  isMaterialCommandResult,
  materialCommandIdFrom,
  materialCommandSignature,
  type ActivityImportCommandEnvelope,
  type ActivityImportReceiptResult,
  type ActivityImportReviewRequiredResult,
  type ActivityImportStaleResult,
  type MaterialCommandValidationResult,
} from '../../src/domain/materialCommands/contract.js'
import { createUtcDateTime } from '../../src/domain/training/dates.js'
import {
  createCompletedRunId,
  createUserId,
  isCompletedRunIdValue,
  type CompletedRunId,
  type UserId,
} from '../../src/domain/training/identifiers.js'
import type {
  CompletedRun,
  PlannedWorkout,
} from '../../src/domain/training/types.js'
import { createDurationSeconds } from '../../src/domain/training/units.js'
import { validateCompletedRun } from '../../src/domain/training/validation.js'
import {
  activityImportDocumentPath,
  activityImportsCollectionPath,
  runDocumentPath,
  workoutCompletionGuardDocumentPath,
  workoutDocumentPath,
} from '../../src/persistence/firestore/paths.js'
import { TRAINING_SCHEMA_VERSION } from '../../src/persistence/trainingSchema.js'
import {
  completedRunAdminDocument,
  completedRunFromAdminDocument,
  completionGuardFromAdminDocument,
  plannedWorkoutAdminDocument,
  plannedWorkoutFromAdminDocument,
} from './firestoreCompletedRunDocuments.js'
import {
  MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
  materialCommandReceiptPath,
} from './firestoreMaterialCommandStore.js'
import type { ActivityImportStore } from './materialCommandHandler.js'
import {
  approvedBetaMembershipPath,
  isApprovedBetaMembership,
} from './approvedBetaMembership.js'

const ACTIVITY_IMPORT_RECORD_SCHEMA_VERSION = 1 as const

type ActivityImportRecordState = 'active' | 'deleted' | 'review_required'

interface ActivityImportRecordV1 {
  readonly schemaVersion: typeof ACTIVITY_IMPORT_RECORD_SCHEMA_VERSION
  readonly trainingSchemaVersion: typeof TRAINING_SCHEMA_VERSION
  readonly userId: UserId
  readonly canonicalCommandId: string
  readonly state: ActivityImportRecordState
  readonly event: CompletedActivityImportEventV1
  readonly completedRunId: CompletedRunId | null
  readonly candidateCompletedRunId: CompletedRunId | null
  readonly candidateKind: 'duplicate_candidate' | 'ambiguous_candidate' | null
  readonly crossProviderFingerprint: string | null
  readonly startedAtEpochMilliseconds: number | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface FirestoreActivityImportStoreOptions {
  createRunId?: () => string
  now?: () => Date
}

function importDocumentId(event: CompletedActivityImportEventV1): string {
  return createHash('sha256')
    .update(createProviderActivityIdentityKey(event))
    .digest('hex')
}

function importRecordFromDocument(
  data: DocumentData | undefined,
): ActivityImportRecordV1 | null {
  if (data === undefined) return null
  const parsedEvent = parseCompletedActivityImportEvent(data.event)
  if (
    data.schemaVersion !== ACTIVITY_IMPORT_RECORD_SCHEMA_VERSION ||
    data.trainingSchemaVersion !== TRAINING_SCHEMA_VERSION ||
    !parsedEvent.ok ||
    typeof data.userId !== 'string' ||
    materialCommandIdFrom({ commandId: data.canonicalCommandId }) === null ||
    !['active', 'deleted', 'review_required'].includes(String(data.state)) ||
    (data.completedRunId !== null &&
      !isCompletedRunIdValue(data.completedRunId)) ||
    (data.candidateCompletedRunId !== null &&
      !isCompletedRunIdValue(data.candidateCompletedRunId)) ||
    ![
      null,
      'duplicate_candidate',
      'ambiguous_candidate',
    ].includes(data.candidateKind) ||
    (data.crossProviderFingerprint !== null &&
      typeof data.crossProviderFingerprint !== 'string') ||
    (data.startedAtEpochMilliseconds !== null &&
      !Number.isSafeInteger(data.startedAtEpochMilliseconds)) ||
    typeof data.createdAt !== 'string' ||
    typeof data.updatedAt !== 'string'
  ) {
    throw new Error('A stored activity-import record is invalid.')
  }
  const userId = createUserId(data.userId)
  if (parsedEvent.value.ownerId !== userId) {
    throw new Error('A stored activity-import owner is inconsistent.')
  }
  const stateIsConsistent =
    (data.state === 'active' &&
      parsedEvent.value.operation === 'upsert' &&
      isCompletedRunIdValue(data.completedRunId) &&
      data.candidateCompletedRunId === null &&
      data.candidateKind === null &&
      typeof data.crossProviderFingerprint === 'string' &&
      data.startedAtEpochMilliseconds ===
        Date.parse(parsedEvent.value.startedAt)) ||
    (data.state === 'deleted' &&
      parsedEvent.value.operation === 'delete' &&
      data.completedRunId === null &&
      data.candidateCompletedRunId === null &&
      data.candidateKind === null &&
      data.crossProviderFingerprint === null &&
      data.startedAtEpochMilliseconds === null) ||
    (data.state === 'review_required' &&
      parsedEvent.value.operation === 'upsert' &&
      data.completedRunId === null &&
      isCompletedRunIdValue(data.candidateCompletedRunId) &&
      (data.candidateKind === 'duplicate_candidate' ||
        data.candidateKind === 'ambiguous_candidate') &&
      typeof data.crossProviderFingerprint === 'string' &&
      data.startedAtEpochMilliseconds ===
        Date.parse(parsedEvent.value.startedAt))
  if (!stateIsConsistent) {
    throw new Error('A stored activity-import state is inconsistent.')
  }
  return {
    schemaVersion: ACTIVITY_IMPORT_RECORD_SCHEMA_VERSION,
    trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
    userId,
    canonicalCommandId: data.canonicalCommandId,
    state: data.state as ActivityImportRecordState,
    event: parsedEvent.value,
    completedRunId:
      data.completedRunId === null
        ? null
        : createCompletedRunId(data.completedRunId),
    candidateCompletedRunId:
      data.candidateCompletedRunId === null
        ? null
        : createCompletedRunId(data.candidateCompletedRunId),
    candidateKind: data.candidateKind,
    crossProviderFingerprint: data.crossProviderFingerprint,
    startedAtEpochMilliseconds: data.startedAtEpochMilliseconds,
    createdAt: createUtcDateTime(data.createdAt),
    updatedAt: createUtcDateTime(data.updatedAt),
  }
}

function importRecordDocument(record: ActivityImportRecordV1): DocumentData {
  return record
}

function storedImportResult(data: unknown) {
  if (
    isActivityImportReceiptResult(data) ||
    isActivityImportReviewRequiredResult(data) ||
    (isMaterialCommandResult(data) &&
      data.status === 'stale_revision' &&
      data.code === 'provider-activity-version-changed')
  ) {
    return data
  }
  throw new Error('A stored activity-import receipt is invalid.')
}

function normalizedEvent(
  ownerId: string,
  envelope: ActivityImportCommandEnvelope,
): CompletedActivityImportEventV1 {
  const parsed = parseCompletedActivityImportEvent({
    ...envelope.command.event,
    ownerId,
  })
  if (!parsed.ok) {
    throw new Error('A validated import command could not be normalized.')
  }
  return parsed.value
}

function validationResult(
  commandId: string,
  message: string,
): MaterialCommandValidationResult {
  return {
    status: 'validation_error',
    commandId,
    code: 'invalid-activity-import',
    message,
  }
}

function importedRun(
  event: CompletedActivityUpsertV1,
  runId: CompletedRunId,
  committedAt: string,
): CompletedRun {
  const run: CompletedRun = {
    id: runId,
    userId: event.ownerId,
    startedAt: event.startedAt,
    timeZone: event.timeZone,
    distance: event.distanceMeters,
    duration: createDurationSeconds(resolveActivityDurationSeconds(event)),
    importProvider: event.provider,
    reportedOrigin: event.reportedOrigin,
    createdAt: createUtcDateTime(committedAt),
    updatedAt: createUtcDateTime(committedAt),
  }
  if (validateCompletedRun(run).length > 0) {
    throw new Error('A normalized provider event projected an invalid run.')
  }
  return run
}

function updatedImportedRun(
  existing: CompletedRun,
  event: CompletedActivityUpsertV1,
  updatedAt: string,
): CompletedRun {
  const run: CompletedRun = {
    ...existing,
    startedAt: event.startedAt,
    timeZone: event.timeZone,
    distance: event.distanceMeters,
    duration: createDurationSeconds(resolveActivityDurationSeconds(event)),
    importProvider: event.provider,
    reportedOrigin: event.reportedOrigin,
    updatedAt: createUtcDateTime(updatedAt),
  }
  if (validateCompletedRun(run).length > 0) {
    throw new Error('A provider update projected an invalid run.')
  }
  return run
}

function appliedResult(options: {
  commandId: string
  canonicalCommandId: string
  completedRun: CompletedRun | null
  operation: ActivityImportReceiptResult['operation']
  processedAt: string
}): ActivityImportReceiptResult {
  return {
    status: 'activity_imported',
    commandId: options.commandId,
    canonicalCommandId: options.canonicalCommandId,
    operation: options.operation,
    completedRunId: options.completedRun?.id ?? null,
    completedRunUpdatedAt: options.completedRun?.updatedAt ?? null,
    processedAt: createUtcDateTime(options.processedAt),
  }
}

function reviewResult(options: {
  commandId: string
  canonicalCommandId: string
  candidateCompletedRunId: CompletedRunId | null
  code: ActivityImportReviewRequiredResult['code']
  recordedAt: string
}): ActivityImportReviewRequiredResult {
  return {
    status: 'activity_import_review_required',
    commandId: options.commandId,
    code: options.code,
    message:
      options.code === 'cross-provider-duplicate-candidate'
        ? 'A matching activity from another provider requires duplicate review.'
        : 'This provider update has the same ordering time but different facts and requires review.',
    canonicalCommandId: options.canonicalCommandId,
    candidateCompletedRunId: options.candidateCompletedRunId,
    recordedAt: createUtcDateTime(options.recordedAt),
  }
}

function staleResult(
  commandId: string,
  incoming: CompletedActivityImportEventV1,
  existing: CompletedActivityImportEventV1,
): ActivityImportStaleResult {
  return {
    status: 'stale_revision',
    commandId,
    code: 'provider-activity-version-changed',
    message: 'A newer provider activity version is already stored.',
    providerUpdatedAt: incoming.providerUpdatedAt,
    latestProviderUpdatedAt: existing.providerUpdatedAt,
  }
}

function incomingEventIsNewer(
  existing: CompletedActivityImportEventV1,
  incoming: CompletedActivityImportEventV1,
): boolean {
  const existingOrderTime =
    existing.providerUpdatedAt !== null && incoming.providerUpdatedAt !== null
      ? existing.providerUpdatedAt
      : existing.observedAt
  const incomingOrderTime =
    existing.providerUpdatedAt !== null && incoming.providerUpdatedAt !== null
      ? incoming.providerUpdatedAt
      : incoming.observedAt
  return Date.parse(incomingOrderTime) > Date.parse(existingOrderTime)
}

function findCrossProviderCandidate(
  incoming: CompletedActivityUpsertV1,
  records: readonly ActivityImportRecordV1[],
): {
  assessment: Exclude<CrossProviderDuplicateAssessment, { kind: 'not_candidate' }>
  record: ActivityImportRecordV1
} | null {
  for (const record of [...records].sort((left, right) =>
    createProviderActivityIdentityKey(left.event).localeCompare(
      createProviderActivityIdentityKey(right.event),
    ),
  )) {
    if (
      record.state !== 'active' ||
      record.completedRunId === null ||
      record.event.operation !== 'upsert'
    ) {
      continue
    }
    const assessment = assessCrossProviderDuplicate(incoming, record.event)
    if (assessment.kind !== 'not_candidate') return { assessment, record }
  }
  return null
}

export class FirestoreActivityImportStore implements ActivityImportStore {
  private readonly createRunId: () => string
  private readonly now: () => Date

  constructor(
    private readonly database: Firestore,
    options: FirestoreActivityImportStoreOptions = {},
  ) {
    this.createRunId = options.createRunId ?? (() => `run-${randomUUID()}`)
    this.now = options.now ?? (() => new Date())
  }

  async commit(options: {
    envelope: ActivityImportCommandEnvelope
    ownerId: string
  }) {
    const ownerId = createUserId(options.ownerId)
    const event = normalizedEvent(options.ownerId, options.envelope)
    const signature = materialCommandSignature(options.envelope)
    const processedAt = this.now().toISOString()
    const importId = importDocumentId(event)
    const importReference = this.database.doc(
      activityImportDocumentPath(ownerId, importId),
    )
    const receiptReference = this.database.doc(
      materialCommandReceiptPath(options.ownerId, options.envelope.commandId),
    )
    const membershipReference = this.database.doc(
      approvedBetaMembershipPath(options.ownerId),
    )

    return this.database.runTransaction(async (transaction) => {
      const [membershipSnapshot, receiptSnapshot, importSnapshot] =
        await Promise.all([
          transaction.get(membershipReference),
          transaction.get(receiptReference),
          transaction.get(importReference),
        ])

      if (!isApprovedBetaMembership(membershipSnapshot.data(), options.ownerId)) {
        return { kind: 'membership-required' as const }
      }
      if (receiptSnapshot.exists) {
        const receipt = receiptSnapshot.data()
        if (!receipt || receipt.signature !== signature) {
          return { kind: 'conflict' as const }
        }
        const result = storedImportResult(receipt.result)
        return result.status === 'activity_imported'
          ? { kind: 'applied' as const, result }
          : result.status === 'activity_import_review_required'
            ? { kind: 'review-required' as const, result }
            : { kind: 'stale' as const, result }
      }

      const existing = importRecordFromDocument(importSnapshot.data())
      if (
        existing !== null &&
        createProviderActivityIdentityKey(existing.event) !==
          createProviderActivityIdentityKey(event)
      ) {
        throw new Error('An activity-import document identity is inconsistent.')
      }
      const canonicalCommandId =
        existing?.canonicalCommandId ?? options.envelope.commandId
      const resolution = resolveProviderActivityEvent(existing?.event ?? null, event)

      const writeReceipt = (result: unknown) => {
        transaction.create(receiptReference, {
          schemaVersion: MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
          signature,
          result,
          createdAt: processedAt,
        })
      }

      if (resolution.kind === 'stale') {
        const result = staleResult(
          options.envelope.commandId,
          event,
          existing!.event,
        )
        writeReceipt(result)
        return { kind: 'stale' as const, result }
      }
      if (resolution.kind === 'ambiguous') {
        const result = reviewResult({
          commandId: options.envelope.commandId,
          canonicalCommandId,
          candidateCompletedRunId: existing?.completedRunId ?? null,
          code: 'provider-update-ambiguous',
          recordedAt: processedAt,
        })
        writeReceipt(result)
        return { kind: 'review-required' as const, result }
      }
      if (resolution.kind === 'unrelated') {
        throw new Error('A provider event resolved against an unrelated identity.')
      }

      let existingRun: CompletedRun | null = null
      if (existing?.completedRunId !== null && existing?.completedRunId !== undefined) {
        const runSnapshot = await transaction.get(
          this.database.doc(runDocumentPath(ownerId, existing.completedRunId)),
        )
        existingRun = completedRunFromAdminDocument(
          runSnapshot.id,
          runSnapshot.data(),
        )
        if (existingRun === null || existingRun.userId !== ownerId) {
          throw new Error('The imported completed run is unavailable.')
        }
      }

      if (resolution.kind === 'duplicate') {
        const runNeedsProvenanceBackfill =
          existingRun !== null &&
          event.operation === 'upsert' &&
          (existingRun.importProvider !== event.provider ||
            existingRun.reportedOrigin !== event.reportedOrigin)
        const backfilledRun =
          runNeedsProvenanceBackfill &&
          existingRun !== null &&
          event.operation === 'upsert'
            ? updatedImportedRun(existingRun, event, processedAt)
            : existingRun
        if (runNeedsProvenanceBackfill && backfilledRun !== null) {
          transaction.set(
            this.database.doc(runDocumentPath(ownerId, backfilledRun.id)),
            completedRunAdminDocument(backfilledRun),
          )
        }
        const result =
          existing?.state === 'review_required'
            ? reviewResult({
                commandId: options.envelope.commandId,
                canonicalCommandId,
                candidateCompletedRunId:
                  existing.candidateCompletedRunId,
                code: 'cross-provider-duplicate-candidate',
                recordedAt: processedAt,
              })
            : appliedResult({
                commandId: options.envelope.commandId,
                canonicalCommandId,
                completedRun: backfilledRun,
                operation:
                  existing?.state === 'deleted'
                    ? 'deleted'
                    : runNeedsProvenanceBackfill
                      ? 'updated'
                      : 'unchanged',
                processedAt,
              })
        if (
          existing !== null &&
          incomingEventIsNewer(existing.event, event)
        ) {
          transaction.set(
            importReference,
            importRecordDocument({
              ...existing,
              event,
              updatedAt: createUtcDateTime(processedAt),
            }),
          )
        }
        writeReceipt(result)
        return result.status === 'activity_imported'
          ? { kind: 'applied' as const, result }
          : { kind: 'review-required' as const, result }
      }

      if (event.operation === 'delete') {
        let reopenedWorkout: PlannedWorkout | null = null
        let guardReference: ReturnType<Firestore['doc']> | null = null
        let workoutReference: ReturnType<Firestore['doc']> | null = null
        if (
          existingRun?.plannedWorkoutPlanId !== undefined &&
          existingRun.plannedWorkoutId !== undefined
        ) {
          workoutReference = this.database.doc(
            workoutDocumentPath(
              ownerId,
              existingRun.plannedWorkoutPlanId,
              existingRun.plannedWorkoutId,
            ),
          )
          guardReference = this.database.doc(
            workoutCompletionGuardDocumentPath(
              ownerId,
              existingRun.plannedWorkoutPlanId,
              existingRun.plannedWorkoutId,
            ),
          )
          const [workoutSnapshot, guardSnapshot] = await Promise.all([
            transaction.get(workoutReference),
            transaction.get(guardReference),
          ])
          const workout = plannedWorkoutFromAdminDocument(
            workoutSnapshot.id,
            workoutSnapshot.data(),
          )
          const guard = completionGuardFromAdminDocument(guardSnapshot.data())
          if (
            workout !== null &&
            workout.userId === ownerId &&
            workout.status === 'completed' &&
            guard?.completedRunId === existingRun.id
          ) {
            reopenedWorkout = {
              ...workout,
              status: 'planned',
              updatedAt: createUtcDateTime(processedAt),
            }
          }
        }

        if (existingRun !== null) {
          transaction.delete(
            this.database.doc(runDocumentPath(ownerId, existingRun.id)),
          )
        }
        if (
          reopenedWorkout !== null &&
          workoutReference !== null &&
          guardReference !== null
        ) {
          transaction.set(
            workoutReference,
            plannedWorkoutAdminDocument(reopenedWorkout),
          )
          transaction.delete(guardReference)
        }
        const record: ActivityImportRecordV1 = {
          schemaVersion: ACTIVITY_IMPORT_RECORD_SCHEMA_VERSION,
          trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
          userId: ownerId,
          canonicalCommandId,
          state: 'deleted',
          event,
          completedRunId: null,
          candidateCompletedRunId: null,
          candidateKind: null,
          crossProviderFingerprint: null,
          startedAtEpochMilliseconds: null,
          createdAt: existing?.createdAt ?? createUtcDateTime(processedAt),
          updatedAt: createUtcDateTime(processedAt),
        }
        const result = appliedResult({
          commandId: options.envelope.commandId,
          canonicalCommandId,
          completedRun: null,
          operation: 'deleted',
          processedAt,
        })
        transaction.set(importReference, importRecordDocument(record))
        writeReceipt(result)
        return { kind: 'applied' as const, result }
      }

      if (Date.parse(event.startedAt) > Date.parse(processedAt)) {
        return {
          kind: 'rejected' as const,
          result: validationResult(
            options.envelope.commandId,
            'An imported completed run cannot start in the future.',
          ),
        }
      }

      const startedAtEpochMilliseconds = Date.parse(event.startedAt)
      const candidateSnapshots = await transaction.get(
        this.database
          .collection(activityImportsCollectionPath(ownerId))
          .where(
            'startedAtEpochMilliseconds',
            '>=',
            startedAtEpochMilliseconds - 60_000,
          )
          .where(
            'startedAtEpochMilliseconds',
            '<=',
            startedAtEpochMilliseconds + 60_000,
          ),
      )
      const allRecords = candidateSnapshots.docs
        .filter((document) => document.id !== importId)
        .map((document) => importRecordFromDocument(document.data()))
        .filter((record): record is ActivityImportRecordV1 => record !== null)
      const candidate = findCrossProviderCandidate(event, allRecords)
      if (candidate !== null) {
        const result = reviewResult({
          commandId: options.envelope.commandId,
          canonicalCommandId,
          candidateCompletedRunId: candidate.record.completedRunId,
          code: 'cross-provider-duplicate-candidate',
          recordedAt: processedAt,
        })
        if (existingRun === null) {
          const record: ActivityImportRecordV1 = {
            schemaVersion: ACTIVITY_IMPORT_RECORD_SCHEMA_VERSION,
            trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
            userId: ownerId,
            canonicalCommandId,
            state: 'review_required',
            event,
            completedRunId: null,
            candidateCompletedRunId: candidate.record.completedRunId,
            candidateKind: candidate.assessment.kind,
            crossProviderFingerprint:
              createCrossProviderDuplicateFingerprint(event),
            startedAtEpochMilliseconds,
            createdAt: existing?.createdAt ?? createUtcDateTime(processedAt),
            updatedAt: createUtcDateTime(processedAt),
          }
          transaction.set(importReference, importRecordDocument(record))
        }
        writeReceipt(result)
        return { kind: 'review-required' as const, result }
      }

      const run =
        existingRun === null
          ? importedRun(
              event,
              createCompletedRunId(this.createRunId()),
              processedAt,
            )
          : updatedImportedRun(existingRun, event, processedAt)
      const record: ActivityImportRecordV1 = {
        schemaVersion: ACTIVITY_IMPORT_RECORD_SCHEMA_VERSION,
        trainingSchemaVersion: TRAINING_SCHEMA_VERSION,
        userId: ownerId,
        canonicalCommandId,
        state: 'active',
        event,
        completedRunId: run.id,
        candidateCompletedRunId: null,
        candidateKind: null,
        crossProviderFingerprint: createCrossProviderDuplicateFingerprint(event),
        startedAtEpochMilliseconds,
        createdAt: existing?.createdAt ?? createUtcDateTime(processedAt),
        updatedAt: createUtcDateTime(processedAt),
      }
      const result = appliedResult({
        commandId: options.envelope.commandId,
        canonicalCommandId,
        completedRun: run,
        operation: existingRun === null ? 'created' : 'updated',
        processedAt,
      })
      const runReference = this.database.doc(runDocumentPath(ownerId, run.id))
      if (existingRun === null) {
        transaction.create(runReference, completedRunAdminDocument(run))
      } else {
        transaction.set(runReference, completedRunAdminDocument(run))
      }
      transaction.set(importReference, importRecordDocument(record))
      writeReceipt(result)
      return { kind: 'applied' as const, result }
    })
  }
}
