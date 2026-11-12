import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

import type { ClosedBetaAdaptationRecommendationCommand } from "../domain/recommendations/closedBetaAdaptationRecommendation";
import { createClosedBetaAdaptationRecommendationClient } from "./closedBetaAdaptationRecommendationClient";
import { getFirebaseApp } from "./firebaseClient";

let generateCallable: ReturnType<
  typeof httpsCallable<ClosedBetaAdaptationRecommendationCommand, unknown>
> | null = null;

function getGenerateCallable() {
  if (generateCallable !== null) return generateCallable;

  const functions = getFunctions(getFirebaseApp(), "us-central1");
  if (import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === "true") {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  generateCallable = httpsCallable<
    ClosedBetaAdaptationRecommendationCommand,
    unknown
  >(functions, "generateClosedBetaAdaptationRecommendation");
  return generateCallable;
}

export const firebaseClosedBetaAdaptationRecommendationClient =
  createClosedBetaAdaptationRecommendationClient({
    async generate(command) {
      return (await getGenerateCallable()(command)).data;
    },
  });
