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
    await expect(
      page.getByRole("heading", { name: "New account registration is closed." }),
    ).toBeVisible();
    const accessLink = page.getByRole("link", { name: "Current access" });
    await expect(accessLink).toHaveAttribute("href", "#access-status");
    await accessLink.click();
    await expect(page).toHaveURL(/#access-status$/);
    await expect(page.locator("#access-status")).toBeVisible();
    const login = page.getByRole("button", { name: "Log in" });
    await expect(login).toHaveCount(1);
    await expect(login).toBeVisible();
    await expectNoHorizontalOverflow(
      page,
      "Public landing page",
      "before login",
    );

    await login.click();
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
    await expect(login).toBeFocused();
  });
}
