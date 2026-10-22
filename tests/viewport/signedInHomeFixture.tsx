import { createRoot } from "react-dom/client";
import "../../src/index.css";
import NextWorkoutSummary from "../../src/components/NextWorkoutSummary";
import Subtitle from "../../src/components/Subtitle";
import Title from "../../src/components/Title";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Signed-in home viewport fixture root was not found.");
}

createRoot(root).render(
  <main className="main signed-in-home">
    <div className="session-controls">
      <p className="session-user">Signed in as runner@example.com</p>
      <button type="button" className="account-settings-btn">
        Account settings
      </button>
      <button type="button" className="logout-btn">
        Log out
      </button>
    </div>
    <Title />
    <Subtitle />
    <div className="runner-profile-entry">
      <button type="button">Resume runner setup</button>
      <p>
        Your saved progress is safe; finish setup before a plan can be evaluated.
      </p>
    </div>
    <NextWorkoutSummary
      plan={null}
      workout={null}
      distanceUnit="mile"
      onOpenPlan={() => undefined}
    />
    <nav className="section-navigation" aria-label="Training sections">
      {[
        ["plan", "Plan"],
        ["track", "Track"],
        ["analyze", "Analyze"],
      ].map(([id, label]) => (
        <button
          key={id}
          type="button"
          className="section-trigger"
          aria-controls={`${id}-panel`}
          aria-expanded="false"
        >
          {label}
        </button>
      ))}
    </nav>
  </main>,
);
