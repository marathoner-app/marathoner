import { useState } from "react";
import type { DecidedAdaptationEvaluationResultV1 } from "../domain/training";
import RecommendationDecisionReview, {
  type RecommendationDecisionReviewModel,
} from "./RecommendationDecisionReview";
import type { DraftAdaptationOutcomeDetail } from "./internalAdaptationScenarioPacket";

interface InternalAdaptationDecisionRehearsalProps {
  readonly result: DecidedAdaptationEvaluationResultV1;
  readonly outcomeDetail: DraftAdaptationOutcomeDetail;
  readonly sourceDescription?: string;
  readonly onSessionDecisionChange?: (
    decision: InternalAdaptationSessionDecision | null,
  ) => void;
}

export type InternalAdaptationSessionDecision = "keep" | "apply";

function readableIdentifier(value: string): string {
  const words = value.replace(/[-_]/gu, " ");
  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
}

function modelFor(
  result: DecidedAdaptationEvaluationResultV1,
  outcomeDetail: DraftAdaptationOutcomeDetail,
  sourceDescription?: string,
): RecommendationDecisionReviewModel {
  return {
    title: `Internal ${readableIdentifier(result.action ?? "recommendation")}`,
    observation: outcomeDetail.when,
    meaning:
      sourceDescription ??
      `The frozen scenario matched ${result.reasonCode} in the draft evaluator.`,
    recommendation:
      outcomeDetail.planMutation ??
      "The draft outcome does not define a plan mutation.",
    impact:
      "Any choice below is recorded only for this page session. No recommendation command, approval receipt, or real plan mutation is created.",
    contentState: "internal_preview",
  };
}

export default function InternalAdaptationDecisionRehearsal({
  result,
  outcomeDetail,
  sourceDescription,
  onSessionDecisionChange,
}: InternalAdaptationDecisionRehearsalProps) {
  const [sessionDecision, setSessionDecision] =
    useState<InternalAdaptationSessionDecision | null>(null);

  const recordDecision = (decision: InternalAdaptationSessionDecision) => {
    setSessionDecision(decision);
    onSessionDecisionChange?.(decision);
  };

  const reviewAgain = () => {
    setSessionDecision(null);
    onSessionDecisionChange?.(null);
  };

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
      model={modelFor(result, outcomeDetail, sourceDescription)}
      state={{ kind: "ready" }}
      interactionMode="internal_rehearsal"
      onKeep={() => recordDecision("keep")}
      onApply={() => recordDecision("apply")}
      onRetry={() => undefined}
    />
  );
}
