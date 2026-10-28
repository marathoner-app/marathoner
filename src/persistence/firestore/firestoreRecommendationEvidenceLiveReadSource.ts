import {
  collection,
  onSnapshot,
  type DocumentData,
  type Firestore,
  type SnapshotMetadata,
} from "firebase/firestore";

import {
  validateRecommendationEvidence,
  type RecommendationEvidenceV2,
} from "../../domain/recommendations/recommendationEvidence";
import type { UserId } from "../../domain/training";
import { getFirebaseFirestore } from "../../services/firebaseClient";
import { recommendationEvidenceCollectionPath } from "./paths";

export interface RecommendationEvidenceListenerMetadata {
  readonly fromCache: boolean;
  readonly hasPendingWrites: boolean;
}

export interface RecommendationEvidenceListenerDocument {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

export interface RecommendationEvidenceCollectionSnapshot {
  readonly documents: readonly RecommendationEvidenceListenerDocument[];
  readonly metadata: RecommendationEvidenceListenerMetadata;
}

type Unsubscribe = () => void;
type ListenerError = (error: unknown) => void;

export interface FirestoreRecommendationEvidenceListenerBackend {
  subscribeCollection(
    path: string,
    onSnapshot: (snapshot: RecommendationEvidenceCollectionSnapshot) => void,
    onError: ListenerError,
  ): Unsubscribe;
}

export type RecommendationEvidenceLiveReadEvent =
  | {
      readonly type: "snapshot";
      readonly ownerId: UserId;
      readonly evidence: readonly RecommendationEvidenceV2[];
      readonly origin: "cache" | "server";
      readonly hasPendingWrites: boolean;
    }
  | {
      readonly type: "error";
      readonly ownerId: UserId;
      readonly message: string;
      readonly recoverable: true;
    };

export interface RecommendationEvidenceLiveReadSource {
  subscribe(
    listener: (event: RecommendationEvidenceLiveReadEvent) => void,
  ): Unsubscribe;
}

export interface CreateFirestoreRecommendationEvidenceLiveReadSourceOptions {
  readonly backend: FirestoreRecommendationEvidenceListenerBackend;
  readonly ownerId: UserId;
}

const READ_ERROR_MESSAGE = "Recommendation history could not be synchronized.";

function listenerMetadata(
  metadata: SnapshotMetadata,
): RecommendationEvidenceListenerMetadata {
  return {
    fromCache: metadata.fromCache,
    hasPendingWrites: metadata.hasPendingWrites,
  };
}

export function createFirebaseRecommendationEvidenceListenerBackend(
  database: Firestore,
): FirestoreRecommendationEvidenceListenerBackend {
  return {
    subscribeCollection(path, receiveSnapshot, receiveError) {
      return onSnapshot(
        collection(database, path),
        { includeMetadataChanges: true },
        (snapshot) => {
          receiveSnapshot({
            documents: snapshot.docs.map((documentSnapshot) => ({
              id: documentSnapshot.id,
              data: documentSnapshot.data() as DocumentData,
            })),
            metadata: listenerMetadata(snapshot.metadata),
          });
        },
        receiveError,
      );
    },
  };
}

function evidenceFromDocument(
  document: RecommendationEvidenceListenerDocument,
): RecommendationEvidenceV2 {
  const issues = validateRecommendationEvidence(document.data);

  if (issues.length > 0) {
    throw new Error("Stored recommendation evidence is invalid.");
  }

  if (document.id !== document.data.recommendationId) {
    throw new Error("Stored recommendation evidence identity is invalid.");
  }

  return document.data as unknown as RecommendationEvidenceV2;
}

function compareNewestFirst(
  left: RecommendationEvidenceV2,
  right: RecommendationEvidenceV2,
): number {
  return (
    right.recommendedAt.localeCompare(left.recommendedAt) ||
    left.recommendationId.localeCompare(right.recommendationId)
  );
}

export function createFirestoreRecommendationEvidenceLiveReadSourceWithBackend({
  backend,
  ownerId,
}: CreateFirestoreRecommendationEvidenceLiveReadSourceOptions): RecommendationEvidenceLiveReadSource {
  return {
    subscribe(listener) {
      let active = true;

      const emitError = (): void => {
        if (!active) return;

        listener({
          type: "error",
          ownerId,
          message: READ_ERROR_MESSAGE,
          recoverable: true,
        });
      };

      const unsubscribe = backend.subscribeCollection(
        recommendationEvidenceCollectionPath(ownerId),
        (snapshot) => {
          if (!active) return;

          try {
            const evidence = snapshot.documents
              .map(evidenceFromDocument)
              .sort(compareNewestFirst);

            listener({
              type: "snapshot",
              ownerId,
              evidence,
              origin: snapshot.metadata.fromCache ? "cache" : "server",
              hasPendingWrites: snapshot.metadata.hasPendingWrites,
            });
          } catch {
            emitError();
          }
        },
        emitError,
      );

      return () => {
        if (!active) return;

        active = false;
        unsubscribe();
      };
    },
  };
}

export function createFirestoreRecommendationEvidenceLiveReadSource(
  ownerId: UserId,
): RecommendationEvidenceLiveReadSource {
  return createFirestoreRecommendationEvidenceLiveReadSourceWithBackend({
    backend: createFirebaseRecommendationEvidenceListenerBackend(
      getFirebaseFirestore(),
    ),
    ownerId,
  });
}
