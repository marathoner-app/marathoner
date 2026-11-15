import { createHash } from 'node:crypto'

import type {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'

import {
  assessCrossProviderDuplicate,
  createCrossProviderDuplicateFingerprint,
  createProviderActivityIdentityKey,
  parseCompletedActivityImportEvent,
  resolveActivityDurationSeconds,
  type CompletedActivityUpsertV1,
  type CrossProviderDuplicateAssessment,
} from '../../src/domain/activityImport/contract.js'
import {
  createCompletedRunId,
  createUserId,
  type CompletedRunId,
  type UserId,
} from '../../src/domain/training/identifiers.js'
import type { CompletedRun } from '../../src/domain/training/types.js'
import {
  activityImportsCollectionPath,
  runsCollectionPath,
} from '../../src/persistence/firestore/paths.js'
import {
  approvedBetaMembershipPath,
  isApprovedBetaMembership,
} from './approvedBetaMembership.js'
import {
  adminTimestamp,
  completedRunFromAdminDocument,
} from './firestoreCompletedRunDocuments.js'

const CONFIRMATION_PREFIX = 'RECONCILE-ACTIVITY-IMPORT-DUPLICATES'

type CandidateKind = Exclude<
  CrossProviderDuplicateAssessment,
  { kind: 'not_candidate' }
>['kind']

type BlockedReason =
  | 'conflicting_heart_rate'
  | 'duplicate_has_runner_fields'
  | 'import_run_mismatch'
  | 'missing_heart_rate'
  | 'missing_run'
  | 'multiple_candidates'
  | 'provider_mismatch'

interface ActiveImport {
  readonly id: string
  readonly completedRunId: CompletedRunId
  readonly event: CompletedActivityUpsertV1
  readonly reference: QueryDocumentSnapshot<DocumentData>['ref']
  readonly updateTimeMilliseconds: number
}

interface CandidateEdge {
  readonly assessmentKind: CandidateKind
  readonly canonical: ActiveImport
  readonly duplicate: ActiveImport
  readonly kind: 'cross_provider' | 'same_provider_enrichment'
}

interface EligiblePair extends CandidateEdge {
  readonly canonicalRun: CompletedRun
  readonly canonicalRunReference: QueryDocumentSnapshot<DocumentData>['ref']
  readonly canonicalRunUpdateTimeMilliseconds: number
  readonly duplicateRun: CompletedRun
  readonly duplicateRunReference: QueryDocumentSnapshot<DocumentData>['ref']
  readonly duplicateRunUpdateTimeMilliseconds: number
}

interface ReconciliationPlan {
  readonly blockedReasonCounts: Readonly<Record<BlockedReason, number>>
  readonly candidatePairCount: number
  readonly confirmation: string | null
  readonly crossProviderCandidatePairCount: number
  readonly eligiblePairs: readonly EligiblePair[]
  readonly sameProviderCandidatePairCount: number
}

export interface ActivityImportDuplicateReconciliationInspection {
  readonly blockedPairCount: number
  readonly blockedReasonCounts: Readonly<Record<BlockedReason, number>>
  readonly candidatePairCount: number
  readonly confirmation: string | null
  readonly crossProviderCandidatePairCount: number
  readonly eligiblePairCount: number
  readonly sameProviderCandidatePairCount: number
}

export type ActivityImportDuplicateReconciliationResult =
  | {
      readonly status: 'already_reconciled'
      readonly reconciledPairCount: 0
    }
  | {
      readonly status: 'reconciled'
      readonly reconciledPairCount: number
    }

export interface FirestoreActivityImportDuplicateReconciliationOptions {
  readonly now?: () => Date
  readonly projectId: string
}

function emptyBlockedCounts(): Record<BlockedReason, number> {
  return {
    conflicting_heart_rate: 0,
    duplicate_has_runner_fields: 0,
    import_run_mismatch: 0,
    missing_heart_rate: 0,
    missing_run: 0,
    multiple_candidates: 0,
    provider_mismatch: 0,
  }
}

function activeImportFromSnapshot(
  snapshot: QueryDocumentSnapshot<DocumentData>,
  ownerId: UserId,
): ActiveImport | null {
  const data = snapshot.data()
  if (data.state !== 'active') return null
  const provider = data.event?.provider
  if (provider !== 'garmin_connect' && provider !== 'apple_health') return null

  const parsedEvent = parseCompletedActivityImportEvent(data.event)
  if (
    data.userId !== ownerId ||
    data.completedRunId === null ||
    typeof data.completedRunId !== 'string' ||
    !parsedEvent.ok ||
    parsedEvent.value.operation !== 'upsert' ||
    parsedEvent.value.ownerId !== ownerId ||
    parsedEvent.value.provider !== provider ||
    data.crossProviderFingerprint !==
      createCrossProviderDuplicateFingerprint(parsedEvent.value) ||
    data.startedAtEpochMilliseconds !== Date.parse(parsedEvent.value.startedAt)
  ) {
    throw new Error('A relevant activity-import record is invalid.')
  }

  return {
    id: snapshot.id,
    completedRunId: createCompletedRunId(data.completedRunId),
    event: parsedEvent.value,
    reference: snapshot.ref,
    updateTimeMilliseconds: snapshot.updateTime.toMillis(),
  }
}

function runMatchesEvent(run: CompletedRun, event: CompletedActivityUpsertV1) {
  return (
    run.userId === event.ownerId &&
    run.startedAt === event.startedAt &&
    run.timeZone === event.timeZone &&
    run.distance === event.distanceMeters &&
    run.duration === resolveActivityDurationSeconds(event) &&
    run.importProvider === event.provider &&
    run.reportedOrigin === event.reportedOrigin
  )
}

function hasRunnerOwnedFields(run: CompletedRun) {
  return (
    run.plannedWorkoutPlanId !== undefined ||
    run.plannedWorkoutId !== undefined ||
    run.shoeId !== undefined ||
    run.perceivedEffort !== undefined ||
    run.unusualPain !== undefined ||
    run.notes !== undefined
  )
}

function heartRateMatchesEvent(
  run: CompletedRun,
  event: CompletedActivityUpsertV1,
) {
  return (
    run.averageHeartRateBpm === event.averageHeartRateBpm &&
    run.maximumHeartRateBpm === event.maximumHeartRateBpm
  )
}

function eventHasHeartRate(event: CompletedActivityUpsertV1) {
  return (
    event.averageHeartRateBpm !== undefined ||
    event.maximumHeartRateBpm !== undefined
  )
}

function blockedReason(
  edge: CandidateEdge,
  runSnapshots: ReadonlyMap<string, QueryDocumentSnapshot<DocumentData>>,
): { reason: BlockedReason } | { pair: EligiblePair } {
  const canonicalRunSnapshot = runSnapshots.get(edge.canonical.completedRunId)
  const duplicateRunSnapshot = runSnapshots.get(edge.duplicate.completedRunId)
  if (canonicalRunSnapshot === undefined || duplicateRunSnapshot === undefined) {
    return { reason: 'missing_run' }
  }

  const canonicalRun = completedRunFromAdminDocument(
    canonicalRunSnapshot.id,
    canonicalRunSnapshot.data(),
  )
  const duplicateRun = completedRunFromAdminDocument(
    duplicateRunSnapshot.id,
    duplicateRunSnapshot.data(),
  )
  if (canonicalRun === null || duplicateRun === null) {
    return { reason: 'missing_run' }
  }
  const providersMatch =
    edge.kind === 'cross_provider'
      ? canonicalRun.importProvider === 'garmin_connect' &&
        duplicateRun.importProvider === 'apple_health'
      : canonicalRun.importProvider === 'apple_health' &&
        duplicateRun.importProvider === 'apple_health'
  if (
    !providersMatch ||
    canonicalRun.reportedOrigin !== 'garmin' ||
    duplicateRun.reportedOrigin !== 'garmin'
  ) {
    return { reason: 'provider_mismatch' }
  }
  if (
    !runMatchesEvent(canonicalRun, edge.canonical.event) ||
    !runMatchesEvent(duplicateRun, edge.duplicate.event)
  ) {
    return { reason: 'import_run_mismatch' }
  }
  if (hasRunnerOwnedFields(duplicateRun)) {
    return { reason: 'duplicate_has_runner_fields' }
  }
  if (
    !heartRateMatchesEvent(canonicalRun, edge.canonical.event) ||
    !heartRateMatchesEvent(duplicateRun, edge.duplicate.event)
  ) {
    return { reason: 'conflicting_heart_rate' }
  }
  const heartRateSourceRun =
    edge.kind === 'cross_provider' ? duplicateRun : canonicalRun
  const heartRateSourceEvent =
    edge.kind === 'cross_provider' ? edge.duplicate.event : edge.canonical.event
  const noHeartRateRun =
    edge.kind === 'cross_provider' ? canonicalRun : duplicateRun
  const noHeartRateEvent =
    edge.kind === 'cross_provider' ? edge.canonical.event : edge.duplicate.event
  if (
    !eventHasHeartRate(heartRateSourceEvent) ||
    (heartRateSourceRun.averageHeartRateBpm === undefined &&
      heartRateSourceRun.maximumHeartRateBpm === undefined)
  ) {
    return { reason: 'missing_heart_rate' }
  }
  if (
    noHeartRateRun.averageHeartRateBpm !== undefined ||
    noHeartRateRun.maximumHeartRateBpm !== undefined ||
    eventHasHeartRate(noHeartRateEvent)
  ) {
    return { reason: 'conflicting_heart_rate' }
  }

  return {
    pair: {
      ...edge,
      canonicalRun,
      canonicalRunReference: canonicalRunSnapshot.ref,
      canonicalRunUpdateTimeMilliseconds:
        canonicalRunSnapshot.updateTime.toMillis(),
      duplicateRun,
      duplicateRunReference: duplicateRunSnapshot.ref,
      duplicateRunUpdateTimeMilliseconds:
        duplicateRunSnapshot.updateTime.toMillis(),
    },
  }
}

function confirmationFor(
  projectId: string,
  ownerId: UserId,
  pairs: readonly EligiblePair[],
) {
  if (pairs.length === 0) return null
  const evidence = pairs
    .map((pair) =>
      [
        pair.kind,
        pair.canonical.id,
        pair.canonical.updateTimeMilliseconds,
        pair.canonicalRun.id,
        pair.canonicalRunUpdateTimeMilliseconds,
        pair.duplicate.id,
        pair.duplicate.updateTimeMilliseconds,
        pair.duplicateRun.id,
        pair.duplicateRunUpdateTimeMilliseconds,
      ].join(':'),
    )
    .sort()
    .join('\n')
  const digest = createHash('sha256')
    .update(`${projectId}\n${ownerId}\n${evidence}`)
    .digest('hex')
    .slice(0, 24)
  return `${CONFIRMATION_PREFIX}:${digest}`
}

function buildPlan(options: {
  imports: readonly QueryDocumentSnapshot<DocumentData>[]
  ownerId: UserId
  projectId: string
  runs: readonly QueryDocumentSnapshot<DocumentData>[]
}): ReconciliationPlan {
  const imports = options.imports
    .map((snapshot) => activeImportFromSnapshot(snapshot, options.ownerId))
    .filter((record): record is ActiveImport => record !== null)
  const garminImports = imports.filter(
    ({ event }) =>
      event.provider === 'garmin_connect' && event.reportedOrigin === 'garmin',
  )
  const appleImports = imports.filter(
    ({ event }) =>
      event.provider === 'apple_health' && event.reportedOrigin === 'garmin',
  )
  const edges: CandidateEdge[] = []
  for (const garmin of garminImports) {
    for (const apple of appleImports) {
      const assessment = assessCrossProviderDuplicate(garmin.event, apple.event)
      if (assessment.kind !== 'not_candidate') {
        edges.push({
          assessmentKind: assessment.kind,
          canonical: garmin,
          duplicate: apple,
          kind: 'cross_provider',
        })
      }
    }
  }
  for (let leftIndex = 0; leftIndex < appleImports.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < appleImports.length;
      rightIndex += 1
    ) {
      const left = appleImports[leftIndex]
      const right = appleImports[rightIndex]
      if (
        createProviderActivityIdentityKey(left.event) ===
          createProviderActivityIdentityKey(right.event) ||
        createCrossProviderDuplicateFingerprint(left.event) !==
          createCrossProviderDuplicateFingerprint(right.event)
      ) {
        continue
      }
      const leftHasHeartRate = eventHasHeartRate(left.event)
      const rightHasHeartRate = eventHasHeartRate(right.event)
      const canonical =
        leftHasHeartRate !== rightHasHeartRate
          ? leftHasHeartRate
            ? left
            : right
          : left.id.localeCompare(right.id) <= 0
            ? left
            : right
      edges.push({
        assessmentKind: 'duplicate_candidate',
        canonical,
        duplicate: canonical === left ? right : left,
        kind: 'same_provider_enrichment',
      })
    }
  }

  const edgeCounts = new Map<string, number>()
  for (const edge of edges) {
    edgeCounts.set(
      edge.canonical.id,
      (edgeCounts.get(edge.canonical.id) ?? 0) + 1,
    )
    edgeCounts.set(
      edge.duplicate.id,
      (edgeCounts.get(edge.duplicate.id) ?? 0) + 1,
    )
  }
  const runSnapshots = new Map(options.runs.map((run) => [run.id, run]))
  const blockedReasonCounts = emptyBlockedCounts()
  const eligiblePairs: EligiblePair[] = []
  for (const edge of edges) {
    if (
      edgeCounts.get(edge.canonical.id) !== 1 ||
      edgeCounts.get(edge.duplicate.id) !== 1
    ) {
      blockedReasonCounts.multiple_candidates += 1
      continue
    }
    const result = blockedReason(edge, runSnapshots)
    if ('reason' in result) {
      blockedReasonCounts[result.reason] += 1
    } else {
      eligiblePairs.push(result.pair)
    }
  }

  return {
    blockedReasonCounts,
    candidatePairCount: edges.length,
    confirmation: confirmationFor(
      options.projectId,
      options.ownerId,
      eligiblePairs,
    ),
    crossProviderCandidatePairCount: edges.filter(
      ({ kind }) => kind === 'cross_provider',
    ).length,
    eligiblePairs,
    sameProviderCandidatePairCount: edges.filter(
      ({ kind }) => kind === 'same_provider_enrichment',
    ).length,
  }
}

