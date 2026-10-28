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
import InternalSessionDraftFeedbackRehearsal from "./InternalSessionDraftFeedbackRehearsal";
import InternalSessionPlanSchedule from "./InternalSessionPlanSchedule";
import { createInternalAdaptationScenarioPacket } from "./internalAdaptationScenarioPacket";
import { createInternalPlanProposalRehearsalRuleSet } from "./internalPlanProposalRehearsalRules";
import { createInternalSafetyEscalationPacket } from "./internalSafetyEscalationPacket";
import { useInternalSessionPlanProjection } from "./useInternalSessionPlanProjection";

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
  readonly onSessionAdaptationStateChange: (isActive: boolean) => void;
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
  onSessionAdaptationStateChange,
}: InternalPlanProposalRehearsalLiveProps) {
  const baseSessionPlanProjection = useMemo(
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
  const {
    sessionPlanProjection,
    isSessionAdaptationActive,
    handleSessionAdaptationProjectionChange,
  } = useInternalSessionPlanProjection(
    sessionDraftPlan,
    baseSessionPlanProjection,
  );

  useEffect(() => {
    onSessionPlanProjectionChange(sessionPlanProjection);
  }, [onSessionPlanProjectionChange, sessionPlanProjection]);

  useEffect(() => {
    onSessionAdaptationStateChange(isSessionAdaptationActive);
  }, [isSessionAdaptationActive, onSessionAdaptationStateChange]);

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
        isSessionAdaptationActive={isSessionAdaptationActive}
      />
      <InternalPlanProposalRehearsal
        profile={profile}
        ruleSet={ruleSet}
        onSessionActivationChange={onSessionDraftPlanChange}
      />
      <InternalSessionPlanSchedule
        projection={sessionPlanProjection}
        distanceUnit={profile?.preferredDistanceUnit ?? "mile"}
        isAdapted={isSessionAdaptationActive}
      />
      <InternalSessionDraftFeedbackRehearsal
        projection={baseSessionPlanProjection}
        runs={runs}
        distanceUnit={profile?.preferredDistanceUnit ?? "mile"}
        draftPacket={adaptationPacket}
        planRuleSet={ruleSet}
        onSessionProjectionChange={handleSessionAdaptationProjectionChange}
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
