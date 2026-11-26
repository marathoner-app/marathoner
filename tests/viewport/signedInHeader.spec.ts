import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectMinimumTouchTarget } from "./layoutAssertions";

async function expectUncoveredControl(control: Locator, label: string) {
  await expectMinimumTouchTarget(control, label);
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const target = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        );
        return target !== null && element.contains(target);
      }),
    )
    .toBe(true);
}

async function expectShellControlsReachable(page: Page) {
  for (const name of ["Account settings", "Log out", "Home", "Plan", "Track", "Analyze"]) {
    await expectUncoveredControl(
      page.getByRole("button", { name, exact: true }),
      `${name} shell control`,
    );
  }
}

for (const width of [1024, 1280]) {
  for (const textScale of [100, 200]) {
    test(`keeps desktop editor controls reachable at ${width}px and ${textScale}% text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("tests/viewport/analyze.html?mode=dashboard&shell=1");
      await page.addStyleTag({ content: `html { font-size: ${textScale}%; }` });

      await expectUncoveredControl(
        page.getByRole("button", { name: "Edit dashboard" }),
        "Edit dashboard",
      );
      await page.getByRole("button", { name: "Edit dashboard" }).click();

      for (const name of ["Add widgets", "Reset", "Cancel", "Save"]) {
        await expectUncoveredControl(
          page.getByRole("button", { name, exact: true }),
          `${name} editor control`,
        );
      }
      await expectShellControlsReachable(page);

      const header = await page.locator(".session-controls").boundingBox();
      const toolbar = await page.getByRole("navigation", { name: "Dashboard editing" }).boundingBox();
      const navigation = await page.getByRole("navigation", { name: "Training sections" }).boundingBox();
      const panel = await page.getByRole("region", { name: "Analyze", exact: true }).boundingBox();
      expect(header).not.toBeNull();
      expect(toolbar).not.toBeNull();
      expect(navigation).not.toBeNull();
      expect(panel).not.toBeNull();
      if (!header || !toolbar || !navigation || !panel) return;

      if (textScale === 200) {
        expect(toolbar.y).toBeGreaterThanOrEqual(header.y + header.height - 0.5);
        expect(panel.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height - 0.5);
        expect(navigation.y + navigation.height).toBeCloseTo(900, 0);
        const dashboard = await page.locator(".analyze-container").boundingBox();
        expect(dashboard).not.toBeNull();
        if (dashboard) {
          expect(dashboard.y + dashboard.height).toBeLessThanOrEqual(navigation.y + 0.5);
        }
      } else {
        expect(navigation.y).toBeCloseTo(header.y, 0);
        expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(header.y + header.height);
      }

      await page.getByRole("button", { name: "Reset", exact: true }).click();
      await expect(page.getByRole("alertdialog", { name: "Reset this dashboard?" })).toBeVisible();
      await page.getByRole("button", { name: "Keep my layout" }).click();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("button", { name: "Edit dashboard" })).toBeVisible();
    });
  }
}

for (const width of [390, 1024, 1280]) {
  test(`anchors large-text navigation while Home scrolls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("tests/viewport/signedInHome.html");
    await page.addStyleTag({ content: "html { font-size: 200%; }" });
    await expectShellControlsReachable(page);

    const navigation = page.getByRole("navigation", { name: "Training sections" });
    const before = await navigation.boundingBox();
    expect(before).not.toBeNull();
    if (!before) return;
    expect(before.y + before.height).toBeCloseTo(900, 0);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const after = await navigation.boundingBox();
    const finalAction = page.getByRole("button", { name: "Final signed-in action" });
    const finalBounds = await finalAction.boundingBox();
    expect(after).not.toBeNull();
    expect(finalBounds).not.toBeNull();
    if (!after || !finalBounds) return;
    expect(after.y).toBeCloseTo(before.y, 0);
    expect(after.y + after.height).toBeCloseTo(900, 0);
    expect(finalBounds.y + finalBounds.height).toBeLessThanOrEqual(after.y + 0.5);
    await finalAction.click({ trial: true });
    await expectShellControlsReachable(page);
  });
}
