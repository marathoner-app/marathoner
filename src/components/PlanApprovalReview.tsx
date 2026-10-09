import { useEffect, useId, useRef, useState } from "react";

import type {
  PlanApprovalReceiptResult,
} from "../domain/materialCommands/contract";
import type {
  GeneratedPlanResultV1,
  PlanGenerationInputV1,
} from "../domain/training";
import type {
  PlanApprovalClient,
  PlanApprovalClientResult,
  PlanApprovalSubmission,
} from "../services/planApprovalClient";
import ProposedPlanSummary from "./ProposedPlanSummary";

type ReviewScreen = "proposal" | "confirmation" | "approved";
type ApprovalOperation = "idle" | "submitting" | "resolving" | "reloading";
type NonApprovedResult = Exclude<
  PlanApprovalClientResult,
  PlanApprovalReceiptResult
>;

interface ReviewedPlan {
  readonly input: PlanGenerationInputV1;
  readonly proposal: GeneratedPlanResultV1["plan"];
}

interface OutcomePresentation {
  readonly title: string;
  readonly message: string;
  readonly canRetryApproval: boolean;
}

export interface PlanApprovalReviewProps {
  readonly input: PlanGenerationInputV1;
  readonly result: GeneratedPlanResultV1;
  readonly expectedActivePlanRevision: number | null;
  readonly approvalClient: PlanApprovalClient;
  readonly reloadTrainingData: () => Promise<void>;
  readonly onReviewInputs: () => void;
  readonly onApproved: (receipt: PlanApprovalReceiptResult) => void;
  readonly createCommandId?: () => string;
}

