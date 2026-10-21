import { render, screen, waitFor, within } from "@testing-library/react";
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
    expect(
      screen.getByText("Invitations are not open yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No public waitlist or self-service request path/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View current access" }),
    ).toHaveAttribute("href", "#access-status");
    expect(
      screen.getByRole("button", { name: /^Log in$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Log in on web" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/TestFlight/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request ios beta access/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign up/i }),
    ).not.toBeInTheDocument();
  });

  it("presents supported sample logging concepts without fake controls", () => {
    render(<PublicLandingPage supportEmail="support@marathonerapp.com" />);

    const preview = screen.getByRole("complementary", {
      name: "One run, clearly recorded.",
    });

    expect(
      within(preview).getByText("Illustrative product preview"),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Sample data")).toBeInTheDocument();
    expect(
      within(preview).getByText(
        "Synthetic example only — not a live plan or training recommendation.",
      ),
    ).toBeInTheDocument();
    expect(
      within(preview).getByRole("list", {
        name: "Marathoner product areas",
      }),
    ).toHaveTextContent("PlanTrackAnalyze");
    expect(within(preview).getByText("5.0 mi")).toBeInTheDocument();
    expect(within(preview).getByText("Easy")).toBeInTheDocument();
    expect(within(preview).getByText("Felt steady")).toBeInTheDocument();
    expect(within(preview).getByText("Daily trainer")).toBeInTheDocument();
    expect(within(preview).getByText("214 mi logged")).toBeInTheDocument();
    expect(within(preview).queryByRole("button")).not.toBeInTheDocument();
    expect(within(preview).queryByRole("link")).not.toBeInTheDocument();
  });

  it("distinguishes current and planned capabilities in the product model", () => {
    render(<PublicLandingPage supportEmail="support@marathonerapp.com" />);

    const explanation = screen.getByRole("region", {
      name: "Plan. Track. Adjust.",
    });
    const cards = within(explanation).getAllByRole("article");

    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Plan around your life");
    expect(cards[0]).toHaveTextContent(
      "The training methodology still requires qualified review before beta coaching use.",
    );
    expect(cards[1]).toHaveTextContent("Track what matters");
    expect(cards[1]).toHaveTextContent(
      "Log completed runs, perceived effort, notes, and shoes without a social feed.",
    );
    expect(cards[1]).toHaveTextContent(
      "Planned: Add fueling, hydration, sleep, and recovery inputs.",
    );
    expect(cards[2]).toHaveTextContent("Adjust with confidence");
    expect(cards[2]).toHaveTextContent(
      "Not available today: Marathoner does not currently recommend or apply training adjustments.",
    );
    expect(within(explanation).queryByRole("button")).not.toBeInTheDocument();
    expect(within(explanation).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shares one login dialog and restores focus to each opening trigger", async () => {
    const user = userEvent.setup();
    render(<PublicLandingPage supportEmail="support@marathonerapp.com" />);

    const loginTriggers = [
      screen.getByRole("button", { name: /^Log in$/ }),
      screen.getByRole("button", { name: "Log in on web" }),
    ];

    for (const loginTrigger of loginTriggers) {
      await user.click(loginTrigger);

      expect(
        screen.getByRole("dialog", { name: "Existing account login" }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("dialog")).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "Close login" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(loginTrigger).toHaveFocus());
    }
  });
});
