import {
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore'

import {
  createGuidanceArtifactVersion,
  createGuidanceItemId,
  createGuidanceTriggerCode,
  evaluateGuidancePresentation,
  type GuidanceDisableRuleV1,
  type GuidancePresentationRecordV1,
} from '../../src/domain/guidance/guidance.js'
import { createUtcDateTime } from '../../src/domain/training/dates.js'
import type { ClosedBetaGuidanceStore } from './closedBetaGuidanceHandler.js'

export const CLOSED_BETA_GUIDANCE_CONTROL_PATH =
  'operatorControls/closedBetaGuidance'
export const CLOSED_BETA_GUIDANCE_CONTROL_SCHEMA_VERSION =
  'closed-beta-guidance-control@1' as const
const historySchemaVersion = 'closed-beta-guidance-history@1' as const

interface ClosedBetaGuidanceControl {
  readonly enabled: boolean
  readonly artifactVersions: readonly string[]
  readonly disabledGuidanceIds: readonly string[]
}

function parseControl(data: DocumentData | undefined): ClosedBetaGuidanceControl | null {
  if (data === undefined) return null
  const keys = Object.keys(data).sort()
  if (
    keys.join('|') !==
      ['artifactVersions', 'disabledGuidanceIds', 'enabled', 'revision', 'schemaVersion', 'updatedAt'].sort().join('|') ||
    data.schemaVersion !== CLOSED_BETA_GUIDANCE_CONTROL_SCHEMA_VERSION ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1 ||
    typeof data.enabled !== 'boolean' ||
    !Array.isArray(data.artifactVersions) ||
    !data.artifactVersions.every((entry: unknown) => typeof entry === 'string') ||
    !Array.isArray(data.disabledGuidanceIds) ||
    !data.disabledGuidanceIds.every((entry: unknown) => typeof entry === 'string') ||
    !(data.updatedAt instanceof Timestamp)
  ) return null
  return {
    enabled: data.enabled,
    artifactVersions: data.artifactVersions as string[],
    disabledGuidanceIds: data.disabledGuidanceIds as string[],
  }
}

interface GuidanceHistoryDocument {
  readonly id: string
  readonly userId: string
  readonly guidanceId: string
  readonly artifactVersion: string
  readonly presentedAt: Timestamp
  readonly dismissedAt?: Timestamp
  readonly dismissible: boolean
}

function parseHistory(
  id: string,
  data: DocumentData | undefined,
  ownerId: string,
): GuidanceHistoryDocument | null {
  if (data === undefined) return null
  const keys = Object.keys(data).sort()
  const expected = [
    'artifactVersion',
    'dismissible',
    'guidanceId',
    'presentedAt',
    'schemaVersion',
    'userId',
    ...(data.dismissedAt === undefined ? [] : ['dismissedAt']),
  ].sort()
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    data.schemaVersion !== historySchemaVersion ||
    data.userId !== ownerId ||
    typeof data.guidanceId !== 'string' ||
    typeof data.artifactVersion !== 'string' ||
    !(data.presentedAt instanceof Timestamp) ||
    (data.dismissedAt !== undefined && !(data.dismissedAt instanceof Timestamp)) ||
    typeof data.dismissible !== 'boolean'
  ) return null
  return {
    id,
    userId: ownerId,
    guidanceId: data.guidanceId,
    artifactVersion: data.artifactVersion,
    presentedAt: data.presentedAt,
    ...(data.dismissedAt === undefined ? {} : { dismissedAt: data.dismissedAt }),
    dismissible: data.dismissible,
  }
}

function presentationRecord(
  document: GuidanceHistoryDocument,
): GuidancePresentationRecordV1 {
  return {
    guidanceId: createGuidanceItemId(document.guidanceId),
    contentVersion: createGuidanceArtifactVersion(document.artifactVersion),
    presentedAt: createUtcDateTime(document.presentedAt.toDate().toISOString()),
    ...(document.dismissedAt === undefined
      ? {}
      : {
          dismissedAt: createUtcDateTime(
            document.dismissedAt.toDate().toISOString(),
          ),
        }),
  }
}

