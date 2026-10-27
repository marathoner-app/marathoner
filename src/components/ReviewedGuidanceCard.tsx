import { useEffect, useId, useRef } from "react";

import "./ReviewedGuidanceCard.css";

export interface ReviewedGuidanceCardModel {
  readonly title: string;
  readonly message: string;
  readonly limitations: readonly string[];
  readonly contextLabel?: string;
  readonly contentState: "internal_preview" | "reviewed";
}

export type ReviewedGuidanceCardState =
  | { readonly kind: "ready" }
  | { readonly kind: "dismiss_pending" }
  | {
      readonly kind: "unavailable";
      readonly title: string;
      readonly message: string;
    }
  | {
      readonly kind: "error";
      readonly title: string;
      readonly message: string;
      readonly retryLabel: string;
    };

export interface ReviewedGuidanceCardProps {
  readonly model: ReviewedGuidanceCardModel;
  readonly state: ReviewedGuidanceCardState;
  readonly onDismiss: () => void;
  readonly onRetry: () => void;
}

export default function ReviewedGuidanceCard({
  model,
  state,
  onDismiss,
  onRetry,
}: ReviewedGuidanceCardProps) {
  const idPrefix = useId();
  const outcomeRef = useRef<HTMLDivElement>(null);
  const pending = state.kind === "dismiss_pending";
  const internalPreview = model.contentState === "internal_preview";
  const dismissalAvailable = state.kind === "ready" || pending;

  useEffect(() => {
    if (state.kind === "error" || state.kind === "unavailable") {
      outcomeRef.current?.focus();
    }
  }, [state.kind]);

  return (
    <section
      className="reviewed-guidance-card"
      aria-labelledby={`${idPrefix}-title`}
      aria-busy={pending}
    >
      <p className="reviewed-guidance-eyebrow">Runner guidance</p>
      {model.contextLabel && (
        <p className="reviewed-guidance-context">{model.contextLabel}</p>
      )}
      <h2 id={`${idPrefix}-title`}>{model.title}</h2>

      {internalPreview && (
        <div className="reviewed-guidance-preview" role="note">
          <strong>Internal preview</strong>
          <span>
            This synthetic example is not approved training guidance and is not
            shown to runners.
          </span>
        </div>
      )}

      <p className="reviewed-guidance-message">{model.message}</p>

      <div className="reviewed-guidance-limitations">
        <h3>Keep in mind</h3>
        <ul>
          {model.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </div>

      {pending && (
        <p className="reviewed-guidance-pending" role="status" aria-live="polite">
          Dismissing this guidance. Wait for confirmation before trying again.
        </p>
      )}

      {(state.kind === "error" || state.kind === "unavailable") && (
        <div
          className="reviewed-guidance-outcome"
          role="alert"
          tabIndex={-1}
          ref={outcomeRef}
        >
          <h3>{state.title}</h3>
          <p>{state.message}</p>
          {state.kind === "error" && (
            <button type="button" className="secondary" onClick={onRetry}>
              {state.retryLabel}
            </button>
          )}
        </div>
      )}

      {dismissalAvailable && (
        <div className="reviewed-guidance-actions">
          <button
            type="button"
            className="secondary"
            onClick={onDismiss}
            disabled={pending || internalPreview}
          >
            {pending ? "Dismissing guidance…" : "Dismiss guidance"}
          </button>
        </div>
      )}
    </section>
  );
}
