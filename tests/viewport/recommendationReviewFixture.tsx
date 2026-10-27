import { createRoot } from "react-dom/client";

import RecommendationDecisionReview from "../../src/components/RecommendationDecisionReview";
import "../../src/index.css";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Recommendation review viewport fixture root was not found.");
}

createRoot(root).render(
  <RecommendationDecisionReview
    model={{
      title: "Give next week another steady pass",
      observation:
        "This synthetic fixture recorded two harder-than-expected runs in the current week.",
      meaning:
        "The fixture reached an internal threshold for reviewing the next progression.",
      recommendation:
        "Repeat the current week’s planned targets once before progressing.",
      impact:
        "The race date and every later training week remain unchanged in this preview.",
      contentState: "internal_preview",
    }}
    state={{ kind: "ready" }}
    onKeep={() => undefined}
    onApply={() => undefined}
    onRetry={() => undefined}
  />,
);
