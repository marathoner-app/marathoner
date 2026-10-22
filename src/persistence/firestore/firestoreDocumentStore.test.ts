import type { Firestore } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocFromCache: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock("firebase/firestore", () => firestoreMocks);

import { FirestoreDocumentStore } from "./firestoreDocumentStore";

function snapshot(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
    exists: () => true,
  };
}

describe("FirestoreDocumentStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.doc.mockReturnValue({ path: "document-reference" });
  });

  it("uses a cached document without waiting for the server", async () => {
    firestoreMocks.getDocFromCache.mockResolvedValue(
      snapshot("run-1", { distanceMeters: 5000 }),
    );
    const store = new FirestoreDocumentStore({} as Firestore);

    await expect(
      store.getCachedOrServer("users/runner-1/runs/run-1"),
    ).resolves.toEqual({
      id: "run-1",
      data: { distanceMeters: 5000 },
    });

    expect(firestoreMocks.getDocFromCache).toHaveBeenCalledOnce();
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled();
  });

  it("falls back to the server when the document is not cached", async () => {
    firestoreMocks.getDocFromCache.mockRejectedValue(
      new Error("Document is not in the cache."),
    );
    firestoreMocks.getDoc.mockResolvedValue(
      snapshot("run-1", { distanceMeters: 5000 }),
    );
    const store = new FirestoreDocumentStore({} as Firestore);

    await expect(
      store.getCachedOrServer("users/runner-1/runs/run-1"),
    ).resolves.toEqual({
      id: "run-1",
      data: { distanceMeters: 5000 },
    });

    expect(firestoreMocks.getDocFromCache).toHaveBeenCalledOnce();
    expect(firestoreMocks.getDoc).toHaveBeenCalledOnce();
  });
});
