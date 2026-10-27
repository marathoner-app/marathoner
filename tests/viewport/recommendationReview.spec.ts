import { expect, test, type Page } from "@playwright/test";

import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport });

async function exerciseRecommendationReview(page: Page, textSizeLabel: string) {
  await expect(
    page.getByRole("heading", { name: "Give next week another steady pass" }),
  ).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Internal preview");

  for (const heading of [
    "Observation",
    "What it means",
    "Recommended change",
    "Expected impact",
    "Your choice",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  const keep = page.getByRole("button", { name: "Keep current plan" });
  const apply = page.getByRole("button", { name: "Apply this change" });
  await expectMinimumTouchTarget(keep, `keep decision at ${textSizeLabel}`);
  await expectMinimumTouchTarget(apply, `apply decision at ${textSizeLabel}`);
  await apply.scrollIntoViewIfNeeded();
  await expect(apply).toBeInViewport();
  await expectNoHorizontalOverflow(
    page,
    "Recommendation review",
    `with ${textSizeLabel}`,
  );
}

test("keeps the recommendation review usable at phone width", async ({ page }) => {
  await page.goto("tests/viewport/recommendationReview.html");

  await exerciseRecommendationReview(page, "default text size");
});

test("keeps the recommendation review usable with 200% text", async ({ page }) => {
  await page.goto("tests/viewport/recommendationReview.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });

  await expect
    .poll(() =>
      page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize),
    )
    .toBe("32px");
  await exerciseRecommendationReview(page, "200% text");
});
