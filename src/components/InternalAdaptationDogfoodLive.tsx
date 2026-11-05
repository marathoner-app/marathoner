import type {
  ActivePlanState,
  CompletedRun,
  PlannedWorkout,
} from "../domain/training/types";
import { firebaseInternalAdaptationRecommendationClient } from "../services/firebaseInternalAdaptationRecommendationClient";
import InternalAdaptationDogfood from "./InternalAdaptationDogfood";

interface InternalAdaptationDogfoodLiveProps {
  readonly activePlanState: ActivePlanState | null;
  readonly workouts: readonly PlannedWorkout[];
  readonly runs: readonly CompletedRun[];
}

export default function InternalAdaptationDogfoodLive(
  props: InternalAdaptationDogfoodLiveProps,
) {
  return (
    <InternalAdaptationDogfood
      {...props}
      client={firebaseInternalAdaptationRecommendationClient}
    />
  );
}
