import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

  it("lets visitors explore the sample Plan, Track, and Analyze workflow", async () => {
    const user = userEvent.setup();
    renderPublicLandingPage();

    const preview = screen.getByRole("complementary", {
      name: "A training week, connected.",
    });

    expect(
      within(preview).getByText("Interactive product preview"),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Sample data")).toBeInTheDocument();
    expect(
      within(preview).getByText(
        "Synthetic walkthrough only. This is not a live plan or training recommendation.",
      ),
    ).toBeInTheDocument();
    const productAreas = within(preview).getByRole("group", {
      name: "Marathoner product areas",
    });
    const planButton = within(productAreas).getByRole("button", { name: "Plan" });
    const trackButton = within(productAreas).getByRole("button", {
      name: "Track",
    });
    const analyzeButton = within(productAreas).getByRole("button", {
      name: "Analyze",
    });

    expect(planButton).toHaveAttribute("aria-pressed", "true");
    expect(within(preview).getByText("Today · Easy run")).toBeInTheDocument();
    expect(within(preview).getByText("5.0 mi")).toBeInTheDocument();
    expect(within(preview).getByText("Easy")).toBeInTheDocument();

    await user.click(trackButton);
    expect(trackButton).toHaveAttribute("aria-pressed", "true");
    expect(within(preview).getByText("Run recorded")).toBeInTheDocument();
    expect(within(preview).getByText("Felt steady")).toBeInTheDocument();
    expect(within(preview).getByText("Daily trainer")).toBeInTheDocument();
    expect(within(preview).getByText("214 mi logged")).toBeInTheDocument();

    await user.click(analyzeButton);
    expect(analyzeButton).toHaveAttribute("aria-pressed", "true");
    expect(within(preview).getByText("12.8 mi")).toBeInTheDocument();
    expect(
      within(preview).getByRole("img", {
        name: "Sample weekly distance rises from 8 miles to 20 miles across four weeks",
      }),
    ).toBeInTheDocument();
    expect(preview).toHaveAttribute("data-preview-mode", "manual");
    expect(within(preview).queryByRole("link")).not.toBeInTheDocument();
  });

  it("moves the enlarged cursor through the automatic walkthrough", () => {
    vi.useFakeTimers();

    try {
      renderPublicLandingPage();

      const preview = screen.getByRole("complementary", {
        name: "A training week, connected.",
      });
      const trackButton = within(preview).getByRole("button", {
        name: "Track",
      });
      const cursor = within(preview).getByTestId("landing-preview-cursor");

      expect(preview).toHaveAttribute("data-preview-mode", "automatic");
      expect(cursor).toHaveClass("landing-preview__demo-cursor--plan");

      act(() => vi.advanceTimersByTime(1_400));
      expect(cursor).toHaveClass("landing-preview__demo-cursor--track");

      act(() => vi.advanceTimersByTime(1_040));
      expect(trackButton).toHaveAttribute("aria-pressed", "true");
      expect(within(preview).getByText("Run recorded")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fight a visitor's manual preview selection", () => {
    vi.useFakeTimers();

    try {
      renderPublicLandingPage();

      const preview = screen.getByRole("complementary", {
        name: "A training week, connected.",
      });
      const analyzeButton = within(preview).getByRole("button", {
        name: "Analyze",
      });

      fireEvent.click(analyzeButton);
      act(() => vi.advanceTimersByTime(10_000));

      expect(preview).toHaveAttribute("data-preview-mode", "manual");
      expect(analyzeButton).toHaveAttribute("aria-pressed", "true");
      expect(within(preview).getByText("12.8 mi")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the preview static when reduced motion is requested", () => {
    const originalMatchMedia = window.matchMedia;
    vi.useFakeTimers();
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
      renderPublicLandingPage();

      const preview = screen.getByRole("complementary", {
        name: "A training week, connected.",
      });
      const planButton = within(preview).getByRole("button", { name: "Plan" });

      act(() => vi.advanceTimersByTime(10_000));
      expect(preview).toHaveAttribute("data-preview-mode", "reduced-motion");
      expect(planButton).toHaveAttribute("aria-pressed", "true");
      expect(
        within(preview).queryByTestId("landing-preview-cursor"),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
    }
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
