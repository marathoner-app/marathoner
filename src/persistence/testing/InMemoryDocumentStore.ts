import type { DocumentStore, StoredDocument } from "../documentStore";

export class InMemoryDocumentStore implements DocumentStore {
  private nextId = 1;
  private readonly documents = new Map<string, Record<string, unknown>>();

  createId(): string {
    const id = `generated-${this.nextId}`;
    this.nextId += 1;
    return id;
  }

  async get(documentPath: string): Promise<StoredDocument | null> {
    const data = this.documents.get(documentPath);

    return data === undefined
      ? null
      : { id: documentPath.split("/").at(-1) ?? "", data };
  }

  async getCachedOrServer(documentPath: string): Promise<StoredDocument | null> {
    const data = this.documents.get(documentPath);

    return data === undefined
      ? null
      : { id: documentPath.split("/").at(-1) ?? "", data };
  }

  async list(collectionPath: string): Promise<StoredDocument[]> {
    const prefix = `${collectionPath}/`;

    return [...this.documents.entries()]
      .filter(([path]) => {
        const remainder = path.slice(prefix.length);
        return path.startsWith(prefix) && !remainder.includes("/");
      })
      .map(([path, data]) => ({
        id: path.split("/").at(-1) ?? "",
        data,
      }));
  }

  async set(documentPath: string, data: Record<string, unknown>): Promise<void> {
    this.documents.set(documentPath, data);
  }

  async delete(documentPath: string): Promise<void> {
    this.documents.delete(documentPath);
  }

  async deleteMany(documentPaths: readonly string[]): Promise<void> {
    documentPaths.forEach((path) => this.documents.delete(path));
  }

  read(documentPath: string): Record<string, unknown> | undefined {
    return this.documents.get(documentPath);
  }

  overwrite(documentPath: string, data: Record<string, unknown>): void {
    this.documents.set(documentPath, data);
  }
}
