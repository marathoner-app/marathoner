import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

async function expectBefore(upper: Locator, lower: Locator, label: string) {
  const upperBounds = await upper.boundingBox();
  const lowerBounds = await lower.boundingBox();
  expect(upperBounds, `${label} upper element should have bounds`).not.toBeNull();
  expect(lowerBounds, `${label} lower element should have bounds`).not.toBeNull();
  if (!upperBounds || !lowerBounds) return;

  expect(
    upperBounds.y + upperBounds.height,
    `${label} should not overlap`,
  ).toBeLessThanOrEqual(lowerBounds.y + 0.5);
}

async function expectHomeVisible(page: Page) {
  await expect(page.getByText("Signed in as runner@example.com")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Marathoner." })).toBeVisible();
  await expect(page.getByText("Welcome to your training companion")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume runner setup" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "No active plan yet" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Training sections" })).toBeVisible();
}

test("keeps the signed-in home in normal flow at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("tests/viewport/signedInHome.html");
  await expectHomeVisible(page);

  const controls = page.locator(".session-controls");
  const title = page.getByRole("heading", { level: 1, name: "Marathoner." });
  const subtitle = page.getByText("Welcome to your training companion");
  const profile = page.locator(".runner-profile-entry");
  const nextWorkout = page.locator(".next-workout-summary");
  const navigation = page.getByRole("navigation", { name: "Training sections" });

  await expectBefore(controls, title, "account controls and brand");
  await expectBefore(title, subtitle, "brand and welcome copy");
  await expectBefore(subtitle, profile, "welcome copy and runner setup");
  await expectBefore(profile, nextWorkout, "runner setup and next workout");
  await expectBefore(nextWorkout, navigation, "next workout and navigation");

  for (const name of [
    "Account settings",
    "Log out",
    "Resume runner setup",
    "Open Plan",
    "Plan",
    "Track",
    "Analyze",
  ]) {
    await expectMinimumTouchTarget(
      page.getByRole("button", { name, exact: true }),
      `${name} on signed-in phone home`,
    );
  }
  await expectNoHorizontalOverflow(page, "signed-in home", "at phone width");
});

test("keeps the signed-in home usable with 200% text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("tests/viewport/signedInHome.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });

  await expect
    .poll(() =>
      page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize),
    )
    .toBe("32px");
  await expectHomeVisible(page);

  const controls = page.locator(".session-controls");
  const title = page.getByRole("heading", { level: 1, name: "Marathoner." });
  const subtitle = page.getByText("Welcome to your training companion");
  const profile = page.locator(".runner-profile-entry");
  const nextWorkout = page.locator(".next-workout-summary");
  const navigation = page.getByRole("navigation", { name: "Training sections" });

  await expectBefore(controls, title, "large-text account controls and brand");
  await expectBefore(title, subtitle, "large-text brand and welcome copy");
  await expectBefore(subtitle, profile, "large-text welcome copy and runner setup");
  await expectBefore(profile, nextWorkout, "large-text runner setup and next workout");
  await expectBefore(nextWorkout, navigation, "large-text next workout and navigation");
  await expectNoHorizontalOverflow(
    page,
    "signed-in home",
    "at phone width with 200% text",
  );
});

test("preserves the desktop signed-in header", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto("tests/viewport/signedInHome.html");
  await expectHomeVisible(page);

  await expect(page.locator(".session-controls")).toHaveCSS("position", "absolute");
  await expectNoHorizontalOverflow(page, "signed-in home", "at desktop width");
});
