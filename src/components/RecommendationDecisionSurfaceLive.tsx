import { getClosedBetaProvisionalMethodologyManifest } from "../domain/methodology/closedBetaProvisionalMethodologyRegistry";
import {
  resolveClosedBetaRecommendationDecisionReviewModel,
  resolveRecommendationDecisionReviewModel,
} from "../recommendations/recommendationDecisionReviewContent";
import { firebaseRecommendationDecisionClient } from "../services/firebaseRecommendationDecisionClient";
import RecommendationDecisionInbox from "./RecommendationDecisionInbox";

export default function RecommendationDecisionSurfaceLive() {
  const manifest = getClosedBetaProvisionalMethodologyManifest();
  return (
    <RecommendationDecisionInbox
      decisionClient={firebaseRecommendationDecisionClient}
      resolveReviewModel={(evidence) =>
        manifest === null
          ? resolveRecommendationDecisionReviewModel(evidence)
          : resolveClosedBetaRecommendationDecisionReviewModel(
              evidence,
              manifest,
            )
      }
    />
  );
}
