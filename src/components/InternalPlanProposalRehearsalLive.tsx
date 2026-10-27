import internalRulesText from "virtual:internal-plan-rehearsal-rules";
import internalAdaptationPacketText from "virtual:internal-adaptation-rehearsal-packet";
import {
  createIanaTimeZone,
  type ActivePlanState,
  type CompletedRun,
  type PlannedWorkout,
  type TrainingPlan,
  type UserId,
  type UserProfile,
} from "../domain/training";
import InternalAdaptationHistoryInspector from "./InternalAdaptationHistoryInspector";
import InternalAdaptationScenarioRehearsal from "./InternalAdaptationScenarioRehearsal";
import InternalPlanProposalRehearsal from "./InternalPlanProposalRehearsal";
import { createInternalAdaptationScenarioPacket } from "./internalAdaptationScenarioPacket";
import { createInternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";

interface InternalPlanProposalRehearsalLiveProps {
  readonly ownerId: UserId;
  readonly profile: UserProfile | null;
  readonly activePlanState: ActivePlanState | null;
  readonly plans: readonly TrainingPlan[];
  readonly workouts: readonly PlannedWorkout[];
  readonly runs: readonly CompletedRun[];
}

const utcTimeZone = createIanaTimeZone("UTC");

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
  ownerId,
  profile,
  activePlanState,
  plans,
  workouts,
  runs,
}: InternalPlanProposalRehearsalLiveProps) {
  if (ruleSet === null || adaptationPacket === null) return null;

  return (
    <>
      <InternalPlanProposalRehearsal profile={profile} ruleSet={ruleSet} />
      <InternalAdaptationHistoryInspector
        ownerId={ownerId}
        activePlanState={activePlanState}
        plans={plans}
        workouts={workouts}
        runs={runs}
        timeZone={profile?.timeZone ?? utcTimeZone}
      />
      <InternalAdaptationScenarioRehearsal packet={adaptationPacket} />
    </>
  );
}
