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

  const dialog = page.getByRole("dialog", { name: "Checking recent training" });
  await expect(dialog).toBeVisible();
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

  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.width).toBe(phoneViewport.width);
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
    .getByRole("dialog", { name: "Checking recent training" })
    .locator(".closed-beta-adaptation-graphic-pulse")
    .evaluate((element) => window.getComputedStyle(element).animationIterationCount);
  expect(iterationCount).toBe("1");
});

test("keeps the completed result in the same full-screen branded experience", async ({
  page,
}) => {
  await page.goto("tests/viewport/trainingCheck.html?mode=result");
  await page.getByRole("button", { name: "Check recent training" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Your current plan still fits",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".closed-beta-adaptation-graphic")).toBeVisible();
  await expectMinimumTouchTarget(
    page.getByRole("button", { name: "Back to Home" }),
    "training check return action",
  );
  await expectNoHorizontalOverflow(page, "Training check result", "at phone width");

  const headingBox = await dialog.getByRole("heading").boundingBox();
  const graphicBox = await dialog
    .locator(".closed-beta-adaptation-graphic")
    .boundingBox();
  expect(headingBox).not.toBeNull();
  expect(graphicBox).not.toBeNull();
  if (headingBox && graphicBox) {
    const headingCenter = headingBox.x + headingBox.width / 2;
    const graphicCenter = graphicBox.x + graphicBox.width / 2;
    expect(Math.abs(headingCenter - graphicCenter)).toBeLessThan(2);
  }
});

test("keeps the completed result usable with 200% text", async ({ page }) => {
  await page.goto("tests/viewport/trainingCheck.html?mode=result");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });
  await page.getByRole("button", { name: "Check recent training" }).click();

  await expect(
    page.getByRole("dialog", { name: "Your current plan still fits" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Training check result",
    "with 200% text",
  );
  await expect(page.getByRole("button", { name: "Back to Home" })).toBeVisible();
});