function inspectionFromPlan(
  plan: ReconciliationPlan,
): ActivityImportDuplicateReconciliationInspection {
  return {
    blockedPairCount: Object.values(plan.blockedReasonCounts).reduce(
      (total, count) => total + count,
      0,
    ),
    blockedReasonCounts: plan.blockedReasonCounts,
    candidatePairCount: plan.candidatePairCount,
    confirmation: plan.confirmation,
    crossProviderCandidatePairCount: plan.crossProviderCandidatePairCount,
    eligiblePairCount: plan.eligiblePairs.length,
    sameProviderCandidatePairCount: plan.sameProviderCandidatePairCount,
  }
}

export class FirestoreActivityImportDuplicateReconciliation {
  private readonly now: () => Date

  constructor(
    private readonly database: Firestore,
    private readonly options: FirestoreActivityImportDuplicateReconciliationOptions,
  ) {
    this.now = options.now ?? (() => new Date())
  }

  async inspect(
    ownerIdValue: string,
  ): Promise<ActivityImportDuplicateReconciliationInspection> {
    const ownerId = createUserId(ownerIdValue)
    const [membership, imports, runs] = await Promise.all([
      this.database.doc(approvedBetaMembershipPath(ownerId)).get(),
      this.database.collection(activityImportsCollectionPath(ownerId)).get(),
      this.database.collection(runsCollectionPath(ownerId)).get(),
    ])
    if (!isApprovedBetaMembership(membership.data(), ownerId)) {
      throw new Error('The selected owner does not have approved beta membership.')
    }
    return inspectionFromPlan(
      buildPlan({
        imports: imports.docs,
        ownerId,
        projectId: this.options.projectId,
        runs: runs.docs,
      }),
    )
  }

