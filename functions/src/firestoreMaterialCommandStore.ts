import type { Firestore } from 'firebase-admin/firestore'

import {
  isMaterialCommandResult,
  materialCommandSignature,
  type MaterialCommandCommittedResult,
  type MaterialCommandEnvelope,
} from '../../src/domain/materialCommands/contract.js'
import type { MaterialCommandStore } from './materialCommandHandler.js'

const receiptSchemaVersion = 1
const proofSchemaVersion = 1

function receiptPath(ownerId: string, commandId: string) {
  return `materialCommandReceipts/${ownerId}/commands/${commandId}`
}

function proofPath(ownerId: string) {
  return `materialCommandProofs/${ownerId}`
}

function storedCommittedResult(data: unknown): MaterialCommandCommittedResult {
  if (!isMaterialCommandResult(data) || data.status !== 'committed') {
    throw new Error('A stored material-command receipt is invalid.')
  }
  return data
}

export class FirestoreMaterialCommandStore implements MaterialCommandStore {
  constructor(private readonly database: Firestore) {}

  async commitProof(options: {
    envelope: MaterialCommandEnvelope
    ownerId: string
  }) {
    const receiptReference = this.database.doc(
      receiptPath(options.ownerId, options.envelope.commandId),
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
          result: storedCommittedResult(receipt.result),
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
        schemaVersion: receiptSchemaVersion,
        signature,
        result,
        createdAt: committedAt,
      })

      return { kind: 'committed' as const, result }
    })
  }

  async resolve(options: { commandId: string; ownerId: string }) {
    const snapshot = await this.database
      .doc(receiptPath(options.ownerId, options.commandId))
      .get()
    if (!snapshot.exists) return null
    return storedCommittedResult(snapshot.data()?.result)
  }
}
