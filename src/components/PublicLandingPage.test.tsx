import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PublicLandingPage from "./PublicLandingPage";

vi.mock("../services/authService", () => ({
  requestPasswordReset: vi.fn(),
  signIn: vi.fn(),
}));

describe("PublicLandingPage", () => {
  it("keeps honest access information in a navigable public shell", () => {
    render(<PublicLandingPage supportEmail="support@marathonerapp.com" />);

    expect(screen.getByTestId("public-landing-page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Your first marathon. One clear plan.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Marathoner.")).toBeInTheDocument();
    expect(
      screen.getByText("Built for first-time marathoners"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Marathoner turns your race date, starting point, and real-life schedule into training you can understand and adjust.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Reach the start line prepared, informed, and in control.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "New account registration is closed.",
      }),
    ).toBeInTheDocument();
    const publicNavigation = screen.getByRole("navigation", {
      name: "Public site",
    });
    expect(screen.getByRole("banner")).toContainElement(publicNavigation);
    expect(publicNavigation).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Current access" }),
    ).toHaveAttribute("href", "#access-status");
    expect(document.querySelector("#access-status")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Log in" })).toHaveLength(1);
    expect(screen.queryByText(/TestFlight/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request ios beta access/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign up/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the existing login dialog from the header and restores focus", async () => {
    const user = userEvent.setup();
    render(<PublicLandingPage supportEmail="support@marathonerapp.com" />);

    const login = screen.getByRole("button", { name: "Log in" });
    await user.click(login);

    expect(
      screen.getByRole("dialog", { name: "Existing account login" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close login" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(login).toHaveFocus());
  });
});
