import { lazy, Suspense } from "react";

import { useRecommendationEvidence } from "../recommendations/useRecommendationEvidence";

const RecommendationDecisionSurfaceLive = lazy(
  () => import("./RecommendationDecisionSurfaceLive"),
);

export default function RecommendationDecisionSurface() {
  const recommendationState = useRecommendationEvidence();
  const hasPendingRecommendation = recommendationState.evidence.some(
    ({ decision }) => decision === "pending",
  );

  if (!hasPendingRecommendation) return null;

  return (
    <Suspense
      fallback={
        <p role="status" aria-live="polite">
          Preparing recommendation review…
        </p>
      }
    >
      <RecommendationDecisionSurfaceLive />
    </Suspense>
  );
}
