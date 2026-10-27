import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import ReviewedGuidanceCard, {
  type ReviewedGuidanceCardModel,
  type ReviewedGuidanceCardProps,
} from "./ReviewedGuidanceCard";

const model: ReviewedGuidanceCardModel = {
  title: "Use effort, not pace, on easy days",
  message:
    "This synthetic example explains that an easy run should feel controlled enough for a short conversation.",
  limitations: [
    "This example does not prescribe a pace or diagnose why a run feels difficult.",
    "Stop and seek qualified help for pain or unusual symptoms.",
  ],
  contextLabel: "After an easy run",
  contentState: "internal_preview",
};

function props(
  overrides: Partial<ReviewedGuidanceCardProps> = {},
): ReviewedGuidanceCardProps {
  return {
    model,
    state: { kind: "ready" },
    onDismiss: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

describe("ReviewedGuidanceCard", () => {
  it("presents synthetic guidance with context and explicit limitations", () => {
    render(<ReviewedGuidanceCard {...props()} />);

    expect(screen.getByRole("heading", { name: model.title })).toBeInTheDocument();
    expect(screen.getByText("After an easy run")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Internal preview");
    expect(screen.getByRole("note")).toHaveTextContent(
      "not approved training guidance",
    );
    expect(screen.getByText(model.message)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Keep in mind" })).toBeInTheDocument();
    for (const limitation of model.limitations) {
      expect(screen.getByText(limitation)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Dismiss guidance" })).toBeDisabled();
  });

  it("omits optional context without leaving an empty label", () => {
    render(
      <ReviewedGuidanceCard
        {...props({ model: { ...model, contextLabel: undefined } })}
      />,
    );

    expect(screen.queryByText("After an easy run")).not.toBeInTheDocument();
  });

  it("does not label reviewed participant copy as synthetic", () => {
    render(
      <ReviewedGuidanceCard
        {...props({ model: { ...model, contentState: "reviewed" } })}
      />,
    );

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("dismisses reviewed guidance only through the supplied callback", async () => {
    const user = userEvent.setup();
    const viewProps = props({
      model: { ...model, contentState: "reviewed" },
    });
    render(<ReviewedGuidanceCard {...viewProps} />);

    await user.click(screen.getByRole("button", { name: "Dismiss guidance" }));

    expect(viewProps.onDismiss).toHaveBeenCalledOnce();
    expect(viewProps.onRetry).not.toHaveBeenCalled();
  });

  it("blocks duplicate dismissal while confirmation is pending", () => {
    render(
      <ReviewedGuidanceCard
        {...props({
          model: { ...model, contentState: "reviewed" },
          state: { kind: "dismiss_pending" },
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Dismissing guidance…" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Wait for confirmation",
    );
  });

  it("moves focus to an unavailable state and removes dismissal", () => {
    render(
      <ReviewedGuidanceCard
        {...props({
          state: {
            kind: "unavailable",
            title: "Guidance is unavailable",
            message: "Continue with your current plan. Try again later.",
          },
        })}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent("Continue with your current plan");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("moves focus to a recoverable error and invokes only retry", async () => {
    const user = userEvent.setup();
    const viewProps = props({
      state: {
        kind: "error",
        title: "The guidance could not be updated",
        message: "Reconnect, then try dismissing it again.",
        retryLabel: "Try again",
      },
    });
    render(<ReviewedGuidanceCard {...viewProps} />);

    expect(screen.getByRole("alert")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(viewProps.onRetry).toHaveBeenCalledOnce();
    expect(viewProps.onDismiss).not.toHaveBeenCalled();
  });

  it("has no beta-blocking accessibility violations in critical states", async () => {
    const view = render(<ReviewedGuidanceCard {...props()} />);
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);

    view.rerender(
      <ReviewedGuidanceCard
        {...props({
          model: { ...model, contentState: "reviewed" },
          state: { kind: "dismiss_pending" },
        })}
      />,
    );
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);

    view.rerender(
      <ReviewedGuidanceCard
        {...props({
          state: {
            kind: "error",
            title: "The guidance could not be updated",
            message: "Reconnect, then try again.",
            retryLabel: "Try again",
          },
        })}
      />,
    );
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });
});
