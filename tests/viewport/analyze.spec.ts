import { expect, test, type Page } from "@playwright/test";
import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport, hasTouch: true });

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
  // A near-snap position can still be moving. Observe stable geometry across
  // render frames before starting a new native gesture.
  await expect
    .poll(() =>
      card.evaluate(async (element) => {
        const viewport = element.parentElement;
        if (viewport === null) return { aligned: false, stable: false };
        const scrollPadding = Number.parseFloat(
          window.getComputedStyle(viewport).scrollPaddingLeft,
        );
        const samples = [];
        for (let frame = 0; frame < 4; frame += 1) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const bounds = element.getBoundingClientRect();
          const targetLeft =
            bounds.left - viewport.getBoundingClientRect().left +
            viewport.scrollLeft - scrollPadding;
          const boundedTarget = Math.max(
            0,
            Math.min(targetLeft, viewport.scrollWidth - viewport.clientWidth),
          );
          samples.push({
            scrollLeft: viewport.scrollLeft,
            cardLeft: bounds.left,
            cardTop: bounds.top,
            distanceToSnap: Math.abs(viewport.scrollLeft - boundedTarget),
          });
        }
        return {
          aligned: samples.every((sample) => sample.distanceToSnap < 1),
          stable: samples.every((sample) =>
            sample.scrollLeft === samples[0].scrollLeft &&
            sample.cardLeft === samples[0].cardLeft &&
            sample.cardTop === samples[0].cardTop),
          samples,
        };
      }),
    )
    .toMatchObject({ aligned: true, stable: true });
  return card;
}

async function dragTouchHorizontally(
  page: Page,
  target: ReturnType<Page["locator"]>,
) {
  const bounds = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    let left = Math.max(0, rect.left);
    let right = Math.min(window.innerWidth, rect.right);
    let top = Math.max(0, rect.top);
    let bottom = Math.min(window.innerHeight, rect.bottom);
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = window.getComputedStyle(parent);
      const clip = parent.getBoundingClientRect();
      if (style.overflowX !== "visible") {
        left = Math.max(left, clip.left + parent.clientLeft);
        right = Math.min(right, clip.left + parent.clientLeft + parent.clientWidth);
      }
      if (style.overflowY !== "visible") {
        top = Math.max(top, clip.top + parent.clientTop);
        bottom = Math.min(bottom, clip.top + parent.clientTop + parent.clientHeight);
      }
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
  });
  expect(bounds.width, "The gesture needs a visible target width").toBeGreaterThan(44);
  expect(bounds.height, "The gesture needs a visible target height").toBeGreaterThan(44);

  const session = await page.context().newCDPSession(page);
  const y = Math.round(bounds.y + bounds.height / 2);
  // Cross the next card's snap threshold without depending on fling momentum.
  const startX = Math.round(bounds.x + bounds.width * 0.9);
  const endX = Math.round(bounds.x + bounds.width * 0.2);
  const hit = await target.evaluate((element, point) => {
    const hitElement = document.elementFromPoint(point.x, point.y);
    return {
      insideTarget: hitElement !== null && element.contains(hitElement),
      tag: hitElement?.tagName,
      card: hitElement?.closest(".analyze-slide")?.getAttribute("aria-label"),
    };
  }, { x: startX, y });
  expect(hit, "The native touch must start inside the visible target").toMatchObject({ insideTarget: true });
  const input = await target.evaluateHandle((element) => {
    const controller = new AbortController();
    const events = {
      starts: 0, moves: 0, ends: 0, cancels: 0, trusted: true,
      firstPoint: null as { x: number; y: number } | null,
      lastPoint: null as { x: number; y: number } | null,
    };
    for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) {
      element.addEventListener(type, (event) => {
        events.trusted &&= event.isTrusted;
        const touch = (event as TouchEvent).changedTouches[0];
        if (touch) {
          events.lastPoint = { x: touch.clientX, y: touch.clientY };
          events.firstPoint ??= events.lastPoint;
        }
        if (type === "touchstart") events.starts += 1;
        if (type === "touchmove") events.moves += 1;
        if (type === "touchend") events.ends += 1;
        if (type === "touchcancel") events.cancels += 1;
      }, { capture: true, passive: true, signal: controller.signal });
    }
    return { events, stop: () => controller.abort() };
  });

  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: startX, y, id: 0 }],
    });
    // Deliver each native move on a separate render frame instead of relying
    // on synthesized scroll timing across platforms.
    const steps = 16;
    for (let step = 1; step <= steps; step += 1) {
      await page.evaluate(() => new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())));
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: startX + (endX - startX) * step / steps, y, id: 0 }],
      });
    }
    await page.evaluate(() => new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())));
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const events = await input.evaluate((state) => state.events);
    return { bounds, startX, endX, y, hit, events };
  } finally {
    await input.evaluate((state) => state.stop());
    await input.dispose();
    await session.detach();
  }
}

