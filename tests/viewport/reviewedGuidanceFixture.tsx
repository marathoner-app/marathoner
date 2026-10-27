import { createRoot } from "react-dom/client";

import ReviewedGuidanceCard from "../../src/components/ReviewedGuidanceCard";
import "../../src/index.css";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Reviewed guidance viewport fixture root was not found.");
}

createRoot(root).render(
  <ReviewedGuidanceCard
    model={{
      title: "Use effort, not pace, on easy days",
      message:
        "This synthetic example explains that an easy run should feel controlled enough for a short conversation.",
      limitations: [
        "This example does not prescribe a pace or diagnose why a run feels difficult.",
        "Stop and seek qualified help for pain or unusual symptoms.",
      ],
      contextLabel: "After an easy run",
      contentState: "internal_preview",
    }}
    state={{ kind: "ready" }}
    onDismiss={() => undefined}
    onRetry={() => undefined}
  />,
);
