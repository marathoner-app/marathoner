import { expect, test } from "@playwright/test";
import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

const viewports = [
  {
    name: "narrow phone",
    width: 320,
    height: 568,
    explanationColumns: 1,
    platformColumns: 1,
    platformCardColumns: 1,
    trustColumns: 1,
  },
  {
    name: "phone",
    width: 390,
    height: 844,
    explanationColumns: 1,
    platformColumns: 1,
    platformCardColumns: 1,
    trustColumns: 1,
  },
  {
    name: "tablet",
    width: 768,
    height: 1_024,
    explanationColumns: 1,
    platformColumns: 1,
    platformCardColumns: 2,
    trustColumns: 1,
  },
  {
    name: "laptop",
    width: 1_280,
    height: 800,
    explanationColumns: 3,
    platformColumns: 2,
    platformCardColumns: 2,
    trustColumns: 3,
  },
  {
    name: "desktop",
    width: 1_440,
    height: 900,
    explanationColumns: 3,
    platformColumns: 2,
    platformCardColumns: 2,
    trustColumns: 3,
  },
] as const;

for (const viewport of viewports) {
  test(`keeps the signed-out landing shell usable at ${viewport.name} width`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("tests/viewport/landing.html");

    const landingFrame = page.locator(".landing-page__frame");
    const landingFrameBounds = await landingFrame.boundingBox();
    expect(
      landingFrameBounds,
      "landing frame should have visible bounds",
    ).not.toBeNull();
    if (viewport.width >= 1_280 && landingFrameBounds) {
      expect(
        landingFrameBounds.width / viewport.width,
        "laptop and desktop landing frames should use at least 90% of the viewport",
      ).toBeGreaterThanOrEqual(0.9);
    }

    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
    await expectMinimumTouchTarget(skipLink, "skip link");
    await page.keyboard.press("Enter");
    await expect(page.locator("#landing-main-content")).toBeFocused();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Training for a marathon is enough work.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Marathoner brings your race date, weekly schedule, training plan, and completed runs into one place. It is built for first-time marathoners who want to understand what to do next and how each week leads to race day.",
      ),
    ).toBeVisible();
    const preview = page.getByRole("complementary", {
      name: "One run, clearly recorded.",
    });
    await expect(preview).toBeVisible();
    await expect(
      preview.getByText("Illustrative product preview"),
    ).toBeVisible();
    await expect(
      preview.getByText(
        "Synthetic example only. This is not a live plan or training recommendation.",
      ),
    ).toBeVisible();
    await expect(preview.getByRole("button")).toHaveCount(0);
    await expect(preview.getByRole("link")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "New account registration is closed." }),
    ).toBeVisible();
    const accessLink = page.getByRole("link", {
      name: "Current access",
      exact: true,
    });
    await expect(accessLink).toHaveAttribute("href", "#access-status");
    await accessLink.click();
    await expect(page).toHaveURL(/#access-status$/);
    await expect(page.locator("#access-status")).toBeVisible();
    await expect(page.getByText("Invitations are not open yet.")).toBeVisible();
    const explanation = page.getByRole("region", {
      name: "Plan. Track. Adjust.",
    });
    await expect(explanation).toBeVisible();
    await expect(
      explanation.getByRole("heading", { name: "Plan around your life" }),
    ).toBeVisible();
    await expect(
      explanation.getByRole("heading", { name: "Track what matters" }),
    ).toBeVisible();
    await expect(
      explanation.getByRole("heading", { name: "Adjust with confidence" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        explanation
          .locator(".landing-how-it-works__cards")
          .evaluate(
            (cards) =>
              window.getComputedStyle(cards).gridTemplateColumns.split(" ")
                .length,
          ),
      )
      .toBe(viewport.explanationColumns);
    const platforms = page.getByRole("region", {
      name: "One product. Two focused surfaces.",
    });
    await expect(platforms).toBeVisible();
    await expect(
      platforms.getByText("Public TestFlight invitations are not open."),
    ).toBeVisible();
    await expect(
      platforms.getByRole("link", { name: "View current iOS status" }),
    ).toHaveAttribute("href", "#access-status");
    await expect(
      platforms.getByRole("button", { name: "Log in on web" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        platforms.evaluate(
          (section) =>
            window.getComputedStyle(section).gridTemplateColumns.split(" ")
              .length,
        ),
      )
      .toBe(viewport.platformColumns);
    await expect
      .poll(() =>
        platforms
          .locator(".landing-platforms__cards")
          .evaluate(
            (cards) =>
              window.getComputedStyle(cards).gridTemplateColumns.split(" ")
                .length,
          ),
      )
      .toBe(viewport.platformCardColumns);
    await expect
      .poll(() =>
        page
          .locator(".trust-grid")
          .evaluate(
            (grid) =>
              window.getComputedStyle(grid).gridTemplateColumns.split(" ")
                .length,
          ),
      )
      .toBe(viewport.trustColumns);
    const headerLogin = page.getByRole("button", {
      name: "Log in",
      exact: true,
    });
    const webLogin = page
      .getByRole("group", { name: "Marathoner access" })
      .getByRole("button", { name: "Log in on web" });
    await expect(headerLogin).toBeVisible();
    await expect(webLogin).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log in on web" }),
    ).toHaveCount(2);

    const touchTargets = [
      {
        locator: page
          .locator(".landing-header")
          .getByRole("link", { name: "Current access" }),
        label: "header access link",
      },
      { locator: headerLogin, label: "header login button" },
      {
        locator: page
          .locator(".landing-hero")
          .getByRole("link", { name: "View current access" }),
        label: "hero access link",
      },
      {
        locator: page
          .locator(".landing-hero")
          .getByRole("button", { name: "Log in on web" }),
        label: "hero login button",
      },
      {
        locator: platforms.getByRole("link", {
          name: "View current iOS status",
        }),
        label: "iOS status link",
      },
      { locator: webLogin, label: "platform login button" },
      ...["Access", "Privacy and data", "Support and deletion"].map(
        (name) => ({
          locator: page
            .getByRole("navigation", { name: "Prototype trust information" })
            .getByRole("link", { name, exact: true }),
          label: `${name} trust link`,
        }),
      ),
    ];

    for (const target of touchTargets) {
      await expectMinimumTouchTarget(target.locator, target.label);
    }

    await expectNoHorizontalOverflow(
      page,
      "Public landing page",
      "before login",
    );

    await webLogin.click();
    const loginDialog = page.getByRole("dialog", {
      name: "Existing account login",
    });
    await expect(loginDialog).toBeVisible();
    const dialogBounds = await loginDialog.boundingBox();
    expect(dialogBounds, "login dialog should have visible bounds").not.toBeNull();
    if (dialogBounds) {
      expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
      expect(dialogBounds.y).toBeGreaterThanOrEqual(0);
      expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(
        viewport.width,
      );
      expect(dialogBounds.y + dialogBounds.height).toBeLessThanOrEqual(
        viewport.height,
      );
    }
    await expectNoHorizontalOverflow(
      page,
      "Public landing page",
      "with the login dialog open",
    );

    await page.getByRole("button", { name: "Close login" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(webLogin).toBeFocused();
  });
}
