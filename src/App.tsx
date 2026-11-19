import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Title from "./components/Title";
import Subtitle from "./components/Subtitle";
import Calendar from "./components/Calendar";
import PublicLandingPage from "./components/PublicLandingPage";
import ShoeTracker from "./components/ShoeTracker";
import type { ShoeTrackerInitialFocusTarget } from "./components/ShoeTracker";
import Analyze from "./components/Analyze";
import { useAuth } from "./auth/useAuth";
import TrainingDataProvider from "./training/TrainingDataProvider";
import { useTrainingData } from "./training/useTrainingData";
import useDelayedStaleNotice from "./training/useDelayedStaleNotice";
import useDelayedTrainingStartupNotice from "./training/useDelayedTrainingStartupNotice";
import { clearBrowserPendingRunSave } from "./training/pendingRunSave";
import RecommendationEvidenceProvider from "./recommendations/RecommendationEvidenceProvider";
import RunnerOnboarding from "./onboarding/RunnerOnboarding";
import { isRunnerProfileOnboardingComplete } from "./onboarding/runnerProfileDraft";
import {
  AccountDeletionDialog,
  AccountDeletionReceipt,
} from "./components/AccountDeletion";
import type { AccountDeletionRequestAcceptedResult } from "./domain/materialCommands/contract";
import {
  createUserId,
  selectNextPlannedWorkout,
  type GeneratedPlanEntityProjection,
  type GeneratedPlanResultV1,
  type UserId,
} from "./domain/training";
import NextWorkoutSummary from "./components/NextWorkoutSummary";
import RecommendationDecisionSurface from "./components/RecommendationDecisionSurface";
import ClosedBetaAdaptationSurface from "./components/ClosedBetaAdaptationSurface";
import TrainingSectionNavigation from "./components/TrainingSectionNavigation";
import SignedInAppHeader from "./components/SignedInAppHeader";
import TrainingStartupStatus from "./components/TrainingStartupStatus";
import SignedInStartupScreen from "./components/SignedInStartupScreen";
import {
  trainingSections,
  type TrainingSection,
} from "./components/trainingSections";
import { isBetaRunCommandRehearsalMode } from "./components/betaRunCommandRehearsalMode";
import { isInternalPlanProposalRehearsalMode } from "./components/internalPlanProposalRehearsalMode";
import { isInternalAdaptationDogfoodEnabled } from "./components/internalAdaptationDogfoodMode";
import { resolvePlanSurfaceData } from "./training/planSurfaceData";
import {
  createHealthKitAccountScope,
  resumeHealthKitImportMonitoring,
  stopHealthKitImportMonitoring,
} from "./services/healthKitImport";
import { selectedFirebaseEnvironment } from "./selectedFirebaseEnvironment";
import ClosedBetaMethodologyConsentGate from "./components/ClosedBetaMethodologyConsentGate";
import { getClosedBetaProvisionalMethodologyManifest } from "./domain/methodology/closedBetaProvisionalMethodologyRegistry";

const publicSupportEmail = "kevin@marathonerapp.com";
const BetaRunCommandRehearsal = isBetaRunCommandRehearsalMode(
  import.meta.env.MODE,
)
  ? lazy(() => import("./components/BetaRunCommandRehearsalLive"))
  : null;
const InternalPlanProposalRehearsal =
  isInternalPlanProposalRehearsalMode(import.meta.env.MODE)
    ? lazy(() => import("./components/InternalPlanProposalRehearsalLive"))
    : null;
const InternalSessionPlanNotice =
  isInternalPlanProposalRehearsalMode(import.meta.env.MODE)
    ? lazy(() => import("./components/InternalSessionPlanNotice"))
    : null;
const InternalSessionTodayComparison =
  isInternalPlanProposalRehearsalMode(import.meta.env.MODE)
    ? lazy(() => import("./components/InternalSessionTodayComparison"))
    : null;
const PlanProposalBuilder =
  (import.meta.env.VITE_FIREBASE_ENVIRONMENT === "development" &&
    import.meta.env.VITE_PROVISIONAL_PLAN_DOGFOOD === "true") ||
  (import.meta.env.VITE_FIREBASE_ENVIRONMENT === "beta" &&
    import.meta.env.VITE_CLOSED_BETA_PROVISIONAL_METHODOLOGY === "true")
    ? lazy(() => import("./components/PlanProposalBuilderLive"))
    : null;
