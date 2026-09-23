import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Title from "./components/Title";
import Subtitle from "./components/Subtitle";
import Calendar from "./components/Calendar";
import PublicAccessNotice from "./components/PublicAccessNotice";
import ShoeTracker from "./components/ShoeTracker";
import Analyze from "./components/Analyze";
import { useAuth } from "./auth/useAuth";
import TrainingDataProvider from "./training/TrainingDataProvider";
import { useTrainingData } from "./training/useTrainingData";

const publicSupportEmail = "kevin@marathonerapp.com";

const sections = [
  { id: "plan", label: "Plan", title: "Plan Your Workouts" },
  { id: "track", label: "Track", title: "Track Your Runs" },
  { id: "analyze", label: "Analyze", title: "Analyze Your Progress" },
] as const;

type Section = (typeof sections)[number]["id"];

function App() {
  const auth = useAuth();
  const reduceMotion = useReducedMotion();
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const lastActiveSection = useRef<Section | null>(null);
  const triggerRefs = useRef<Record<Section, HTMLButtonElement | null>>({
    plan: null,
    track: null,
    analyze: null,
  });

  useEffect(() => {
    if (!activeSection && lastActiveSection.current) {
      triggerRefs.current[lastActiveSection.current]?.focus();
      lastActiveSection.current = null;
    }
  }, [activeSection]);

  useEffect(() => {
    if (auth.status !== "signedIn") {
      setActiveSection(null);
      setLogoutError(null);
    }
  }, [auth.status]);

  const openSection = (section: Section) => {
    lastActiveSection.current = section;
    setActiveSection(section);
  };

  const closeSection = () => {
    setActiveSection(null);
  };

  const handleLogout = async () => {
    setLogoutError(null);

    try {
      await auth.logout();
    } catch {
      setLogoutError("We couldn't log you out. Please try again.");
    }
  };

  const activeSectionDetails = sections.find(({ id }) => id === activeSection);

  return (
    <motion.main
      className={`main${auth.status === "signedOut" ? " public-entry" : ""}`}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 1, ease: "easeOut" }}
    >
      {auth.status === "loading" && (
        <>
          <Title />
          <p className="auth-message" role="status">
            Loading your session...
          </p>
        </>
      )}

      {auth.status !== "loading" && !activeSection && (
        <>
          {auth.status === "signedIn" && (
            <div className="session-controls">
              <p className="session-user">
                Signed in as {auth.user.email ?? "Marathoner user"}
              </p>
              <button
                type="button"
                className="logout-btn"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
          <Title />
          <Subtitle />
          {auth.status === "signedOut" && (
            <PublicAccessNotice supportEmail={publicSupportEmail} />
          )}
          {logoutError && (
            <p className="auth-message auth-error" role="alert">
              {logoutError}
            </p>
          )}
        </>
      )}

      {auth.status === "signedIn" && (
        <TrainingDataProvider userId={auth.user.uid}>
          {!activeSection && (
            <nav className="section-navigation" aria-label="Training sections">
              {sections.map(({ id, label }) => (
                <motion.button
                  key={id}
                  ref={(element) => {
                    triggerRefs.current[id] = element;
                  }}
                  type="button"
                  className="section-trigger"
                  aria-controls={`${id}-panel`}
                  aria-expanded="false"
                  onClick={() => openSection(id)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {label}
                </motion.button>
              ))}
            </nav>
          )}

          {activeSection && activeSectionDetails && (
            <motion.section
              id={`${activeSection}-panel`}
              className="section-panel"
              aria-labelledby={`${activeSection}-panel-title`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeSection();
              }}
            >
              <SectionContent
                section={activeSection}
                title={activeSectionDetails.title}
                onClose={closeSection}
              />
            </motion.section>
          )}
        </TrainingDataProvider>
      )}
    </motion.main>
  );
}

type SectionContentProps = {
  section: Section;
  title: string;
  onClose: () => void;
};

function SectionContent({ section, title, onClose }: SectionContentProps) {
  const training = useTrainingData();
  const activePlan =
    training.plans.find((plan) => plan.status === "active") ??
    training.plans.find((plan) => plan.status === "draft") ??
    training.plans.find((plan) => plan.status !== "archived") ??
    null;

  return (
    <motion.div
      className="section-panel-content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button
        type="button"
        onClick={onClose}
        className="close"
        aria-label={`Close ${title} panel`}
        autoFocus
      >
        <span aria-hidden="true">X</span>
      </button>
      <h1 id={`${section}-panel-title`} className="section-heading">{title}</h1>
      {training.status === "loading" && (
        <p className="training-status" role="status">
          Loading your training data...
        </p>
      )}
      {training.status === "error" && (
        <div className="training-error" role="alert">
          <p>{training.error}</p>
          <button type="button" onClick={() => void training.reload()}>
            Try again
          </button>
        </div>
      )}
      {training.status === "ready" && section === "plan" && (
        <Calendar plan={activePlan} workouts={training.workouts} />
      )}
      {training.status === "ready" && section === "track" && (
        <ShoeTracker
          runs={training.runs}
          shoes={training.shoes}
          plannedWorkouts={training.workouts.filter(
            (workout) => workout.planId === activePlan?.id,
          )}
          onCreateShoe={training.createShoe}
          onCreateRun={training.createRun}
          onUpdateRun={training.updateRun}
          onDeleteRun={training.deleteRun}
        />
      )}
      {training.status === "ready" && section === "analyze" && (
        <Analyze runs={training.runs} />
      )}
    </motion.div>
  );
}

export default App;
