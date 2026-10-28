import { createContext } from "react";

import type { RecommendationEvidenceV2 } from "../domain/recommendations/recommendationEvidence";

export type RecommendationEvidenceStatus = "loading" | "ready" | "error";

export interface RecommendationEvidenceContextValue {
  readonly status: RecommendationEvidenceStatus;
  readonly evidence: readonly RecommendationEvidenceV2[];
  readonly origin: "cache" | "server" | null;
  readonly hasPendingWrites: boolean;
  readonly error: string | null;
  readonly retry: () => void;
}

export const RecommendationEvidenceContext = createContext<
  RecommendationEvidenceContextValue | undefined
>(undefined);
