import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import NextWorkoutSummary from "../../src/components/NextWorkoutSummary";
import Subtitle from "../../src/components/Subtitle";
import Title from "../../src/components/Title";
import TrainingSectionNavigation from "../../src/components/TrainingSectionNavigation";
import SignedInAppHeader from "../../src/components/SignedInAppHeader";
import SignedInStartupScreen from "../../src/components/SignedInStartupScreen";
import {
  trainingSections,
  type TrainingSection,
} from "../../src/components/trainingSections";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Signed-in home viewport fixture root was not found.");
}

export function SignedInHomeFixture() {
  const [activeSection, setActiveSection] = useState<TrainingSection | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const activeDetails = trainingSections.find(({ id }) => id === activeSection);
  const search = new URLSearchParams(window.location.search);
  const setupComplete = search.get("setup") !== "incomplete";
  const startupMode = search.get("startup");
  const openSection = (section: TrainingSection) => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    setActiveSection(section);
  };

  if (startupMode !== null) {
    return (
      <main className="main signed-in-home">
        <SignedInStartupScreen
          delayed={startupMode === "delayed"}
          onRetry={() => setRetryCount((count) => count + 1)}
        />
        {retryCount > 0 && <p role="alert">Retry requested</p>}
      </main>
    );
  }

  return (
    <main
      className={`main${
        activeSection === null ? " signed-in-home" : ""
      }`}
    >
      <SignedInAppHeader
        email="runner@example.com"
        onOpenAccountSettings={() => undefined}
        onLogout={() => undefined}
      />

      {activeSection === null && (
        <>
          <Title />
          <Subtitle />
          <div className="runner-profile-entry">
            <button type="button">
              {setupComplete ? "Edit runner profile" : "Resume runner setup"}
            </button>
            <p>
              {setupComplete
                ? "Your first-marathon starting point is saved."
                : "Your saved progress is safe; finish setup before a plan can be evaluated."}
            </p>
          </div>
          <NextWorkoutSummary
            plan={null}
            workout={null}
            distanceUnit="mile"
            onOpenPlan={() => openSection("plan")}
          />
        </>
      )}

      {setupComplete && (
        <TrainingSectionNavigation
          activeSection={activeSection}
          transitionDuration={0}
          onSelectHome={() => setActiveSection(null)}
          onSelect={openSection}
        />
      )}

      {activeSection === null && (
        <section
          aria-label="Additional signed-in content"
          style={{
            display: "grid",
            flex: "0 0 auto",
            minHeight: "50rem",
            placeItems: "end center",
            width: "100%",
          }}
        >
          <button type="button">Final signed-in action</button>
        </section>
      )}

      {activeSection !== null && activeDetails && (
        <section
          id={`${activeSection}-panel`}
          className="section-panel"
          aria-label={activeDetails.title}
        >
          <div className="section-panel-content">
            <section
              aria-label={`${activeDetails.label} sample content`}
              style={{
                display: "grid",
                minHeight: "60rem",
                placeItems: "end center",
              }}
            >
              <button type="button">Final section action</button>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}

createRoot(root).render(<SignedInHomeFixture />);
