import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport });

async function exerciseAnalyzeFeedback(page: Page, textSizeLabel: string) {
  await expect(page.getByRole("heading", { name: "Total Distance" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This Week", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Average Pace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Total Runs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Runs This Week" })).toBeVisible();
  const summaryCards = page.locator(".analyze-cards");
  await expect(summaryCards.getByText("5 km")).toHaveCount(2);
  await expect(summaryCards.getByText("6:00 /km")).toBeVisible();
  await expect(summaryCards.getByText("1", { exact: true })).toHaveCount(2);

  await expect(page.getByRole("heading", { name: "Weekly Distance" })).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Analyze",
    `with the weekly chart at ${textSizeLabel}`,
  );

  await page.getByText("View weekly distance data").click();
  const table = page.getByRole("table", { name: "Weekly running distance" });
  await expect(table).toBeVisible();
  const currentWeek = table.getByRole("row", { name: "2026-10-19 5 km 1" });
  await expect(currentWeek).toBeVisible();
  await currentWeek.scrollIntoViewIfNeeded();
  await expect(currentWeek).toBeInViewport();
  await expectNoHorizontalOverflow(
    page,
    "Analyze",
    `with the weekly data table open at ${textSizeLabel}`,
  );
}

test("keeps Analyze feedback usable at phone width", async ({ page }) => {
  await page.goto("tests/viewport/analyze.html");

  await exerciseAnalyzeFeedback(page, "default text size");
});

test("keeps Analyze feedback usable with 200% text", async ({ page }) => {
  await page.goto("tests/viewport/analyze.html");
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
    "Analyze",
    "before opening weekly data at 200% text",
  );

  await exerciseAnalyzeFeedback(page, "200% text");
});
