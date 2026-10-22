export interface StoredDocument {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

export interface DocumentStore {
  createId(collectionPath: string): string;
  get(documentPath: string): Promise<StoredDocument | null>;
  getCachedOrServer(documentPath: string): Promise<StoredDocument | null>;
  list(collectionPath: string): Promise<StoredDocument[]>;
  set(documentPath: string, data: Record<string, unknown>): Promise<void>;
  delete(documentPath: string): Promise<void>;
  deleteMany(documentPaths: readonly string[]): Promise<void>;
}
