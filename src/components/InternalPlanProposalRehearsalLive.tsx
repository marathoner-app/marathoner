import internalRulesText from "virtual:internal-plan-rehearsal-rules";
import type { UserProfile } from "../domain/training";
import InternalPlanProposalRehearsal from "./InternalPlanProposalRehearsal";
import { createInternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";

interface InternalPlanProposalRehearsalLiveProps {
  readonly profile: UserProfile | null;
}

const ruleSet =
  internalRulesText === null
    ? null
    : createInternalPlanProposalRehearsalRuleSet(internalRulesText);

export default function InternalPlanProposalRehearsalLive({
  profile,
}: InternalPlanProposalRehearsalLiveProps) {
  if (ruleSet === null) return null;

  return <InternalPlanProposalRehearsal profile={profile} ruleSet={ruleSet} />;
}