function defaultCommandId(): string {
  return `approve-plan-${globalThis.crypto.randomUUID()}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function workoutCount(plan: GeneratedPlanResultV1["plan"]): number {
  return plan.weeks.reduce((total, week) => total + week.workouts.length, 0);
}

function formatCount(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function outcomePresentation(result: NonApprovedResult): OutcomePresentation {
  switch (result.status) {
    case "stale_revision":
      return {
        title: "The active plan changed",
        message:
          "Marathoner did not activate this proposal because your plan changed after this review began. Reload your training data and review the proposal again.",
        canRetryApproval: false,
      };
    case "retryable_error":
      return {
        title: "Approval was not completed",
        message: `${result.message} Marathoner will reuse this approval request when you try again.`,
        canRetryApproval: true,
      };
    case "authentication_error":
      return {
        title: "Your account needs attention",
        message:
          result.code === "verified-email-required"
            ? "Verify your account email before approving this plan. The proposal is still inactive."
            : "Sign in again before approving this plan. The proposal is still inactive.",
        canRetryApproval: true,
      };
    case "authorization_error":
      return {
        title: "Plan approval is not available",
        message:
          result.code === "plan-artifact-not-approved"
            ? "This plan was not created from an approved Marathoner methodology, so it cannot be activated."
            : result.code === "approved-beta-membership-required"
              ? "This account is not currently approved to activate a beta training plan."
              : "Marathoner could not verify this app session. Reopen the supported app before trying again.",
        canRetryApproval: false,
      };
    case "outcome_unknown":
      return {
        title: "Approval status needs checking",
        message: result.message,
        canRetryApproval: false,
      };
    case "unsupported_version":
      return {
        title: "Update Marathoner before approving",
        message:
          "This version cannot safely approve the proposal. The plan is still inactive.",
        canRetryApproval: false,
      };
    case "validation_error":
      return {
        title: "The proposal needs another review",
        message:
          "Marathoner could not safely approve this proposal. Review the runner inputs before trying again.",
        canRetryApproval: false,
      };
    case "conflict":
      return {
        title: "This approval could not be safely repeated",
        message:
          "Marathoner found a different request using this approval identifier. Review the proposal again before continuing.",
        canRetryApproval: false,
      };
  }
}

function unresolvedResult(
  commandId: string,
  result?: PlanApprovalClientResult,
): NonApprovedResult {
  const message =
    result?.status === "retryable_error"
      ? "Marathoner could not reach the original approval yet. No new approval was sent. Reconnect and check again."
      : result?.status === "authentication_error"
        ? "Sign in again, then check the original approval. No new approval was sent."
        : result?.status === "authorization_error"
          ? "Marathoner could not verify this app session while checking the original approval. Reopen the supported app and check again."
          : "The original approval still cannot be confirmed. No new approval was sent; check it again before doing anything else.";

  return {
    status: "outcome_unknown",
    commandId,
    code: "resolve-by-command-id",
    message,
  };
}

export default function PlanApprovalReview({
  input,
  result,
  expectedActivePlanRevision,
  approvalClient,
  reloadTrainingData,
  onReviewInputs,
  onApproved,
  createCommandId = defaultCommandId,
}: PlanApprovalReviewProps) {
  const idPrefix = useId();
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const approvedHeadingRef = useRef<HTMLHeadingElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const commandIdRef = useRef<string | null>(null);
  const operationRef = useRef(false);
  const [screen, setScreen] = useState<ReviewScreen>("proposal");
  const [operation, setOperation] = useState<ApprovalOperation>("idle");
  const [reviewedPlan, setReviewedPlan] = useState<ReviewedPlan | null>(null);
  const [outcome, setOutcome] = useState<NonApprovedResult | null>(null);
  const [approvalReceipt, setApprovalReceipt] =
    useState<PlanApprovalReceiptResult | null>(null);
  const [reloadFailed, setReloadFailed] = useState(false);
  const [resolutionRequired, setResolutionRequired] = useState(false);
  const pending = operation !== "idle";

  useEffect(() => {
    if (screen === "confirmation") confirmationHeadingRef.current?.focus();
    if (screen === "approved") approvedHeadingRef.current?.focus();
  }, [screen]);

  useEffect(() => {
    if (outcome !== null || reloadFailed) outcomeRef.current?.focus();
  }, [outcome, reloadFailed]);

  const beginConfirmation = () => {
    setReviewedPlan({ input, proposal: result.plan });
    setOutcome(null);
    setScreen("confirmation");
  };

  const finishApproval = async (receipt: PlanApprovalReceiptResult) => {
    setApprovalReceipt(receipt);
    setOutcome(null);
    setReloadFailed(false);
    setOperation("reloading");

    try {
      await reloadTrainingData();
      setScreen("approved");
      onApproved(receipt);
    } catch {
      setReloadFailed(true);
    }
  };

  const applySubmissionResult = async (approvalResult: PlanApprovalClientResult) => {
    if (approvalResult.status === "plan_approved") {
      setResolutionRequired(false);
      await finishApproval(approvalResult);
      return;
    }

    if (approvalResult.status === "outcome_unknown") {
      setResolutionRequired(true);
      const originalCommandId = commandIdRef.current;
      if (originalCommandId !== null) {
        setOutcome(unresolvedResult(originalCommandId));
      }
      return;
    }
    setOutcome(approvalResult);
  };

  const submitApproval = async () => {
    if (
      operationRef.current ||
      resolutionRequired ||
      reviewedPlan === null
    ) {
      return;
    }

    operationRef.current = true;
    setOperation("submitting");
    setOutcome(null);
    setReloadFailed(false);
    const commandId = commandIdRef.current ?? createCommandId();
    commandIdRef.current = commandId;
    const submission: PlanApprovalSubmission = {
      commandId,
      expectedActivePlanRevision,
      input: reviewedPlan.input,
      proposal: reviewedPlan.proposal,
    };

    try {
      await applySubmissionResult(await approvalClient.submit(submission));
    } catch {
      setResolutionRequired(true);
      setOutcome(unresolvedResult(commandId));
    } finally {
      operationRef.current = false;
      setOperation("idle");
    }
  };

  const resolveApproval = async () => {
    const commandId = commandIdRef.current;
    if (operationRef.current || commandId === null) return;

    operationRef.current = true;
    setOperation("resolving");
    setOutcome(null);

    try {
      const resolved = await approvalClient.resolve(commandId);
      if (resolved.status === "plan_approved") {
        setResolutionRequired(false);
        await finishApproval(resolved);
      } else {
        setResolutionRequired(true);
        setOutcome(unresolvedResult(commandId, resolved));
      }
    } catch {
      setResolutionRequired(true);
      setOutcome(unresolvedResult(commandId));
    } finally {
      operationRef.current = false;
      setOperation("idle");
    }
  };

  const retryTrainingReload = async () => {
    if (operationRef.current || approvalReceipt === null) return;
    operationRef.current = true;
    try {
      await finishApproval(approvalReceipt);
    } finally {
      operationRef.current = false;
      setOperation("idle");
    }
  };

  if (screen === "proposal") {
    return (
      <ProposedPlanSummary
        result={result}
        onReviewInputs={onReviewInputs}
        onContinueReview={beginConfirmation}
      />
    );
  }

  if (screen === "approved" && reviewedPlan !== null) {
    return (
      <section
        className="plan-approval-state approved"
        aria-labelledby={`${idPrefix}-approved-title`}
      >
        <p className="plan-approval-eyebrow">Plan active</p>
        <h2
          id={`${idPrefix}-approved-title`}
          ref={approvedHeadingRef}
          tabIndex={-1}
        >
          {reviewedPlan.proposal.name} is active
        </h2>
        <p role="status">
          Your training data has been refreshed. Your active plan and next
          workout are now available in Marathoner.
        </p>
      </section>
    );
  }

  if (reviewedPlan === null) return null;

  const presentation = outcome === null ? null : outcomePresentation(outcome);
  const statusMessage =
    operation === "submitting"
      ? "Approving this plan..."
      : operation === "resolving"
        ? "Checking the original approval..."
        : operation === "reloading"
          ? "Approval confirmed. Loading your active plan..."
          : null;

  return (
    <section
      className="plan-approval-state confirmation"
      aria-labelledby={`${idPrefix}-confirmation-title`}
    >
      <p className="plan-approval-eyebrow">Final confirmation</p>
      <h2
        id={`${idPrefix}-confirmation-title`}
        ref={confirmationHeadingRef}
        tabIndex={-1}
      >
        Activate {reviewedPlan.proposal.name}?
      </h2>
      <p>
        Approving makes this exact reviewed proposal your active training plan
        and adds its workouts to your calendar.
      </p>
      {expectedActivePlanRevision !== null && (
        <p>Your current active plan will be archived when this one is approved.</p>
      )}

      <dl className="plan-approval-summary" aria-label="Plan being activated">
        <div>
          <dt>Starts</dt>
          <dd>{formatDate(reviewedPlan.proposal.startDate)}</dd>
        </div>
        <div>
          <dt>Race day</dt>
          <dd>{formatDate(reviewedPlan.proposal.targetRaceDate)}</dd>
        </div>
        <div>
          <dt>Schedule</dt>
          <dd>
            {formatCount(reviewedPlan.proposal.weeks.length, "week")} ·{" "}
            {formatCount(workoutCount(reviewedPlan.proposal), "workout")}
          </dd>
        </div>
      </dl>

      {statusMessage !== null && (
        <p className="plan-approval-pending" role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}

      {presentation !== null && (
        <div
          ref={outcomeRef}
          className="plan-approval-outcome"
          role="alert"
          tabIndex={-1}
        >
          <h3>{presentation.title}</h3>
          <p>{presentation.message}</p>
        </div>
      )}

      {reloadFailed && (
        <div
          ref={outcomeRef}
          className="plan-approval-outcome"
          role="alert"
          tabIndex={-1}
        >
          <h3>The plan is active, but this screen is out of date</h3>
          <p>
            Marathoner confirmed the approval but could not reload your training
            data. Reload it again; do not approve the plan a second time.
          </p>
        </div>
      )}

      <div className="plan-approval-actions">
        {!resolutionRequired && approvalReceipt === null && (
          <>
            <button
              type="button"
              className="secondary"
              disabled={pending}
              onClick={onReviewInputs}
            >
              Review inputs
            </button>
            {outcome === null && (
              <button
                type="button"
                className="secondary"
                disabled={pending}
                onClick={() => setScreen("proposal")}
              >
                Back to plan details
              </button>
            )}
            {(outcome === null || presentation?.canRetryApproval) && (
              <button
                type="button"
                disabled={pending}
                onClick={() => void submitApproval()}
              >
                {outcome === null ? "Approve and activate" : "Try approval again"}
              </button>
            )}
          </>
        )}

        {resolutionRequired && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void resolveApproval()}
          >
            Check original approval
          </button>
        )}

        {reloadFailed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void retryTrainingReload()}
          >
            Reload training data
          </button>
        )}
      </div>
    </section>
  );
}
