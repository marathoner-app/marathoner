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
