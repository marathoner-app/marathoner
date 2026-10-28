import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InternalPlanActivationRehearsal from "../src/components/InternalPlanActivationRehearsal";
import {
  planGenerationContractFixtures,
  type GeneratedPlanResultV1,
} from "../src/domain/training";

const result = planGenerationContractFixtures.find(
  (fixture) => fixture.id === "generated-exact-date-distance-target",
)?.result;

if (result?.kind !== "generated") {
  throw new Error("Missing generated plan rehearsal fixture.");
}

const generatedResult: GeneratedPlanResultV1 = result;

describe("InternalPlanActivationRehearsal", () => {
  it("requires review and an explicit activation action", async () => {
    const user = userEvent.setup();
    render(
      <InternalPlanActivationRehearsal
        result={generatedResult}
        onReviewInputs={vi.fn()}
        onSessionActivationChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Active only in this rehearsal" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue review" }));

    expect(
      screen.getByRole("heading", {
        name: "Activate Synthetic contract plan in this session?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/write Firestore, or change synchronized training data/iu),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Active only in this rehearsal" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Activate only in this rehearsal",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Active only in this rehearsal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Track and synchronized training data remain unchanged",
    );
    expect(
      screen.getByRole("heading", {
        name: "First scheduled training workout",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no approval receipt/iu)).toBeInTheDocument();
  });

  it("allows backing out before activation", async () => {
    const user = userEvent.setup();
    render(
      <InternalPlanActivationRehearsal
        result={generatedResult}
        onReviewInputs={vi.fn()}
        onSessionActivationChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Continue review" }));
    await user.click(
      screen.getByRole("button", { name: "Back to proposal details" }),
    );

    expect(
      screen.getByRole("heading", { name: "Synthetic contract plan" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Active only in this rehearsal" }),
    ).not.toBeInTheDocument();
  });

  it("ends activation without persistence and can return to inputs", async () => {
    const user = userEvent.setup();
    const onReviewInputs = vi.fn();
    const { unmount } = render(
      <InternalPlanActivationRehearsal
        result={generatedResult}
        onReviewInputs={onReviewInputs}
        onSessionActivationChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Continue review" }));
    await user.click(
      screen.getByRole("button", {
        name: "Activate only in this rehearsal",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "End rehearsal activation" }),
    );

    expect(
      screen.getByRole("heading", { name: "Synthetic contract plan" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review inputs" }));
    expect(onReviewInputs).toHaveBeenCalledOnce();

    unmount();
    render(
      <InternalPlanActivationRehearsal
        result={generatedResult}
        onReviewInputs={vi.fn()}
        onSessionActivationChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("heading", { name: "Active only in this rehearsal" }),
    ).not.toBeInTheDocument();
  });
});
