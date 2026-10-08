import { useId } from "react";
import type { PlanGenerationResultV1 } from "../domain/training";
import ProposedPlanSummary from "./ProposedPlanSummary";

type PlanGenerationResultViewProps = {
  readonly result: PlanGenerationResultV1;
  readonly onReviewInputs: () => void;
  readonly onContinueReview: () => void;
};

type NoPlanStateProps = {
  readonly kind: "unsupported" | "invalid-input";
  readonly title: string;
  readonly message: string;
  readonly onReviewInputs: () => void;
};

function NoPlanState({
  kind,
  title,
  message,
  onReviewInputs,
}: NoPlanStateProps) {
  const titleId = `${useId()}-title`;

  return (
    <section
      className={`plan-result-state ${kind}`}
      aria-labelledby={titleId}
    >
      <div role="status">
        <p className="plan-result-state-label">No plan created</p>
        <h2 id={titleId}>{title}</h2>
        <p>{message}</p>
      </div>
      <button type="button" onClick={onReviewInputs}>
        Review inputs
      </button>
    </section>
  );
}

function assertNever(result: never): never {
  throw new Error(`Unhandled plan-generation result: ${String(result)}`);
}

export default function PlanGenerationResultView({
  result,
  onReviewInputs,
  onContinueReview,
}: PlanGenerationResultViewProps) {
  switch (result.kind) {
    case "generated":
      return (
        <ProposedPlanSummary
          result={result}
          onReviewInputs={onReviewInputs}
          onContinueReview={onContinueReview}
        />
      );
    case "unsupported":
      return (
        <NoPlanState
          kind="unsupported"
          title="A plan wasn’t created"
          message="Marathoner can’t safely create a plan from these details yet. Review your inputs before trying again."
          onReviewInputs={onReviewInputs}
        />
      );
    case "invalid_input":
      return (
        <NoPlanState
          kind="invalid-input"
          title="Review your running details"
          message="Some details need attention before Marathoner can create a proposal. Review your inputs and try again."
          onReviewInputs={onReviewInputs}
        />
      );
    default:
      return assertNever(result);
  }
}
