import { getFirestore } from "firebase/firestore";
import type { UserId } from "../../domain/training";
import { getFirebaseApp } from "../../services/firebaseClient";
import { createDocumentTrainingRepositories } from "../documentTrainingRepositories";
import type { TrainingRepositories } from "../trainingRepositories";
import { FirestoreDocumentStore } from "./firestoreDocumentStore";

export function createFirestoreTrainingRepositories(
  userId: UserId,
): TrainingRepositories {
  return createDocumentTrainingRepositories(
    new FirestoreDocumentStore(getFirestore(getFirebaseApp())),
    userId,
  );
}
