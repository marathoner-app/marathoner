import type { Firestore } from 'firebase-admin/firestore'

import {
  isMaterialCommandResult,
  materialCommandSignature,
  type AccountDeletionRequestAcceptedResult,
  type MaterialCommandCommittedResult,
  type PlanApprovalReceiptResult,
  type ProofMaterialCommandEnvelope,
  type RunCompletionReceiptResult,
} from '../../src/domain/materialCommands/contract.js'
import type { MaterialCommandStore } from './materialCommandHandler.js'

export const MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION = 1
const proofSchemaVersion = 1

export function materialCommandReceiptPath(ownerId: string, commandId: string) {
  return `materialCommandReceipts/${ownerId}/commands/${commandId}`
}

function proofPath(ownerId: string) {
  return `materialCommandProofs/${ownerId}`
}

export function storedMaterialCommandResult(
  data: unknown,
):
  | MaterialCommandCommittedResult
  | AccountDeletionRequestAcceptedResult
  | PlanApprovalReceiptResult
  | RunCompletionReceiptResult {
  if (
    !isMaterialCommandResult(data) ||
    (data.status !== 'committed' &&
      data.status !== 'accepted' &&
      data.status !== 'plan_approved' &&
      data.status !== 'run_completed')
  ) {
    throw new Error('A stored material-command receipt is invalid.')
  }
  return data
}

function storedProofResult(data: unknown): MaterialCommandCommittedResult {
  const result = storedMaterialCommandResult(data)
  if (result.status !== 'committed') {
    throw new Error('A stored proof-command receipt is invalid.')
  }
  return result
}

export class FirestoreMaterialCommandStore implements MaterialCommandStore {
  constructor(private readonly database: Firestore) {}

  async commitProof(options: {
    envelope: ProofMaterialCommandEnvelope
    ownerId: string
  }) {
    const receiptReference = this.database.doc(
      materialCommandReceiptPath(options.ownerId, options.envelope.commandId),
    )
    const proofReference = this.database.doc(proofPath(options.ownerId))
    const signature = materialCommandSignature(options.envelope)

    return this.database.runTransaction(async (transaction) => {
      const [receiptSnapshot, proofSnapshot] = await Promise.all([
        transaction.get(receiptReference),
        transaction.get(proofReference),
      ])

      if (receiptSnapshot.exists) {
        const receipt = receiptSnapshot.data()
        if (!receipt) {
          throw new Error('A stored material-command receipt is invalid.')
        }
        if (receipt.signature !== signature) return { kind: 'conflict' as const }
        return {
          kind: 'committed' as const,
          result: storedProofResult(receipt.result),
        }
      }

      const proof = proofSnapshot.data()
      const priorProofCount = proofSnapshot.exists && proof ? proof.proofCount : 0
      if (!Number.isInteger(priorProofCount) || Number(priorProofCount) < 0) {
        throw new Error('The material-command proof record is invalid.')
      }

      const committedAt = new Date().toISOString()
      const result: MaterialCommandCommittedResult = {
        status: 'committed',
        commandId: options.envelope.commandId,
        committedAt,
        proofCount: Number(priorProofCount) + 1,
      }

      transaction.set(proofReference, {
        schemaVersion: proofSchemaVersion,
        proofCount: result.proofCount,
        updatedAt: committedAt,
      })
      transaction.create(receiptReference, {
        schemaVersion: MATERIAL_COMMAND_RECEIPT_SCHEMA_VERSION,
        signature,
        result,
        createdAt: committedAt,
      })

      return { kind: 'committed' as const, result }
    })
  }

  async resolve(options: { commandId: string; ownerId: string }) {
    const snapshot = await this.database
      .doc(materialCommandReceiptPath(options.ownerId, options.commandId))
      .get()
    if (!snapshot.exists) return null
    return storedMaterialCommandResult(snapshot.data()?.result)
  }
}
