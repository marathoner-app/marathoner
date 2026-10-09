import { useId } from "react";
import type { PlanApprovalReceiptResult } from "../domain/materialCommands/contract";
import type {
  PlanGenerationInputV1,
  PlanGenerationResultV1,
} from "../domain/training";
import type { PlanApprovalClient } from "../services/planApprovalClient";
import PlanApprovalReview from "./PlanApprovalReview";

type PlanGenerationResultViewProps = {
  readonly result: PlanGenerationResultV1;
  readonly input: PlanGenerationInputV1;
  readonly expectedActivePlanRevision: number | null;
  readonly approvalClient: PlanApprovalClient;
  readonly reloadTrainingData: () => Promise<void>;
  readonly onReviewInputs: () => void;
  readonly onApproved: (receipt: PlanApprovalReceiptResult) => void;
  readonly createCommandId?: () => string;
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

export default function PlanGenerationResultView(
  props: PlanGenerationResultViewProps,
) {
  const { result, onReviewInputs } = props;
  switch (result.kind) {
    case "generated":
      return (
        <PlanApprovalReview
          input={props.input}
          result={result}
          expectedActivePlanRevision={props.expectedActivePlanRevision}
          approvalClient={props.approvalClient}
          reloadTrainingData={props.reloadTrainingData}
          onReviewInputs={onReviewInputs}
          onApproved={props.onApproved}
          createCommandId={props.createCommandId}
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
