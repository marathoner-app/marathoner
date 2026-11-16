import { createHash } from 'node:crypto'

import type {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'

import {
  createCrossProviderDuplicateFingerprint,
  parseCompletedActivityImportEvent,
  resolveActivityDurationSeconds,
  type CompletedActivityUpsertV1,
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
import { completedRunFromAdminDocument } from './firestoreCompletedRunDocuments.js'

const CONFIRMATION_PREFIX = 'RECONCILE-LEGACY-IMPORTED-RUN-DUPLICATES'

type BlockedReason =
  | 'ambiguous_cluster'
  | 'chronology_mismatch'
  | 'conflicting_heart_rate'
  | 'import_evidence_mismatch'
  | 'import_run_mismatch'
  | 'legacy_has_import_metadata'
  | 'legacy_has_runner_fields'
  | 'provider_mismatch'

type ExcludedReason = 'missing_heart_rate'

interface ActiveImportEvidence {
  readonly completedRunId: CompletedRunId
  readonly event: CompletedActivityUpsertV1
  readonly id: string
  readonly updateTimeMilliseconds: number
}

interface RunRecord {
  readonly reference: QueryDocumentSnapshot<DocumentData>['ref']
  readonly run: CompletedRun
  readonly updateTimeMilliseconds: number
}

interface EligiblePair {
  readonly enrichedImport: ActiveImportEvidence
  readonly enrichedRun: RunRecord
  readonly legacyRun: RunRecord
}

interface BlockedCluster {
  readonly reason: BlockedReason
  readonly runs: readonly RunRecord[]
  readonly trackedRunIds: readonly CompletedRunId[]
}

interface ExcludedCluster {
  readonly reason: ExcludedReason
  readonly runs: readonly RunRecord[]
  readonly trackedRunIds: readonly CompletedRunId[]
}

interface ReconciliationPlan {
  readonly blockedClusters: readonly BlockedCluster[]
  readonly blockedReasonCounts: Readonly<Record<BlockedReason, number>>
  readonly candidateClusterCount: number
  readonly confirmation: string | null
  readonly eligiblePairs: readonly EligiblePair[]
  readonly excludedClusters: readonly ExcludedCluster[]
  readonly excludedReasonCounts: Readonly<Record<ExcludedReason, number>>
}

export interface LegacyImportedRunDuplicatePairInspection {
  readonly averageHeartRateBpm: number | null
  readonly distanceMeters: number
  readonly durationSeconds: number
  readonly enrichedImportId: string
  readonly enrichedRunId: string
  readonly legacyRunId: string
  readonly maximumHeartRateBpm: number | null
  readonly startedAt: string
}

export interface LegacyImportedRunDuplicateBlockedClusterInspection {
  readonly distanceMeters: number
  readonly durationSeconds: number
  readonly reason: BlockedReason
  readonly runIds: readonly string[]
  readonly startedAt: string
  readonly trackedRunIds: readonly string[]
}

export interface LegacyImportedRunDuplicateExcludedClusterInspection {
  readonly distanceMeters: number
  readonly durationSeconds: number
  readonly reason: ExcludedReason
  readonly runIds: readonly string[]
  readonly startedAt: string
  readonly trackedRunIds: readonly string[]
}

export interface LegacyImportedRunDuplicateInspection {
  readonly blockedClusters: readonly LegacyImportedRunDuplicateBlockedClusterInspection[]
  readonly blockedClusterCount: number
  readonly blockedReasonCounts: Readonly<Record<BlockedReason, number>>
  readonly candidateClusterCount: number
  readonly confirmation: string | null
  readonly eligiblePairs: readonly LegacyImportedRunDuplicatePairInspection[]
  readonly eligiblePairCount: number
  readonly excludedClusters: readonly LegacyImportedRunDuplicateExcludedClusterInspection[]
  readonly excludedClusterCount: number
  readonly excludedReasonCounts: Readonly<Record<ExcludedReason, number>>
}

export type LegacyImportedRunDuplicateReconciliationResult =
  | {
      readonly reconciledPairCount: 0
      readonly status: 'already_reconciled'
    }
  | {
      readonly reconciledPairCount: number
      readonly status: 'reconciled'
    }

export interface FirestoreLegacyImportedRunDuplicateReconciliationOptions {
  readonly projectId: string
}

function emptyBlockedReasonCounts(): Record<BlockedReason, number> {
  return {
    ambiguous_cluster: 0,
    chronology_mismatch: 0,
    conflicting_heart_rate: 0,
    import_evidence_mismatch: 0,
    import_run_mismatch: 0,
    legacy_has_import_metadata: 0,
    legacy_has_runner_fields: 0,
    provider_mismatch: 0,
  }
}

function emptyExcludedReasonCounts(): Record<ExcludedReason, number> {
  return { missing_heart_rate: 0 }
}

function activeImportEvidence(
  snapshot: QueryDocumentSnapshot<DocumentData>,
  ownerId: UserId,
): ActiveImportEvidence | null {
  const data = snapshot.data()
  if (data.state !== 'active') return null
  const parsedEvent = parseCompletedActivityImportEvent(data.event)
  if (
    data.userId !== ownerId ||
    typeof data.completedRunId !== 'string' ||
    !parsedEvent.ok ||
    parsedEvent.value.operation !== 'upsert' ||
    parsedEvent.value.ownerId !== ownerId ||
    data.crossProviderFingerprint !==
      createCrossProviderDuplicateFingerprint(parsedEvent.value) ||
    data.startedAtEpochMilliseconds !== Date.parse(parsedEvent.value.startedAt)
  ) {
    throw new Error('A relevant activity-import record is invalid.')
  }

  return {
    completedRunId: createCompletedRunId(data.completedRunId),
    event: parsedEvent.value,
    id: snapshot.id,
    updateTimeMilliseconds: snapshot.updateTime.toMillis(),
  }
}

function runRecord(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): RunRecord {
  const run = completedRunFromAdminDocument(snapshot.id, snapshot.data())
  if (run === null) throw new Error('A completed-run record is invalid.')
  return {
    reference: snapshot.ref,
    run,
    updateTimeMilliseconds: snapshot.updateTime.toMillis(),
  }
}

function exactRunKey(run: CompletedRun) {
  return [run.startedAt, run.timeZone, run.distance, run.duration].join('|')
}

function runMatchesEvent(run: CompletedRun, event: CompletedActivityUpsertV1) {
  return (
    run.userId === event.ownerId &&
    run.startedAt === event.startedAt &&
    run.timeZone === event.timeZone &&
    run.distance === event.distanceMeters &&
    run.duration === resolveActivityDurationSeconds(event) &&
    run.importProvider === event.provider &&
    run.reportedOrigin === event.reportedOrigin &&
    run.averageHeartRateBpm === event.averageHeartRateBpm &&
    run.maximumHeartRateBpm === event.maximumHeartRateBpm
  )
}

function hasHeartRate(run: CompletedRun) {
  return (
    run.averageHeartRateBpm !== undefined ||
    run.maximumHeartRateBpm !== undefined
  )
}

function eventHasHeartRate(event: CompletedActivityUpsertV1) {
  return (
    event.averageHeartRateBpm !== undefined ||
    event.maximumHeartRateBpm !== undefined
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

function confirmationFor(
  projectId: string,
  ownerId: UserId,
  pairs: readonly EligiblePair[],
) {
  if (pairs.length === 0) return null
  const evidence = pairs
    .map(({ enrichedImport, enrichedRun, legacyRun }) =>
      [
        enrichedImport.id,
        enrichedImport.updateTimeMilliseconds,
        enrichedRun.run.id,
        enrichedRun.updateTimeMilliseconds,
        legacyRun.run.id,
        legacyRun.updateTimeMilliseconds,
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
  readonly imports: readonly QueryDocumentSnapshot<DocumentData>[]
  readonly ownerId: UserId
  readonly projectId: string
  readonly runs: readonly QueryDocumentSnapshot<DocumentData>[]
}): ReconciliationPlan {
  const imports = options.imports
    .map((snapshot) => activeImportEvidence(snapshot, options.ownerId))
    .filter((value): value is ActiveImportEvidence => value !== null)
  const importsByRunId = new Map<CompletedRunId, ActiveImportEvidence[]>()
  for (const activityImport of imports) {
    const existing = importsByRunId.get(activityImport.completedRunId) ?? []
    existing.push(activityImport)
    importsByRunId.set(activityImport.completedRunId, existing)
  }

  const runGroups = new Map<string, RunRecord[]>()
  for (const snapshot of options.runs) {
    const record = runRecord(snapshot)
    const key = exactRunKey(record.run)
    const existing = runGroups.get(key) ?? []
    existing.push(record)
    runGroups.set(key, existing)
  }

  const candidateClusters = [...runGroups.values()].filter((cluster) => {
    const trackedCount = cluster.filter(
      ({ run }) => (importsByRunId.get(run.id) ?? []).length > 0,
    ).length
    return trackedCount > 0 && trackedCount < cluster.length
  })
  const blockedReasonCounts = emptyBlockedReasonCounts()
  const blockedClusters: BlockedCluster[] = []
  const eligiblePairs: EligiblePair[] = []
  const excludedReasonCounts = emptyExcludedReasonCounts()
  const excludedClusters: ExcludedCluster[] = []

  for (const cluster of candidateClusters) {
    const tracked = cluster.filter(
      ({ run }) => (importsByRunId.get(run.id) ?? []).length > 0,
    )
    const untracked = cluster.filter(
      ({ run }) => (importsByRunId.get(run.id) ?? []).length === 0,
    )
    const block = (reason: BlockedReason) => {
      blockedReasonCounts[reason] += 1
      blockedClusters.push({
        reason,
        runs: cluster,
        trackedRunIds: tracked.map(({ run }) => run.id),
      })
    }
    const exclude = (reason: ExcludedReason) => {
      excludedReasonCounts[reason] += 1
      excludedClusters.push({
        reason,
        runs: cluster,
        trackedRunIds: tracked.map(({ run }) => run.id),
      })
    }
    if (cluster.length !== 2 || tracked.length !== 1 || untracked.length !== 1) {
      block('ambiguous_cluster')
      continue
    }
    const enrichedRun = tracked[0]
    const legacyRun = untracked[0]
    if (enrichedRun === undefined || legacyRun === undefined) {
      block('ambiguous_cluster')
      continue
    }
    const enrichedImports = importsByRunId.get(enrichedRun.run.id) ?? []
    if (enrichedImports.length !== 1) {
      block('import_evidence_mismatch')
      continue
    }
    const enrichedImport = enrichedImports[0]
    if (enrichedImport === undefined) {
      block('import_evidence_mismatch')
      continue
    }
    if (
      enrichedRun.run.importProvider !== 'apple_health' ||
      enrichedRun.run.reportedOrigin !== 'garmin' ||
      enrichedImport.event.provider !== 'apple_health' ||
      enrichedImport.event.reportedOrigin !== 'garmin'
    ) {
      block('provider_mismatch')
      continue
    }
    if (!runMatchesEvent(enrichedRun.run, enrichedImport.event)) {
      block('import_run_mismatch')
      continue
    }
    if (!hasHeartRate(enrichedRun.run) || !eventHasHeartRate(enrichedImport.event)) {
      exclude('missing_heart_rate')
      continue
    }
    if (hasHeartRate(legacyRun.run)) {
      block('conflicting_heart_rate')
      continue
    }
    if (
      legacyRun.run.importProvider !== undefined ||
      legacyRun.run.reportedOrigin !== undefined
    ) {
      block('legacy_has_import_metadata')
      continue
    }
    if (hasRunnerOwnedFields(legacyRun.run)) {
      block('legacy_has_runner_fields')
      continue
    }
    if (
      Date.parse(legacyRun.run.createdAt) >=
      Date.parse(enrichedRun.run.createdAt)
    ) {
      block('chronology_mismatch')
      continue
    }
    eligiblePairs.push({ enrichedImport, enrichedRun, legacyRun })
  }

  return {
    blockedClusters,
    blockedReasonCounts,
    candidateClusterCount: candidateClusters.length,
    confirmation: confirmationFor(
      options.projectId,
      options.ownerId,
      eligiblePairs,
    ),
    eligiblePairs,
    excludedClusters,
    excludedReasonCounts,
  }
}

function clusterInspection(
  cluster: BlockedCluster | ExcludedCluster,
): Omit<
  LegacyImportedRunDuplicateBlockedClusterInspection,
  'reason'
> {
  const [firstRun] = cluster.runs
  if (firstRun === undefined) {
    throw new Error('A legacy duplicate cluster has no runs.')
  }
  return {
    distanceMeters: firstRun.run.distance,
    durationSeconds: firstRun.run.duration,
    runIds: cluster.runs.map(({ run }) => run.id).sort(),
    startedAt: firstRun.run.startedAt,
    trackedRunIds: [...cluster.trackedRunIds].sort(),
  }
}

function inspectionFromPlan(
  plan: ReconciliationPlan,
): LegacyImportedRunDuplicateInspection {
  return {
    blockedClusters: plan.blockedClusters.map((cluster) => ({
      ...clusterInspection(cluster),
      reason: cluster.reason,
    })),
    blockedClusterCount: Object.values(plan.blockedReasonCounts).reduce(
      (total, count) => total + count,
      0,
    ),
    blockedReasonCounts: plan.blockedReasonCounts,
    candidateClusterCount: plan.candidateClusterCount,
    confirmation: plan.confirmation,
    eligiblePairs: plan.eligiblePairs.map(
      ({ enrichedImport, enrichedRun, legacyRun }) => ({
        averageHeartRateBpm: enrichedRun.run.averageHeartRateBpm ?? null,
        distanceMeters: enrichedRun.run.distance,
        durationSeconds: enrichedRun.run.duration,
        enrichedImportId: enrichedImport.id,
        enrichedRunId: enrichedRun.run.id,
        legacyRunId: legacyRun.run.id,
        maximumHeartRateBpm: enrichedRun.run.maximumHeartRateBpm ?? null,
        startedAt: enrichedRun.run.startedAt,
      }),
    ),
    eligiblePairCount: plan.eligiblePairs.length,
    excludedClusters: plan.excludedClusters.map((cluster) => ({
      ...clusterInspection(cluster),
      reason: cluster.reason,
    })),
    excludedClusterCount: plan.excludedClusters.length,
    excludedReasonCounts: plan.excludedReasonCounts,
  }
}

export class FirestoreLegacyImportedRunDuplicateReconciliation {
  constructor(
    private readonly database: Firestore,
    private readonly options: FirestoreLegacyImportedRunDuplicateReconciliationOptions,
  ) {}

  async inspect(
    ownerIdValue: string,
  ): Promise<LegacyImportedRunDuplicateInspection> {
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
    readonly confirmation: string
    readonly ownerId: string
  }): Promise<LegacyImportedRunDuplicateReconciliationResult> {
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
        throw new Error(
          'The selected owner does not have approved beta membership.',
        )
      }
      const plan = buildPlan({
        imports: imports.docs,
        ownerId,
        projectId: this.options.projectId,
        runs: runs.docs,
      })
      const inspection = inspectionFromPlan(plan)
      if (inspection.blockedClusterCount > 0) {
        throw new Error(
          'Legacy duplicate reconciliation found a blocked cluster and made no changes.',
        )
      }
      if (plan.eligiblePairs.length === 0) {
        return { status: 'already_reconciled', reconciledPairCount: 0 }
      }
      if (options.confirmation !== plan.confirmation) {
        throw new Error(
          'Legacy duplicate reconciliation requires the exact current dry-run confirmation.',
        )
      }

      for (const pair of plan.eligiblePairs) {
        transaction.delete(pair.legacyRun.reference)
      }
      return {
        status: 'reconciled',
        reconciledPairCount: plan.eligiblePairs.length,
      }
    })
  }
}
