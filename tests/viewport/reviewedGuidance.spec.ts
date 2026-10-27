import { expect, test, type Page } from "@playwright/test";

import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport });

async function exerciseReviewedGuidance(page: Page, textSizeLabel: string) {
  await expect(
    page.getByRole("heading", { name: "Use effort, not pace, on easy days" }),
  ).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Internal preview");
  await expect(page.getByText("After an easy run")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keep in mind" })).toBeVisible();

  const dismiss = page.getByRole("button", { name: "Dismiss guidance" });
  await expectMinimumTouchTarget(
    dismiss,
    `dismiss guidance at ${textSizeLabel}`,
  );
  await dismiss.scrollIntoViewIfNeeded();
  await expect(dismiss).toBeInViewport();
  await expectNoHorizontalOverflow(
    page,
    "Reviewed guidance",
    `with ${textSizeLabel}`,
  );
}

test("keeps reviewed guidance usable at phone width", async ({ page }) => {
  await page.goto("tests/viewport/reviewedGuidance.html");

  await exerciseReviewedGuidance(page, "default text size");
});

test("keeps reviewed guidance usable with 200% text", async ({ page }) => {
  await page.goto("tests/viewport/reviewedGuidance.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });

  await expect
    .poll(() =>
      page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize),
    )
    .toBe("32px");
  await exerciseReviewedGuidance(page, "200% text");
});
