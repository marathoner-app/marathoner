import { expect, test, type Page } from "@playwright/test";
import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport });

async function expectPhoneAnalyzeFrame(page: Page, stage: string) {
  const layout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    documentWidth: document.documentElement.scrollWidth,
    viewportHeight: window.innerHeight,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(
    layout.documentWidth,
    `Analyze should not make the page horizontally scroll ${stage}`,
  ).toBeLessThanOrEqual(layout.viewportWidth);
  expect(
    layout.documentHeight,
    `Analyze should fit the phone viewport ${stage}`,
  ).toBeLessThanOrEqual(layout.viewportHeight);
}

async function showCard(page: Page, label: string, position: number) {
  await page.getByRole("button", { name: `Show ${label} card` }).click();
  await expect(page.getByText(`${label} · ${position} of 5`)).toBeVisible();
  const card = page.getByRole("group", {
    name: `${position} of 5: ${label}`,
  });
  await expect(card).toBeInViewport();
  return card;
}

test("presents Analyze as a contained, swipeable phone carousel", async ({
  page,
}) => {
  await page.goto("tests/viewport/analyze.html");

  const viewport = page.locator(".analyze-carousel-viewport");
  await expect(viewport).toHaveCSS("scroll-snap-type", "x mandatory");
  await expect(viewport).toHaveCSS("touch-action", "pan-x pan-y");
  await expect(page.getByText("Latest run · 1 of 5")).toBeVisible();

  const firstCardBounds = await page
    .getByRole("group", { name: "1 of 5: Latest run" })
    .boundingBox();
  const secondCardBounds = await page
    .getByRole("group", { name: "2 of 5: Training summary" })
    .boundingBox();
  const viewportBounds = await viewport.boundingBox();
  expect(firstCardBounds).not.toBeNull();
  expect(secondCardBounds).not.toBeNull();
  expect(viewportBounds).not.toBeNull();
  if (firstCardBounds && secondCardBounds && viewportBounds) {
    expect(firstCardBounds.x).toBeGreaterThanOrEqual(viewportBounds.x);
    expect(secondCardBounds.x).toBeLessThan(viewportBounds.x + viewportBounds.width);
    expect(secondCardBounds.x).toBeGreaterThan(firstCardBounds.x);
  }

  await expectMinimumTouchTarget(
    page.getByRole("button", { name: "Previous analysis card" }),
    "previous analysis card",
  );
  await expectMinimumTouchTarget(
    page.getByRole("button", { name: "Next analysis card" }),
    "next analysis card",
  );
  await expectPhoneAnalyzeFrame(page, "on the first card");
});

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
  await expectPhoneAnalyzeFrame(page, `on the latest run at ${textSizeLabel}`);

  const summary = await showCard(page, "Training summary", 2);
  await expect(summary.getByRole("heading", { name: "Total Distance" })).toBeVisible();
  await expect(
    summary.getByRole("heading", { name: "This Week", exact: true }),
  ).toBeVisible();
  await expect(summary.getByRole("heading", { name: "Average Pace" })).toBeVisible();
  await expect(summary.getByRole("heading", { name: "Total Runs" })).toBeVisible();
  await expect(summary.getByRole("heading", { name: "Runs This Week" })).toBeVisible();
  await expect(summary.getByText("10 km")).toHaveCount(2);
  await expect(summary.getByText("5:45 /km")).toBeVisible();
  await expect(summary.getByText("2", { exact: true })).toHaveCount(2);

  const weeklyCard = await showCard(page, "Weekly distance", 3);
  await expect(
    weeklyCard.getByRole("heading", { name: "Weekly Distance" }),
  ).toBeVisible();
  await weeklyCard.getByText("View weekly distance data").click();
  const table = weeklyCard.getByRole("table", {
    name: "Weekly running distance",
  });
  const currentWeek = table.getByRole("row", { name: "2026-10-19 10 km 2" });
  await currentWeek.scrollIntoViewIfNeeded();
  await expect(currentWeek).toBeInViewport();

  const paceCard = await showCard(page, "Recent pace", 4);
  await expect(
    paceCard.getByRole("heading", { name: "Recent Pace" }),
  ).toBeVisible();
  await paceCard.getByText("View recent pace data").click();
  const paceTable = paceCard.getByRole("table", { name: "Recent recorded pace" });
  await expect(
    paceTable.getByRole("row", { name: "2026-10-21 6:00 /km" }),
  ).toBeVisible();
  const latestPace = paceTable.getByRole("row", {
    name: "2026-10-22 5:30 /km",
  });
  await latestPace.scrollIntoViewIfNeeded();
  await expect(latestPace).toBeInViewport();

  const effortCard = await showCard(page, "Recent effort", 5);
  await expect(
    effortCard.getByRole("heading", { name: "Recent Effort" }),
  ).toBeVisible();
  const effortSequence = effortCard.getByRole("list", {
    name: "Recent run effort sequence",
  });
  await expect(effortSequence).toContainText("About as expected");
  await expect(effortSequence).toContainText("Harder than expected");
  await effortCard.getByText("View recent effort data").click();
  const effortTable = effortCard.getByRole("table", {
    name: "Recent recorded perceived effort",
  });
  await expect(
    effortTable.getByRole("row", {
      name: "2026-10-21 About as expected",
    }),
  ).toBeVisible();
  await expect(
    effortTable.getByRole("row", {
      name: "2026-10-22 Harder than expected",
    }),
  ).toBeVisible();
  await expectPhoneAnalyzeFrame(page, `after reviewing every card at ${textSizeLabel}`);
}

test("keeps every Analyze category usable at phone width", async ({ page }) => {
  await page.goto("tests/viewport/analyze.html");

  await exerciseAnalyzeFeedback(page, "default text size");
});

test("keeps the carousel usable with 200% text", async ({ page }) => {
  await page.goto("tests/viewport/analyze.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });

  await expect
    .poll(() =>
      page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize),
    )
    .toBe("32px");

  await exerciseAnalyzeFeedback(page, "200% text");
});

test("keeps Analyze as an all-at-once desktop dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("tests/viewport/analyze.html");

  await expect(page.locator(".analyze-carousel-viewport")).toHaveCSS(
    "display",
    "contents",
  );
  await expect(page.locator(".analyze-carousel-controls")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Oct 22, 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Training summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Weekly Distance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Pace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Effort" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Analyze", "on the desktop dashboard");
});
