import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import RecommendationDecisionReview, {
  type RecommendationDecisionReviewModel,
  type RecommendationDecisionReviewProps,
} from "./RecommendationDecisionReview";

const model: RecommendationDecisionReviewModel = {
  title: "Give next week another steady pass",
  observation:
    "This synthetic fixture recorded two harder-than-expected runs in the current week.",
  meaning:
    "The fixture reached an internal threshold for reviewing the next progression.",
  recommendation:
    "Repeat the current week’s planned targets once before progressing.",
  impact:
    "The race date and every later training week remain unchanged in this preview.",
  contentState: "internal_preview",
};

function props(
  overrides: Partial<RecommendationDecisionReviewProps> = {},
): RecommendationDecisionReviewProps {
  return {
    model,
    state: { kind: "ready" },
    onKeep: vi.fn(),
    onApply: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

describe("RecommendationDecisionReview", () => {
  it("presents the recommendation as an ordered, explicitly synthetic review", () => {
    render(<RecommendationDecisionReview {...props()} />);

    expect(
      screen.getByRole("heading", { name: model.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Internal preview",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "not approved training guidance",
    );

    for (const heading of [
      "Observation",
      "What it means",
      "Recommended change",
      "Expected impact",
      "Your choice",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }

    expect(screen.getByText(model.observation)).toBeInTheDocument();
    expect(screen.getByText(model.meaning)).toBeInTheDocument();
    expect(screen.getByText(model.recommendation)).toBeInTheDocument();
    expect(screen.getByText(model.impact)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Keep current plan" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Apply this change" }),
    ).toBeDisabled();
  });

  it("does not label reviewed participant copy as synthetic", () => {
    render(
      <RecommendationDecisionReview
        {...props({
          model: { ...model, contentState: "reviewed" },
        })}
      />,
    );

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("enables unmistakably session-only choices only in internal rehearsal mode", async () => {
    const user = userEvent.setup();
    const viewProps = props({ interactionMode: "internal_rehearsal" });
    render(<RecommendationDecisionReview {...viewProps} />);

    expect(screen.getByRole("note")).toHaveTextContent(
      "session-only and cannot change a real plan",
    );
    const keepButton = screen.getByRole("button", {
      name: "Keep in rehearsal",
    });
    const applyButton = screen.getByRole("button", {
      name: "Apply in rehearsal",
    });
    expect(keepButton).toBeEnabled();
    expect(applyButton).toBeEnabled();

    await user.click(keepButton);
    await user.click(applyButton);

    expect(viewProps.onKeep).toHaveBeenCalledOnce();
    expect(viewProps.onApply).toHaveBeenCalledOnce();
  });

  it("offers explicit keep and apply choices through supplied callbacks", async () => {
    const user = userEvent.setup();
    const viewProps = props({
      model: { ...model, contentState: "reviewed" },
    });
    render(<RecommendationDecisionReview {...viewProps} />);

    await user.click(screen.getByRole("button", { name: "Keep current plan" }));
    await user.click(screen.getByRole("button", { name: "Apply this change" }));

    expect(viewProps.onKeep).toHaveBeenCalledOnce();
    expect(viewProps.onApply).toHaveBeenCalledOnce();
    expect(viewProps.onRetry).not.toHaveBeenCalled();
  });

  it.each([
    ["keep" as const, "Keeping current plan…", "Keeping your current plan"],
    ["apply" as const, "Applying change…", "Applying this change"],
  ])(
    "blocks repeated decisions while %s is pending",
    (decision, pendingButtonName, announcement) => {
      render(
        <RecommendationDecisionReview
          {...props({ state: { kind: "pending", decision } })}
        />,
      );

      expect(screen.getByRole("button", { name: pendingButtonName })).toBeDisabled();
      const otherButton =
        decision === "keep" ? "Apply this change" : "Keep current plan";
      expect(screen.getByRole("button", { name: otherButton })).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent(announcement);
    },
  );

  it("moves focus to an unavailable state and offers no decision action", () => {
    render(
      <RecommendationDecisionReview
        {...props({
          state: {
            kind: "unavailable",
            title: "Recommendation decisions are paused",
            message:
              "Review your current plan for now. Marathoner has not changed it.",
          },
        })}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent("Marathoner has not changed it");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    [
      "keep" as const,
      "Current plan kept",
      "Marathoner confirmed your choice.",
    ],
    [
      "apply" as const,
      "Recommendation applied",
      "Marathoner confirmed the plan change.",
    ],
  ])(
    "moves focus to the %s confirmation and removes decision actions",
    (decision, title, message) => {
      render(
        <RecommendationDecisionReview
          {...props({
            model: { ...model, contentState: "reviewed" },
            state: { kind: "confirmed", decision, title, message },
          })}
        />,
      );

      const status = screen.getByRole("status");
      expect(status).toHaveFocus();
      expect(status).toHaveTextContent(title);
      expect(status).toHaveTextContent(message);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it("moves focus to a recoverable error and invokes only the retry callback", async () => {
    const user = userEvent.setup();
    const viewProps = props({
      state: {
        kind: "error",
        title: "The decision was not completed",
        message:
          "Your current plan is unchanged. Reconnect, then try this decision again.",
        retryLabel: "Try decision again",
      },
    });
    render(<RecommendationDecisionReview {...viewProps} />);

    expect(screen.getByRole("alert")).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Try decision again" }),
    );

    expect(viewProps.onRetry).toHaveBeenCalledOnce();
    expect(viewProps.onKeep).not.toHaveBeenCalled();
    expect(viewProps.onApply).not.toHaveBeenCalled();
  });

  it("has no beta-blocking accessibility violations in critical states", async () => {
    const view = render(<RecommendationDecisionReview {...props()} />);
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);

    view.rerender(
      <RecommendationDecisionReview
        {...props({ interactionMode: "internal_rehearsal" })}
      />,
    );
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);

    view.rerender(
      <RecommendationDecisionReview
        {...props({ state: { kind: "pending", decision: "apply" } })}
      />,
    );
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);

    view.rerender(
      <RecommendationDecisionReview
        {...props({
          state: {
            kind: "error",
            title: "The decision was not completed",
            message: "Your current plan is unchanged. Try again when connected.",
            retryLabel: "Try decision again",
          },
        })}
      />,
    );
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });
});
