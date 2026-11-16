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
const ORPHAN_NORMALIZATION_CONFIRMATION_PREFIX =
  'NORMALIZE-ORPHAN-ACTIVITY-IMPORT'
const MISSING_RUN_CLUSTER_SUPPRESSION_CONFIRMATION_PREFIX =
  'SUPPRESS-MISSING-RUN-IMPORT-CLUSTER'

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

type OrphanNormalizationBlockedReason =
  | 'conflicting_heart_rate'
  | 'duplicate_has_runner_fields'
  | 'import_run_mismatch'
  | 'invalid_cluster_shape'
  | 'multiple_candidate_clusters'

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

interface EligibleOrphanNormalization {
  readonly canonical: ActiveImport
  readonly canonicalRun: CompletedRun
  readonly canonicalRunUpdateTimeMilliseconds: number
  readonly noHeartRateCopy: ActiveImport
  readonly noHeartRateRun: CompletedRun
  readonly noHeartRateRunUpdateTimeMilliseconds: number
  readonly orphan: ActiveImport
}

interface OrphanNormalizationPlan {
  readonly blockedReasonCounts: Readonly<
    Record<OrphanNormalizationBlockedReason, number>
  >
  readonly candidateClusterCount: number
  readonly confirmation: string | null
  readonly eligibleNormalization: EligibleOrphanNormalization | null
}

interface MissingRunImportAuditPlan {
  readonly activeMissingRunCount: number
  readonly confirmation: string | null
  readonly distinctMissingRunReferenceCount: number
  readonly eligibleCluster: EligibleMissingRunClusterSuppression | null
  readonly providerReplayRecreationRiskCount: number
  readonly relatedExistingRunReferenceCount: number
  readonly relatedMissingRunReferenceCount: number
  readonly relatedImportStateCounts: Readonly<
    Record<'active' | 'deleted' | 'review_required' | 'user_deleted' | 'unknown', number>
  >
  readonly relatedMissingRunCount: number
  readonly unrelatedSingletonCount: number
}

interface EligibleMissingRunClusterSuppression {
  readonly activityImports: readonly ActiveImportReference[]
}

