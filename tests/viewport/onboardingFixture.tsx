import { createRoot } from "react-dom/client";
import "../../src/index.css";
import RunnerOnboarding from "../../src/onboarding/RunnerOnboarding";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Runner setup viewport fixture root was not found.");
}

createRoot(root).render(
  <RunnerOnboarding
    profile={null}
    onSave={async () => {
      throw new Error("The viewport fixture does not save runner profiles.");
    }}
    onClose={() => undefined}
  />,
);
