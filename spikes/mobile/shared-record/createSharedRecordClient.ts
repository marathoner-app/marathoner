import {
  createSharedRecordProof,
  parseSharedRecordProof,
  sharedRecordProofDocumentPath,
  type SharedRecordProof,
  type SharedRecordProofSource,
} from '@marathoner/training-contract'
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore'

export interface SharedRecordClient {
  read(userId: string): Promise<SharedRecordProof | null>
  write(
    userId: string,
    sourceClient: SharedRecordProofSource,
  ): Promise<SharedRecordProof>
  delete(userId: string): Promise<void>
}

export function createSharedRecordClient(
  database: Firestore,
): SharedRecordClient {
  return {
    async read(userId) {
      const snapshot = await getDoc(
        doc(database, sharedRecordProofDocumentPath(userId)),
      )

      return snapshot.exists()
        ? parseSharedRecordProof(snapshot.data())
        : null
    },

    async write(userId, sourceClient) {
      const record = createSharedRecordProof(userId, sourceClient)

      await setDoc(
        doc(database, sharedRecordProofDocumentPath(userId)),
        record,
      )

      return record
    },

    async delete(userId) {
      await deleteDoc(
        doc(database, sharedRecordProofDocumentPath(userId)),
      )
    },
  }
}
