import { expect, test, type Page } from "@playwright/test";

import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

test.use({ viewport: { width: 390, height: 844 } });

async function exerciseConsent(page: Page, textSizeLabel: string) {
  await expect(
    page.getByRole("heading", {
      name: "Before you use beta training features",
    }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeVisible();
  await expect(page.getByText(/beta-rules@0.2.0-draft/)).toHaveCount(0);
  await expect(page.getByText(/closed-beta-provisional-methodology@0.1.0/)).toBeVisible();
  const action = page.getByRole("button", { name: "Accept and continue" });
  await expectMinimumTouchTarget(action, `consent action at ${textSizeLabel}`);
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeInViewport();
  await expectNoHorizontalOverflow(
    page,
    "Closed-beta methodology consent",
    `with ${textSizeLabel}`,
  );
}

test("keeps beta consent usable at phone width", async ({ page }) => {
  await page.goto("tests/viewport/methodologyConsent.html");
  await exerciseConsent(page, "default text size");
});

test("keeps beta consent usable with 200% text", async ({ page }) => {
  await page.goto("tests/viewport/methodologyConsent.html");
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });
  await exerciseConsent(page, "200% text");
});
