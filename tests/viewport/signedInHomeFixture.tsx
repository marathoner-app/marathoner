import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import NextWorkoutSummary from "../../src/components/NextWorkoutSummary";
import Subtitle from "../../src/components/Subtitle";
import Title from "../../src/components/Title";
import TrainingSectionNavigation from "../../src/components/TrainingSectionNavigation";
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
  const activeDetails = trainingSections.find(({ id }) => id === activeSection);

  return (
    <main className={`main${activeSection === null ? " signed-in-home" : ""}`}>
      {activeSection === null && (
        <>
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
              Your saved progress is safe; finish setup before a plan can be
              evaluated.
            </p>
          </div>
          <NextWorkoutSummary
            plan={null}
            workout={null}
            distanceUnit="mile"
            onOpenPlan={() => setActiveSection("plan")}
          />
          <TrainingSectionNavigation
            activeSection={null}
            transitionDuration={0}
            onSelect={setActiveSection}
          />
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
        </>
      )}

      {activeSection !== null && activeDetails && (
        <section
          id={`${activeSection}-panel`}
          className="section-panel"
          aria-labelledby={`${activeSection}-panel-title`}
        >
          <div className="section-panel-content">
            <button
              type="button"
              className="close"
              aria-label={`Close ${activeDetails.title} panel`}
              onClick={() => setActiveSection(null)}
            >
              <span aria-hidden="true">X</span>
            </button>
            <h1 id={`${activeSection}-panel-title`} className="section-heading">
              {activeDetails.title}
            </h1>
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

      {activeSection !== null && (
        <TrainingSectionNavigation
          activeSection={activeSection}
          transitionDuration={0}
          onSelect={setActiveSection}
        />
      )}
    </main>
  );
}

createRoot(root).render(<SignedInHomeFixture />);
