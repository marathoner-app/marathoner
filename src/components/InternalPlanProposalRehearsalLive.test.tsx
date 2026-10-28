import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  createUserId,
  planGenerationContractFixtures,
  type GeneratedPlanEntityProjection,
  type GeneratedPlanResultV1,
} from "../domain/training";
import InternalPlanProposalRehearsalLive from "./InternalPlanProposalRehearsalLive";

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
      />
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

    await user.click(
      screen.getByRole("button", { name: "Clear session draft" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Projected session plan" }),
      ).toHaveTextContent("No session projection"),
    );
  });
});