async function expectSummaryTextInsideCards(page: Page, textSizeLabel: string) {
  const overflow = await page.locator(".analyze-card").evaluateAll((cards) =>
    cards.flatMap((card, cardIndex) => {
      const cardBounds = card.getBoundingClientRect();
      return Array.from(card.querySelectorAll<HTMLElement>("h3, p"))
        .filter((content) => {
          const bounds = content.getBoundingClientRect();
          return (
            content.scrollWidth > content.clientWidth + 1 ||
            content.scrollHeight > content.clientHeight + 1 ||
            bounds.left < cardBounds.left - 0.5 ||
            bounds.right > cardBounds.right + 0.5 ||
            bounds.top < cardBounds.top - 0.5 ||
            bounds.bottom > cardBounds.bottom + 0.5
          );
        })
        .map((content) => `card ${cardIndex + 1}: ${content.textContent?.trim()}`);
    }),
  );

  expect(
    overflow,
    `Analyze summary text should remain inside its cards at ${textSizeLabel}`,
  ).toEqual([]);
}

function boxesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return !(
    first.x + first.width <= second.x + 1 ||
    second.x + second.width <= first.x + 1 ||
    first.y + first.height <= second.y + 1 ||
    second.y + second.height <= first.y + 1
  );
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

test("renders the active pace line before interaction and separates chart drags from carousel swipes", async ({
  page,
}) => {
  await page.goto("tests/viewport/analyze.html");

  const viewport = page.locator(".analyze-carousel-viewport");
  const weeklyCard = await showCard(page, "Weekly distance", 3);
  const weeklyChart = weeklyCard.locator(".weekly-trend-chart");
  await expect(weeklyChart).toHaveCSS("touch-action", "pan-y");
  await weeklyChart.scrollIntoViewIfNeeded();
  const weeklyScrollLeft = await viewport.evaluate((element) => element.scrollLeft);

  await dragTouchHorizontally(page, weeklyChart);

  await expect(page.getByText("Weekly distance · 3 of 5")).toBeVisible();
  await expect
    .poll(async () =>
      Math.abs(
        (await viewport.evaluate((element) => element.scrollLeft)) -
          weeklyScrollLeft,
      ),
    )
    .toBeLessThan(2);
  await expect
    .poll(() =>
      weeklyChart.locator("div").evaluateAll((elements) =>
        elements.some(
          (element) =>
            element.textContent?.includes("Weekly distance") === true &&
            window.getComputedStyle(element).display !== "none",
        ),
      ),
    )
    .toBe(true);

  const paceCard = await showCard(page, "Recent pace", 4);
  const paceChart = paceCard.locator(".pace-trend-chart");
  await expect(paceChart).toHaveCSS("touch-action", "pan-y");
  await expect
    .poll(() =>
      paceChart.locator("svg path").evaluateAll((paths) =>
        paths.some((path) => {
          const bounds = path.getBoundingClientRect();
          const styles = window.getComputedStyle(path);
          return (
            Number.parseFloat(styles.strokeWidth) >= 3 &&
            bounds.width > 0 &&
            bounds.height > 0
          );
        }),
      ),
    )
    .toBe(true);

  const latestCard = await showCard(page, "Latest run", 1);
  const gesture = await dragTouchHorizontally(page, latestCard.locator(".latest-run-summary"));

  try {
    await expect.poll(async () => ({
      label: await page.locator(".analyze-carousel-status").textContent(),
      visible: await page.locator(".analyze-carousel-status").isVisible(),
    }), { message: "The native swipe should advance from Latest run to Training summary" })
      .toEqual({ label: "Training summary · 2 of 5", visible: true });
  } catch (error) {
    console.error("Native swipe diagnostics:", JSON.stringify({
      scrollLeft: await viewport.evaluate((element) => element.scrollLeft),
      gesture,
    }));
    throw error;
  }
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

test("contains dynamically enlarged training-summary text", async ({ page }) => {
  await page.goto("tests/viewport/analyze.html");
  await page.addStyleTag({
    content: `
      .analyze-card h3,
      .analyze-card p {
        font-size: 200% !important;
      }
    `,
  });

  await showCard(page, "Training summary", 2);
  await expectSummaryTextInsideCards(page, "the largest dynamic text size");
  await expectPhoneAnalyzeFrame(
    page,
    "with dynamically enlarged training-summary text",
  );
});

test("synchronizes large-text carousel state after a horizontal scroll", async ({
  page,
}) => {
  await page.goto("tests/viewport/analyze.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });

  const viewport = page.locator(".analyze-carousel-viewport");
  await viewport.evaluate((carousel) => {
    const target = carousel.querySelectorAll<HTMLElement>(".analyze-slide")[1];
    if (target === undefined) throw new Error("Training summary card is missing.");
    const carouselBounds = carousel.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    carousel.scrollTo({
      left: carousel.scrollLeft + targetBounds.left - carouselBounds.left,
      behavior: "auto",
    });
  });

  await expect(page.getByText("Training summary · 2 of 5")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show Training summary card" }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("button", { name: "Previous analysis card" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Next analysis card" }),
  ).toBeEnabled();
});

test("keeps Analyze as an all-at-once desktop dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("tests/viewport/analyze.html?mode=dashboard&shell=1");

  await expect(page.locator(".analyze-desktop-grid")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Oct 22, 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Training summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Weekly Distance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Pace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Effort" })).toBeVisible();
  await expect(page.locator(".analyze-widget")).toHaveCount(5);
  await expect(page.getByRole("navigation", { name: "Training sections" })).toBeVisible();

  const frame = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(
    frame.documentHeight,
    "Analyze should fit the desktop viewport without page scrolling",
  ).toBeLessThanOrEqual(frame.viewportHeight);
  await expectNoHorizontalOverflow(page, "Analyze", "on the desktop dashboard");

  const effortWidget = page.getByRole("group", {
    name: "Recent effort widget",
  });
  const effortCard = effortWidget.locator(".effort-pattern");
  const [widgetBounds, cardBounds] = await Promise.all([
    effortWidget.boundingBox(),
    effortCard.boundingBox(),
  ]);
  expect(widgetBounds).not.toBeNull();
  expect(cardBounds).not.toBeNull();
  if (widgetBounds && cardBounds) {
    expect(Math.abs(cardBounds.height - widgetBounds.height)).toBeLessThanOrEqual(2);
  }
  const [lastEffortBounds, effortDataBounds] = await Promise.all([
    effortCard.locator(".effort-pattern-item").last().boundingBox(),
    effortCard.locator(".effort-pattern-data").boundingBox(),
  ]);
  expect(lastEffortBounds).not.toBeNull();
  expect(effortDataBounds).not.toBeNull();
  if (lastEffortBounds && effortDataBounds) {
    expect(
      effortDataBounds.y,
      "The effort table disclosure should follow the full sequence without overlapping it",
    ).toBeGreaterThanOrEqual(lastEffortBounds.y + lastEffortBounds.height);
  }

  await page.getByRole("button", { name: "Edit dashboard" }).click();
  await expect(page.locator(".analyze-widget-edit-bar").first()).toHaveCSS(
    "position",
    "absolute",
  );
  const editingCardBounds = await effortCard.boundingBox();
  expect(editingCardBounds).not.toBeNull();
  if (cardBounds && editingCardBounds) {
    expect(Math.abs(editingCardBounds.width - cardBounds.width)).toBeLessThanOrEqual(
      2,
    );
    expect(
      Math.abs(editingCardBounds.height - cardBounds.height),
    ).toBeLessThanOrEqual(2);
  }
  await expect(
    effortCard.getByRole("heading", { name: "Recent Effort" }),
  ).toBeVisible();
});

test("edits, restores, saves, and reloads the desktop dashboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("tests/viewport/analyze.html?mode=dashboard&shell=1");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "Edit dashboard" }).click();
  await expect(page.getByRole("button", { name: "Add widgets" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Move or resize/ })).toHaveCount(5);

  const paceHandle = page.getByRole("button", {
    name: "Move or resize Recent pace",
  });
  await paceHandle.focus();
  await paceHandle.press("Space");
  await paceHandle.press("Shift+ArrowUp");
  await paceHandle.press("Shift+ArrowUp");
  await paceHandle.press("ArrowDown");
  await paceHandle.press("Space");

  const weeklyWidget = page.getByRole("group", {
    name: "Weekly distance widget",
  });
  const latestWidget = page.getByRole("group", { name: "Latest run widget" });
  const resizeHandle = weeklyWidget.locator(".react-resizable-handle-se");
  const [handleBounds, latestBounds] = await Promise.all([
    resizeHandle.boundingBox(),
    latestWidget.boundingBox(),
  ]);
  expect(handleBounds).not.toBeNull();
  expect(latestBounds).not.toBeNull();
  if (handleBounds && latestBounds) {
    await page.mouse.move(
      handleBounds.x + handleBounds.width / 2,
      handleBounds.y + handleBounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      latestBounds.x + latestBounds.width / 2,
      latestBounds.y + latestBounds.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
  }

  const [weeklyAfterResize, latestAfterResize] = await Promise.all([
    weeklyWidget.boundingBox(),
    latestWidget.boundingBox(),
  ]);
  expect(weeklyAfterResize).not.toBeNull();
  expect(latestAfterResize).not.toBeNull();
  if (weeklyAfterResize && latestAfterResize) {
    expect(boxesOverlap(weeklyAfterResize, latestAfterResize)).toBe(false);
  }

  const weeklyHandle = page.getByRole("button", {
    name: "Move or resize Weekly distance",
  });
  await weeklyHandle.focus();
  await weeklyHandle.press("Space");
  await weeklyHandle.press("ArrowRight");
  await weeklyHandle.press("Shift+ArrowUp");
  await weeklyHandle.press("Space");

  await page.getByRole("button", { name: "Hide Latest run" }).click();
  await expect(page.getByRole("group", { name: "Latest run widget" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add widgets" }).click();
  const drawer = page.getByRole("complementary", { name: "Add widgets" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("group", { name: "Latest run widget" })).toBeVisible();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit dashboard" })).toBeVisible();
  const saved = await page.evaluate(() =>
    window.localStorage.getItem(
      "marathoner.analyze-dashboard-layout.v1:viewport-runner",
    ),
  );
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved ?? "{}").widgets).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ i: "recent-pace", y: 7, h: 4 }),
    ]),
  );

  await page.reload();
  await expect(page.getByRole("group", { name: "Weekly distance widget" })).toBeVisible();
  await expect(page.locator(".analyze-widget")).toHaveCount(5);
});

