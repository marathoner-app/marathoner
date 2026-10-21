import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./layoutAssertions";

const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1_440, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`keeps the signed-out landing shell usable at ${viewport.name} width`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("tests/viewport/landing.html");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Your first marathon. One clear plan.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Built for first-time marathoners")).toBeVisible();
    const preview = page.getByRole("complementary", {
      name: "One run, clearly recorded.",
    });
    await expect(preview).toBeVisible();
    await expect(
      preview.getByText("Illustrative product preview"),
    ).toBeVisible();
    await expect(
      preview.getByText(
        "Synthetic example only — not a live plan or training recommendation.",
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
      .toBe(viewport.name === "phone" ? 1 : 3);
    const headerLogin = page.getByRole("button", {
      name: "Log in",
      exact: true,
    });
    const webLogin = page.getByRole("button", { name: "Log in on web" });
    await expect(headerLogin).toBeVisible();
    await expect(webLogin).toBeVisible();
    await expectNoHorizontalOverflow(
      page,
      "Public landing page",
      "before login",
    );

    await webLogin.click();
    await expect(
      page.getByRole("dialog", { name: "Existing account login" }),
    ).toBeVisible();
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
