import {
  createSharedRecordProof,
  parseSharedRecordProof,
  sharedRecordProofDocumentPath,
  type SharedRecordProof,
} from '@marathoner/training-contract';
import type { FirebaseApp } from 'firebase/app';
import {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
} from 'firebase/firestore';

export interface ExpoSharedRecordClient {
  read(userId: string): Promise<SharedRecordProof | null>;
  write(userId: string): Promise<SharedRecordProof>;
  delete(userId: string): Promise<void>;
}

export function createExpoSharedRecordClient(
  firebaseApp: FirebaseApp,
): ExpoSharedRecordClient {
  const database = getFirestore(firebaseApp);

  return {
    async read(userId) {
      const snapshot = await getDoc(
        doc(database, sharedRecordProofDocumentPath(userId)),
      );

      return snapshot.exists()
        ? parseSharedRecordProof(snapshot.data())
        : null;
    },

    async write(userId) {
      const record = createSharedRecordProof(userId, 'expo');

      await setDoc(
        doc(database, sharedRecordProofDocumentPath(userId)),
        record,
      );

      return record;
    },

    async delete(userId) {
      await deleteDoc(
        doc(database, sharedRecordProofDocumentPath(userId)),
      );
    },
  };
}
