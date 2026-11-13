import provisionalRulesText from "virtual:provisional-plan-dogfood-rules";
import closedBetaRulesText from "virtual:closed-beta-provisional-plan-rules";
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

if (provisionalRulesText !== null && closedBetaRulesText !== null) {
  throw new Error(
    "Plan proposal rules cannot be enabled for dogfood and closed beta together.",
  );
}

const rulesText = closedBetaRulesText ?? provisionalRulesText;
const ruleSet =
  rulesText === null
    ? null
    : createInternalPlanProposalRehearsalRuleSet(rulesText);
const provisionalContext =
  closedBetaRulesText === null ? "owner_dogfood" : "closed_beta";

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
      provisionalContext={provisionalContext}
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
