import { useCallback, useState } from "react";
import type {
  GeneratedPlanEntityProjection,
  GeneratedPlanResultV1,
} from "../domain/training";

export function useInternalSessionPlanProjection(
  sessionDraftPlan: GeneratedPlanResultV1 | null,
  baseSessionPlanProjection: GeneratedPlanEntityProjection | null,
) {
  const [adaptedSessionProjection, setAdaptedSessionProjection] = useState<{
    readonly sourcePlan: GeneratedPlanResultV1;
    readonly projection: GeneratedPlanEntityProjection;
  } | null>(null);
  const sessionPlanProjection =
    sessionDraftPlan !== null &&
    adaptedSessionProjection?.sourcePlan === sessionDraftPlan
      ? adaptedSessionProjection.projection
      : baseSessionPlanProjection;
  const handleSessionAdaptationProjectionChange = useCallback(
    (projection: GeneratedPlanEntityProjection | null) => {
      setAdaptedSessionProjection(
        projection === null || sessionDraftPlan === null
          ? null
          : { sourcePlan: sessionDraftPlan, projection },
      );
    },
    [sessionDraftPlan],
  );

  return {
    sessionPlanProjection,
    handleSessionAdaptationProjectionChange,
  } as const;
}