test("keeps the desktop dashboard scrollable with 200% text", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("tests/viewport/analyze.html?mode=dashboard&shell=1");
  await page.addStyleTag({ content: ":root { font-size: 200%; }" });

  const frame = page.locator(".analyze-desktop-grid-frame");
  const weeklyWidget = page.getByRole("group", { name: "Weekly distance widget" });
  const latestWidget = page.getByRole("group", { name: "Latest run widget" });
  await expect(frame).toBeVisible();
  await expect
    .poll(() => frame.evaluate((element) => element.scrollHeight - element.clientHeight))
    .toBeGreaterThan(0);

  const [frameBounds, weeklyBounds, latestBounds] = await Promise.all([
    frame.boundingBox(),
    weeklyWidget.boundingBox(),
    latestWidget.boundingBox(),
  ]);
  if (frameBounds === null || weeklyBounds === null || latestBounds === null) {
    throw new Error("The desktop dashboard should have visible widget bounds.");
  }

  // Wheel over the gap so the dashboard itself receives the gesture.
  await page.mouse.move(
    (weeklyBounds.x + weeklyBounds.width + latestBounds.x) / 2,
    frameBounds.y + frameBounds.height / 2,
  );
  await page.mouse.wheel(0, 500);
  await expect.poll(() => frame.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  for (const name of ["Training summary", "Recent Pace", "Recent Effort"]) {
    const heading = page.getByRole("heading", { name, exact: true });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeInViewport();
  }
  await expectNoHorizontalOverflow(page, "Analyze", "with 200% desktop text");
});
