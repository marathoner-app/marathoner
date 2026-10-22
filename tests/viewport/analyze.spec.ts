import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport });

async function exerciseAnalyzeFeedback(page: Page, textSizeLabel: string) {
  const latestRun = page.locator(".latest-run-summary");
  await expect(latestRun.getByText("Latest run")).toBeVisible();
  await expect(
    latestRun.getByRole("heading", { name: "Oct 22, 2026" }),
  ).toBeVisible();
  await expect(latestRun.getByText("5 km")).toBeVisible();
  await expect(latestRun.getByText("27:30")).toBeVisible();
  await expect(latestRun.getByText("5:30 /km")).toBeVisible();
  await expect(latestRun.getByText("Not recorded")).toHaveCount(1);
  await expect(latestRun.getByText("Harder than expected")).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Analyze",
    `with the latest-run summary at ${textSizeLabel}`,
  );

  await expect(page.getByRole("heading", { name: "Total Distance" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This Week", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Average Pace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Total Runs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Runs This Week" })).toBeVisible();
  const summaryCards = page.locator(".analyze-cards");
  await expect(summaryCards.getByText("10 km")).toHaveCount(2);
  await expect(summaryCards.getByText("5:45 /km")).toBeVisible();
  await expect(summaryCards.getByText("2", { exact: true })).toHaveCount(2);

  await expect(page.getByRole("heading", { name: "Weekly Distance" })).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Analyze",
    `with the weekly chart at ${textSizeLabel}`,
  );

  await page.getByText("View weekly distance data").click();
  const table = page.getByRole("table", { name: "Weekly running distance" });
  await expect(table).toBeVisible();
  const currentWeek = table.getByRole("row", { name: "2026-10-19 10 km 2" });
  await expect(currentWeek).toBeVisible();
  await currentWeek.scrollIntoViewIfNeeded();
  await expect(currentWeek).toBeInViewport();
  await expectNoHorizontalOverflow(
    page,
    "Analyze",
    `with the weekly data table open at ${textSizeLabel}`,
  );

  await expect(page.getByRole("heading", { name: "Recent Pace" })).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Analyze",
    `with the recent pace chart at ${textSizeLabel}`,
  );

  await page.getByText("View recent pace data").click();
  const paceTable = page.getByRole("table", { name: "Recent recorded pace" });
  await expect(paceTable.getByRole("row", { name: "2026-10-21 6:00 /km" })).toBeVisible();
  const latestPace = paceTable.getByRole("row", {
    name: "2026-10-22 5:30 /km",
  });
  await expect(latestPace).toBeVisible();
  await latestPace.scrollIntoViewIfNeeded();
  await expect(latestPace).toBeInViewport();
  await expectNoHorizontalOverflow(
    page,
    "Analyze",
    `with the recent pace data table open at ${textSizeLabel}`,
  );

  await expect(page.getByRole("heading", { name: "Recent Effort" })).toBeVisible();
  const effortSequence = page.getByRole("list", {
    name: "Recent run effort sequence",
  });
  await expect(effortSequence).toContainText("About as expected");
  await expect(effortSequence).toContainText("Harder than expected");
  await expectNoHorizontalOverflow(
    page,
    "Analyze",
    `with the recent effort sequence at ${textSizeLabel}`,
  );

  await page.getByText("View recent effort data").click();
  const effortTable = page.getByRole("table", {
    name: "Recent recorded perceived effort",
  });
  await expect(
    effortTable.getByRole("row", { name: "2026-10-21 About as expected" }),
  ).toBeVisible();
  await expect(
    effortTable.getByRole("row", { name: "2026-10-22 Harder than expected" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Analyze",
    `with the recent effort table open at ${textSizeLabel}`,
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
