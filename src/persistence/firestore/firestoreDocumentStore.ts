import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  setDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import type { DocumentStore, StoredDocument } from "../documentStore";

export class FirestoreDocumentStore implements DocumentStore {
  constructor(private readonly database: Firestore) {}

  createId(collectionPath: string): string {
    return doc(collection(this.database, collectionPath)).id;
  }

  async get(documentPath: string): Promise<StoredDocument | null> {
    const snapshot = await getDoc(doc(this.database, documentPath));

    return snapshot.exists()
      ? { id: snapshot.id, data: snapshot.data() as DocumentData }
      : null;
  }

  async getCachedOrServer(
    documentPath: string,
  ): Promise<StoredDocument | null> {
    const reference = doc(this.database, documentPath);

    try {
      const snapshot = await getDocFromCache(reference);

      return snapshot.exists()
        ? { id: snapshot.id, data: snapshot.data() as DocumentData }
        : null;
    } catch {
      return this.get(documentPath);
    }
  }

  async list(collectionPath: string): Promise<StoredDocument[]> {
    const snapshot = await getDocs(collection(this.database, collectionPath));

    return snapshot.docs.map((document) => ({
      id: document.id,
      data: document.data() as DocumentData,
    }));
  }

  async set(documentPath: string, data: Record<string, unknown>): Promise<void> {
    await setDoc(doc(this.database, documentPath), data);
  }

  async delete(documentPath: string): Promise<void> {
    await deleteDoc(doc(this.database, documentPath));
  }

  async deleteMany(documentPaths: readonly string[]): Promise<void> {
    const batch = writeBatch(this.database);

    documentPaths.forEach((documentPath) => {
      batch.delete(doc(this.database, documentPath));
    });

    await batch.commit();
  }
}
