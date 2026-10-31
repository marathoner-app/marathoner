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

async function expectMobileBottomNavigation(page: Page) {
  const navigation = page.getByRole("navigation", { name: "Training sections" });
  const navigationBounds = await navigation.boundingBox();
  expect(navigationBounds, "mobile navigation should have bounds").not.toBeNull();
  if (!navigationBounds) return;

  await expect(navigation).toHaveCSS("position", "fixed");
  expect(
    navigationBounds.y + navigationBounds.height,
    "mobile navigation should meet the bottom viewport edge",
  ).toBeCloseTo(await page.evaluate(() => window.innerHeight), 0);

  const triggerBounds = [];
  for (const name of ["Plan", "Track", "Analyze"]) {
    const trigger = page.getByRole("button", { name, exact: true });
    await expectMinimumTouchTarget(trigger, `${name} mobile navigation destination`);
    triggerBounds.push(await trigger.boundingBox());
  }

  expect(triggerBounds.every((bounds) => bounds !== null)).toBe(true);
  if (triggerBounds.some((bounds) => bounds === null)) return;
  const [planBounds, trackBounds, analyzeBounds] = triggerBounds as [
    NonNullable<(typeof triggerBounds)[number]>,
    NonNullable<(typeof triggerBounds)[number]>,
    NonNullable<(typeof triggerBounds)[number]>,
  ];
  expect(planBounds.width).toBeCloseTo(trackBounds.width, 0);
  expect(trackBounds.width).toBeCloseTo(analyzeBounds.width, 0);
  expect(planBounds.x).toBeLessThan(trackBounds.x);
  expect(trackBounds.x).toBeLessThan(analyzeBounds.x);
}

async function expectAboveNavigation(
  content: Locator,
  navigation: Locator,
  label: string,
) {
  const contentBounds = await content.boundingBox();
  const navigationBounds = await navigation.boundingBox();
  expect(contentBounds, `${label} should have bounds`).not.toBeNull();
  expect(navigationBounds, "navigation should have bounds").not.toBeNull();
  if (!contentBounds || !navigationBounds) return;

  expect(
    contentBounds.y + contentBounds.height,
    `${label} should not be covered by the bottom navigation`,
  ).toBeLessThanOrEqual(navigationBounds.y + 0.5);
}

async function expectHomeVisible(page: Page) {
  await expect(page.getByText("Signed in as runner@example.com")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Marathoner." })).toBeVisible();
  await expect(page.getByText("Welcome to your training companion")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit runner profile" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "No active plan yet" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Training sections" })).toBeVisible();
}

test("uses the shared canvas, banner, and card surface hierarchy", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("tests/viewport/signedInHome.html");
  await expectHomeVisible(page);

  await expect(page.locator("main")).toHaveCSS(
    "background-color",
    "rgb(248, 250, 252)",
  );
  await expect(page.locator(".session-controls")).toHaveCSS(
    "background-color",
    "rgb(231, 236, 248)",
  );
  await expect(page.locator(".next-workout-summary")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );

  await page.getByRole("button", { name: "Plan", exact: true }).click();
  const panel = page.locator(".section-panel");
  await expect(panel).toHaveCSS("background-color", "rgb(248, 250, 252)");
  await expect
    .poll(() =>
      panel.evaluate((element) =>
        window.getComputedStyle(element, "::before").backgroundColor,
      ),
    )
    .toBe("rgb(231, 236, 248)");
});

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
  await expectMobileBottomNavigation(page);

  for (const name of [
    "Account settings",
    "Log out",
    "Edit runner profile",
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
  const finalAction = page.getByRole("button", { name: "Final signed-in action" });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(finalAction).toBeInViewport();
  await expectAboveNavigation(finalAction, navigation, "final signed-in action");
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
  await expectMobileBottomNavigation(page);
  const finalAction = page.getByRole("button", { name: "Final signed-in action" });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(finalAction).toBeInViewport();
  await expectAboveNavigation(
    finalAction,
    navigation,
    "large-text final signed-in action",
  );
  await expectNoHorizontalOverflow(
    page,
    "signed-in home",
    "at phone width with 200% text",
  );
});

test("hides training destinations until runner setup is complete", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("tests/viewport/signedInHome.html?setup=incomplete");

  await expect(
    page.getByRole("button", { name: "Resume runner setup" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Training sections" }),
  ).toHaveCount(0);
  for (const name of ["Plan", "Track", "Analyze"]) {
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveCount(0);
  }
  await expectNoHorizontalOverflow(
    page,
    "incomplete runner setup home",
    "at phone width",
  );
});

test("keeps the desktop signed-in banner in normal flow", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto("tests/viewport/signedInHome.html");
  await expectHomeVisible(page);

  const controls = page.locator(".session-controls");
  const title = page.getByRole("heading", { level: 1, name: "Marathoner." });

  await expect(controls).toHaveCSS("position", "static");
  await expect(controls).toHaveCSS(
    "background-color",
    "rgb(231, 236, 248)",
  );
  await expectBefore(controls, title, "desktop account banner and brand");
  await expect(
    page.getByRole("navigation", { name: "Training sections" }),
  ).toHaveCSS("position", "static");
  await expectNoHorizontalOverflow(page, "signed-in home", "at desktop width");
});

test("keeps mobile navigation available while switching sections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("tests/viewport/signedInHome.html");

  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Plan Your Workouts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Plan", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expectMobileBottomNavigation(page);

  await page.getByRole("button", { name: "Track", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Track Your Runs" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Plan", exact: true }),
  ).not.toHaveAttribute("aria-current");
  await expect(
    page.getByRole("button", { name: "Track", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  const finalAction = page.getByRole("button", { name: "Final section action" });
  await finalAction.scrollIntoViewIfNeeded();
  await expect(finalAction).toBeInViewport();
  await expectAboveNavigation(
    finalAction,
    page.getByRole("navigation", { name: "Training sections" }),
    "final section action",
  );
  await expectNoHorizontalOverflow(
    page,
    "signed-in training section",
    "after mobile tab switching",
  );
});

test("keeps overflowing signed-in content reachable at desktop width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto("tests/viewport/signedInHome.html");

  const finalAction = page.getByRole("button", {
    name: "Final signed-in action",
  });
  const layout = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
  }));

  expect(layout.documentHeight).toBeGreaterThan(layout.viewportHeight);
  await finalAction.scrollIntoViewIfNeeded();
  await expect(finalAction).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expectNoHorizontalOverflow(
    page,
    "overflowing signed-in home",
    "after scrolling at desktop width",
  );
});