export class FirestoreClosedBetaGuidanceStore implements ClosedBetaGuidanceStore {
  constructor(private readonly database: Firestore) {}

  async present(options: Parameters<ClosedBetaGuidanceStore['present']>[0]) {
    const historyCollection = this.database.collection(
      `users/${options.ownerId}/guidanceHistory`,
    )
    const newReference = historyCollection.doc()
    return this.database.runTransaction(async (transaction) => {
      const [controlSnapshot, historySnapshot] = await Promise.all([
        transaction.get(this.database.doc(CLOSED_BETA_GUIDANCE_CONTROL_PATH)),
        transaction.get(historyCollection),
      ])
      const control = parseControl(controlSnapshot.data())
      if (
        control === null ||
        !control.enabled ||
        !control.artifactVersions.includes(options.provisionalArtifactVersion)
      ) return { kind: 'disabled' as const }

      const parsedHistory = historySnapshot.docs.map((snapshot) =>
        parseHistory(snapshot.id, snapshot.data(), options.ownerId),
      )
      if (parsedHistory.some((entry) => entry === null)) {
        return { kind: 'disabled' as const }
      }
      const history = parsedHistory as GuidanceHistoryDocument[]
      const remoteDisableRules: GuidanceDisableRuleV1[] = control.disabledGuidanceIds.map(
        (guidanceId) => ({ guidanceId: createGuidanceItemId(guidanceId) }),
      )
      const now = createUtcDateTime(options.now)
      const activeTriggerCodes = options.activeTriggerCodes.map(createGuidanceTriggerCode)

      for (const item of options.candidates) {
        const baseDecision = evaluateGuidancePresentation(item, {
          now,
          activeTriggerCodes,
          presentationHistory: [],
          remoteDisableRules,
          provisionalArtifactVersion: createGuidanceArtifactVersion(
            options.provisionalArtifactVersion,
          ),
        })
        if (!baseDecision.eligible) continue

        const existing = history.find(
          (record) =>
            record.guidanceId === item.id &&
            record.artifactVersion === item.contentVersion &&
            record.dismissedAt === undefined,
        )
        if (existing !== undefined) {
          return { kind: 'available' as const, item, presentationId: existing.id }
        }

        const decision = evaluateGuidancePresentation(item, {
          now,
          activeTriggerCodes,
          presentationHistory: history.map(presentationRecord),
          remoteDisableRules,
          provisionalArtifactVersion: createGuidanceArtifactVersion(
            options.provisionalArtifactVersion,
          ),
        })
        if (!decision.eligible) continue
        transaction.create(newReference, {
          schemaVersion: historySchemaVersion,
          userId: options.ownerId,
          guidanceId: item.id,
          artifactVersion: item.contentVersion,
          presentedAt: Timestamp.fromDate(new Date(options.now)),
          dismissible: item.suppression.dismissesVersion,
        })
        return { kind: 'available' as const, item, presentationId: newReference.id }
      }
      return { kind: 'none' as const }
    })
  }

  async dismiss(options: Parameters<ClosedBetaGuidanceStore['dismiss']>[0]) {
    const reference = this.database.doc(
      `users/${options.ownerId}/guidanceHistory/${options.presentationId}`,
    )
    return this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      const history = parseHistory(snapshot.id, snapshot.data(), options.ownerId)
      if (history === null) return 'not_found' as const
      if (history.artifactVersion !== options.artifactVersion) {
        return 'version_mismatch' as const
      }
      if (!history.dismissible) return 'not_dismissible' as const
      if (history.dismissedAt === undefined) {
        transaction.update(reference, {
          dismissedAt: Timestamp.fromDate(new Date(options.now)),
        })
      }
      return 'dismissed' as const
    })
  }
}
