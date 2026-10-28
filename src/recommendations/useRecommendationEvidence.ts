import { useContext } from "react";

import { RecommendationEvidenceContext } from "./RecommendationEvidenceContext";

export function useRecommendationEvidence() {
  const value = useContext(RecommendationEvidenceContext);

  if (value === undefined) {
    throw new Error(
      "useRecommendationEvidence must be used within RecommendationEvidenceProvider.",
    );
  }

  return value;
}
