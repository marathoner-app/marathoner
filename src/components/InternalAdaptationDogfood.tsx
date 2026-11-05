import { useMemo, useState } from "react";

import {
  INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
  type InternalAdaptationRecommendationCommand,
  type InternalAdaptationRecommendationResult,
} from "../domain/recommendations/internalAdaptationRecommendation";
import type { RecommendationEvidenceV2 } from "../domain/recommendations/recommendationEvidence";
import type {
  ActivePlanState,
  CompletedRun,
  PlannedWorkout,
} from "../domain/training/types";
import { useRecommendationEvidence } from "../recommendations/useRecommendationEvidence";
import {
  createDraftRecommendationDecisionContent,
  resolveInternalRecommendationDecisionReviewModel,
} from "../recommendations/recommendationDecisionReviewContent";
import type { InternalAdaptationRecommendationClient } from "../services/internalAdaptationRecommendationClient";
import { selectInternalAdaptationTrigger } from "./internalAdaptationTrigger";
import RecommendationDecisionReview from "./RecommendationDecisionReview";

import "./InternalAdaptationDogfood.css";

export interface InternalAdaptationDogfoodProps {
  readonly activePlanState: ActivePlanState | null;
  readonly workouts: readonly PlannedWorkout[];
  readonly runs: readonly CompletedRun[];
  readonly client: InternalAdaptationRecommendationClient;
  readonly createCommandId?: () => string;
}

type GenerationState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "submitting" | "error";
      readonly triggerKey: string;
      readonly command: InternalAdaptationRecommendationCommand;
    }
  | {
      readonly kind: "result";
      readonly triggerKey: string;
      readonly command: InternalAdaptationRecommendationCommand;
      readonly result: InternalAdaptationRecommendationResult;
    };

interface SessionChoice {
  readonly recommendationId: string;
  readonly decision: "keep" | "apply";
}

function defaultCommandId(): string {
  return `internal-adaptation-${crypto.randomUUID()}`;
}

function reviewModel(evidence: RecommendationEvidenceV2) {
  const { evaluationInput, evaluationResult } = evidence;
  return resolveInternalRecommendationDecisionReviewModel(
    {
      action: evaluationResult.action,
      reasonCode: evaluationResult.reasonCode,
      explanationKey: evaluationResult.explanationKey,
      basePlanArtifactVersion: evaluationInput.basePlanArtifactVersion,
      adaptationArtifactVersion: evaluationInput.adaptationArtifactVersion,
    },
    createDraftRecommendationDecisionContent({
      basePlanArtifactVersion: evaluationInput.basePlanArtifactVersion,
      adaptationArtifactVersion: evaluationInput.adaptationArtifactVersion,
    }),
  );
}

function SurfaceState({
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
      className="internal-adaptation-dogfood"
      aria-labelledby="internal-adaptation-dogfood-title"
      role={kind}
    >
      <p className="internal-adaptation-dogfood-eyebrow">Internal testing</p>
      <h2 id="internal-adaptation-dogfood-title">{title}</h2>
      <p>{message}</p>
      {action && (
        <button type="button" onClick={action.run}>
          {action.label}
        </button>
      )}
    </section>
  );
}

