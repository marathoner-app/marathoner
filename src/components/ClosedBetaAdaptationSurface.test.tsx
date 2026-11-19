import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createCompletedRunId,
  createPlannedWorkoutId,
  createTrainingPlanId,
  createUserId,
} from "../domain/training/identifiers";
import {
  createRecommendationId,
  type RecommendationEvidenceV2,
} from "../domain/recommendations";
import type {
  ActivePlanState,
  CompletedRun,
  PlannedWorkout,
} from "../domain/training/types";
import { RecommendationEvidenceContext } from "../recommendations/RecommendationEvidenceContext";
import type { ClosedBetaAdaptationRecommendationClient } from "../services/closedBetaAdaptationRecommendationClient";
import { closedBetaMethodologyManifestFixture } from "../test/closedBetaMethodologyManifest";
import ClosedBetaAdaptationSurface from "./ClosedBetaAdaptationSurface";

const ownerId = createUserId("closed-beta-runner");
const planId = createTrainingPlanId("closed-beta-plan");
const workoutId = createPlannedWorkoutId("closed-beta-workout");
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
  id: createCompletedRunId("closed-beta-run"),
  userId: ownerId,
  plannedWorkoutPlanId: planId,
  plannedWorkoutId: workoutId,
  startedAt: "2026-11-09T18:00:00.000Z",
} as CompletedRun;

function renderSurface(
  client: ClosedBetaAdaptationRecommendationClient,
  evidence: readonly RecommendationEvidenceV2[] = [],
) {
  return render(
    <RecommendationEvidenceContext.Provider
      value={{
        status: "ready",
        evidence,
        origin: "server",
        hasPendingWrites: false,
        error: null,
        retry: vi.fn(),
      }}
    >
      <ClosedBetaAdaptationSurface
        manifest={closedBetaMethodologyManifestFixture}
        activePlanState={activePlanState}
        workouts={[workout]}
        runs={[run]}
        client={client}
        createCommandId={() => "closed-beta-adaptation-command-0001"}
      />
    </RecommendationEvidenceContext.Provider>,
  );
}

describe("ClosedBetaAdaptationSurface", () => {
  it("shows the real inputs and an active status while the check is pending", async () => {
    const user = userEvent.setup();
    const client: ClosedBetaAdaptationRecommendationClient = {
      generate: vi.fn(() => new Promise<never>(() => undefined)),
    };
    renderSurface(client);

    expect(
      screen.getByRole("list", { name: "This check considers" }),
    ).toHaveTextContent("Recent runsTraining patternCurrent plan");

    await user.click(
      screen.getByRole("button", { name: "Check recent training" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Checking recent training" }),
    ).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Checking recent training");
    expect(status).toHaveTextContent(
      "Your plan stays unchanged while this check finishes.",
    );
    expect(
      screen.getByRole("list", { name: "This check considers" }),
    ).toHaveTextContent("Recent runsTraining patternCurrent plan");
  });

  it("sends the exact client manifest and artifact versions before showing no change", async () => {
    const user = userEvent.setup();
    const client: ClosedBetaAdaptationRecommendationClient = {
      generate: vi.fn(async (command) => ({
        status: "no_change" as const,
        commandId: command.commandId,
        reasonCode: "ADAPT-NO-CHANGE",
        explanationKey: "adaptation.no_change",
      })),
    };
    renderSurface(client);

    await user.click(
      screen.getByRole("button", { name: "Check recent training" }),
    );

    expect(client.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: "closed-beta-adaptation-command-0001",
        manifestVersion: "closed-beta-provisional-methodology@0.2.0",
        adaptationArtifactVersion: "beta-adaptation@0.3.0-draft",
        triggerWorkoutId: workoutId,
        evaluationDate: "2026-11-09",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your current plan still fits",
    );
    expect(
      screen.getByRole("dialog", { name: "Your current plan still fits" }),
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        ".closed-beta-adaptation-experience .closed-beta-adaptation-graphic",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to Home" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View training check" }),
    ).toHaveFocus();
  });

  it("keeps an ambiguous request idempotent when the user checks again", async () => {
    const user = userEvent.setup();
    const client: ClosedBetaAdaptationRecommendationClient = {
      generate: vi
        .fn()
        .mockRejectedValueOnce(new Error("response lost"))
        .mockResolvedValueOnce({
          status: "no_change",
          commandId: "closed-beta-adaptation-command-0001",
          reasonCode: "ADAPT-NO-CHANGE",
          explanationKey: "adaptation.no_change",
        }),
    };
    renderSurface(client);

    await user.click(
      screen.getByRole("button", { name: "Check recent training" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The training check needs confirmation",
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Check the same request again",
      }),
    );

    expect(client.generate).toHaveBeenCalledTimes(2);
    expect(vi.mocked(client.generate).mock.calls[0]?.[0]).toEqual(
      vi.mocked(client.generate).mock.calls[1]?.[0],
    );
  });

  it("keeps a server-confirmed recommendation review in the branded full-screen shell", async () => {
    const user = userEvent.setup();
    const client: ClosedBetaAdaptationRecommendationClient = {
      generate: vi.fn(),
    };
    const pendingEvidence = {
      recommendationId: createRecommendationId(
        "closed-beta-recommendation-0001",
      ),
      decision: "pending",
      evaluationInput: { evaluatedPlanRevision: 3 },
    } as unknown as RecommendationEvidenceV2;
    renderSurface(client, [pendingEvidence]);

    await user.click(
      screen.getByRole("button", { name: "Review recommendation" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Review your plan recommendation" }),
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        ".closed-beta-adaptation-experience .closed-beta-adaptation-graphic",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Recommendation explanation is not ready",
    );
    expect(client.generate).not.toHaveBeenCalled();
  });
});
