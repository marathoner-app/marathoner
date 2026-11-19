import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./layoutAssertions";

const viewports = [
  { label: "phone", width: 390, height: 844 },
  { label: "desktop", width: 1200, height: 900 },
] as const;

async function readLayout(locator: Locator) {
  return locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return {
      width: bounds.width,
      maxWidth: style.maxWidth,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
    };
  });
}

async function readSurface(locator: Locator) {
  return locator.evaluate((element) => {
    const style = window.getComputedStyle(element);

    return {
      borderRadius: style.borderRadius,
      borderWidth: style.borderWidth,
      boxShadow: style.boxShadow,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
    };
  });
}

async function capturePlan(page: Page) {
  await page.goto("tests/viewport/plan.html");
  const layout = await readLayout(page.locator(".plan-container.training-page"));
  const surface = await readSurface(
    page.locator(".plan-header.training-primary-surface"),
  );
  await expectNoHorizontalOverflow(page, "Plan", "with the shared training layout");
  return { layout, surface };
}

async function captureTrack(page: Page) {
  await page.goto("tests/viewport/track.html");
  const layout = await readLayout(page.locator(".tracker.training-page"));
  const surface = await readSurface(
    page.locator(".entry.training-primary-surface"),
  );
  await expectNoHorizontalOverflow(page, "Track", "with the shared training layout");
  return { layout, surface };
}

for (const viewport of viewports) {
  test(`keeps Plan and Track on the same ${viewport.label} layout rhythm`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    const plan = await capturePlan(page);
    const track = await captureTrack(page);

    expect(track.layout).toEqual(plan.layout);
    expect(track.surface).toEqual(plan.surface);
  });
}
