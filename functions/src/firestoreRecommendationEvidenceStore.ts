import { isDeepStrictEqual } from 'node:util'

import type { DocumentData, Firestore } from 'firebase-admin/firestore'

import {
  createRecommendationId,
  validateRecommendationEvidence,
  type RecommendationEvidenceV1,
  type RecommendationId,
} from '../../src/domain/recommendations/recommendationEvidence.js'
import { createUserId } from '../../src/domain/training/identifiers.js'

export type RecommendationEvidenceStoreErrorCode =
  | 'invalid-evidence'
  | 'invalid-transition'
  | 'evidence-conflict'
  | 'evidence-not-found'
  | 'stored-evidence-invalid'

export class RecommendationEvidenceStoreError extends Error {
  constructor(readonly code: RecommendationEvidenceStoreErrorCode) {
    super(`Recommendation evidence persistence failed: ${code}.`)
  }
}

export function recommendationEvidencePath(
  ownerId: string,
  recommendationId: string,
): string {
  return `users/${createUserId(ownerId)}/recommendationEvidence/${createRecommendationId(recommendationId)}`
}

function parseStoredEvidence(
  data: DocumentData | undefined,
): RecommendationEvidenceV1 {
  if (data === undefined) {
    throw new RecommendationEvidenceStoreError('evidence-not-found')
  }
  if (validateRecommendationEvidence(data).length > 0) {
    throw new RecommendationEvidenceStoreError('stored-evidence-invalid')
  }
  return data as RecommendationEvidenceV1
}

function assertValidEvidence(value: unknown): asserts value is RecommendationEvidenceV1 {
  if (validateRecommendationEvidence(value).length > 0) {
    throw new RecommendationEvidenceStoreError('invalid-evidence')
  }
}

function immutableEvidenceFields(evidence: RecommendationEvidenceV1) {
  return {
    schemaVersion: evidence.schemaVersion,
    recommendationId: evidence.recommendationId,
    evaluatedPlanId: evidence.evaluatedPlanId,
    evaluationInput: evidence.evaluationInput,
    evaluationResult: evidence.evaluationResult,
    recommendedAt: evidence.recommendedAt,
  }
}

export class FirestoreRecommendationEvidenceStore {
  constructor(private readonly database: Firestore) {}

  async createPending(options: {
    evidence: RecommendationEvidenceV1
    ownerId: string
  }): Promise<RecommendationEvidenceV1> {
    assertValidEvidence(options.evidence)
    if (options.evidence.decision !== 'pending') {
      throw new RecommendationEvidenceStoreError('invalid-transition')
    }

    const reference = this.database.doc(
      recommendationEvidencePath(
        options.ownerId,
        options.evidence.recommendationId,
      ),
    )
    return this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      if (snapshot.exists) {
        const stored = parseStoredEvidence(snapshot.data())
        if (isDeepStrictEqual(stored, options.evidence)) return stored
        throw new RecommendationEvidenceStoreError('evidence-conflict')
      }

      transaction.create(reference, options.evidence)
      return options.evidence
    })
  }

  async recordDecision(options: {
    evidence: RecommendationEvidenceV1
    ownerId: string
  }): Promise<RecommendationEvidenceV1> {
    assertValidEvidence(options.evidence)
    if (options.evidence.decision === 'pending') {
      throw new RecommendationEvidenceStoreError('invalid-transition')
    }

    const reference = this.database.doc(
      recommendationEvidencePath(
        options.ownerId,
        options.evidence.recommendationId,
      ),
    )
    return this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      const stored = parseStoredEvidence(snapshot.data())
      if (stored.decision !== 'pending') {
        if (isDeepStrictEqual(stored, options.evidence)) return stored
        throw new RecommendationEvidenceStoreError('evidence-conflict')
      }
      if (
        !isDeepStrictEqual(
          immutableEvidenceFields(stored),
          immutableEvidenceFields(options.evidence),
        )
      ) {
        throw new RecommendationEvidenceStoreError('evidence-conflict')
      }

      transaction.set(reference, options.evidence)
      return options.evidence
    })
  }

  async read(options: {
    ownerId: string
    recommendationId: RecommendationId
  }): Promise<RecommendationEvidenceV1> {
    const snapshot = await this.database
      .doc(
        recommendationEvidencePath(
          options.ownerId,
          options.recommendationId,
        ),
      )
      .get()
    return parseStoredEvidence(snapshot.data())
  }
}
