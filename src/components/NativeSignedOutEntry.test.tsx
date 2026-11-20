import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import NativeSignedOutEntry from "./NativeSignedOutEntry";

vi.mock("../services/authService", () => ({
  requestPasswordReset: vi.fn(),
  signIn: vi.fn(),
}));

const renderEntry = (statusNotice?: string) =>
  render(
    <main>
      <NativeSignedOutEntry
        statusNotice={statusNotice}
        supportEmail="support@marathonerapp.com"
      />
    </main>,
  );

describe("NativeSignedOutEntry", () => {
  it("keeps the installed entry compact and offers account recovery", async () => {
    const user = userEvent.setup();
    renderEntry("Your session ended. Log in again.");

    expect(screen.getByTestId("native-signed-out-entry")).toBeInTheDocument();
    expect(screen.getByText("Marathoner.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Training for a marathon is enough work.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your session ended. Log in again.",
    );
    expect(screen.queryByText(/how it works/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/interest list/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /get updates/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute(
      "href",
      "mailto:support@marathonerapp.com?subject=Marathoner%20account%20support%20request",
    );

    const resetButton = screen.getByRole("button", { name: "Reset password" });
    await user.click(resetButton);
    expect(
      screen.getByRole("dialog", { name: "Reset your password" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveFocus();

    await user.click(
      screen.getByRole("button", { name: "Close password reset" }),
    );
    await waitFor(() => expect(resetButton).toHaveFocus());
  });

  it("opens the existing-account login and has no beta-blocking accessibility violations", async () => {
    const user = userEvent.setup();
    renderEntry();

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      screen.getByRole("dialog", { name: "Existing account login" }),
    ).toBeInTheDocument();
    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });

  it("uses a static poster when reduced motion is requested", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });

    try {
      renderEntry();

      expect(screen.queryByTestId("native-entry-video")).not.toBeInTheDocument();
      expect(screen.getByTestId("native-entry-poster")).toHaveAttribute(
        "src",
        "/landing/runner-hero-poster.jpg",
      );
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("renders the motion visual with native playback attributes", () => {
    renderEntry();

    const video = screen.getByTestId("native-entry-video");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveProperty("muted", true);
    expect(video).toHaveAttribute("playsinline");
    expect(video.querySelector("source")).toHaveAttribute(
      "src",
      "/landing/runner-hero.mp4",
    );
  });
});