const InternalAdaptationDogfood = isInternalAdaptationDogfoodEnabled({
  firebaseEnvironment: import.meta.env.VITE_FIREBASE_ENVIRONMENT,
  provisionalPlanDogfood: import.meta.env.VITE_PROVISIONAL_PLAN_DOGFOOD,
})
  ? lazy(() => import("./components/InternalAdaptationDogfoodLive"))
  : null;
const ClosedBetaGuidanceSurface = lazy(
  () => import("./components/ClosedBetaGuidanceSurface"),
);

async function clearInternalPlanRehearsalSession(): Promise<void> {
  if (InternalPlanProposalRehearsal === null) return;

  const rehearsalSession = await import(
    "./components/internalPlanRehearsalSession"
  );
  rehearsalSession.clearInternalPlanRehearsalSession();
}

const sections = trainingSections;

type Section = TrainingSection;

function App() {
  const auth = useAuth();
  const logout = auth.logout;
  const signedInUserId = auth.status === "signedIn" ? auth.user.uid : null;
  const healthKitAccountScope = useMemo(
    () =>
      signedInUserId === null
        ? null
        : createHealthKitAccountScope(
            selectedFirebaseEnvironment.config.projectId,
            signedInUserId,
          ),
    [signedInUserId],
  );
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [trackInitialFocusTarget, setTrackInitialFocusTarget] =
    useState<ShoeTrackerInitialFocusTarget | null>(null);
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
  const homeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreHomeFocus = useRef(false);
  const accountSettingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreAccountSettingsFocus = useRef(false);
  const lastSignedInUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSection && restoreHomeFocus.current) {
      homeTriggerRef.current?.focus();
      restoreHomeFocus.current = false;
    }
  }, [activeSection]);

  useEffect(() => {
    if (auth.status !== "signedIn") {
      setActiveSection(null);
      setTrackInitialFocusTarget(null);
      setLogoutPending(false);
      setLogoutError(null);
      setAccountSettingsOpen(false);
      if (deletionReceipt === null) setUnresolvedDeletionCommandId(null);
    }
  }, [auth.status, deletionReceipt]);

  useEffect(() => {
    if (
      lastSignedInUserId.current !== null &&
      lastSignedInUserId.current !== signedInUserId
    ) {
      void clearInternalPlanRehearsalSession();
      clearBrowserPendingRunSave();
    }
    lastSignedInUserId.current = signedInUserId;
  }, [signedInUserId]);

  useEffect(() => {
    if (healthKitAccountScope === null) return;
    void resumeHealthKitImportMonitoring(healthKitAccountScope).catch(
      () => undefined,
    );
    return () => {
      void stopHealthKitImportMonitoring(healthKitAccountScope);
    };
  }, [healthKitAccountScope]);

  useEffect(() => {
    if (!logoutPending || deletionReceipt !== null) return;

    let attemptIsCurrent = true;

    void logout().catch(() => {
      if (!attemptIsCurrent) return;

      setLogoutPending(false);
      setLogoutError("We couldn't log you out. Please try again.");
    });

    return () => {
      attemptIsCurrent = false;
    };
  }, [deletionReceipt, logout, logoutPending]);

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
    void clearInternalPlanRehearsalSession();
    clearBrowserPendingRunSave();
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

  const openSection = (
    section: Section,
    initialFocusTarget: ShoeTrackerInitialFocusTarget | null = null,
  ) => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    setTrackInitialFocusTarget(
      section === "track" ? initialFocusTarget : null,
    );
    setActiveSection(section);
  };

  const closeSection = () => {
    setActiveSection(null);
    setTrackInitialFocusTarget(null);
  };

  const selectHome = () => {
    if (activeSection !== null) {
      restoreHomeFocus.current = true;
    }
    closeSection();
  };

  const handleLogout = () => {
    setLogoutError(null);
    void clearInternalPlanRehearsalSession();
    clearBrowserPendingRunSave();
    setLogoutPending(true);
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

  const signedInChrome =
    auth.status === "signedIn" ? (
      <>
        <SignedInAppHeader
          email={auth.user.email}
          accountSettingsTriggerRef={accountSettingsTriggerRef}
          onOpenAccountSettings={() => setAccountSettingsOpen(true)}
          onLogout={handleLogout}
        />
        {logoutError && (
          <p className="auth-message auth-error session-auth-error" role="alert">
            {logoutError}
          </p>
        )}
        {!activeSection && (
          <>
            <Title />
            <Subtitle />
          </>
        )}
      </>
    ) : null;

  return (
    <main
      className={`main${auth.status === "signedOut" ? " public-entry" : ""}${
        auth.status === "signedIn" && activeSection === null
          ? " signed-in-home"
          : ""
      }`}
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
        <SignedInStartupScreen />
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
        auth.status === "signedOut" &&
        !activeSection && (
          <PublicLandingPage
            supportEmail={publicSupportEmail}
            statusNotice={auth.notice}
          />
        )}

      {!deletionReceipt && !logoutPending && auth.status === "signedIn" && (
        <ClosedBetaMethodologyConsentGate
          ownerId={auth.user.uid}
          chrome={signedInChrome}
        >
          <TrainingDataProvider key={auth.user.uid} userId={auth.user.uid}>
            <RecommendationEvidenceProvider
              ownerId={createUserId(auth.user.uid)}
            >
              <AuthenticatedExperience
                ownerId={createUserId(auth.user.uid)}
                activeSection={activeSection}
                activeSectionDetails={activeSectionDetails}
                trackInitialFocusTarget={trackInitialFocusTarget}
                chrome={signedInChrome}
                onOpenSection={openSection}
                onSelectHome={selectHome}
                onRegisterHomeTrigger={(element) => {
                  homeTriggerRef.current = element;
                }}
              />
            </RecommendationEvidenceProvider>
          </TrainingDataProvider>
        </ClosedBetaMethodologyConsentGate>
      )}

      {!deletionReceipt &&
        !logoutPending &&
        auth.status === "signedIn" &&
        healthKitAccountScope !== null &&
        accountSettingsOpen && (
          <AccountDeletionDialog
            accountScope={auth.user.uid}
            healthKitAccountScope={healthKitAccountScope}
            email={auth.user.email}
            supportEmail={publicSupportEmail}
            unresolvedCommandId={unresolvedDeletionCommandId}
            onAccepted={acceptDeletion}
            onClose={closeAccountSettings}
            onUnresolvedCommandChange={setUnresolvedDeletionCommandId}
          />
        )}
    </main>
  );
}

