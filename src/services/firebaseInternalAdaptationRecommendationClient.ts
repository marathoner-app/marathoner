import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

import type { InternalAdaptationRecommendationCommand } from "../domain/recommendations/internalAdaptationRecommendation";
import { getFirebaseApp } from "./firebaseClient";
import { createInternalAdaptationRecommendationClient } from "./internalAdaptationRecommendationClient";

let generateCallable: ReturnType<
  typeof httpsCallable<InternalAdaptationRecommendationCommand, unknown>
> | null = null;

function getGenerateCallable() {
  if (generateCallable !== null) return generateCallable;

  const functions = getFunctions(getFirebaseApp(), "us-central1");
  if (import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === "true") {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  generateCallable = httpsCallable<
    InternalAdaptationRecommendationCommand,
    unknown
  >(functions, "generateInternalAdaptationRecommendation");
  return generateCallable;
}

export const firebaseInternalAdaptationRecommendationClient =
  createInternalAdaptationRecommendationClient({
    async generate(command) {
      return (await getGenerateCallable()(command)).data;
    },
  });
