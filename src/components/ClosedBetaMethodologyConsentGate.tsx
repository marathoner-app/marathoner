import {
  useEffect,
  useId,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
  closedBetaMethodologyConsentCopy,
  type ClosedBetaMethodologyConsentResult,
} from "../domain/methodology/closedBetaMethodologyConsent";
import type { ClosedBetaProvisionalMethodologyManifest } from "../domain/methodology/closedBetaProvisionalMethodology";
import { getClosedBetaProvisionalMethodologyManifest } from "../domain/methodology/closedBetaProvisionalMethodologyRegistry";
import type { ClosedBetaMethodologyConsentClient } from "../services/closedBetaMethodologyConsentClient";
import { firebaseClosedBetaMethodologyConsentClient } from "../services/firebaseClosedBetaMethodologyConsentClient";

import "./ClosedBetaMethodologyConsentGate.css";

type GateState =
  | { readonly kind: "loading" }
  | { readonly kind: "accepted" }
  | {
      readonly kind: "required";
      readonly reason: "missing" | "version_changed";
    }
  | { readonly kind: "error"; readonly message: string };

export interface ClosedBetaMethodologyConsentGateProps {
  readonly ownerId: string;
  readonly children: ReactNode;
  readonly client?: ClosedBetaMethodologyConsentClient;
  readonly manifest?: ClosedBetaProvisionalMethodologyManifest | null;
}

function stateFromResult(
  result: ClosedBetaMethodologyConsentResult,
  manifest: ClosedBetaProvisionalMethodologyManifest,
): GateState {
  if (result.status === "accepted") {
    return result.acceptance.manifestVersion === manifest.manifestVersion
      ? { kind: "accepted" }
      : { kind: "required", reason: "version_changed" };
  }
  if (result.status === "consent_required") {
    if (result.manifestVersion !== manifest.manifestVersion) {
      return {
        kind: "error",
        message:
          "This Marathoner build does not contain the current beta methodology. Update the app before continuing.",
      };
    }
    return { kind: "required", reason: result.reason };
  }
  if (result.status === "authorization_error") {
    return {
      kind: "error",
      message:
        result.code === "approved-beta-membership-required"
          ? "This account does not currently have approved closed-beta access."
          : "Marathoner could not verify this app. Reopen the supported app and try again.",
    };
  }
  if (result.status === "authentication_error") {
    return {
      kind: "error",
      message: "Sign in again before continuing with the closed beta.",
    };
  }
  return {
    kind: "error",
    message:
      result.status === "validation_error"
        ? "The beta methodology changed while this page was open. Check the current version and try again."
        : "Beta training features are temporarily unavailable. Try again shortly.",
  };
}

export default function ClosedBetaMethodologyConsentGate({
  ownerId,
  children,
  client = firebaseClosedBetaMethodologyConsentClient,
  manifest = getClosedBetaProvisionalMethodologyManifest(),
}: ClosedBetaMethodologyConsentGateProps) {
  const headingId = `${useId()}-heading`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<GateState>(
    manifest === null ? { kind: "accepted" } : { kind: "loading" },
  );
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = useCallback(() => {
    if (manifest === null) return;
    setChecked(false);
    setState({ kind: "loading" });
    let active = true;
    void client
      .getStatus()
      .then((result) => {
        if (active) setState(stateFromResult(result, manifest));
      })
      .catch(() => {
        if (active) {
          setState({
            kind: "error",
            message: "Marathoner could not check beta access. Try again.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [client, manifest]);

  useEffect(() => loadStatus(), [loadStatus, ownerId]);

  useEffect(() => {
    if (state.kind === "required" || state.kind === "error") {
      headingRef.current?.focus();
    }
  }, [state.kind]);

  if (manifest === null || state.kind === "accepted") return children;

  if (state.kind === "loading") {
    return (
      <div className="methodology-consent-status" role="status">
        Checking beta methodology access…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <section
        className="methodology-consent-gate methodology-consent-error"
        aria-labelledby={headingId}
      >
        <p className="methodology-consent-eyebrow">
          {closedBetaMethodologyConsentCopy.eyebrow}
        </p>
        <h2 id={headingId} ref={headingRef} tabIndex={-1}>
          Beta access needs attention
        </h2>
        <p role="alert">{state.message}</p>
        <button type="button" onClick={loadStatus}>
          Try again
        </button>
      </section>
    );
  }

  const accept = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      const nextState = stateFromResult(
        await client.accept({
          accepted: true,
          consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
          manifestVersion: manifest.manifestVersion,
        }),
        manifest,
      );
      if (nextState.kind === "required") setChecked(false);
      setState(nextState);
    } catch {
      setState({
        kind: "error",
        message: "Marathoner could not save your beta consent. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="methodology-consent-gate"
      aria-labelledby={headingId}
    >
      <p className="methodology-consent-eyebrow">
        {closedBetaMethodologyConsentCopy.eyebrow}
      </p>
      <h2 id={headingId} ref={headingRef} tabIndex={-1}>
        {closedBetaMethodologyConsentCopy.title}
      </h2>
      {state.reason === "version_changed" && (
        <p className="methodology-consent-changed" role="status">
          The beta methodology version changed. Please review and accept the
          current version before continuing.
        </p>
      )}
      <p>{closedBetaMethodologyConsentCopy.introduction}</p>
      <p>{closedBetaMethodologyConsentCopy.testingContext}</p>
      <p>{closedBetaMethodologyConsentCopy.safetyContext}</p>
      <p className="methodology-consent-version">
        Methodology {manifest.manifestVersion} · Consent{" "}
        {CLOSED_BETA_METHODOLOGY_CONSENT_VERSION}
      </p>
      <label className="methodology-consent-agreement">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>{closedBetaMethodologyConsentCopy.agreement}</span>
      </label>
      <button
        type="button"
        disabled={!checked || submitting}
        onClick={() => void accept()}
      >
        {submitting ? "Saving acceptance…" : closedBetaMethodologyConsentCopy.action}
      </button>
    </section>
  );
}
