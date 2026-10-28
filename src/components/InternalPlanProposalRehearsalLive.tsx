import { useEffect, useMemo } from "react";
import internalRulesText from "virtual:internal-plan-rehearsal-rules";
import internalAdaptationPacketText from "virtual:internal-adaptation-rehearsal-packet";
import internalSafetyPacketText from "virtual:internal-safety-escalation-packet";
import {
  createIanaTimeZone,
  createTrainingPlanId,
  createUtcDateTime,
  projectGeneratedPlanEntities,
  type ActivePlanState,
  type CompletedRun,
  type GeneratedPlanEntityProjection,
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
import InternalSessionPlanSchedule from "./InternalSessionPlanSchedule";
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
  readonly sessionDraftPlan: GeneratedPlanResultV1 | null;
  readonly onSessionDraftPlanChange: (
    plan: GeneratedPlanResultV1 | null,
  ) => void;
  readonly onSessionPlanProjectionChange: (
    projection: GeneratedPlanEntityProjection | null,
  ) => void;
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
  sessionDraftPlan,
  onSessionDraftPlanChange,
  onSessionPlanProjectionChange,
}: InternalPlanProposalRehearsalLiveProps) {
  const sessionPlanProjection = useMemo(
    () =>
      sessionDraftPlan === null
        ? null
        : projectGeneratedPlanEntities({
            proposal: sessionDraftPlan.plan,
            ownerId,
            planId: createTrainingPlanId("internal-session-draft"),
            projectedAt: createUtcDateTime(new Date().toISOString()),
            status: "active",
          }),
    [ownerId, sessionDraftPlan],
  );

  useEffect(() => {
    onSessionPlanProjectionChange(sessionPlanProjection);
  }, [onSessionPlanProjectionChange, sessionPlanProjection]);

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
        onSessionActivationChange={onSessionDraftPlanChange}
      />
      <InternalSessionPlanSchedule
        projection={sessionPlanProjection}
        distanceUnit={profile?.preferredDistanceUnit ?? "mile"}
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
