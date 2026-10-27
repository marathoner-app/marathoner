import internalRulesText from "virtual:internal-plan-rehearsal-rules";
import internalAdaptationPacketText from "virtual:internal-adaptation-rehearsal-packet";
import type { UserProfile } from "../domain/training";
import InternalAdaptationScenarioRehearsal from "./InternalAdaptationScenarioRehearsal";
import InternalPlanProposalRehearsal from "./InternalPlanProposalRehearsal";
import { createInternalAdaptationScenarioPacket } from "./internalAdaptationScenarioPacket";
import { createInternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";

interface InternalPlanProposalRehearsalLiveProps {
  readonly profile: UserProfile | null;
}

const ruleSet =
  internalRulesText === null
    ? null
    : createInternalPlanProposalRehearsalRuleSet(internalRulesText);
const adaptationPacket =
  internalAdaptationPacketText === null
    ? null
    : createInternalAdaptationScenarioPacket(
        internalAdaptationPacketText.rulesText,
        internalAdaptationPacketText.fixturesText,
      );

export default function InternalPlanProposalRehearsalLive({
  profile,
}: InternalPlanProposalRehearsalLiveProps) {
  if (ruleSet === null || adaptationPacket === null) return null;

  return (
    <>
      <InternalPlanProposalRehearsal profile={profile} ruleSet={ruleSet} />
      <InternalAdaptationScenarioRehearsal packet={adaptationPacket} />
    </>
  );
}
