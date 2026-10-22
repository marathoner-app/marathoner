import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Title from "./components/Title";
import Subtitle from "./components/Subtitle";
import Calendar from "./components/Calendar";
import PublicLandingPage from "./components/PublicLandingPage";
import ShoeTracker from "./components/ShoeTracker";
import Analyze from "./components/Analyze";
import { useAuth } from "./auth/useAuth";
import TrainingDataProvider from "./training/TrainingDataProvider";
import { useTrainingData } from "./training/useTrainingData";
import useDelayedStaleNotice from "./training/useDelayedStaleNotice";
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
  const [logoutPending, setLogoutPending] = useState(false);
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
      setLogoutPending(false);
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
    setLogoutPending(true);

    try {
      await auth.logout();
    } catch {
      setLogoutPending(false);
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
      className={`main${auth.status === "signedOut" ? " public-entry" : ""}${
        auth.status === "signedIn" && activeSection === null
          ? " signed-in-home"
          : ""
      }`}
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

      {!deletionReceipt && logoutPending && (
        <>
          <Title />
          <p className="auth-message" role="status">
            Signing out...
          </p>
        </>
      )}

      {!deletionReceipt &&
        !logoutPending &&
        (auth.status === "signedIn" || auth.status === "signedOut") &&
        !activeSection && (
          auth.status === "signedOut" ? (
            <PublicLandingPage supportEmail={publicSupportEmail} />
          ) : (
            <>
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
              <Title />
              <Subtitle />
              {logoutError && (
                <p className="auth-message auth-error" role="alert">
                  {logoutError}
                </p>
              )}
            </>
          )
        )}

      {!deletionReceipt && !logoutPending && auth.status === "signedIn" && (
        <TrainingDataProvider key={auth.user.uid} userId={auth.user.uid}>
          <AuthenticatedExperience
            activeSection={activeSection}
            activeSectionDetails={activeSectionDetails}
            reduceMotion={Boolean(reduceMotion)}
            onOpenSection={openSection}
            onCloseSection={closeSection}
            onRegisterTrigger={(section, element) => {
              triggerRefs.current[section] = element;
            }}
          />
        </TrainingDataProvider>
      )}

      {!deletionReceipt &&
        !logoutPending &&
        auth.status === "signedIn" &&
        accountSettingsOpen && (
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
  reduceMotion: boolean;
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
  reduceMotion,
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
  const hasReadableTraining =
    training.status === "current" || training.status === "stale";
  const hasOtherStaleReason =
    training.status === "stale" &&
    training.staleReasons.some((reason) => reason !== "pending_writes");
  const showSynchronizationNotice = useDelayedStaleNotice(hasOtherStaleReason);
  const showOnboarding =
    training.status === "current" &&
    (isOnboardingOpen || (!onboardingComplete && !onboardingDeferred));
  const sectionTransitionDuration = reduceMotion ? 0 : 0.25;

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

      {!activeSection && showSynchronizationNotice && (
        <div className="training-home-status training-stale" role="status">
          <p>
            Marathoner is reconnecting. You can review your training, and
            editing will resume automatically when the connection returns.
          </p>
        </div>
      )}

      {!activeSection && hasReadableTraining && !showOnboarding && (
        <>
          <div className="runner-profile-entry">
            <button
              type="button"
              disabled={!training.canWrite}
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
                transition={{ duration: sectionTransitionDuration }}
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
          transition={{ duration: sectionTransitionDuration }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCloseSection();
          }}
        >
          <SectionContent
            section={activeSection}
            title={activeSectionDetails.title}
            transitionDuration={sectionTransitionDuration}
            showSynchronizationNotice={showSynchronizationNotice}
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
  transitionDuration: number;
  showSynchronizationNotice: boolean;
  onClose: () => void;
};

function SectionContent({
  section,
  title,
  transitionDuration,
  showSynchronizationNotice,
  onClose,
}: SectionContentProps) {
  const training = useTrainingData();
  const hasReadableTraining =
    training.status === "current" || training.status === "stale";
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
      transition={{ duration: transitionDuration }}
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
      {showSynchronizationNotice && (
        <div className="training-stale" role="status">
          <p>
            Marathoner is reconnecting. You can review your training, and
            editing will resume automatically when the connection returns.
          </p>
        </div>
      )}
      {hasReadableTraining && section === "plan" && (
        <Calendar plan={activePlan} workouts={training.workouts} />
      )}
      {hasReadableTraining && section === "track" && (
        <fieldset className="training-read-only" disabled={!training.canWrite}>
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
        </fieldset>
      )}
      {hasReadableTraining && section === "analyze" && (
        <Analyze
          runs={training.runs}
          shoes={training.shoes}
          distanceUnit={training.profile?.preferredDistanceUnit ?? "mile"}
          timeZone={training.profile?.timeZone}
        />
      )}
    </motion.div>
  );
}

export default App;
