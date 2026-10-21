import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PublicLandingPage from "./PublicLandingPage";

vi.mock("../services/authService", () => ({
  requestPasswordReset: vi.fn(),
  signIn: vi.fn(),
}));

const renderPublicLandingPage = () =>
  render(
    <main>
      <PublicLandingPage supportEmail="support@marathonerapp.com" />
    </main>,
  );

describe("PublicLandingPage", () => {
  it("keeps honest access information in a navigable public shell", () => {
    renderPublicLandingPage();

    expect(screen.getByTestId("public-landing-page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Training for a marathon is enough work.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Marathoner.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Marathoner brings your race date, weekly schedule, training plan, and completed runs into one place. It is built for first-time marathoners who want to understand what to do next and how each week leads to race day.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Built for first-time marathoners"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Your first marathon. One clear plan.",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("public-landing-page")).not.toHaveTextContent(
      /\u2014/,
    );
    expect(
      screen.getByRole("heading", {
        name: "New account registration is closed.",
      }),
    ).toBeInTheDocument();
    const publicNavigation = screen.getByRole("navigation", {
      name: "Public site",
    });
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(document.querySelector("#landing-main-content")).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#landing-main-content");
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
      screen.getAllByRole("button", { name: "Log in on web" }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: /request ios beta access/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign up/i }),
    ).not.toBeInTheDocument();
  });

  it("moves keyboard users from the skip link to the main content", async () => {
    const user = userEvent.setup();
    renderPublicLandingPage();

    const skipLink = screen.getByRole("link", {
      name: "Skip to main content",
    });
    const mainContent = document.querySelector("#landing-main-content");

    expect(mainContent).toBeInstanceOf(HTMLElement);

    await user.tab();
    expect(skipLink).toHaveFocus();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(mainContent).toHaveFocus());

    await user.tab();
    expect(
      screen.getByRole("link", { name: "View current access" }),
    ).toHaveFocus();
  });

  it("presents supported sample logging concepts without fake controls", () => {
    renderPublicLandingPage();

    const preview = screen.getByRole("complementary", {
      name: "One run, clearly recorded.",
    });

    expect(
      within(preview).getByText("Illustrative product preview"),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Sample data")).toBeInTheDocument();
    expect(
      within(preview).getByText(
        "Synthetic example only. This is not a live plan or training recommendation.",
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
    renderPublicLandingPage();

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

  it("explains the platform roles without inventing mobile availability", () => {
    renderPublicLandingPage();

    const platforms = screen.getByRole("region", {
      name: "One product. Two focused surfaces.",
    });
    const platformCards = within(platforms).getAllByRole("article");

    expect(platformCards).toHaveLength(2);
    expect(platformCards[0]).toHaveTextContent("iPhone");
    expect(platformCards[0]).toHaveTextContent(
      "Public TestFlight invitations are not open.",
    );
    expect(
      within(platformCards[0]).getByRole("link", {
        name: "View current iOS status",
      }),
    ).toHaveAttribute("href", "#access-status");
    expect(platformCards[1]).toHaveTextContent("Web");
    expect(platformCards[1]).toHaveTextContent(
      "Existing-account login only. New registration remains closed.",
    );
    expect(
      within(platformCards[1]).getByRole("button", {
        name: "Log in on web",
      }),
    ).toBeInTheDocument();
    expect(
      within(platforms).queryByRole("link", { name: /TestFlight|App Store/i }),
    ).not.toBeInTheDocument();
    expect(within(platforms).queryByText(/Android/i)).not.toBeInTheDocument();
  });

  it("shares one login dialog and restores focus to each opening trigger", async () => {
    const user = userEvent.setup();
    renderPublicLandingPage();

    const loginTriggers = [
      screen.getByRole("button", { name: /^Log in$/ }),
      ...screen.getAllByRole("button", { name: "Log in on web" }),
    ];

    expect(loginTriggers).toHaveLength(3);

    for (const loginTrigger of loginTriggers) {
      await user.click(loginTrigger);

      expect(
        screen.getByRole("dialog", { name: "Existing account login" }),
      ).toHaveAttribute("aria-modal", "true");
      expect(screen.getAllByRole("dialog")).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "Close login" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(loginTrigger).toHaveFocus());
    }
  });
});
