import provisionalRulesText from "virtual:provisional-plan-dogfood-rules";
import type { DateOnly, UserProfile } from "../domain/training";
import type { PlanApprovalReceiptResult } from "../domain/materialCommands/contract";
import { firebasePlanApprovalClient } from "../services/firebasePlanApprovalClient";
import PlanProposalBuilder from "./PlanProposalBuilder";
import { createInternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";

interface PlanProposalBuilderLiveProps {
  readonly profile: UserProfile | null;
  readonly onEditProfile: () => void;
  readonly expectedActivePlanRevision: number | null;
  readonly reloadTrainingData: () => Promise<void>;
  readonly onApproved: (receipt: PlanApprovalReceiptResult) => void;
  readonly today?: DateOnly;
}

const ruleSet =
  provisionalRulesText === null
    ? null
    : createInternalPlanProposalRehearsalRuleSet(provisionalRulesText);

export default function PlanProposalBuilderLive({
  profile,
  onEditProfile,
  expectedActivePlanRevision,
  reloadTrainingData,
  onApproved,
  today,
}: PlanProposalBuilderLiveProps) {
  if (ruleSet === null) return null;

  return (
    <PlanProposalBuilder
      profile={profile}
      generatorVersion={ruleSet.generatorVersion}
      rules={ruleSet.rules}
      onEditProfile={onEditProfile}
      approval={{
        client: firebasePlanApprovalClient,
        expectedActivePlanRevision,
        reloadTrainingData,
        onApproved,
      }}
      today={today}
    />
  );
}
