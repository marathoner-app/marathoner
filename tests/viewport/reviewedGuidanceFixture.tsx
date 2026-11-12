import { createRoot } from "react-dom/client";

import ReviewedGuidanceCard from "../../src/components/ReviewedGuidanceCard";
import "../../src/index.css";
import { closedBetaMethodologyManifestFixture } from "../../src/test/closedBetaMethodologyManifest";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Reviewed guidance viewport fixture root was not found.");
}

const safetyFixture = new URL(window.location.href).searchParams.has("safety");

createRoot(root).render(
  <ReviewedGuidanceCard
    model={
      safetyFixture
        ? {
            title: "Pause training and get urgent help",
            message:
              "Your symptoms need attention before you continue training.",
            limitations: [
              "Do not use Marathoner as a substitute for medical care.",
              "Call emergency services now if you may be in immediate danger.",
            ],
            contextLabel: "Safety guidance",
            contentState: "reviewed",
            dismissible: false,
            methodologyKind: "safety",
          }
        : {
            title: "Use effort, not pace, on easy days",
            message:
              "This synthetic example explains that an easy run should feel controlled enough for a short conversation.",
            limitations: [
              "This example does not prescribe a pace or diagnose why a run feels difficult.",
              "Stop and seek qualified help for pain or unusual symptoms.",
            ],
            contextLabel: "After an easy run",
            contentState: "reviewed",
          }
    }
    methodologyManifest={closedBetaMethodologyManifestFixture}
    state={{ kind: "ready" }}
    onDismiss={() => undefined}
    onRetry={() => undefined}
  />,
);