type AuthenticatedExperienceProps = {
  ownerId: UserId;
  activeSection: Section | null;
  activeSectionDetails: (typeof sections)[number] | undefined;
  trackInitialFocusTarget: ShoeTrackerInitialFocusTarget | null;
  chrome: ReactNode;
  onOpenSection: (
    section: Section,
    initialFocusTarget?: ShoeTrackerInitialFocusTarget | null,
  ) => void;
  onSelectHome: () => void;
  onRegisterHomeTrigger: (element: HTMLButtonElement | null) => void;
};

function AuthenticatedExperience({
  ownerId,
  activeSection,
  activeSectionDetails,
  trackInitialFocusTarget,
  chrome,
  onOpenSection,
  onSelectHome,
  onRegisterHomeTrigger,
}: AuthenticatedExperienceProps) {
  const training = useTrainingData();
  const closedBetaMethodologyManifest =
    getClosedBetaProvisionalMethodologyManifest();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingDeferred, setOnboardingDeferred] = useState(false);
  const [sessionDraftPlan, setSessionDraftPlan] =
    useState<GeneratedPlanResultV1 | null>(null);
  const [sessionPlanProjection, setSessionPlanProjection] =
    useState<GeneratedPlanEntityProjection | null>(null);
  const [isSessionAdaptationActive, setIsSessionAdaptationActive] =
    useState(false);
  const runnerProfileOpeningTriggerRef = useRef<HTMLElement | null>(null);
  const runnerProfileTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreRunnerProfileFocus = useRef(false);
  const onboardingComplete = isRunnerProfileOnboardingComplete(training.profile);
  const synchronizedActivePlan = useMemo(
    () => training.plans.find((plan) => plan.status === "active") ?? null,
    [training.plans],
  );
  const planSurfaceData = useMemo(
    () =>
      resolvePlanSurfaceData({
        sessionProjection: sessionPlanProjection,
        synchronizedPlan: synchronizedActivePlan,
        synchronizedWorkouts: training.workouts,
      }),
    [sessionPlanProjection, synchronizedActivePlan, training.workouts],
  );
  const nextWorkout = useMemo(
    () =>
      training.profile === null
        ? null
        : selectNextPlannedWorkout(
            planSurfaceData.activePlan,
            planSurfaceData.workouts,
            training.profile.timeZone,
          ),
    [planSurfaceData, training.profile],
  );
  const latestRun = useMemo(
    () =>
      [...training.runs].sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt),
      )[0] ?? null,
    [training.runs],
  );
  const guidanceTriggerCodes = useMemo(() => {
    const triggers: string[] = [];
    if (planSurfaceData.activePlan !== null) {
      triggers.push("PLAN-REVIEWED-LIMITATIONS", "TRAINING-WEEK-STARTED-SLEEP");
    }
    if (nextWorkout?.kind === "run" && nextWorkout.purpose === "easy") {
      triggers.push("EASY-WORKOUT-UPCOMING");
    }
    if (
      nextWorkout !== null &&
      nextWorkout.kind !== "rest" &&
      nextWorkout.targetDistance !== undefined &&
      nextWorkout.targetDistance >= 12_000
    ) {
      triggers.push(
        "LONG-WORKOUT-UPCOMING-FUELING",
        "LONG-WORKOUT-UPCOMING-HYDRATION",
      );
    }
    if (training.shoes.some(({ status }) => status === "active")) {
      triggers.push("SHOE-TRACKING-STARTED");
    }
    if (training.runs.length >= 3) {
      triggers.push("COMPLETED-RUN-PATTERN-RECORDED");
    }
    return triggers;
  }, [nextWorkout, planSurfaceData.activePlan, training.runs.length, training.shoes]);
  const hasReadableTraining =
    training.status === "current" || training.status === "stale";
  const hasSynchronizationError = training.error !== null;
  const pendingSourceKey = training.pendingSources.join(",");
  const startupDelayElapsed = useDelayedTrainingStartupNotice(
    training.pendingSources.length > 0,
    pendingSourceKey,
  );
  const runsReady = !training.pendingSources.includes("runs");
  const shoesReady = !training.pendingSources.includes("shoes");
  const secondaryTrainingReady = runsReady && shoesReady;
  const [guidanceResolved, setGuidanceResolved] = useState(
    closedBetaMethodologyManifest === null,
  );
  const [guidanceRetryToken, setGuidanceRetryToken] = useState(0);
  const [initialStartupComplete, setInitialStartupComplete] = useState(false);
  const initialHomeSnapshotReady =
    hasReadableTraining && training.pendingSources.length === 0;
  const guidanceRequiredForStartup =
    onboardingComplete && closedBetaMethodologyManifest !== null;
  const initialExperienceReady =
    initialHomeSnapshotReady &&
    (!guidanceRequiredForStartup || guidanceResolved);
  const experienceReady = initialStartupComplete || initialExperienceReady;
  const guidanceStartupDelayed = useDelayedTrainingStartupNotice(
    initialHomeSnapshotReady &&
      guidanceRequiredForStartup &&
      !guidanceResolved,
    `${ownerId}:${guidanceTriggerCodes.join(",")}`,
  );
  const hasOtherStaleReason =
    training.status === "stale" &&
    !hasSynchronizationError &&
    training.staleReasons.some(
      (reason) =>
        reason !== "pending_writes" &&
        !(reason === "feature_incomplete" && training.pendingSources.length > 0),
    );
  const showSynchronizationNotice = useDelayedStaleNotice(hasOtherStaleReason);
  const showOnboarding =
    hasReadableTraining &&
    (isOnboardingOpen || (!onboardingComplete && !onboardingDeferred));
  const showExistingHomeBehindOnboarding =
    !showOnboarding || onboardingComplete;
  const navigationPending = !hasReadableTraining;
  const showNavigation = navigationPending || onboardingComplete;

  const closeOnboarding = () => {
    restoreRunnerProfileFocus.current = true;
    setIsOnboardingOpen(false);
    setOnboardingDeferred(true);
  };

  const editRunnerProfile = (trigger?: HTMLElement) => {
    runnerProfileOpeningTriggerRef.current =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setOnboardingDeferred(false);
    setIsOnboardingOpen(true);
  };

  useEffect(() => {
    if (showOnboarding || !restoreRunnerProfileFocus.current) return;

    (
      runnerProfileOpeningTriggerRef.current ?? runnerProfileTriggerRef.current
    )?.focus();
    runnerProfileOpeningTriggerRef.current = null;
    restoreRunnerProfileFocus.current = false;
  }, [showOnboarding]);

  useEffect(() => {
    if (InternalPlanProposalRehearsal === null) return;

    setSessionDraftPlan(null);
    setSessionPlanProjection(null);
    setIsSessionAdaptationActive(false);
  }, [training.profile?.updatedAt]);

  useEffect(() => {
    if (initialExperienceReady) setInitialStartupComplete(true);
  }, [initialExperienceReady]);

  return (
    <>
      {!experienceReady && (
        <SignedInStartupScreen
          delayed={startupDelayElapsed || guidanceStartupDelayed}
          onRetry={() => {
            void training.reload();
            setGuidanceRetryToken((token) => token + 1);
          }}
        />
      )}

      <div className="signed-in-experience" hidden={!experienceReady}>
        {chrome}

        {showOnboarding && (
          <RunnerOnboarding
            profile={training.profile}
            onSave={training.saveProfile}
            onClose={closeOnboarding}
          />
        )}

        {!activeSection && training.status === "loading" && (
          <TrainingStartupStatus
            pendingSources={training.pendingSources}
            delayed={startupDelayElapsed}
            hasReadableSnapshot={false}
            onRetry={() => void training.reload()}
          />
        )}

      {!activeSection &&
        hasReadableTraining &&
        training.pendingSources.length > 0 && (
          <TrainingStartupStatus
            pendingSources={training.pendingSources}
            delayed={startupDelayElapsed}
            hasReadableSnapshot
            onRetry={() => void training.reload()}
          />
      )}

        {!activeSection && hasSynchronizationError && (
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

        {!activeSection && hasReadableTraining && showExistingHomeBehindOnboarding && (
          <>
          <div className="runner-profile-entry">
            <button
              ref={runnerProfileTriggerRef}
              type="button"
              disabled={!training.canWrite}
              onClick={(event) => editRunnerProfile(event.currentTarget)}
            >
              {onboardingComplete ? "Edit runner profile" : "Resume runner setup"}
            </button>
            <p>
              {onboardingComplete
                ? "Your first-marathon starting point is saved."
                : "Your saved progress is safe; finish setup before a plan can be evaluated."}
            </p>
          </div>
          {InternalSessionPlanNotice && sessionPlanProjection && (
            <Suspense fallback={null}>
              <InternalSessionPlanNotice
                surface="home"
                isAdapted={isSessionAdaptationActive}
              />
            </Suspense>
          )}
          <NextWorkoutSummary
            plan={planSurfaceData.activePlan}
            workout={nextWorkout}
            distanceUnit={training.profile?.preferredDistanceUnit ?? "mile"}
            onOpenPlan={() => onOpenSection("plan")}
          />
          </>
        )}

        {secondaryTrainingReady &&
          onboardingComplete &&
          closedBetaMethodologyManifest !== null && (
            <div
              hidden={
                activeSection !== null ||
                (showOnboarding && !onboardingComplete)
              }
            >
              <Suspense fallback={null}>
                <ClosedBetaGuidanceSurface
                  key={`${ownerId}:${guidanceRetryToken}`}
                  ownerId={ownerId}
                  activeTriggerCodes={guidanceTriggerCodes}
                  safetyState={
                    latestRun?.unusualPain === true
                      ? "reported"
                      : "none_reported"
                  }
                  otherConcerningOrPersistentSymptoms={
                    latestRun?.unusualPain === true
                  }
                  onResolvedChange={setGuidanceResolved}
                />
              </Suspense>
            </div>
          )}

        {!activeSection && hasReadableTraining && showExistingHomeBehindOnboarding && (
          <>
          {runsReady &&
            InternalSessionTodayComparison &&
            sessionPlanProjection &&
            training.profile && (
              <Suspense fallback={null}>
                <InternalSessionTodayComparison
                  projection={sessionPlanProjection}
                  runs={training.runs}
                  distanceUnit={training.profile.preferredDistanceUnit}
                  timeZone={training.profile.timeZone}
                  onOpenTrack={(runId) =>
                    onOpenSection(
                      "track",
                      runId === null
                        ? { kind: "log-run" }
                        : { kind: "review-run", runId },
                    )
                  }
                />
              </Suspense>
            )}
          {runsReady &&
            InternalAdaptationDogfood === null &&
            closedBetaMethodologyManifest === null && (
            <RecommendationDecisionSurface />
          )}
          {runsReady &&
            InternalAdaptationDogfood === null &&
            closedBetaMethodologyManifest !== null && (
              <ClosedBetaAdaptationSurface
                manifest={closedBetaMethodologyManifest}
                activePlanState={training.activePlanState}
                workouts={training.workouts}
                runs={training.runs}
              />
            )}
          {runsReady && InternalAdaptationDogfood && onboardingComplete && (
            <Suspense
              fallback={
                <div className="training-home-status" role="status">
                  <p>Loading the internal training check...</p>
                </div>
              }
            >
              <InternalAdaptationDogfood
                activePlanState={training.activePlanState}
                workouts={training.workouts}
                runs={training.runs}
              />
            </Suspense>
          )}
          </>
        )}

        {showNavigation && (
          <TrainingSectionNavigation
            activeSection={activeSection}
            disabled={navigationPending}
            interactionLocked={showOnboarding}
            onSelectHome={onSelectHome}
            onRegisterHomeTrigger={onRegisterHomeTrigger}
            onSelect={onOpenSection}
          />
        )}

      {!activeSection && hasReadableTraining && showExistingHomeBehindOnboarding && (
        <>
          {runsReady && InternalPlanProposalRehearsal && (
            <Suspense
              fallback={
                <div className="training-home-status" role="status">
                  <p>Loading the internal plan rehearsal...</p>
                </div>
              }
            >
              <InternalPlanProposalRehearsal
                key={training.profile?.updatedAt ?? "no-profile"}
                ownerId={ownerId}
                profile={training.profile}
                activePlanState={training.activePlanState}
                plans={training.plans}
                workouts={training.workouts}
                runs={training.runs}
                sessionDraftPlan={sessionDraftPlan}
                onSessionDraftPlanChange={setSessionDraftPlan}
                onSessionPlanProjectionChange={setSessionPlanProjection}
                onSessionAdaptationStateChange={
                  setIsSessionAdaptationActive
                }
              />
            </Suspense>
          )}
          {runsReady && BetaRunCommandRehearsal && (
            <Suspense
              fallback={
                <div className="training-home-status" role="status">
                  <p>Loading the owner command rehearsal...</p>
                </div>
              }
            >
              <BetaRunCommandRehearsal
                completedRunIds={training.runs.map(({ id }) => id)}
              />
            </Suspense>
          )}
        </>
      )}

        {activeSection && activeSectionDetails && (
          <section
            id={`${activeSection}-panel`}
            className={`section-panel section-panel--${activeSection}`}
            aria-label={activeSectionDetails.title}
          >
            <SectionContent
              section={activeSection}
              showSynchronizationNotice={showSynchronizationNotice}
              sessionPlanProjection={sessionPlanProjection}
              isSessionAdaptationActive={isSessionAdaptationActive}
              trackInitialFocusTarget={trackInitialFocusTarget}
              startupDelayElapsed={startupDelayElapsed}
              onEditRunnerProfile={editRunnerProfile}
            />
          </section>
        )}
      </div>
    </>
  );
}

type SectionContentProps = {
  section: Section;
  showSynchronizationNotice: boolean;
  sessionPlanProjection: GeneratedPlanEntityProjection | null;
  isSessionAdaptationActive: boolean;
  trackInitialFocusTarget: ShoeTrackerInitialFocusTarget | null;
  startupDelayElapsed: boolean;
  onEditRunnerProfile: () => void;
};

function SectionContent({
  section,
  showSynchronizationNotice,
  sessionPlanProjection,
  isSessionAdaptationActive,
  trackInitialFocusTarget,
  startupDelayElapsed,
  onEditRunnerProfile,
}: SectionContentProps) {
  const training = useTrainingData();
  const hasReadableTraining =
    training.status === "current" || training.status === "stale";
  const hasSynchronizationError = training.error !== null;
  const runsReady = !training.pendingSources.includes("runs");
  const shoesReady = !training.pendingSources.includes("shoes");
  const sectionSourcesReady =
    section === "plan" || (runsReady && shoesReady);
  const synchronizedActivePlan =
    training.plans.find((plan) => plan.status === "active") ??
    training.plans.find((plan) => plan.status === "draft") ??
    training.plans.find((plan) => plan.status !== "archived") ??
    null;
  const planSurfaceData = resolvePlanSurfaceData({
    sessionProjection: sessionPlanProjection,
    synchronizedPlan: synchronizedActivePlan,
    synchronizedWorkouts: training.workouts,
  });
  const nextPlanWorkout =
    training.profile === null
      ? null
      : selectNextPlannedWorkout(
          planSurfaceData.activePlan,
          planSurfaceData.workouts,
          training.profile.timeZone,
        );
  return (
    <div
      className={`section-panel-content section-panel-content--${section}`}
    >
      {training.status === "loading" && (
        <TrainingStartupStatus
          className="training-status"
          pendingSources={training.pendingSources}
          delayed={startupDelayElapsed}
          hasReadableSnapshot={false}
          onRetry={() => void training.reload()}
        />
      )}
      {hasReadableTraining && !sectionSourcesReady && (
        <TrainingStartupStatus
          className="training-status"
          pendingSources={training.pendingSources}
          delayed={startupDelayElapsed}
          hasReadableSnapshot
          onRetry={() => void training.reload()}
        />
      )}
      {hasSynchronizationError && (
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
        <>
          {InternalSessionPlanNotice && sessionPlanProjection && (
            <Suspense fallback={null}>
              <InternalSessionPlanNotice
                surface="plan"
                isAdapted={isSessionAdaptationActive}
              />
            </Suspense>
          )}
          {planSurfaceData.activePlan === null && PlanProposalBuilder ? (
            <Suspense
              fallback={
                <p className="training-status" role="status">
                  Loading plan builder...
                </p>
              }
            >
              <PlanProposalBuilder
                key={training.profile?.updatedAt ?? "no-profile"}
                profile={training.profile}
                onEditProfile={onEditRunnerProfile}
                expectedActivePlanRevision={
                  training.activePlanState?.activePlanRevision ?? null
                }
                reloadTrainingData={training.reload}
                onApproved={() => undefined}
              />
            </Suspense>
          ) : (
            <Calendar
              plan={planSurfaceData.activePlan}
              workouts={planSurfaceData.workouts}
              distanceUnit={training.profile?.preferredDistanceUnit ?? "mile"}
              initialDate={nextPlanWorkout?.scheduledDate}
            />
          )}
        </>
      )}
      {hasReadableTraining && sectionSourcesReady && section === "track" && (
        <fieldset className="training-read-only" disabled={!training.canWrite}>
          <ShoeTracker
            distanceUnit={training.profile?.preferredDistanceUnit ?? "mile"}
            defaultShoeId={training.profile?.defaultShoeId}
            runs={training.runs}
            shoes={training.shoes}
            plannedWorkouts={training.workouts.filter(
              (workout) => workout.planId === synchronizedActivePlan?.id,
            )}
            onCreateShoe={training.createShoe}
            onSetDefaultShoe={training.setDefaultShoe}
            onRetireShoe={training.retireShoe}
            onCreateRun={training.createRun}
            hasPendingRunSave={training.hasPendingRunSave}
            onCheckPendingRunSave={training.checkPendingRunSave}
            onUpdateRun={training.updateRun}
            onDeleteRun={training.deleteRun}
            initialFocusTarget={trackInitialFocusTarget}
          />
        </fieldset>
      )}
      {hasReadableTraining && sectionSourcesReady && section === "analyze" && (
        <Analyze
          runs={training.runs}
          shoes={training.shoes}
          distanceUnit={training.profile?.preferredDistanceUnit ?? "mile"}
          timeZone={training.profile?.timeZone}
        />
      )}
    </div>
  );
}

export default App;
