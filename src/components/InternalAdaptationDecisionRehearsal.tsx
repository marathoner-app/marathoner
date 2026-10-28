import { useState } from "react";
import type { RecommendationAction } from "../domain/recommendations";
import type { DecidedAdaptationEvaluationResultV1 } from "../domain/training";
import {
  resolveInternalRecommendationDecisionReviewModel,
  type VersionedRecommendationDecisionContent,
} from "../recommendations/recommendationDecisionReviewContent";
import RecommendationDecisionReview from "./RecommendationDecisionReview";

interface InternalAdaptationDecisionRehearsalProps {
  readonly result: DecidedAdaptationEvaluationResultV1;
  readonly contentRegistry: readonly VersionedRecommendationDecisionContent[];
  readonly onSessionDecisionChange?: (
    decision: InternalAdaptationSessionDecision | null,
  ) => void;
}

export type InternalAdaptationSessionDecision = "keep" | "apply";

interface InternalAdaptationSessionDecisionState {
  readonly resultIdentity: string;
  readonly decision: InternalAdaptationSessionDecision;
}

const materialActions: readonly RecommendationAction[] = [
  "repeat_period",
  "hold_progression",
  "reschedule",
];

function readableIdentifier(value: string): string {
  const words = value.replace(/[-_]/gu, " ");
  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
}

function isMaterialAction(
  value: DecidedAdaptationEvaluationResultV1["action"],
): value is RecommendationAction {
  return (
    value !== null &&
    materialActions.some((candidate) => candidate === value)
  );
}

export default function InternalAdaptationDecisionRehearsal({
  result,
  contentRegistry,
  onSessionDecisionChange,
}: InternalAdaptationDecisionRehearsalProps) {
  const [sessionDecisionState, setSessionDecisionState] =
    useState<InternalAdaptationSessionDecisionState | null>(null);
  const resultIdentity = [
    result.action,
    result.reasonCode,
    result.explanationKey,
    result.provenance.basePlanArtifactVersion,
    result.provenance.adaptationArtifactVersion,
  ].join(":");
  const sessionDecision =
    sessionDecisionState?.resultIdentity === resultIdentity
      ? sessionDecisionState.decision
      : null;
  const model = isMaterialAction(result.action)
    ? resolveInternalRecommendationDecisionReviewModel(
        {
          action: result.action,
          reasonCode: result.reasonCode,
          explanationKey: result.explanationKey,
          basePlanArtifactVersion: result.provenance.basePlanArtifactVersion,
          adaptationArtifactVersion:
            result.provenance.adaptationArtifactVersion,
        },
        contentRegistry,
      )
    : null;

  const recordDecision = (decision: InternalAdaptationSessionDecision) => {
    setSessionDecisionState({ resultIdentity, decision });
    onSessionDecisionChange?.(decision);
  };

  const reviewAgain = () => {
    setSessionDecisionState(null);
    onSessionDecisionChange?.(null);
  };

  if (model === null) {
    return (
      <section className="internal-adaptation-session-decision" role="alert">
        <p className="internal-adaptation-rehearsal-eyebrow">
          Draft explanation unavailable
        </p>
        <h3>This recommendation cannot be rehearsed</h3>
        <p>
          The exact draft explanation for this action, reason, and artifact
          version is missing or ambiguous. No choice is available.
        </p>
      </section>
    );
  }

  if (sessionDecision !== null) {
    return (
      <section
        className="internal-adaptation-session-decision"
        aria-labelledby="internal-adaptation-session-decision-title"
      >
        <p className="internal-adaptation-rehearsal-eyebrow">
          Session-only choice
        </p>
        <h3 id="internal-adaptation-session-decision-title">
          Session choice recorded: {sessionDecision === "keep"
            ? "Keep current plan"
            : "Apply draft change"}
        </h3>
        <p role="status">
          This choice exists only in the current rehearsal. No command was sent,
          no decision was saved, and no real plan changed.
        </p>
        <dl>
          <div>
            <dt>Reason code</dt>
            <dd>{result.reasonCode}</dd>
          </div>
          <div>
            <dt>Draft action</dt>
            <dd>{readableIdentifier(result.action ?? "none")}</dd>
          </div>
        </dl>
        <button type="button" onClick={reviewAgain}>
          Review the choice again
        </button>
      </section>
    );
  }

  return (
    <RecommendationDecisionReview
      model={model}
      state={{ kind: "ready" }}
      interactionMode="internal_rehearsal"
      onKeep={() => recordDecision("keep")}
      onApply={() => recordDecision("apply")}
      onRetry={() => undefined}
    />
  );
}