interface ActiveImportReference {
  readonly id: string
  readonly reference: QueryDocumentSnapshot<DocumentData>['ref']
  readonly updateTimeMilliseconds: number
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

export interface ActivityImportOrphanNormalizationInspection {
  readonly blockedClusterCount: number
  readonly blockedReasonCounts: Readonly<
    Record<OrphanNormalizationBlockedReason, number>
  >
  readonly candidateClusterCount: number
  readonly confirmation: string | null
  readonly eligibleClusterCount: number
}

export type ActivityImportOrphanNormalizationResult =
  | {
      readonly normalizedImportCount: 0
      readonly status: 'already_normalized'
    }
  | {
      readonly normalizedImportCount: 1
      readonly status: 'normalized'
    }

export interface ActivityImportMissingRunInspection {
  readonly activeMissingRunCount: number
  readonly confirmation: string | null
  readonly distinctMissingRunReferenceCount: number
  readonly eligibleClusterCount: number
  readonly providerReplayRecreationRiskCount: number
  readonly relatedExistingRunReferenceCount: number
  readonly relatedMissingRunReferenceCount: number
  readonly relatedImportStateCounts: Readonly<
    Record<'active' | 'deleted' | 'review_required' | 'user_deleted' | 'unknown', number>
  >
  readonly relatedMissingRunCount: number
  readonly unrelatedSingletonCount: number
}

export type ActivityImportMissingRunSuppressionResult =
  | {
      readonly status: 'no_active_missing_run'
      readonly suppressedImportCount: 0
    }
  | {
      readonly status: 'suppressed'
      readonly suppressedImportCount: 3
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

function emptyOrphanNormalizationBlockedCounts(): Record<
  OrphanNormalizationBlockedReason,
  number
> {
  return {
    conflicting_heart_rate: 0,
    duplicate_has_runner_fields: 0,
    import_run_mismatch: 0,
    invalid_cluster_shape: 0,
    multiple_candidate_clusters: 0,
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

function runHasHeartRate(run: CompletedRun) {
  return (
    run.averageHeartRateBpm !== undefined ||
    run.maximumHeartRateBpm !== undefined
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

function orphanNormalizationConfirmationFor(
  projectId: string,
  ownerId: UserId,
  normalization: EligibleOrphanNormalization | null,
) {
  if (normalization === null) return null
  const evidence = [
    normalization.canonical.id,
    normalization.canonical.updateTimeMilliseconds,
    normalization.canonicalRun.id,
    normalization.canonicalRunUpdateTimeMilliseconds,
    normalization.noHeartRateCopy.id,
    normalization.noHeartRateCopy.updateTimeMilliseconds,
    normalization.noHeartRateRun.id,
    normalization.noHeartRateRunUpdateTimeMilliseconds,
    normalization.orphan.id,
    normalization.orphan.updateTimeMilliseconds,
  ].join(':')
  const digest = createHash('sha256')
    .update(`${projectId}\n${ownerId}\n${evidence}`)
    .digest('hex')
    .slice(0, 24)
  return `${ORPHAN_NORMALIZATION_CONFIRMATION_PREFIX}:${digest}`
}

function missingRunClusterSuppressionConfirmationFor(
  projectId: string,
  ownerId: UserId,
  cluster: EligibleMissingRunClusterSuppression | null,
) {
  if (cluster === null) return null
  const evidence = [...cluster.activityImports]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(
      ({ id, updateTimeMilliseconds }) =>
        `${id}:${updateTimeMilliseconds}`,
    )
    .join('\n')
  const digest = createHash('sha256')
    .update(`${projectId}\n${ownerId}\n${evidence}`)
    .digest('hex')
    .slice(0, 24)
  return `${MISSING_RUN_CLUSTER_SUPPRESSION_CONFIRMATION_PREFIX}:${digest}`
}

function buildMissingRunImportAuditPlan(options: {
  imports: readonly QueryDocumentSnapshot<DocumentData>[]
  ownerId: UserId
  projectId: string
  runs: readonly QueryDocumentSnapshot<DocumentData>[]
}): MissingRunImportAuditPlan {
  const activeImports = options.imports
    .map((snapshot) => activeImportFromSnapshot(snapshot, options.ownerId))
    .filter((record): record is ActiveImport => record !== null)
  const runIds = new Set(options.runs.map(({ id }) => id))
  const fingerprintCounts = new Map<string, number>()
  for (const snapshot of options.imports) {
    const fingerprint = snapshot.data().crossProviderFingerprint
    if (typeof fingerprint !== 'string') continue
    fingerprintCounts.set(
      fingerprint,
      (fingerprintCounts.get(fingerprint) ?? 0) + 1,
    )
  }
  const activeMissingRunImports = activeImports.filter(
    ({ completedRunId }) => !runIds.has(completedRunId),
  )
  const activeMissingRunIds = new Set(
    activeMissingRunImports.map(({ id }) => id),
  )
  const missingRunReferences = new Set(
    activeMissingRunImports.map(({ completedRunId }) => completedRunId),
  )
  const missingFingerprints = new Set<string>(
    activeMissingRunImports.map(({ event }) =>
      createCrossProviderDuplicateFingerprint(event),
    ),
  )
  const relatedImportStateCounts = {
    active: 0,
    deleted: 0,
    review_required: 0,
    user_deleted: 0,
    unknown: 0,
  }
  let relatedExistingRunReferenceCount = 0
  let relatedMissingRunReferenceCount = 0
  const distinctMissingRunReferences = new Set(missingRunReferences)
  const relatedImportSnapshots: QueryDocumentSnapshot<DocumentData>[] = []
  for (const snapshot of options.imports) {
    if (activeMissingRunIds.has(snapshot.id)) continue
    const data = snapshot.data()
    if (
      typeof data.crossProviderFingerprint !== 'string' ||
      !missingFingerprints.has(data.crossProviderFingerprint)
    ) {
      continue
    }
    relatedImportSnapshots.push(snapshot)
    const state = data.state
    if (
      state === 'active' ||
      state === 'deleted' ||
      state === 'review_required' ||
      state === 'user_deleted'
    ) {
      const relatedState:
        | 'active'
        | 'deleted'
        | 'review_required'
        | 'user_deleted' = state
      relatedImportStateCounts[relatedState] += 1
    } else {
      relatedImportStateCounts.unknown += 1
    }
    const referencedRunIds = [
      data.completedRunId,
      data.candidateCompletedRunId,
    ].filter((value): value is string => typeof value === 'string')
    if (referencedRunIds.some((runId) => runIds.has(runId))) {
      relatedExistingRunReferenceCount += 1
    }
    const relatedMissingReferences = referencedRunIds.filter(
      (runId) => !runIds.has(runId),
    )
    if (
      relatedMissingReferences.some((runId) =>
        missingRunReferences.has(createCompletedRunId(runId)),
      )
    ) {
      relatedMissingRunReferenceCount += 1
    }
    for (const runId of relatedMissingReferences) {
      distinctMissingRunReferences.add(createCompletedRunId(runId))
    }
  }
  const unrelatedSingletons = activeMissingRunImports.filter(
    ({ event }) =>
      fingerprintCounts.get(createCrossProviderDuplicateFingerprint(event)) ===
      1,
  )
  const relatedMissingRunCount =
    activeMissingRunImports.length - unrelatedSingletons.length
  const activeMissingRun = activeMissingRunImports[0]
  const eligibleRelatedImports =
    activeMissingRunImports.length === 1 &&
    activeMissingRun !== undefined &&
    relatedImportSnapshots.length === 2
      ? relatedImportSnapshots
          .map((snapshot): ActiveImportReference | null => {
            const data = snapshot.data()
            const parsedEvent = parseCompletedActivityImportEvent(data.event)
            if (
              data.userId !== options.ownerId ||
              data.state !== 'review_required' ||
              data.completedRunId !== null ||
              data.candidateCompletedRunId !== activeMissingRun.completedRunId ||
              (data.candidateKind !== 'duplicate_candidate' &&
                data.candidateKind !== 'ambiguous_candidate') ||
              !parsedEvent.ok ||
              parsedEvent.value.operation !== 'upsert' ||
              parsedEvent.value.ownerId !== options.ownerId ||
              data.crossProviderFingerprint !==
                createCrossProviderDuplicateFingerprint(parsedEvent.value) ||
              data.startedAtEpochMilliseconds !==
                Date.parse(parsedEvent.value.startedAt)
            ) {
              return null
            }
            return {
              id: snapshot.id,
              reference: snapshot.ref,
              updateTimeMilliseconds: snapshot.updateTime.toMillis(),
            }
          })
          .filter((record): record is ActiveImportReference => record !== null)
      : []
  const eligibleCluster =
    activeMissingRun !== undefined &&
    activeMissingRunImports.length === 1 &&
    unrelatedSingletons.length === 0 &&
    relatedImportSnapshots.length === 2 &&
    eligibleRelatedImports.length === 2 &&
    relatedExistingRunReferenceCount === 0 &&
    relatedMissingRunReferenceCount === 2 &&
    distinctMissingRunReferences.size === 1
      ? {
          activityImports: [
            {
              id: activeMissingRun.id,
              reference: activeMissingRun.reference,
              updateTimeMilliseconds: activeMissingRun.updateTimeMilliseconds,
            },
            ...eligibleRelatedImports,
          ],
        }
      : null
  const confirmation = missingRunClusterSuppressionConfirmationFor(
    options.projectId,
    options.ownerId,
    eligibleCluster,
  )
  return {
    activeMissingRunCount: activeMissingRunImports.length,
    confirmation,
    distinctMissingRunReferenceCount: distinctMissingRunReferences.size,
    eligibleCluster,
    providerReplayRecreationRiskCount: activeMissingRunImports.length,
    relatedExistingRunReferenceCount,
    relatedMissingRunReferenceCount,
    relatedImportStateCounts,
    relatedMissingRunCount,
    unrelatedSingletonCount: unrelatedSingletons.length,
  }
}

function buildOrphanNormalizationPlan(options: {
  imports: readonly QueryDocumentSnapshot<DocumentData>[]
  ownerId: UserId
  projectId: string
  runs: readonly QueryDocumentSnapshot<DocumentData>[]
}): OrphanNormalizationPlan {
  const imports = options.imports
    .map((snapshot) => activeImportFromSnapshot(snapshot, options.ownerId))
    .filter((record): record is ActiveImport => record !== null)
    .filter(({ event }) => event.reportedOrigin === 'garmin')
  const runSnapshots = new Map(options.runs.map((run) => [run.id, run]))
  const importsByFingerprint = new Map<string, ActiveImport[]>()
  for (const activityImport of imports) {
    const fingerprint = createCrossProviderDuplicateFingerprint(
      activityImport.event,
    )
    const group = importsByFingerprint.get(fingerprint) ?? []
    group.push(activityImport)
    importsByFingerprint.set(fingerprint, group)
  }
  const candidateClusters = [...importsByFingerprint.values()].filter(
    (group) =>
      group.length > 1 &&
      group.some(
        (activityImport) =>
          !runSnapshots.has(activityImport.completedRunId),
      ),
  )
  const blockedReasonCounts = emptyOrphanNormalizationBlockedCounts()
  if (candidateClusters.length > 1) {
    blockedReasonCounts.multiple_candidate_clusters = candidateClusters.length
    return {
      blockedReasonCounts,
      candidateClusterCount: candidateClusters.length,
      confirmation: null,
      eligibleNormalization: null,
    }
  }
  const cluster = candidateClusters[0]
  if (cluster === undefined) {
    return {
      blockedReasonCounts,
      candidateClusterCount: 0,
      confirmation: null,
      eligibleNormalization: null,
    }
  }
  const missingRunImports = cluster.filter(
    (activityImport) => !runSnapshots.has(activityImport.completedRunId),
  )
  const orphan = missingRunImports[0]
  if (
    cluster.length !== 3 ||
    cluster.some(({ event }) => event.provider !== 'apple_health') ||
    new Set(
      cluster.map(({ event }) => createProviderActivityIdentityKey(event)),
    ).size !== 3 ||
    missingRunImports.length !== 1 ||
    orphan === undefined ||
    eventHasHeartRate(orphan.event)
  ) {
    blockedReasonCounts.invalid_cluster_shape = 1
    return {
      blockedReasonCounts,
      candidateClusterCount: 1,
      confirmation: null,
      eligibleNormalization: null,
    }
  }

  const presentImports = cluster.filter(
    (activityImport) => runSnapshots.has(activityImport.completedRunId),
  )
  if (
    presentImports.length !== 2 ||
    new Set(presentImports.map(({ completedRunId }) => completedRunId)).size !==
      2
  ) {
    blockedReasonCounts.invalid_cluster_shape = 1
    return {
      blockedReasonCounts,
      candidateClusterCount: 1,
      confirmation: null,
      eligibleNormalization: null,
    }
  }
  const presentRecords = presentImports.map((activityImport) => {
    const runSnapshot = runSnapshots.get(activityImport.completedRunId)
    if (runSnapshot === undefined) {
      throw new Error('An orphan-normalization run disappeared while planning.')
    }
    return {
      activityImport,
      run: completedRunFromAdminDocument(runSnapshot.id, runSnapshot.data()),
      runSnapshot,
    }
  })
  if (
    presentRecords.some(
      ({ activityImport, run }) =>
        run === null || !runMatchesEvent(run, activityImport.event),
    )
  ) {
    blockedReasonCounts.import_run_mismatch = 1
    return {
      blockedReasonCounts,
      candidateClusterCount: 1,
      confirmation: null,
      eligibleNormalization: null,
    }
  }
  const validPresentRecords = presentRecords.flatMap(
    ({ activityImport, run, runSnapshot }) =>
      run === null ? [] : [{ activityImport, run, runSnapshot }],
  )
  if (
    validPresentRecords.some(
      ({ activityImport, run }) =>
        !heartRateMatchesEvent(run, activityImport.event),
    )
  ) {
    blockedReasonCounts.conflicting_heart_rate = 1
    return {
      blockedReasonCounts,
      candidateClusterCount: 1,
      confirmation: null,
      eligibleNormalization: null,
    }
  }
  const heartRateRecords = validPresentRecords.filter(
    ({ activityImport, run }) =>
      eventHasHeartRate(activityImport.event) &&
      runHasHeartRate(run),
  )
  const noHeartRateRecords = validPresentRecords.filter(
    ({ activityImport, run }) =>
      !eventHasHeartRate(activityImport.event) &&
      !runHasHeartRate(run),
  )
  if (heartRateRecords.length !== 1 || noHeartRateRecords.length !== 1) {
    blockedReasonCounts.conflicting_heart_rate = 1
    return {
      blockedReasonCounts,
      candidateClusterCount: 1,
      confirmation: null,
      eligibleNormalization: null,
    }
  }
  const canonicalRecord = heartRateRecords[0]
  const noHeartRateRecord = noHeartRateRecords[0]
  if (
    canonicalRecord === undefined ||
    noHeartRateRecord === undefined ||
    hasRunnerOwnedFields(noHeartRateRecord.run)
  ) {
    blockedReasonCounts.duplicate_has_runner_fields = 1
    return {
      blockedReasonCounts,
      candidateClusterCount: 1,
      confirmation: null,
      eligibleNormalization: null,
    }
  }
  const eligibleNormalization: EligibleOrphanNormalization = {
    canonical: canonicalRecord.activityImport,
    canonicalRun: canonicalRecord.run,
    canonicalRunUpdateTimeMilliseconds:
      canonicalRecord.runSnapshot.updateTime.toMillis(),
    noHeartRateCopy: noHeartRateRecord.activityImport,
    noHeartRateRun: noHeartRateRecord.run,
    noHeartRateRunUpdateTimeMilliseconds:
      noHeartRateRecord.runSnapshot.updateTime.toMillis(),
    orphan,
  }
  return {
    blockedReasonCounts,
    candidateClusterCount: 1,
    confirmation: orphanNormalizationConfirmationFor(
      options.projectId,
      options.ownerId,
      eligibleNormalization,
    ),
    eligibleNormalization,
  }
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

function orphanNormalizationInspectionFromPlan(
  plan: OrphanNormalizationPlan,
): ActivityImportOrphanNormalizationInspection {
  return {
    blockedClusterCount: Object.values(plan.blockedReasonCounts).reduce(
      (total, count) => total + count,
      0,
    ),
    blockedReasonCounts: plan.blockedReasonCounts,
    candidateClusterCount: plan.candidateClusterCount,
    confirmation: plan.confirmation,
    eligibleClusterCount: plan.eligibleNormalization === null ? 0 : 1,
  }
}

function missingRunInspectionFromPlan(
  plan: MissingRunImportAuditPlan,
): ActivityImportMissingRunInspection {
  return {
    activeMissingRunCount: plan.activeMissingRunCount,
    confirmation: plan.confirmation,
    distinctMissingRunReferenceCount: plan.distinctMissingRunReferenceCount,
    eligibleClusterCount: plan.eligibleCluster === null ? 0 : 1,
    providerReplayRecreationRiskCount:
      plan.providerReplayRecreationRiskCount,
    relatedExistingRunReferenceCount: plan.relatedExistingRunReferenceCount,
    relatedMissingRunReferenceCount: plan.relatedMissingRunReferenceCount,
    relatedImportStateCounts: plan.relatedImportStateCounts,
    relatedMissingRunCount: plan.relatedMissingRunCount,
    unrelatedSingletonCount: plan.unrelatedSingletonCount,
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

  async inspectOrphanImportNormalization(
    ownerIdValue: string,
  ): Promise<ActivityImportOrphanNormalizationInspection> {
    const ownerId = createUserId(ownerIdValue)
    const [membership, imports, runs] = await Promise.all([
      this.database.doc(approvedBetaMembershipPath(ownerId)).get(),
      this.database.collection(activityImportsCollectionPath(ownerId)).get(),
      this.database.collection(runsCollectionPath(ownerId)).get(),
    ])
    if (!isApprovedBetaMembership(membership.data(), ownerId)) {
      throw new Error('The selected owner does not have approved beta membership.')
    }
    return orphanNormalizationInspectionFromPlan(
      buildOrphanNormalizationPlan({
        imports: imports.docs,
        ownerId,
        projectId: this.options.projectId,
        runs: runs.docs,
      }),
    )
  }

  async inspectMissingRunImportRelationships(
    ownerIdValue: string,
  ): Promise<ActivityImportMissingRunInspection> {
    const ownerId = createUserId(ownerIdValue)
    const [membership, imports, runs] = await Promise.all([
      this.database.doc(approvedBetaMembershipPath(ownerId)).get(),
      this.database.collection(activityImportsCollectionPath(ownerId)).get(),
      this.database.collection(runsCollectionPath(ownerId)).get(),
    ])
    if (!isApprovedBetaMembership(membership.data(), ownerId)) {
      throw new Error('The selected owner does not have approved beta membership.')
    }
    return missingRunInspectionFromPlan(
      buildMissingRunImportAuditPlan({
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

  async normalizeOrphanImport(options: {
    confirmation: string
    ownerId: string
  }): Promise<ActivityImportOrphanNormalizationResult> {
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
      const plan = buildOrphanNormalizationPlan({
        imports: imports.docs,
        ownerId,
        projectId: this.options.projectId,
        runs: runs.docs,
      })
      const inspection = orphanNormalizationInspectionFromPlan(plan)
      if (inspection.blockedClusterCount > 0) {
        throw new Error(
          'Orphan import normalization found a blocked candidate and made no changes.',
        )
      }
      if (plan.eligibleNormalization === null) {
        return { status: 'already_normalized', normalizedImportCount: 0 }
      }
      if (options.confirmation !== plan.confirmation) {
        throw new Error(
          'Orphan import normalization requires the exact current dry-run confirmation.',
        )
      }

      transaction.update(plan.eligibleNormalization.orphan.reference, {
        candidateCompletedRunId: plan.eligibleNormalization.canonicalRun.id,
        candidateKind: 'duplicate_candidate',
        completedRunId: null,
        state: 'review_required',
        updatedAt: this.now().toISOString(),
      })
      return { status: 'normalized', normalizedImportCount: 1 }
    })
  }

  async suppressMissingRunImportCluster(options: {
    confirmation: string
    ownerId: string
  }): Promise<ActivityImportMissingRunSuppressionResult> {
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
      const plan = buildMissingRunImportAuditPlan({
        imports: imports.docs,
        ownerId,
        projectId: this.options.projectId,
        runs: runs.docs,
      })
      if (plan.activeMissingRunCount === 0) {
        return { status: 'no_active_missing_run', suppressedImportCount: 0 }
      }
      if (plan.eligibleCluster === null || plan.confirmation === null) {
        throw new Error(
          'Missing-run suppression requires one exact eligible three-record cluster.',
        )
      }
      if (options.confirmation !== plan.confirmation) {
        throw new Error(
          'Missing-run suppression requires the exact current dry-run confirmation.',
        )
      }
      for (const activityImport of plan.eligibleCluster.activityImports) {
        transaction.update(activityImport.reference, {
          candidateCompletedRunId: null,
          candidateKind: null,
          completedRunId: null,
          state: 'user_deleted',
          updatedAt: this.now().toISOString(),
        })
      }
      return { status: 'suppressed', suppressedImportCount: 3 }
    })
  }

}
