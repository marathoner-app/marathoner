import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  CLOSED_BETA_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
  type ClosedBetaAdaptationRecommendationCommand,
  type ClosedBetaAdaptationRecommendationResult,
} from "../domain/recommendations/closedBetaAdaptationRecommendation";
import type { ClosedBetaProvisionalMethodologyManifest } from "../domain/methodology/closedBetaProvisionalMethodology";
import type {
  ActivePlanState,
  CompletedRun,
  PlannedWorkout,
} from "../domain/training/types";
import { useRecommendationEvidence } from "../recommendations/useRecommendationEvidence";
import type { ClosedBetaAdaptationRecommendationClient } from "../services/closedBetaAdaptationRecommendationClient";
import { firebaseClosedBetaAdaptationRecommendationClient } from "../services/firebaseClosedBetaAdaptationRecommendationClient";
import { selectInternalAdaptationTrigger } from "./internalAdaptationTrigger";
import RecommendationDecisionSurface from "./RecommendationDecisionSurface";

import "./ClosedBetaAdaptationSurface.css";

interface ClosedBetaAdaptationSurfaceProps {
  readonly manifest: ClosedBetaProvisionalMethodologyManifest;
  readonly activePlanState: ActivePlanState | null;
  readonly workouts: readonly PlannedWorkout[];
  readonly runs: readonly CompletedRun[];
  readonly client?: ClosedBetaAdaptationRecommendationClient;
  readonly createCommandId?: () => string;
}

type GenerationState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "submitting" | "error";
      readonly triggerKey: string;
      readonly command: ClosedBetaAdaptationRecommendationCommand;
    }
  | {
      readonly kind: "result";
      readonly triggerKey: string;
      readonly command: ClosedBetaAdaptationRecommendationCommand;
      readonly result: ClosedBetaAdaptationRecommendationResult;
    };

function defaultCommandId(): string {
  return `closed-beta-adaptation-${crypto.randomUUID()}`;
}

function adaptationVersion(
  manifest: ClosedBetaProvisionalMethodologyManifest,
): string | null {
  return (
    manifest.artifacts.find(({ kind }) => kind === "adaptation")?.version ??
    null
  );
}

function TrainingCheckGraphic({
  active = false,
  large = false,
}: {
  readonly active?: boolean;
  readonly large?: boolean;
}) {
  return (
    <div
      className={`closed-beta-adaptation-graphic${active ? " is-active" : ""}${large ? " is-large" : ""}`}
      aria-hidden="true"
    >
      <span className="closed-beta-adaptation-graphic-pulse" />
      <svg viewBox="0 0 56 56" focusable="false">
        <path d="M8 39 20 27l10 6 17-19" />
        <circle cx="8" cy="39" r="3" />
        <circle cx="20" cy="27" r="3" />
        <circle cx="30" cy="33" r="3" />
        <circle cx="47" cy="14" r="3" />
      </svg>
    </div>
  );
}

function TrainingCheckInputs() {
  return (
    <ul
      className="closed-beta-adaptation-inputs"
      aria-label="This check considers"
    >
      <li>Recent runs</li>
      <li>Training pattern</li>
      <li>Current plan</li>
    </ul>
  );
}