export default function InternalAdaptationDogfood({
  activePlanState,
  workouts,
  runs,
  client,
  createCommandId = defaultCommandId,
}: InternalAdaptationDogfoodProps) {
  const evidenceState = useRecommendationEvidence();
  const [generationState, setGenerationState] = useState<GenerationState>({
    kind: "idle",
  });
  const [sessionChoice, setSessionChoice] = useState<SessionChoice | null>(null);
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
  const pendingEvidence = evidenceState.evidence.filter(
    ({ decision }) => decision === "pending",
  );
  const pending = pendingEvidence[0];
  const model = useMemo(
    () => (pending === undefined ? null : reviewModel(pending)),
    [pending],
  );
  const visibleChoice =
    pending !== undefined &&
    sessionChoice?.recommendationId === pending.recommendationId
      ? sessionChoice
      : null;

  const submit = async (
    existingCommand?: InternalAdaptationRecommendationCommand,
  ) => {
    if (trigger === null || triggerKey === null) return;
    const command = existingCommand ?? {
      schemaVersion: INTERNAL_ADAPTATION_RECOMMENDATION_SCHEMA_VERSION,
      commandId: createCommandId(),
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

  if (evidenceState.status === "loading") {
    return (
      <SurfaceState
        kind="status"
        title="Checking for an existing draft recommendation"
        message="Marathoner is confirming recommendation history before allowing another internal check."
      />
    );
  }
  if (evidenceState.status === "error") {
    return (
      <SurfaceState
        kind="alert"
        title="Draft recommendation history is unavailable"
        message="No new check is available until Marathoner confirms the latest server history."
        action={{ label: "Try loading history again", run: evidenceState.retry }}
      />
    );
  }
  if (
    evidenceState.origin !== "server" ||
    evidenceState.hasPendingWrites
  ) {
    return (
      <SurfaceState
        kind="status"
        title="Confirming draft recommendation history"
        message="Marathoner is waiting for the server before allowing another internal check."
      />
    );
  }
  if (pendingEvidence.length > 1) {
    return (
      <SurfaceState
        kind="alert"
        title="Draft recommendations need reconciliation"
        message="More than one pending recommendation exists. The active plan is unchanged, and no new check is available."
      />
    );
  }
  if (pending !== undefined) {
    if (model === null) {
      return (
        <SurfaceState
          kind="alert"
          title="Draft explanation is unavailable"
          message="The exact provisional explanation for this recommendation is missing. No choice is available and the active plan is unchanged."
        />
      );
    }
    return (
      <div className="internal-adaptation-dogfood-review">
        <RecommendationDecisionReview
          model={model}
          state={
            visibleChoice === null
              ? { kind: "ready" }
              : {
                  kind: "confirmed",
                  decision: visibleChoice.decision,
                  title:
                    visibleChoice.decision === "apply"
                      ? "Draft apply choice recorded for this session"
                      : "Draft keep choice recorded for this session",
                  message:
                    "No command was sent and your active plan did not change.",
                }
          }
          interactionMode="internal_rehearsal"
          onKeep={() =>
            setSessionChoice({
              recommendationId: pending.recommendationId,
              decision: "keep",
            })
          }
          onApply={() =>
            setSessionChoice({
              recommendationId: pending.recommendationId,
              decision: "apply",
            })
          }
          onRetry={() => undefined}
        />
        {visibleChoice && (
          <button
            type="button"
            className="internal-adaptation-review-again"
            onClick={() => setSessionChoice(null)}
          >
            Review this draft recommendation again
          </button>
        )}
      </div>
    );
  }
  if (trigger === null || triggerKey === null) {
    return (
      <SurfaceState
        kind="status"
        title="No completed planned run is ready to check"
        message="Log a run against a workout in the active plan before requesting an internal draft adjustment check."
      />
    );
  }
  if (visibleGenerationState.kind === "submitting") {
    return (
      <SurfaceState
        kind="status"
        title="Checking recent training"
        message="Marathoner is evaluating synchronized plan and run history. The active plan remains unchanged."
      />
    );
  }
  if (visibleGenerationState.kind === "error") {
    return (
      <SurfaceState
        kind="alert"
        title="Marathoner could not confirm the check"
        message="The outcome is unknown. Retry the same request so Marathoner can safely return its original result."
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
        <SurfaceState
          kind="status"
          title="Draft recommendation created"
          message="Marathoner is waiting for the server-confirmed recommendation to appear. The active plan is unchanged."
        />
      );
    }
    if (result.status === "no_change") {
      return (
        <SurfaceState
          kind="status"
          title="No draft plan change was recommended"
          message="The provisional rules found no bounded adjustment for this completed training. The active plan is unchanged."
        />
      );
    }
    if (result.status === "retryable_error") {
      return (
        <SurfaceState
          kind="alert"
          title="The draft check is temporarily unavailable"
          message="Marathoner did not record a result. Retry the same request when the connection is stable."
          action={{
            label: "Try the same check again",
            run: () => void submit(visibleGenerationState.command),
          }}
        />
      );
    }
    const title =
      result.status === "refused"
        ? "No safe draft recommendation was created"
        : result.status === "disabled"
          ? "Internal draft checks are turned off"
          : result.status === "authorization_error"
            ? "This account cannot run the internal check"
            : "The draft check could not be completed";
    return (
      <SurfaceState
        kind={result.status === "refused" ? "status" : "alert"}
        title={title}
        message={`${result.message} The active plan is unchanged.`}
      />
    );
  }

  return (
    <section
      className="internal-adaptation-dogfood"
      aria-labelledby="internal-adaptation-dogfood-title"
    >
      <p className="internal-adaptation-dogfood-eyebrow">Internal testing</p>
      <h2 id="internal-adaptation-dogfood-title">
        Check recent training against the draft adjustment rules
      </h2>
      <p>
        This uses synchronized training data and provisional rules. It can create
        a draft recommendation for review, but it cannot change the active plan.
      </p>
      <p className="internal-adaptation-dogfood-trigger">
        Latest eligible workout: {trigger.evaluationDate}
      </p>
      <button type="button" onClick={() => void submit()}>
        Check recent training
      </button>
    </section>
  );
}
