import { resolveRecommendationDecisionReviewModel } from "../recommendations/recommendationDecisionReviewContent";
import { firebaseRecommendationDecisionClient } from "../services/firebaseRecommendationDecisionClient";
import RecommendationDecisionInbox from "./RecommendationDecisionInbox";

export default function RecommendationDecisionSurfaceLive() {
  return (
    <RecommendationDecisionInbox
      decisionClient={firebaseRecommendationDecisionClient}
      resolveReviewModel={resolveRecommendationDecisionReviewModel}
    />
  );
}
