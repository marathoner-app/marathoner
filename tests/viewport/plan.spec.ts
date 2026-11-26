import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport });

async function tokenColor(page: Page, token: string) {
  return page.evaluate((name) => {
    const sample = document.createElement("span");
    sample.style.color = `var(${name})`;
    document.body.append(sample);
    const color = getComputedStyle(sample).color;
    sample.remove();
    return color;
  }, token);
}

async function expectContentContained(locator: Locator, label: string) {
  const overflow = await locator.evaluate((element) => ({
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
  }));

  expect(
    overflow.scrollWidth,
    `${label} should not overflow horizontally`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect(
    overflow.scrollHeight,
    `${label} should not overflow vertically`,
  ).toBeLessThanOrEqual(overflow.clientHeight + 1);
}

async function expectEqualWeekButtonDimensions(
  previousWeek: Locator,
  nextWeek: Locator,
  stateLabel: string,
) {
  const [previousBounds, nextBounds] = await Promise.all([
    previousWeek.boundingBox(),
    nextWeek.boundingBox(),
  ]);
  if (previousBounds === null || nextBounds === null) {
    throw new Error(`Week-navigation buttons were not visible ${stateLabel}.`);
  }

  expect(
    Math.abs(previousBounds.width - nextBounds.width),
    `week-navigation widths should match ${stateLabel}`,
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs(previousBounds.height - nextBounds.height),
    `week-navigation heights should match ${stateLabel}`,
  ).toBeLessThanOrEqual(0.5);

  return previousBounds;
}

async function exerciseEqualWeekButtonDimensions(
  page: Page,
  textSizeLabel: string,
) {
  const previousWeek = page.getByRole("button", { name: "Previous week" });
  const nextWeek = page.getByRole("button", { name: "Next week" });

  await expect(previousWeek).toBeDisabled();
  await expect(nextWeek).toBeEnabled();
  const firstWeekBounds = await expectEqualWeekButtonDimensions(
    previousWeek,
    nextWeek,
    `on the first week at ${textSizeLabel}`,
  );

  await nextWeek.click();
  await expect(page.getByRole("heading", { name: "Week 2 of 3" })).toBeVisible();
  await expect(previousWeek).toBeEnabled();
  await expect(nextWeek).toBeEnabled();
  const middleWeekBounds = await expectEqualWeekButtonDimensions(
    previousWeek,
    nextWeek,
    `on a middle week at ${textSizeLabel}`,
  );

  await nextWeek.click();
  await expect(page.getByRole("heading", { name: "Week 3 of 3" })).toBeVisible();
  await expect(previousWeek).toBeEnabled();
  await expect(nextWeek).toBeDisabled();
  const finalWeekBounds = await expectEqualWeekButtonDimensions(
    previousWeek,
    nextWeek,
    `on the final week at ${textSizeLabel}`,
  );

  expect(middleWeekBounds.width).toBeCloseTo(firstWeekBounds.width, 1);
  expect(middleWeekBounds.height).toBeCloseTo(firstWeekBounds.height, 1);
  expect(finalWeekBounds.width).toBeCloseTo(firstWeekBounds.width, 1);
  expect(finalWeekBounds.height).toBeCloseTo(firstWeekBounds.height, 1);
}

test("uses the shared Plan surface and workout hierarchy", async ({ page }) => {
  await page.goto("tests/viewport/plan.html");

  await expect(page.locator(".plan-sheet")).toHaveCSS(
    "background-color",
    await tokenColor(page, "--app-surface"),
  );
  await expect(page.locator(".plan-day-status.completed")).toHaveCSS(
    "color",
    await tokenColor(page, "--app-success"),
  );
  await expect(page.locator(".plan-day.tempo-run .plan-day-date")).toHaveCSS(
    "border-left-color",
    await tokenColor(page, "--app-workout-quality"),
  );

  await page
    .getByRole("button", {
      name: "Thu Oct 29 Tempo run 5 mi · 45 min Scheduled",
    })
    .click();
  await expect(page.getByRole("dialog", { name: "Tempo run" })).toHaveCSS(
    "background-color",
    await tokenColor(page, "--app-surface"),
  );
  await expect(page.locator(".plan-modal-overlay")).toHaveCSS(
    "background-color",
    await tokenColor(page, "--app-overlay"),
  );
});

async function exercisePlan(page: Page, textSizeLabel: string) {
  await expect(
    page.getByRole("heading", { name: "Week 1 of 3" }),
  ).toBeVisible();
  await expect(page.getByText("Base building")).toBeVisible();
  await expect(page.getByText("8.1 mi")).toBeVisible();
  await expect(page.getByText("1 of 2 workouts complete")).toBeVisible();

  const previousWeek = page.getByRole("button", { name: "Previous week" });
  const nextWeek = page.getByRole("button", { name: "Next week" });
  const weekSelector = page.getByRole("combobox", { name: "Training week" });
  await expectMinimumTouchTarget(previousWeek, `previous week at ${textSizeLabel}`);
  await expectMinimumTouchTarget(nextWeek, `next week at ${textSizeLabel}`);
  await expectMinimumTouchTarget(weekSelector, `week selector at ${textSizeLabel}`);

  const tempoWorkout = page.getByRole("button", {
    name: "Thu Oct 29 Tempo run 5 mi · 45 min Scheduled",
  });
  await expect(tempoWorkout).toBeVisible();
  await expectMinimumTouchTarget(tempoWorkout, `tempo workout at ${textSizeLabel}`);
  await expectNoHorizontalOverflow(
    page,
    "Plan",
    `while viewing week one at ${textSizeLabel}`,
  );

  await tempoWorkout.click();
  const dialog = page.getByRole("dialog", { name: "Tempo run" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("5 mi", { exact: true })).toBeVisible();
  await expect(dialog.getByText("45 min", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(
      "Keep the opening miles controlled, then settle into a comfortably hard effort.",
    ),
  ).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close" });
  await expectMinimumTouchTarget(close, `workout close at ${textSizeLabel}`);
  await expectNoHorizontalOverflow(
    page,
    "Plan",
    `with workout details open at ${textSizeLabel}`,
  );
  await close.click();

  await nextWeek.click();
  await expect(
    page.getByRole("heading", { name: "Week 2 of 3" }),
  ).toBeVisible();
  await expect(page.getByText("Marathon training")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Sun Nov 8 Long run 10 mi Scheduled",
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Plan",
    `after moving to week two at ${textSizeLabel}`,
  );
}

test("keeps Plan browsing usable at phone width", async ({ page }) => {
  await page.goto("tests/viewport/plan.html");

  await exercisePlan(page, "default text size");
});

test("keeps Plan browsing usable with 200% text", async ({ page }) => {
  await page.goto("tests/viewport/plan.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });

  await expect
    .poll(() =>
      page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize),
    )
    .toBe("32px");
  await expectNoHorizontalOverflow(
    page,
    "Plan",
    "before interaction at 200% text",
  );

  await exercisePlan(page, "200% text");
});

for (const textScale of [100, 200]) {
  test(`keeps the complete phone Plan usable at ${textScale}% text`, async ({ page }) => {
    await page.goto("tests/viewport/plan.html?shell=1");
    await page.addStyleTag({ content: `:root { font-size: ${textScale}%; }` });
    await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible();
    const navigation = page.getByRole("navigation", { name: "Training sections" });
    await expect(navigation).toBeVisible();
    await exercisePlan(page, `${textScale}% text inside the app shell`);

    const lastWorkout = page.locator(".plan-day").last();
    await lastWorkout.scrollIntoViewIfNeeded();
    const workoutBounds = await lastWorkout.boundingBox();
    const navigationBounds = await navigation.boundingBox();
    expect(workoutBounds).not.toBeNull();
    expect(navigationBounds).not.toBeNull();
    if (workoutBounds && navigationBounds) {
      expect(workoutBounds.y + workoutBounds.height).toBeLessThanOrEqual(navigationBounds.y);
    }
  });
}

test("keeps training tickets static when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("tests/viewport/plan.html");

  const transitionDuration = await page
    .locator(".plan-day")
    .first()
    .evaluate((element) =>
      Number.parseFloat(window.getComputedStyle(element).transitionDuration),
    );
  expect(transitionDuration).toBeLessThanOrEqual(0.00001);
});

test("contains dynamically enlarged week-navigation labels", async ({ page }) => {
  await page.goto("tests/viewport/plan.html");
  await page.addStyleTag({
    content: ".plan-week-controls button { font-size: 350% !important; }",
  });

  await expectContentContained(
    page.getByRole("button", { name: "Previous week" }),
    "Previous week at the largest dynamic text size",
  );
  await expectContentContained(
    page.getByRole("button", { name: "Next week" }),
    "Next week at the largest dynamic text size",
  );
  await expectNoHorizontalOverflow(
    page,
    "Plan",
    "with dynamically enlarged week-navigation labels",
  );
});

test("keeps week-navigation buttons equal across boundary states", async ({
  page,
}) => {
  await page.goto("tests/viewport/plan.html");
  await exerciseEqualWeekButtonDimensions(page, "default text size");

  await page.goto("tests/viewport/plan.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });
  await exerciseEqualWeekButtonDimensions(page, "200% text");
});
