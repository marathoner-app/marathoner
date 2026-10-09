import { useEffect, useMemo, useRef, useState } from "react";
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
import RunnerOnboarding from "./onboarding/RunnerOnboarding";
import { isRunnerProfileOnboardingComplete } from "./onboarding/runnerProfileDraft";
import {
  AccountDeletionDialog,
  AccountDeletionReceipt,
} from "./components/AccountDeletion";
import type { AccountDeletionRequestAcceptedResult } from "./domain/materialCommands/contract";
import { selectNextPlannedWorkout } from "./domain/training";
import NextWorkoutSummary from "./components/NextWorkoutSummary";

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
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [unresolvedDeletionCommandId, setUnresolvedDeletionCommandId] =
    useState<string | null>(null);
  const [deletionReceipt, setDeletionReceipt] =
    useState<AccountDeletionRequestAcceptedResult | null>(null);
  const [deletionSignOutError, setDeletionSignOutError] = useState<string | null>(
    null,
  );
  const [deletionSignOutAttempt, setDeletionSignOutAttempt] = useState(0);
  const lastActiveSection = useRef<Section | null>(null);
  const accountSettingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreAccountSettingsFocus = useRef(false);
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
      setAccountSettingsOpen(false);
      if (deletionReceipt === null) setUnresolvedDeletionCommandId(null);
    }
  }, [auth.status, deletionReceipt]);

  useEffect(() => {
    if (
      !accountSettingsOpen &&
      restoreAccountSettingsFocus.current &&
      deletionReceipt === null
    ) {
      accountSettingsTriggerRef.current?.focus();
      restoreAccountSettingsFocus.current = false;
    }
  }, [accountSettingsOpen, deletionReceipt]);

  useEffect(() => {
    if (deletionReceipt === null || auth.status !== "signedIn") return;

    let active = true;
    setDeletionSignOutError(null);
    void auth.logout().catch(() => {
      if (active) {
        setDeletionSignOutError(
          "Your deletion request was accepted, but this device could not finish signing out. Your training data remains hidden; try signing out again.",
        );
      }
    });

    return () => {
      active = false;
    };
  }, [auth, deletionReceipt, deletionSignOutAttempt]);

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

  const closeAccountSettings = () => {
    restoreAccountSettingsFocus.current = true;
    setAccountSettingsOpen(false);
  };

  const acceptDeletion = (receipt: AccountDeletionRequestAcceptedResult) => {
    restoreAccountSettingsFocus.current = false;
    setAccountSettingsOpen(false);
    setDeletionReceipt(receipt);
  };

  return (
    <motion.main
      className={`main${auth.status === "signedOut" ? " public-entry" : ""}`}
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 1, ease: "easeOut" }}
    >
      {deletionReceipt && (
        <AccountDeletionReceipt
          receipt={deletionReceipt}
          supportEmail={publicSupportEmail}
          signedOut={auth.status === "signedOut"}
          signOutError={deletionSignOutError}
          onRetrySignOut={() =>
            setDeletionSignOutAttempt((attempt) => attempt + 1)
          }
          onDone={() => setDeletionReceipt(null)}
        />
      )}

      {!deletionReceipt && auth.status === "loading" && (
        <>
          <Title />
          <p className="auth-message" role="status">
            Loading your session...
          </p>
        </>
      )}

      {!deletionReceipt && auth.status === "error" && (
        <>
          <Title />
          <div className="startup-error" role="alert">
            <p>{auth.message}</p>
            <button type="button" onClick={auth.retrySession}>
              Try again
            </button>
          </div>
        </>
      )}

      {!deletionReceipt &&
        (auth.status === "signedIn" || auth.status === "signedOut") &&
        !activeSection && (
          <>
            {auth.status === "signedIn" && (
              <div className="session-controls">
                <p className="session-user">
                  Signed in as {auth.user.email ?? "Marathoner user"}
                </p>
                <button
                  ref={accountSettingsTriggerRef}
                  type="button"
                  className="account-settings-btn"
                  onClick={() => setAccountSettingsOpen(true)}
                >
                  Account settings
                </button>
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

      {!deletionReceipt && auth.status === "signedIn" && (
        <TrainingDataProvider userId={auth.user.uid}>
          <AuthenticatedExperience
            activeSection={activeSection}
            activeSectionDetails={activeSectionDetails}
            onOpenSection={openSection}
            onCloseSection={closeSection}
            onRegisterTrigger={(section, element) => {
              triggerRefs.current[section] = element;
            }}
          />
        </TrainingDataProvider>
      )}

      {!deletionReceipt && auth.status === "signedIn" && accountSettingsOpen && (
        <AccountDeletionDialog
          email={auth.user.email}
          supportEmail={publicSupportEmail}
          unresolvedCommandId={unresolvedDeletionCommandId}
          onAccepted={acceptDeletion}
          onClose={closeAccountSettings}
          onUnresolvedCommandChange={setUnresolvedDeletionCommandId}
        />
      )}
    </motion.main>
  );
}

type AuthenticatedExperienceProps = {
  activeSection: Section | null;
  activeSectionDetails: (typeof sections)[number] | undefined;
  onOpenSection: (section: Section) => void;
  onCloseSection: () => void;
  onRegisterTrigger: (
    section: Section,
    element: HTMLButtonElement | null,
  ) => void;
};

function AuthenticatedExperience({
  activeSection,
  activeSectionDetails,
  onOpenSection,
  onCloseSection,
  onRegisterTrigger,
}: AuthenticatedExperienceProps) {
  const training = useTrainingData();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingDeferred, setOnboardingDeferred] = useState(false);
  const onboardingComplete = isRunnerProfileOnboardingComplete(training.profile);
  const activePlan = useMemo(
    () => training.plans.find((plan) => plan.status === "active") ?? null,
    [training.plans],
  );
  const nextWorkout = useMemo(
    () =>
      training.profile === null
        ? null
        : selectNextPlannedWorkout(
            activePlan,
            training.workouts,
            training.profile.timeZone,
          ),
    [activePlan, training.profile, training.workouts],
  );
  const showOnboarding =
    training.status === "ready" &&
    (isOnboardingOpen || (!onboardingComplete && !onboardingDeferred));

  const closeOnboarding = () => {
    setIsOnboardingOpen(false);
    setOnboardingDeferred(true);
  };

  return (
    <>
      {showOnboarding && (
        <RunnerOnboarding
          profile={training.profile}
          onSave={training.saveProfile}
          onClose={closeOnboarding}
        />
      )}

      {!activeSection && training.status === "loading" && (
        <div className="training-home-status" role="status">
          <p>Loading your training data...</p>
        </div>
      )}

      {!activeSection && training.status === "error" && (
        <div className="training-home-status training-error" role="alert">
          <p>{training.error}</p>
          <button type="button" onClick={() => void training.reload()}>
            Try again
          </button>
        </div>
      )}

      {!activeSection && training.status === "ready" && !showOnboarding && (
        <>
          <div className="runner-profile-entry">
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
            >
              {onboardingComplete ? "Edit runner profile" : "Resume runner setup"}
            </button>
            <p>
              {onboardingComplete
                ? "Your first-marathon starting point is saved."
                : "Your saved progress is safe; finish setup before a plan can be evaluated."}
            </p>
          </div>
          <NextWorkoutSummary
            plan={activePlan}
            workout={nextWorkout}
            distanceUnit={training.profile?.preferredDistanceUnit ?? "mile"}
            onOpenPlan={() => onOpenSection("plan")}
          />
          <nav className="section-navigation" aria-label="Training sections">
            {sections.map(({ id, label }) => (
              <motion.button
                key={id}
                ref={(element) => onRegisterTrigger(id, element)}
                type="button"
                className="section-trigger"
                aria-controls={`${id}-panel`}
                aria-expanded="false"
                onClick={() => onOpenSection(id)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                {label}
              </motion.button>
            ))}
          </nav>
        </>
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
            if (event.key === "Escape") onCloseSection();
          }}
        >
          <SectionContent
            section={activeSection}
            title={activeSectionDetails.title}
            onClose={onCloseSection}
          />
        </motion.section>
      )}
    </>
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
          distanceUnit={training.profile?.preferredDistanceUnit ?? "mile"}
          runs={training.runs}
          shoes={training.shoes}
          plannedWorkouts={training.workouts.filter(
            (workout) => workout.planId === activePlan?.id,
          )}
          onCreateShoe={training.createShoe}
          onRetireShoe={training.retireShoe}
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
