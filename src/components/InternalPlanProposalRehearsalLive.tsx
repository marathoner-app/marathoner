import { useState } from "react";
import internalRulesText from "virtual:internal-plan-rehearsal-rules";
import internalAdaptationPacketText from "virtual:internal-adaptation-rehearsal-packet";
import internalSafetyPacketText from "virtual:internal-safety-escalation-packet";
import {
  createIanaTimeZone,
  type ActivePlanState,
  type CompletedRun,
  type GeneratedPlanResultV1,
  type PlannedWorkout,
  type TrainingPlan,
  type UserId,
  type UserProfile,
} from "../domain/training";
import InternalDogfoodJourneyOverview from "./InternalDogfoodJourneyOverview";
import InternalAdaptationHistoryInspector from "./InternalAdaptationHistoryInspector";
import InternalAdaptationScenarioRehearsal from "./InternalAdaptationScenarioRehearsal";
import InternalGuidanceReviewGallery from "./InternalGuidanceReviewGallery";
import InternalPlanProposalRehearsal from "./InternalPlanProposalRehearsal";
import InternalSafetyEscalationRehearsal from "./InternalSafetyEscalationRehearsal";
import { createInternalAdaptationScenarioPacket } from "./internalAdaptationScenarioPacket";
import { createInternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";
import { createInternalSafetyEscalationPacket } from "./internalSafetyEscalationPacket";

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
const safetyPacket =
  internalSafetyPacketText === null
    ? null
    : createInternalSafetyEscalationPacket(
        internalSafetyPacketText.rulesText,
        internalSafetyPacketText.fixturesText,
      );

export default function InternalPlanProposalRehearsalLive({
  ownerId,
  profile,
  activePlanState,
  plans,
  workouts,
  runs,
}: InternalPlanProposalRehearsalLiveProps) {
  const [sessionDraftPlan, setSessionDraftPlan] =
    useState<GeneratedPlanResultV1 | null>(null);

  if (ruleSet === null || adaptationPacket === null || safetyPacket === null) {
    return null;
  }

  return (
    <>
      <InternalDogfoodJourneyOverview
        ownerId={ownerId}
        profile={profile}
        activePlanState={activePlanState}
        plans={plans}
        workouts={workouts}
        runs={runs}
        sessionDraftPlan={sessionDraftPlan}
      />
      <InternalPlanProposalRehearsal
        profile={profile}
        ruleSet={ruleSet}
        onSessionActivationChange={setSessionDraftPlan}
      />
      <InternalAdaptationHistoryInspector
        ownerId={ownerId}
        activePlanState={activePlanState}
        plans={plans}
        workouts={workouts}
        runs={runs}
        timeZone={profile?.timeZone ?? utcTimeZone}
        distanceUnit={profile?.preferredDistanceUnit ?? "mile"}
        draftPacket={adaptationPacket}
      />
      <InternalAdaptationScenarioRehearsal packet={adaptationPacket} />
      <InternalGuidanceReviewGallery />
      <InternalSafetyEscalationRehearsal packet={safetyPacket} />
    </>
  );
}
