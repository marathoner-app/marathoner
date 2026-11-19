import { createRoot } from "react-dom/client";

import ClosedBetaAdaptationSurface from "../../src/components/ClosedBetaAdaptationSurface";
import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
} from "../../src/domain/training/identifiers";
import type {
  ActivePlanState,
  CompletedRun,
  PlannedWorkout,
} from "../../src/domain/training/types";
import "../../src/index.css";
import { RecommendationEvidenceContext } from "../../src/recommendations/RecommendationEvidenceContext";
import type { ClosedBetaAdaptationRecommendationClient } from "../../src/services/closedBetaAdaptationRecommendationClient";
import { closedBetaMethodologyManifestFixture } from "../../src/test/closedBetaMethodologyManifest";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Training check viewport fixture root was not found.");
}

const ownerId = createUserId("viewport-training-check-runner");
const planId = createTrainingPlanId("viewport-training-check-plan");
const workoutId = createPlannedWorkoutId("viewport-training-check-workout");
const activePlanState = {
  userId: ownerId,
  activePlanId: planId,
  activePlanRevision: 3,
} as ActivePlanState;
const workout = {
  id: workoutId,
  userId: ownerId,
  planId,
  scheduledDate: "2026-11-09",
  status: "completed",
  kind: "run",
} as PlannedWorkout;
const run = {
  id: createCompletedRunId("viewport-training-check-run"),
  userId: ownerId,
  plannedWorkoutPlanId: planId,
  plannedWorkoutId: workoutId,
  startedAt: "2026-11-09T18:00:00.000Z",
} as CompletedRun;
const pendingClient: ClosedBetaAdaptationRecommendationClient = {
  generate: () => new Promise<never>(() => undefined),
};

createRoot(root).render(
  <div
    style={{
      boxSizing: "border-box",
      marginInline: "auto",
      maxWidth: "44rem",
      padding: "1rem",
    }}
  >
    <RecommendationEvidenceContext.Provider
      value={{
        status: "ready",
        evidence: [],
        origin: "server",
        hasPendingWrites: false,
        error: null,
        retry: () => undefined,
      }}
    >
      <ClosedBetaAdaptationSurface
        manifest={closedBetaMethodologyManifestFixture}
        activePlanState={activePlanState}
        workouts={[workout]}
        runs={[run]}
        client={pendingClient}
        createCommandId={() => "viewport-training-check-command"}
      />
    </RecommendationEvidenceContext.Provider>
  </div>,
);