export default function ClosedBetaAdaptationSurface({
  manifest,
  activePlanState,
  workouts,
  runs,
  client = firebaseClosedBetaAdaptationRecommendationClient,
  createCommandId = defaultCommandId,
}: ClosedBetaAdaptationSurfaceProps) {
  const titleId = useId();
  const evidenceState = useRecommendationEvidence();
  const [generationState, setGenerationState] = useState<GenerationState>({
    kind: "idle",
  });
  const [experienceOpen, setExperienceOpen] = useState(false);
  const entryActionRef = useRef<HTMLButtonElement>(null);
  const experienceRef = useRef<HTMLElement>(null);
  const experienceWasOpenRef = useRef(false);
  const trigger = useMemo(
    () => selectInternalAdaptationTrigger(activePlanState, workouts, runs),
    [activePlanState, runs, workouts],
  );
  const triggerKey =
    activePlanState && trigger
      ? `${activePlanState.activePlanId}:${activePlanState.activePlanRevision}:${trigger.workoutId}:${trigger.evaluationDate}`
      : null;
  const visibleGenerationState =
    generationState.kind !== "idle" &&
    generationState.triggerKey === triggerKey
      ? generationState
      : ({ kind: "idle" } as const);
  const pendingCount = evidenceState.evidence.filter(
    ({ decision }) => decision === "pending",
  ).length;
  const artifactVersion = adaptationVersion(manifest);
  const checkAvailable =
    evidenceState.status === "ready" &&
    evidenceState.origin === "server" &&
    !evidenceState.hasPendingWrites &&
    activePlanState !== null &&
    trigger !== null &&
    triggerKey !== null &&
    artifactVersion !== null;

  useEffect(() => {
    if (!experienceOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [experienceOpen]);

  useEffect(() => {
    if (experienceOpen) {
      experienceRef.current?.focus();
    } else if (experienceWasOpenRef.current) {
      entryActionRef.current?.focus();
    }
    experienceWasOpenRef.current = experienceOpen;
  }, [experienceOpen]);

  useEffect(() => {
    if (
      experienceOpen &&
      pendingCount === 0 &&
      visibleGenerationState.kind === "idle"
    ) {
      setExperienceOpen(false);
    }
  }, [experienceOpen, pendingCount, visibleGenerationState.kind]);

  const experienceCanClose = visibleGenerationState.kind !== "submitting";

  useEffect(() => {
    if (!experienceOpen || !experienceCanClose) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExperienceOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [experienceCanClose, experienceOpen]);

  const submit = async (
    existingCommand?: ClosedBetaAdaptationRecommendationCommand,
  ) => {
    if (trigger === null || triggerKey === null || artifactVersion === null) {
      return;
    }
    const command = existingCommand ?? {
      schemaVersion: CLOSED_BETA_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
      commandId: createCommandId(),
      manifestVersion: manifest.manifestVersion,
      adaptationArtifactVersion: artifactVersion,
      triggerWorkoutId: trigger.workoutId,
      evaluationDate: trigger.evaluationDate,
      confirmedRescheduleTargetDate: null,
    };
    setGenerationState({ kind: "submitting", triggerKey, command });
    try {
      const result = await client.generate(command);
      setGenerationState({ kind: "result", triggerKey, command, result });
    } catch {
      setGenerationState({ kind: "error", triggerKey, command });
    }
  };

  if (pendingCount === 0 && !checkAvailable) return null;

  let entryTitle = "See whether your plan still fits";
  let entryCopy =
    "Marathoner can compare your recent completed training with the current beta rules. It will never change your plan without showing you the exact recommendation first.";
  let entryAction = "Check recent training";

  if (pendingCount > 0) {
    entryTitle = "Review your plan recommendation";
    entryCopy =
      "Your training check is ready. Review the exact recommendation before deciding whether anything changes.";
    entryAction = "Review recommendation";
  } else if (visibleGenerationState.kind === "error") {
    entryTitle = "Your training check needs confirmation";
    entryCopy =
      "Return to the same request so Marathoner can confirm its outcome without creating a duplicate recommendation.";
    entryAction = "Return to training check";
  } else if (visibleGenerationState.kind === "result") {
    entryTitle = "Your training check is ready";
    entryCopy =
      "Marathoner finished comparing your latest completed training with your current plan.";
    entryAction = "View training check";
  }

  const openExperience = () => {
    setExperienceOpen(true);
    if (
      pendingCount === 0 &&
      visibleGenerationState.kind === "idle"
    ) {
      void submit();
    }
  };

  let experienceTitle = "Checking recent training";
  let experienceMessage =
    "Marathoner is comparing your latest completed workout with the recent pattern and your current plan.";
  let experienceRole: "status" | "alert" = "status";
  let experienceAction:
    | { readonly label: string; readonly run: () => void }
    | undefined;

  if (visibleGenerationState.kind === "error") {
    experienceTitle = "The training check needs confirmation";
    experienceMessage =
      "Marathoner could not confirm the result. Check the same request again so a second recommendation cannot be created.";
    experienceRole = "alert";
    experienceAction = {
      label: "Check the same request again",
      run: () => void submit(visibleGenerationState.command),
    };
  } else if (visibleGenerationState.kind === "result") {
    const { result } = visibleGenerationState;
    if (result.status === "pending_recommendation_created") {
      experienceTitle = "Preparing your plan recommendation";
      experienceMessage =
        "The recommendation was saved. Marathoner is waiting for the server-confirmed review to appear; your plan is still unchanged.";
    } else if (result.status === "no_change") {
      experienceTitle = "Your current plan still fits";
      experienceMessage =
        "The current beta rules did not find a supported change for this training pattern. Nothing was changed.";
    } else if (result.status === "retryable_error") {
      experienceTitle = "The training check is temporarily unavailable";
      experienceMessage =
        "Your plan is unchanged. Reconnect, then try the same check again.";
      experienceRole = "alert";
      experienceAction = {
        label: "Try the same check again",
        run: () => void submit(visibleGenerationState.command),
      };
    } else {
      const paused =
        result.status === "disabled" ||
        result.status === "stale_version" ||
        result.status === "unavailable";
      experienceTitle =
        result.status === "refused"
          ? "No plan change is recommended"
          : paused
            ? "Plan recommendations are unavailable"
            : "The training check could not be completed";
      experienceMessage = `${result.message} Your active plan is unchanged.`;
      experienceRole = result.status === "refused" ? "status" : "alert";
    }
  }

  const reviewingRecommendation = pendingCount > 0;
  if (reviewingRecommendation) {
    experienceTitle = "Review your plan recommendation";
    experienceMessage =
      "See what Marathoner observed, what it means, and the exact proposed change before making a choice.";
  }

  return (
    <>
      <section
        className="closed-beta-adaptation-surface closed-beta-adaptation-surface--entry"
        aria-labelledby={`${titleId}-entry`}
        hidden={experienceOpen}
      >
        <TrainingCheckGraphic />
        <div className="closed-beta-adaptation-entry-heading">
          <p className="closed-beta-adaptation-eyebrow">Training check</p>
          <h2 id={`${titleId}-entry`}>{entryTitle}</h2>
        </div>
        <p className="closed-beta-adaptation-copy">{entryCopy}</p>
        <TrainingCheckInputs />
        <button
          ref={entryActionRef}
          className="closed-beta-adaptation-action"
          type="button"
          onClick={openExperience}
        >
          <span>{entryAction}</span>
          <span
            className="closed-beta-adaptation-action-arrow"
            aria-hidden="true"
          >
            →
          </span>
        </button>
      </section>

      {experienceOpen && (
        <section
          ref={experienceRef}
          className={`closed-beta-adaptation-experience${reviewingRecommendation ? " closed-beta-adaptation-experience--review" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${titleId}-experience`}
          aria-busy={visibleGenerationState.kind === "submitting"}
          tabIndex={-1}
        >
          <div className="closed-beta-adaptation-experience-shell">
            <div
              className="closed-beta-adaptation-experience-intro"
              role={reviewingRecommendation ? undefined : experienceRole}
              aria-live={
                !reviewingRecommendation && experienceRole === "status"
                  ? "polite"
                  : undefined
              }
            >
              <TrainingCheckGraphic
                active={visibleGenerationState.kind === "submitting"}
                large
              />
              <p className="closed-beta-adaptation-eyebrow">
                Training check
              </p>
              <h2 id={`${titleId}-experience`}>{experienceTitle}</h2>
              <div className="closed-beta-adaptation-experience-message">
                <p>{experienceMessage}</p>
              </div>
              {!reviewingRecommendation && <TrainingCheckInputs />}
              {visibleGenerationState.kind === "submitting" && (
                <p className="closed-beta-adaptation-assurance">
                  Your plan stays unchanged while this check finishes.
                </p>
              )}
            </div>

            {reviewingRecommendation && (
              <div className="closed-beta-adaptation-review">
                <RecommendationDecisionSurface />
              </div>
            )}

            {experienceCanClose && (
              <div className="closed-beta-adaptation-experience-actions">
                {experienceAction && (
                  <button
                    className="closed-beta-adaptation-action"
                    type="button"
                    onClick={experienceAction.run}
                  >
                    {experienceAction.label}
                  </button>
                )}
                <button
                  className="closed-beta-adaptation-return"
                  type="button"
                  onClick={() => setExperienceOpen(false)}
                >
                  Back to Home
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
