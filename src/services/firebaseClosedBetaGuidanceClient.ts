import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

import type {
  DismissClosedBetaGuidanceRequest,
  GetClosedBetaGuidanceRequest,
} from "../domain/guidance/closedBetaGuidance";
import { createClosedBetaGuidanceClient } from "./closedBetaGuidanceClient";
import { getFirebaseApp } from "./firebaseClient";

let callables: {
  get: ReturnType<typeof httpsCallable<GetClosedBetaGuidanceRequest, unknown>>;
  dismiss: ReturnType<
    typeof httpsCallable<DismissClosedBetaGuidanceRequest, unknown>
  >;
} | null = null;

function getCallables() {
  if (callables !== null) return callables;
  const functions = getFunctions(getFirebaseApp(), "us-central1");
  if (import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === "true") {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  callables = {
    get: httpsCallable<GetClosedBetaGuidanceRequest, unknown>(
      functions,
      "getClosedBetaGuidance",
    ),
    dismiss: httpsCallable<DismissClosedBetaGuidanceRequest, unknown>(
      functions,
      "dismissClosedBetaGuidance",
    ),
  };
  return callables;
}

export const firebaseClosedBetaGuidanceClient = createClosedBetaGuidanceClient({
  async get(request) {
    return (await getCallables().get(request)).data;
  },
  async dismiss(request) {
    return (await getCallables().dismiss(request)).data;
  },
});
