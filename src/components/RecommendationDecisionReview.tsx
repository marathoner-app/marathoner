import { useEffect, useId, useRef } from "react";

import "./RecommendationDecisionReview.css";

export interface RecommendationDecisionReviewModel {
  readonly title: string;
  readonly observation: string;
  readonly meaning: string;
  readonly recommendation: string;
  readonly impact: string;
  readonly contentState: "internal_preview" | "reviewed";
}

export type RecommendationDecisionReviewState =
  | { readonly kind: "ready" }
  | { readonly kind: "pending"; readonly decision: "keep" | "apply" }
  | {
      readonly kind: "confirmed";
      readonly decision: "keep" | "apply";
      readonly title: string;
      readonly message: string;
    }
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

export interface RecommendationDecisionReviewProps {
  readonly model: RecommendationDecisionReviewModel;
  readonly state: RecommendationDecisionReviewState;
  readonly onKeep: () => void;
  readonly onApply: () => void;
  readonly onRetry: () => void;
  readonly interactionMode?: "participant" | "internal_rehearsal";
}

export default function RecommendationDecisionReview({
  model,
  state,
  onKeep,
  onApply,
  onRetry,
  interactionMode = "participant",
}: RecommendationDecisionReviewProps) {
  const idPrefix = useId();
  const outcomeRef = useRef<HTMLDivElement>(null);
  const pending = state.kind === "pending";
  const internalPreview = model.contentState === "internal_preview";
  const internalRehearsal =
    internalPreview && interactionMode === "internal_rehearsal";
  const decisionsAvailable = state.kind === "ready" || pending;
  const decisionsDisabled = pending || (internalPreview && !internalRehearsal);

  useEffect(() => {
    if (
      state.kind === "confirmed" ||
      state.kind === "error" ||
      state.kind === "unavailable"
    ) {
      outcomeRef.current?.focus();
    }
  }, [state.kind]);

  return (
    <section
      className="recommendation-decision-review"
      aria-labelledby={`${idPrefix}-title`}
      aria-busy={pending}
    >
      <p className="recommendation-review-eyebrow">Plan recommendation</p>
      <h2 id={`${idPrefix}-title`}>{model.title}</h2>

      {internalPreview && (
        <div className="recommendation-review-preview" role="note">
          <strong>Internal preview</strong>
          <span>
            {internalRehearsal
              ? "This synthetic recommendation is not approved training guidance. Choices below are session-only and cannot change a real plan."
              : "This synthetic recommendation is not approved training guidance and cannot change a plan."}
          </span>
        </div>
      )}

      <ol className="recommendation-review-narrative">
        <li>
          <h3>Observation</h3>
          <p>{model.observation}</p>
        </li>
        <li>
          <h3>What it means</h3>
          <p>{model.meaning}</p>
        </li>
        <li>
          <h3>Recommended change</h3>
          <p>{model.recommendation}</p>
        </li>
        <li>
          <h3>Expected impact</h3>
          <p>{model.impact}</p>
        </li>
      </ol>

      <div className="recommendation-review-choice">
        <h3>Your choice</h3>
        <p>
          {internalRehearsal
            ? "This rehearsal records only your in-memory choice. It cannot submit or confirm a plan change."
            : "Your current plan stays unchanged unless you choose to apply this recommendation and Marathoner confirms the change."}
        </p>
      </div>

      {pending && (
        <p className="recommendation-review-pending" role="status" aria-live="polite">
          {state.decision === "apply"
            ? "Applying this change. Wait for confirmation before doing anything else."
            : "Keeping your current plan. Wait for confirmation before doing anything else."}
        </p>
      )}

      {state.kind === "confirmed" && (
        <div
          className="recommendation-review-outcome confirmed"
          role="status"
          aria-live="polite"
          tabIndex={-1}
          ref={outcomeRef}
        >
          <h3>{state.title}</h3>
          <p>{state.message}</p>
        </div>
      )}

      {(state.kind === "error" || state.kind === "unavailable") && (
        <div
          className="recommendation-review-outcome"
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

      {decisionsAvailable && (
        <div className="recommendation-review-actions">
          <button
            type="button"
            className="secondary"
            onClick={onKeep}
            disabled={decisionsDisabled}
          >
            {internalRehearsal
              ? "Keep in rehearsal"
              : state.kind === "pending" && state.decision === "keep"
                ? "Keeping current plan…"
                : "Keep current plan"}
          </button>
          <button type="button" onClick={onApply} disabled={decisionsDisabled}>
            {internalRehearsal
              ? "Apply in rehearsal"
              : state.kind === "pending" && state.decision === "apply"
                ? "Applying change…"
                : "Apply this change"}
          </button>
        </div>
      )}
    </section>
  );
}
