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
  await expect(page.getByRole("note")).toContainText(
    "Guidance beta-guidance@0.1.0-draft",
  );
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

test("keeps non-dismissible safety guidance usable at phone width and 200% text", async ({
  page,
}) => {
  await page.goto("tests/viewport/reviewedGuidance.html?safety");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });

  await expect(
    page.getByRole("heading", { name: "Pause training and get urgent help" }),
  ).toBeVisible();
  await expect(page.getByRole("note")).toContainText(
    "Safety rules beta-safety@0.1.0-draft",
  );
  await expect(page.getByRole("button", { name: "Dismiss guidance" })).toHaveCount(
    0,
  );
  await expectNoHorizontalOverflow(
    page,
    "Safety guidance",
    "with 200% text",
  );
});
