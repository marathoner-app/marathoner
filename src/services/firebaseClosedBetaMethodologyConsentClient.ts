import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

import type { AcceptClosedBetaMethodologyConsentCommand } from "../domain/methodology/closedBetaMethodologyConsent";
import {
  createClosedBetaMethodologyConsentClient,
} from "./closedBetaMethodologyConsentClient";
import { getFirebaseApp } from "./firebaseClient";

let callables: {
  getStatus: ReturnType<typeof httpsCallable<Record<string, never>, unknown>>;
  accept: ReturnType<
    typeof httpsCallable<AcceptClosedBetaMethodologyConsentCommand, unknown>
  >;
} | null = null;

function getCallables() {
  if (callables !== null) return callables;
  const functions = getFunctions(getFirebaseApp(), "us-central1");
  if (import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === "true") {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  callables = {
    getStatus: httpsCallable(functions, "getClosedBetaMethodologyConsent"),
    accept: httpsCallable<AcceptClosedBetaMethodologyConsentCommand, unknown>(
      functions,
      "acceptClosedBetaMethodologyConsent",
    ),
  };
  return callables;
}

export const firebaseClosedBetaMethodologyConsentClient =
  createClosedBetaMethodologyConsentClient({
    async getStatus() {
      return (await getCallables().getStatus({})).data;
    },
    async accept(command) {
      return (await getCallables().accept(command)).data;
    },
  });
