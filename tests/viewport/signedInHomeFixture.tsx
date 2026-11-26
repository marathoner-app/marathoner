import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import NextWorkoutSummary from "../../src/components/NextWorkoutSummary";
import TrainingSectionNavigation from "../../src/components/TrainingSectionNavigation";
import SignedInAppHeader from "../../src/components/SignedInAppHeader";
import SignedInStartupScreen from "../../src/components/SignedInStartupScreen";
import RunnerOnboarding from "../../src/onboarding/RunnerOnboarding";
import {
  createDateOnly,
  createDistanceMeters,
  createDurationSeconds,
  createPlannedWorkoutId,
  createTrainingPlanId,
  type TrainingPlan,
  type PlannedWorkout,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  type UserProfile,
} from "../../src/domain/training";
import {
  trainingSections,
  type TrainingSection,
} from "../../src/components/trainingSections";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Signed-in home viewport fixture root was not found.");
}

const fixtureTimestamp = createUtcDateTime("2026-11-19T12:00:00Z");
const completeProfile: UserProfile = {
  id: createUserId("viewport-runner"),
  displayName: "Runner",
  preferredDistanceUnit: "mile",
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  experienceLevel: "consistent",
  consistentRunningWeeks: 12,
  targetRace: { kind: "date", date: createDateOnly("2027-05-02") },
  currentWeeklyDistance: createDistanceMeters(32_187),
  currentRunningFrequencyDaysPerWeek: 4,
  longestRecentRunDistance: createDistanceMeters(16_093),
  availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
  preferredLongRunDay: "sunday",
  completionGoal: "complete_first_marathon",
  createdAt: fixtureTimestamp,
  updatedAt: fixtureTimestamp,
};

const samplePlan: TrainingPlan = {
  id: createTrainingPlanId("viewport-home-plan"),
  userId: completeProfile.id,
  name: "First Marathon Journey",
  startDate: createDateOnly("2026-11-23"),
  targetRaceDate: createDateOnly("2027-05-02"),
  status: "active",
  createdAt: fixtureTimestamp,
  updatedAt: fixtureTimestamp,
};
const sampleWorkout: PlannedWorkout = {
  id: createPlannedWorkoutId("viewport-home-workout"),
  userId: completeProfile.id,
  planId: samplePlan.id,
  scheduledDate: createDateOnly("2026-11-26"),
  kind: "run",
  purpose: "tempo",
  phase: "base_building",
  status: "planned",
  targetDistance: createDistanceMeters(8_000),
  targetDuration: createDurationSeconds(2_700),
  createdAt: fixtureTimestamp,
  updatedAt: fixtureTimestamp,
};

export function SignedInHomeFixture() {
  const [activeSection, setActiveSection] = useState<TrainingSection | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const activeDetails = trainingSections.find(({ id }) => id === activeSection);
  const search = new URLSearchParams(window.location.search);
  const preview = search.get("preview") === "1";
  const setupComplete = search.get("setup") !== "incomplete";
  const startupMode = search.get("startup");
  const openSection = (section: TrainingSection) => {
    if (preview) {
      window.location.href = `${section}.html?shell=1&mode=dashboard`;
      return;
    }
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
          <div className="training-page-header signed-in-home-heading">
            <h1 className="title">Home</h1>
          </div>
          <div className="home-training-overview">
          <NextWorkoutSummary
            plan={search.has("workout") ? samplePlan : null}
            workout={search.has("workout") ? sampleWorkout : null}
            distanceUnit="mile"
            onOpenPlan={() => openSection("plan")}
          />
          <div className="runner-profile-entry">
            <h2>Runner profile</h2>

            <p>
              {setupComplete
                ? "Your first-marathon starting point is saved."
                : "Your saved progress is safe; finish setup before a plan can be evaluated."}
            </p>

            <button type="button" onClick={() => setOnboardingOpen(true)}>
              {setupComplete ? "Edit runner profile" : "Resume runner setup"}
            </button>
          </div>
          </div>
        </>
      )}

      {setupComplete && (
        <TrainingSectionNavigation
          activeSection={activeSection}
          interactionLocked={onboardingOpen}
          onSelectHome={() => setActiveSection(null)}
          onSelect={openSection}
        />
      )}

      {activeSection === null && !preview && (
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
              <button type="button" onClick={() => setOnboardingOpen(true)}>
                Review runner setup
              </button>
              <button type="button">Final section action</button>
            </section>
          </div>
        </section>
      )}

      {onboardingOpen && (
        <RunnerOnboarding
          profile={completeProfile}
          onSave={async () => completeProfile}
          onClose={() => setOnboardingOpen(false)}
        />
      )}
    </main>
  );
}

createRoot(root).render(<SignedInHomeFixture />);
