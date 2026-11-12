import { useMemo, useState } from "react";

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

function StatusCard({
  kind,
  title,
  message,
  action,
}: {
  readonly kind: "status" | "alert";
  readonly title: string;
  readonly message: string;
  readonly action?: { readonly label: string; readonly run: () => void };
}) {
  return (
    <section
      className="closed-beta-adaptation-surface"
      aria-labelledby="closed-beta-adaptation-title"
      role={kind}
    >
      <p className="closed-beta-adaptation-eyebrow">Training check</p>
      <h2 id="closed-beta-adaptation-title">{title}</h2>
      <p>{message}</p>
      {action && (
        <button type="button" onClick={action.run}>
          {action.label}
        </button>
      )}
    </section>
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
  const evidenceState = useRecommendationEvidence();
  const [generationState, setGenerationState] = useState<GenerationState>({
    kind: "idle",
  });
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

  if (pendingCount > 0) return <RecommendationDecisionSurface />;
  if (
    evidenceState.status !== "ready" ||
    evidenceState.origin !== "server" ||
    evidenceState.hasPendingWrites ||
    activePlanState === null ||
    trigger === null ||
    triggerKey === null ||
    artifactVersion === null
  ) {
    return null;
  }

  if (visibleGenerationState.kind === "submitting") {
    return (
      <StatusCard
        kind="status"
        title="Checking recent training"
        message="Marathoner is comparing your latest completed workout with the recent pattern. Your plan remains unchanged while this check finishes."
      />
    );
  }
  if (visibleGenerationState.kind === "error") {
    return (
      <StatusCard
        kind="alert"
        title="The training check needs confirmation"
        message="Marathoner could not confirm the result. Check the same request again so a second recommendation cannot be created."
        action={{
          label: "Check the same request again",
          run: () => void submit(visibleGenerationState.command),
        }}
      />
    );
  }
  if (visibleGenerationState.kind === "result") {
    const { result } = visibleGenerationState;
    if (result.status === "pending_recommendation_created") {
      return (
        <StatusCard
          kind="status"
          title="Preparing your plan recommendation"
          message="The recommendation was saved. Marathoner is waiting for the server-confirmed review to appear; your plan is still unchanged."
        />
      );
    }
    if (result.status === "no_change") {
      return (
        <StatusCard
          kind="status"
          title="Your current plan still fits"
          message="The current beta rules did not find a supported change for this training pattern. Nothing was changed."
        />
      );
    }
    if (result.status === "retryable_error") {
      return (
        <StatusCard
          kind="alert"
          title="The training check is temporarily unavailable"
          message="Your plan is unchanged. Reconnect, then try the same check again."
          action={{
            label: "Try the same check again",
            run: () => void submit(visibleGenerationState.command),
          }}
        />
      );
    }
    const paused =
      result.status === "disabled" ||
      result.status === "stale_version" ||
      result.status === "unavailable";
    return (
      <StatusCard
        kind={result.status === "refused" ? "status" : "alert"}
        title={
          result.status === "refused"
            ? "No plan change is recommended"
            : paused
              ? "Plan recommendations are unavailable"
              : "The training check could not be completed"
        }
        message={`${result.message} Your active plan is unchanged.`}
      />
    );
  }

  return (
    <section
      className="closed-beta-adaptation-surface"
      aria-labelledby="closed-beta-adaptation-title"
    >
      <p className="closed-beta-adaptation-eyebrow">Training check</p>
      <h2 id="closed-beta-adaptation-title">See whether your plan still fits</h2>
      <p>
        Marathoner can compare your recent completed training with the current
        beta rules. It will never change your plan without showing you the
        exact recommendation first.
      </p>
      <button type="button" onClick={() => void submit()}>
        Check recent training
      </button>
    </section>
  );
}
