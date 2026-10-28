import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  createTrainingPlanId,
  createUserId,
  createUtcDateTime,
  planGenerationContractFixtures,
  projectGeneratedPlanEntities,
  type GeneratedPlanEntityProjection,
  type GeneratedPlanResultV1,
} from "../domain/training";
import InternalPlanProposalRehearsalLive from "./InternalPlanProposalRehearsalLive";
import { useInternalSessionPlanProjection } from "./useInternalSessionPlanProjection";

function generatedPlanFixture(): GeneratedPlanResultV1 {
  const fixture = planGenerationContractFixtures[0].result;
  if (fixture.kind !== "generated") {
    throw new Error(
      "The internal session projection test requires a generated fixture.",
    );
  }
  return fixture;
}

const generatedFixture = generatedPlanFixture();
const baseProjection = projectGeneratedPlanEntities({
  proposal: generatedFixture.plan,
  ownerId: createUserId("owner-1"),
  planId: createTrainingPlanId("internal-session-draft"),
  projectedAt: createUtcDateTime("2030-01-01T00:00:00.000Z"),
  status: "active",
});

function Harness() {
  const [sessionDraftPlan, setSessionDraftPlan] =
    useState<GeneratedPlanResultV1 | null>(null);
  const [projection, setProjection] =
    useState<GeneratedPlanEntityProjection | null>(null);

  return (
    <>
      <button type="button" onClick={() => setSessionDraftPlan(generatedFixture)}>
        Activate session draft
      </button>
      <button type="button" onClick={() => setSessionDraftPlan(null)}>
        Clear session draft
      </button>
      <output aria-label="Projected session plan">
        {projection?.plan.name ?? "No session projection"}
      </output>
      <InternalPlanProposalRehearsalLive
        ownerId={createUserId("owner-1")}
        profile={null}
        activePlanState={null}
        plans={[]}
        workouts={[]}
        runs={[]}
        sessionDraftPlan={sessionDraftPlan}
        onSessionDraftPlanChange={setSessionDraftPlan}
        onSessionPlanProjectionChange={setProjection}
        onSessionAdaptationStateChange={() => undefined}
      />
    </>
  );
}

function SessionProjectionHarness() {
  const [sessionDraftPlan, setSessionDraftPlan] =
    useState<GeneratedPlanResultV1 | null>(generatedFixture);
  const {
    sessionPlanProjection,
    isSessionAdaptationActive,
    handleSessionAdaptationProjectionChange,
  } = useInternalSessionPlanProjection(
    sessionDraftPlan,
    sessionDraftPlan === null ? null : baseProjection,
  );

  return (
    <>
      <output aria-label="Effective session plan">
        {sessionPlanProjection?.plan.name ?? "No session projection"}
      </output>
      <output aria-label="Session adaptation state">
        {isSessionAdaptationActive ? "Adjusted" : "Base"}
      </output>
      <button
        type="button"
        onClick={() =>
          handleSessionAdaptationProjectionChange({
            ...baseProjection,
            plan: { ...baseProjection.plan, name: "Adapted session plan" },
          })
        }
      >
        Apply lifted session projection
      </button>
      <button
        type="button"
        onClick={() => handleSessionAdaptationProjectionChange(null)}
      >
        Restore base session projection
      </button>
      <button type="button" onClick={() => setSessionDraftPlan(null)}>
        Clear source session draft
      </button>
      <button
        type="button"
        onClick={() => setSessionDraftPlan({ ...generatedFixture })}
      >
        Replace source session draft
      </button>
    </>
  );
}

describe("InternalPlanProposalRehearsalLive session projection", () => {
  it("reports activation and clearing to the authenticated shell", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(
      screen.getByRole("status", { name: "Projected session plan" }),
    ).toHaveTextContent("No session projection");

    await user.click(
      screen.getByRole("button", { name: "Activate session draft" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Projected session plan" }),
      ).toHaveTextContent("Synthetic contract plan"),
    );
    expect(
      screen.queryByRole("region", { name: "Today in the session draft" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Clear session draft" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Projected session plan" }),
      ).toHaveTextContent("No session projection"),
    );
  });

  it("reports an accepted adaptation until the rehearsal restores its base projection", async () => {
    const user = userEvent.setup();
    render(<SessionProjectionHarness />);
    await user.click(
      screen.getByRole("button", {
        name: "Apply lifted session projection",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Effective session plan" }),
      ).toHaveTextContent("Adapted session plan"),
    );
    expect(
      screen.getByRole("status", { name: "Session adaptation state" }),
    ).toHaveTextContent("Adjusted");

    await user.click(
      screen.getByRole("button", {
        name: "Restore base session projection",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Effective session plan" }),
      ).toHaveTextContent("Synthetic contract plan"),
    );
    expect(
      screen.getByRole("status", { name: "Session adaptation state" }),
    ).toHaveTextContent("Base");

    await user.click(
      screen.getByRole("button", { name: "Apply lifted session projection" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Replace source session draft" }),
    );
    expect(
      screen.getByRole("status", { name: "Effective session plan" }),
    ).toHaveTextContent("Synthetic contract plan");
    expect(
      screen.getByRole("status", { name: "Session adaptation state" }),
    ).toHaveTextContent("Base");

    await user.click(
      screen.getByRole("button", { name: "Apply lifted session projection" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Clear source session draft" }),
    );
    expect(
      screen.getByRole("status", { name: "Effective session plan" }),
    ).toHaveTextContent("No session projection");
    expect(
      screen.getByRole("status", { name: "Session adaptation state" }),
    ).toHaveTextContent("Base");
  });
});
