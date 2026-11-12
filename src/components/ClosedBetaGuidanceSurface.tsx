import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ClosedBetaGuidancePresentation,
  ClosedBetaGuidanceResult,
  ClosedBetaGuidanceSafetyState,
} from "../domain/guidance/closedBetaGuidance";
import type { ClosedBetaGuidanceClient } from "../services/closedBetaGuidanceClient";
import { firebaseClosedBetaGuidanceClient } from "../services/firebaseClosedBetaGuidanceClient";
import ReviewedGuidanceCard, {
  type ReviewedGuidanceCardState,
} from "./ReviewedGuidanceCard";

interface ClosedBetaGuidanceSurfaceProps {
  readonly ownerId: string;
  readonly activeTriggerCodes: readonly string[];
  readonly safetyState: ClosedBetaGuidanceSafetyState;
  readonly emergencySignals?: readonly string[];
  readonly otherConcerningOrPersistentSymptoms?: boolean;
  readonly client?: ClosedBetaGuidanceClient;
}

type SurfaceState =
  | { readonly kind: "loading" }
  | { readonly kind: "hidden" }
  | {
      readonly kind: "visible";
      readonly presentation: ClosedBetaGuidancePresentation;
      readonly cardState: ReviewedGuidanceCardState;
    }
  | { readonly kind: "error"; readonly message: string };

function errorMessage(result: ClosedBetaGuidanceResult): string {
  if (result.status === "authorization_error") {
    return result.code === "methodology-consent-required"
      ? "Review the current beta methodology notice before using runner guidance."
      : "Marathoner could not verify beta guidance access. Reopen the supported app and try again.";
  }
  if (result.status === "stale_version") {
    return "This Marathoner build does not contain the current beta guidance. Update the app and try again.";
  }
  return "Runner guidance is temporarily unavailable. Your plan and training history are unchanged.";
}

export default function ClosedBetaGuidanceSurface({
  ownerId,
  activeTriggerCodes,
  safetyState,
  emergencySignals = [],
  otherConcerningOrPersistentSymptoms = false,
  client = firebaseClosedBetaGuidanceClient,
}: ClosedBetaGuidanceSurfaceProps) {
  const requestKey = useMemo(
    () =>
      JSON.stringify({
        activeTriggerCodes,
        safetyState,
        emergencySignals,
        otherConcerningOrPersistentSymptoms,
      }),
    [
      activeTriggerCodes,
      emergencySignals,
      otherConcerningOrPersistentSymptoms,
      safetyState,
    ],
  );
  const [state, setState] = useState<SurfaceState>({ kind: "loading" });

  const load = useCallback(() => {
    const request = JSON.parse(requestKey) as {
      activeTriggerCodes: string[];
      safetyState: ClosedBetaGuidanceSafetyState;
      emergencySignals: string[];
      otherConcerningOrPersistentSymptoms: boolean;
    };
    let active = true;
    setState({ kind: "loading" });
    void client
      .get(request)
      .then((result) => {
        if (!active) return;
        if (result.status === "available") {
          setState({
            kind: "visible",
            presentation: result.presentation,
            cardState: { kind: "ready" },
          });
        } else if (result.status === "none" || result.status === "dismissed") {
          setState({ kind: "hidden" });
        } else {
          setState({ kind: "error", message: errorMessage(result) });
        }
      })
      .catch(() => {
        if (active) {
          setState({
            kind: "error",
            message:
              "Runner guidance is temporarily unavailable. Your plan and training history are unchanged.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [client, requestKey]);

  useEffect(() => load(), [load, ownerId]);

  if (state.kind === "hidden") return null;
  if (state.kind === "loading") {
    return (
      <p className="training-status" role="status">
        Checking runner guidance…
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <section className="training-home-status training-stale" role="alert">
        <p>{state.message}</p>
        <button type="button" onClick={load}>
          Try again
        </button>
      </section>
    );
  }

  const dismiss = async () => {
    if (!state.presentation.dismissible) return;
    setState({ ...state, cardState: { kind: "dismiss_pending" } });
    try {
      const result = await client.dismiss({
        presentationId: state.presentation.presentationId,
        artifactVersion: state.presentation.artifactVersion,
      });
      if (result.status === "dismissed") {
        setState({ kind: "hidden" });
      } else {
        setState({
          ...state,
          cardState: {
            kind: "error",
            title: "Guidance could not be dismissed",
            message: errorMessage(result),
            retryLabel: "Try again",
          },
        });
      }
    } catch {
      setState({
        ...state,
        cardState: {
          kind: "error",
          title: "Guidance could not be dismissed",
          message: "Reconnect, then try dismissing this guidance again.",
          retryLabel: "Try again",
        },
      });
    }
  };

  return (
    <ReviewedGuidanceCard
      model={{
        title: state.presentation.title,
        message: state.presentation.message,
        limitations: state.presentation.limitations,
        contextLabel: state.presentation.contextLabel,
        contentState: "reviewed",
        dismissible: state.presentation.dismissible,
        methodologyKind: state.presentation.kind,
      }}
      state={state.cardState}
      onDismiss={() => void dismiss()}
      onRetry={() => void dismiss()}
    />
  );
}
