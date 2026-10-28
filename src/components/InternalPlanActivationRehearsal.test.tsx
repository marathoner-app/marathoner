import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { planGenerationContractFixtures } from "../domain/training/planGenerationFixtures";
import InternalPlanActivationRehearsal from "./InternalPlanActivationRehearsal";

const result = planGenerationContractFixtures[0]?.result;

if (result?.kind !== "generated") {
  throw new Error("Expected the first contract fixture to contain a plan.");
}

describe("InternalPlanActivationRehearsal", () => {
  it("explains the session preview boundary before and after activation", async () => {
    const user = userEvent.setup();

    render(
      <InternalPlanActivationRehearsal
        result={result}
        onReviewInputs={vi.fn()}
        onSessionActivationChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Continue review" }));

    expect(
      screen.getByText(
        /previews this draft in the home next-workout card and Plan calendar/iu,
      ),
    ).toHaveTextContent("It does not save or approve the plan");
    expect(
      screen.getByText(
        /previews this draft in the home next-workout card and Plan calendar/iu,
      ),
    ).toHaveTextContent(
      "Track continues to use synchronized training data.",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Activate only in this rehearsal",
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      `${result.plan.name} is active as a session-only preview in home and Plan.`,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "It was not saved or approved.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Track and synchronized training data remain unchanged.",
    );
  });

  it("reports activation and ending it to the surrounding workspace", async () => {
    const user = userEvent.setup();
    const onSessionActivationChange = vi.fn();

    render(
      <InternalPlanActivationRehearsal
        result={result}
        onReviewInputs={vi.fn()}
        onSessionActivationChange={onSessionActivationChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Continue review" }));
    await user.click(
      screen.getByRole("button", {
        name: "Activate only in this rehearsal",
      }),
    );

    expect(onSessionActivationChange).toHaveBeenLastCalledWith(result);
    expect(
      screen.getByRole("heading", { name: "Active only in this rehearsal" }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "End rehearsal activation" }),
    );

    expect(onSessionActivationChange).toHaveBeenLastCalledWith(null);
    expect(
      screen.getByText("Proposed plan — not active"),
    ).toBeVisible();
  });

  it("clears session activation before returning to the input form", async () => {
    const user = userEvent.setup();
    const onReviewInputs = vi.fn();
    const onSessionActivationChange = vi.fn();

    render(
      <InternalPlanActivationRehearsal
        result={result}
        onReviewInputs={onReviewInputs}
        onSessionActivationChange={onSessionActivationChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Review inputs" }));

    expect(onSessionActivationChange).toHaveBeenCalledOnce();
    expect(onSessionActivationChange).toHaveBeenCalledWith(null);
    expect(onReviewInputs).toHaveBeenCalledOnce();
  });
});
