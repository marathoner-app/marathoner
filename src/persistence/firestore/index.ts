import type { UserId } from "../../domain/training";
import { getFirebaseFirestore } from "../../services/firebaseClient";
import { createDocumentTrainingRepositories } from "../documentTrainingRepositories";
import type { TrainingRepositories } from "../trainingRepositories";
import { FirestoreDocumentStore } from "./firestoreDocumentStore";

export { createFirestoreTrainingLiveReadSource } from "./firestoreTrainingLiveReadSource";
export { createFirestoreRecommendationEvidenceLiveReadSource } from "./firestoreRecommendationEvidenceLiveReadSource";

export function createFirestoreTrainingRepositories(
  userId: UserId,
): TrainingRepositories {
  return createDocumentTrainingRepositories(
    new FirestoreDocumentStore(getFirebaseFirestore()),
    userId,
  );
}
