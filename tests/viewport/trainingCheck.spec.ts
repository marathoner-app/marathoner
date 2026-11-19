import { expect, test, type Page } from "@playwright/test";

import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport });

async function exerciseTrainingCheck(page: Page, textSizeLabel: string) {
  const action = page.getByRole("button", { name: "Check recent training" });
  await expect(action).toBeVisible();
  await expectMinimumTouchTarget(action, `training check at ${textSizeLabel}`);
  await expect(page.getByRole("list", { name: "This check considers" })).toHaveText(
    /Recent runs.*Training pattern.*Current plan/,
  );
  await expectNoHorizontalOverflow(page, "Training check", `with ${textSizeLabel}`);

  await action.click();

  const status = page.getByRole("status");
  await expect(status).toContainText("Checking recent training");
  await expect(status).toContainText(
    "Your plan stays unchanged while this check finishes.",
  );
  await expectNoHorizontalOverflow(
    page,
    "Working training check",
    `with ${textSizeLabel}`,
  );
}

test("keeps the idle and working Training check contained at phone width", async ({
  page,
}) => {
  await page.goto("tests/viewport/trainingCheck.html");

  await exerciseTrainingCheck(page, "default text size");
});

test("keeps the Training check usable with 200% text", async ({ page }) => {
  await page.goto("tests/viewport/trainingCheck.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });

  await expect
    .poll(() =>
      page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize),
    )
    .toBe("32px");
  await exerciseTrainingCheck(page, "200% text");
});

test("uses a static working treatment when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("tests/viewport/trainingCheck.html");
  await page.getByRole("button", { name: "Check recent training" }).click();

  const iterationCount = await page
    .locator(".closed-beta-adaptation-graphic-pulse")
    .evaluate((element) => window.getComputedStyle(element).animationIterationCount);
  expect(iterationCount).toBe("1");
});
