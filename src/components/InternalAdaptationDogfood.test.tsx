import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RecommendationEvidenceV2 } from "../domain/recommendations/recommendationEvidence";
import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
} from "../domain/training/identifiers";
import type {
  ActivePlanState,
  CompletedRun,
  PlannedWorkout,
} from "../domain/training/types";
import {
  RecommendationEvidenceContext,
  type RecommendationEvidenceContextValue,
} from "../recommendations/RecommendationEvidenceContext";
import type { InternalAdaptationRecommendationClient } from "../services/internalAdaptationRecommendationClient";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import InternalAdaptationDogfood from "./InternalAdaptationDogfood";
import { selectInternalAdaptationTrigger } from "./internalAdaptationTrigger";

const ownerId = createUserId("owner-1");
const planId = createTrainingPlanId("plan-1");
const workoutId = createPlannedWorkoutId("workout-1");
const activePlanState = {
  userId: ownerId,
  activePlanId: planId,
  activePlanRevision: 4,
} as ActivePlanState;
const workout = {
  id: workoutId,
  userId: ownerId,
  planId,
  kind: "run",
  status: "completed",
  scheduledDate: "2026-11-02",
} as PlannedWorkout;
const run = {
  id: createCompletedRunId("run-1"),
  userId: ownerId,
  plannedWorkoutPlanId: planId,
  plannedWorkoutId: workoutId,
} as CompletedRun;

function context(
  overrides: Partial<RecommendationEvidenceContextValue> = {},
): RecommendationEvidenceContextValue {
  return {
    status: "ready",
    evidence: [],
    origin: "server",
    hasPendingWrites: false,
    error: null,
    retry: vi.fn(),
    ...overrides,
  };
}

function client(
  generate: InternalAdaptationRecommendationClient["generate"] = vi.fn(
    async (command) => ({
      status: "no_change" as const,
      commandId: command.commandId,
      reasonCode: "ADAPT-NO-CHANGE",
      explanationKey: "adaptation.no_change",
    }),
  ),
): InternalAdaptationRecommendationClient {
  return { generate };
}

function renderSurface(
  evidenceContext: RecommendationEvidenceContextValue,
  options: {
    client?: InternalAdaptationRecommendationClient;
    activePlanState?: ActivePlanState | null;
    workouts?: readonly PlannedWorkout[];
    runs?: readonly CompletedRun[];
  } = {},
) {
  return render(
    <RecommendationEvidenceContext.Provider value={evidenceContext}>
      <InternalAdaptationDogfood
        activePlanState={options.activePlanState ?? activePlanState}
        workouts={options.workouts ?? [workout]}
        runs={options.runs ?? [run]}
        client={options.client ?? client()}
        createCommandId={() => "internal-adaptation-component-0001"}
      />
    </RecommendationEvidenceContext.Provider>,
  );
}

function pendingEvidence(
  recommendationId = "recommendation-pending-0001",
): RecommendationEvidenceV2 {
  return {
    recommendationId,
    decision: "pending",
    evaluationInput: {
      basePlanArtifactVersion: "beta-rules@0.2.0-draft",
      adaptationArtifactVersion: "beta-adaptation@0.2.0-draft",
      evaluatedPlanRevision: 4,
    },
    evaluationResult: {
      action: "hold_progression",
      reasonCode: "ADAPT-HOLD-REPEATED-HARD-EFFORT",
      explanationKey: "adaptation.hold.repeated_hard_effort",
    },
  } as unknown as RecommendationEvidenceV2;
}

describe("internal adaptation dogfood", () => {
  it("has no beta-blocking accessibility violations in its ready state", async () => {
    renderSurface(context());

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });

  it("selects the latest completed planned workout with a synchronized run", () => {
    const laterWorkout = {
      ...workout,
      id: createPlannedWorkoutId("workout-2"),
      scheduledDate: "2026-11-04",
    } as PlannedWorkout;
    const laterRun = {
      ...run,
      id: createCompletedRunId("run-2"),
      plannedWorkoutId: laterWorkout.id,
    } as CompletedRun;

    expect(
      selectInternalAdaptationTrigger(
        activePlanState,
        [workout, laterWorkout],
        [run, laterRun],
      ),
    ).toEqual({
      workoutId: laterWorkout.id,
      evaluationDate: laterWorkout.scheduledDate,
    });
  });

  it("does not select a synchronized run owned by a different user", () => {
    const otherOwnerRun = {
      ...run,
      userId: createUserId("owner-2"),
    } as CompletedRun;

    expect(
      selectInternalAdaptationTrigger(
        activePlanState,
        [workout],
        [otherOwnerRun],
      ),
    ).toBeNull();
  });

  it("waits for server-confirmed evidence history before offering a check", () => {
    renderSurface(context({ status: "loading", origin: null }));

    expect(
      screen.getByRole("status", {
        name: "Checking for an existing draft recommendation",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Check recent training" }),
    ).not.toBeInTheDocument();
  });

  it("explains when no completed planned run is eligible", () => {
    renderSurface(context(), { runs: [] });

    expect(
      screen.getByRole("status", {
        name: "No completed planned run is ready to check",
      }),
    ).toBeInTheDocument();
  });

  it("submits only the minimal trigger facts and reports no change", async () => {
    const user = userEvent.setup();
    const generate = vi.fn(async (command) => ({
      status: "no_change" as const,
      commandId: command.commandId,
      reasonCode: "ADAPT-NO-CHANGE",
      explanationKey: "adaptation.no_change",
    }));
    renderSurface(context(), { client: client(generate) });

    await user.click(
      screen.getByRole("button", { name: "Check recent training" }),
    );

    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(generate.mock.calls[0]?.[0]).toEqual({
      schemaVersion: 1,
      commandId: "internal-adaptation-component-0001",
      triggerWorkoutId: workoutId,
      evaluationDate: "2026-11-02",
      confirmedRescheduleTargetDate: null,
    });
    expect(
      await screen.findByRole("status", {
        name: "No draft plan change was recommended",
      }),
    ).toBeInTheDocument();
  });

  it("retries an ambiguous outcome with the exact same command", async () => {
    const user = userEvent.setup();
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection lost"))
      .mockResolvedValueOnce({
        status: "no_change",
        commandId: "internal-adaptation-component-0001",
        reasonCode: "ADAPT-NO-CHANGE",
        explanationKey: "adaptation.no_change",
      });
    renderSurface(context(), { client: client(generate) });

    await user.click(
      screen.getByRole("button", { name: "Check recent training" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Check the same request again",
      }),
    );

    await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
    expect(generate.mock.calls[1]?.[0]).toEqual(generate.mock.calls[0]?.[0]);
  });

  it("renders one server-confirmed pending recommendation as an internal preview", async () => {
    const user = userEvent.setup();
    renderSurface(context({ evidence: [pendingEvidence()] }));

    expect(
      screen.getByRole("heading", {
        name: "Give next week another steady pass",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Internal preview")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Check recent training" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Apply in rehearsal" }),
    );
    expect(
      screen.getByText("Draft apply choice recorded for this session"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No command was sent and your active plan did not change."),
    ).toBeInTheDocument();
  });

  it("refuses to act when multiple pending recommendations exist", () => {
    renderSurface(
      context({
        evidence: [
          pendingEvidence("recommendation-pending-0001"),
          pendingEvidence("recommendation-pending-0002"),
        ],
      }),
    );

    expect(
      screen.getByRole("alert", {
        name: "Draft recommendations need reconciliation",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Check recent training" }),
    ).not.toBeInTheDocument();
  });
});
