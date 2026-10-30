import { useId } from "react";
import type { PlanApprovalReceiptResult } from "../domain/materialCommands/contract";
import type {
  DistanceMeters,
  DistanceUnit,
  PlanGenerationReasonCode,
  PlanGenerationInputV1,
  PlanGenerationResultV1,
  PlanSupportRulesV1,
  UnsupportedPlanGenerationResultV1,
} from "../domain/training";
import {
  createDistanceMeters,
  metersToKilometers,
  metersToMiles,
} from "../domain/training";
import type { PlanApprovalClient } from "../services/planApprovalClient";
import PlanApprovalReview from "./PlanApprovalReview";
import ProposedPlanSummary from "./ProposedPlanSummary";

type PlanGenerationResultViewProps = {
  readonly result: PlanGenerationResultV1;
  readonly input: PlanGenerationInputV1;
  readonly distanceUnit: DistanceUnit;
  readonly supportRules: Pick<
    PlanSupportRulesV1,
    | "minimumConsistentRunningWeeks"
    | "currentWeeklyDistanceMeters"
    | "currentRunningFrequencyDaysPerWeek"
    | "longestRecentRunDistanceMeters"
    | "minimumAvailableTrainingDays"
    | "wholeWeeksFromPlanStartToRace"
    | "reasonCodes"
  >;
  readonly onReviewInputs: () => void;
  readonly approval?: {
    readonly expectedActivePlanRevision: number | null;
    readonly client: PlanApprovalClient;
    readonly reloadTrainingData: () => Promise<void>;
    readonly onApproved: (receipt: PlanApprovalReceiptResult) => void;
    readonly createCommandId?: () => string;
  };
};

type NoPlanStateProps = {
  readonly kind: "unsupported" | "invalid-input";
  readonly title: string;
  readonly message: string;
  readonly reasons?: readonly string[];
  readonly onReviewInputs: () => void;
};

function NoPlanState({
  kind,
  title,
  message,
  reasons,
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
        {reasons !== undefined && reasons.length > 0 && (
          <>
            <p className="plan-result-reasons-heading">What needs review:</p>
            <ul className="plan-result-reasons">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      <button type="button" onClick={onReviewInputs}>
        Review inputs
      </button>
    </section>
  );
}

function formatDistanceValue(
  distance: DistanceMeters,
  unit: DistanceUnit,
): string {
  const converted =
    unit === "mile"
      ? metersToMiles(distance)
      : metersToKilometers(distance);
  return Number(converted.toFixed(1)).toString();
}

function distanceUnitLabel(unit: DistanceUnit): string {
  return unit === "mile" ? "miles" : "kilometers";
}

function formatDistance(
  distance: DistanceMeters,
  unit: DistanceUnit,
): string {
  return `${formatDistanceValue(distance, unit)} ${distanceUnitLabel(unit)}`;
}

function formatDistanceRange(
  range: { readonly minimum: number; readonly maximum: number },
  unit: DistanceUnit,
): string {
  const minimum = formatDistanceValue(
    createDistanceMeters(range.minimum),
    unit,
  );
  const maximum = formatDistanceValue(
    createDistanceMeters(range.maximum),
    unit,
  );
  return `${minimum}–${maximum} ${distanceUnitLabel(unit)}`;
}

function unsupportedPlanReasons(
  result: UnsupportedPlanGenerationResultV1,
  input: PlanGenerationInputV1,
  rules: PlanGenerationResultViewProps["supportRules"],
  distanceUnit: DistanceUnit,
): string[] {
  const { runner } = input;
  const explanations = new Map<PlanGenerationReasonCode, () => string>([
    [
      rules.reasonCodes.cohortGate,
      () =>
        "Your saved goal does not match the first-marathon completion plan.",
    ],
    [
      rules.reasonCodes.experience,
      () =>
        "This plan currently supports runners who are running consistently.",
    ],
    [
      rules.reasonCodes.consistencyDuration,
      () => {
        if (runner.consistentRunningWeeks === undefined) {
          return `Add how many consecutive weeks you have been running; this plan requires at least ${rules.minimumConsistentRunningWeeks}.`;
        }

        return `Your saved consistency is ${runner.consistentRunningWeeks} weeks; this plan requires at least ${rules.minimumConsistentRunningWeeks} consecutive weeks.`;
      },
    ],
    [
      rules.reasonCodes.weeklyDistance,
      () =>
        `Your saved weekly distance is ${formatDistance(runner.currentWeeklyDistance, distanceUnit)}; this plan supports ${formatDistanceRange(rules.currentWeeklyDistanceMeters, distanceUnit)} per week.`,
    ],
    [
      rules.reasonCodes.runFrequency,
      () =>
        `Your saved running frequency is ${runner.currentRunningFrequencyDaysPerWeek} days per week; this plan supports ${rules.currentRunningFrequencyDaysPerWeek.minimum}–${rules.currentRunningFrequencyDaysPerWeek.maximum}.`,
    ],
    [
      rules.reasonCodes.longestRun,
      () =>
        `Your saved longest recent run is ${formatDistance(runner.longestRecentRunDistance, distanceUnit)}; this plan supports ${formatDistanceRange(rules.longestRecentRunDistanceMeters, distanceUnit)}.`,
    ],
    [
      rules.reasonCodes.raceDateRequired,
      () =>
        "An exact marathon date is required; a target window is not supported yet.",
    ],
    [
      rules.reasonCodes.raceHorizon,
      () =>
        `The selected start date must be ${rules.wholeWeeksFromPlanStartToRace.minimum}–${rules.wholeWeeksFromPlanStartToRace.maximum} whole weeks before race day.`,
    ],
    [
      rules.reasonCodes.raceAlignment,
      () =>
        "The selected start date must align with your marathon date and preferred long-run day.",
    ],
    [
      rules.reasonCodes.availability,
      () =>
        `This plan needs at least ${rules.minimumAvailableTrainingDays} available training days that fit your preferred long-run day.`,
    ],
    [
      rules.reasonCodes.scheduleConstraint,
      () =>
        "This plan cannot account for written schedule constraints yet. Keep them saved if they still apply.",
    ],
  ]);
  const reasons = result.reasonCodes.flatMap((reasonCode) => {
    const explanation = explanations.get(reasonCode);
    return explanation === undefined ? [] : [explanation()];
  });

  if (reasons.length !== result.reasonCodes.length || reasons.length === 0) {
    reasons.push(
      "At least one saved detail is outside this plan’s supported boundary.",
    );
  }

  return reasons;
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
      if (props.approval === undefined) {
        return (
          <ProposedPlanSummary
            result={result}
            onReviewInputs={onReviewInputs}
          />
        );
      }
      return (
        <PlanApprovalReview
          input={props.input}
          result={result}
          expectedActivePlanRevision={
            props.approval.expectedActivePlanRevision
          }
          approvalClient={props.approval.client}
          reloadTrainingData={props.approval.reloadTrainingData}
          onReviewInputs={onReviewInputs}
          onApproved={props.approval.onApproved}
          createCommandId={props.approval.createCommandId}
        />
      );
    case "unsupported":
      return (
        <NoPlanState
          kind="unsupported"
          title="A plan wasn’t created"
          message="Marathoner can’t safely create a plan from these details yet. Review your inputs before trying again."
          reasons={unsupportedPlanReasons(
            result,
            props.input,
            props.supportRules,
            props.distanceUnit,
          )}
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