  async reconcile(options: {
    confirmation: string
    ownerId: string
  }): Promise<ActivityImportDuplicateReconciliationResult> {
    const ownerId = createUserId(options.ownerId)
    return this.database.runTransaction(async (transaction) => {
      const [membership, imports, runs] = await Promise.all([
        transaction.get(this.database.doc(approvedBetaMembershipPath(ownerId))),
        transaction.get(
          this.database.collection(activityImportsCollectionPath(ownerId)),
        ),
        transaction.get(this.database.collection(runsCollectionPath(ownerId))),
      ])
      if (!isApprovedBetaMembership(membership.data(), ownerId)) {
        throw new Error('The selected owner does not have approved beta membership.')
      }
      const plan = buildPlan({
        imports: imports.docs,
        ownerId,
        projectId: this.options.projectId,
        runs: runs.docs,
      })
      const inspection = inspectionFromPlan(plan)
      if (inspection.blockedPairCount > 0) {
        throw new Error('Duplicate reconciliation found a blocked candidate and made no changes.')
      }
      if (plan.eligiblePairs.length === 0) {
        return { status: 'already_reconciled', reconciledPairCount: 0 }
      }
      if (options.confirmation !== plan.confirmation) {
        throw new Error('Duplicate reconciliation requires the exact current dry-run confirmation.')
      }

      const reconciledAt = this.now().toISOString()
      for (const pair of plan.eligiblePairs) {
        if (pair.kind === 'cross_provider') {
          transaction.update(pair.canonicalRunReference, {
            ...(pair.duplicateRun.averageHeartRateBpm === undefined
              ? {}
              : {
                  averageHeartRateBpm:
                    pair.duplicateRun.averageHeartRateBpm,
                }),
            ...(pair.duplicateRun.maximumHeartRateBpm === undefined
              ? {}
              : { maximumHeartRateBpm: pair.duplicateRun.maximumHeartRateBpm }),
            updatedAt: adminTimestamp(reconciledAt),
          })
        }
        transaction.delete(pair.duplicateRunReference)
        transaction.update(pair.duplicate.reference, {
          candidateCompletedRunId: pair.canonicalRun.id,
          candidateKind: pair.assessmentKind,
          completedRunId: null,
          state: 'review_required',
          updatedAt: reconciledAt,
        })
      }

      return {
        status: 'reconciled',
        reconciledPairCount: plan.eligiblePairs.length,
      }
    })
  }
}
