import { expect, type Locator, type Page } from "@playwright/test";

export async function expectMinimumTouchTarget(locator: Locator, label: string) {
  const bounds = await locator.boundingBox();
  expect(bounds, `${label} should have visible bounds`).not.toBeNull();

  if (!bounds) return;

  expect(bounds.width, `${label} should be at least 44px wide`).toBeGreaterThanOrEqual(
    44,
  );
  expect(
    bounds.height,
    `${label} should be at least 44px tall`,
  ).toBeGreaterThanOrEqual(44);
}

export async function expectNoHorizontalOverflow(
  page: Page,
  surface: string,
  stage: string,
) {
  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const closedDetails = element.closest("details:not([open])");
        if (closedDetails !== null && element.tagName !== "SUMMARY") return false;
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && (bounds.left < -0.5 || bounds.right > viewportWidth + 0.5);
      })
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        const name =
          element.getAttribute("aria-label") ??
          element.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) ??
          "";
        return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
          element.className ? `.${String(element.className).trim().replace(/\s+/g, ".")}` : ""
        } (${Math.round(bounds.left)}..${Math.round(bounds.right)}) ${name}`.trim();
      });

    return {
      viewportWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      offenders,
    };
  });

  const details = layout.offenders.length
    ? ` Elements outside the viewport: ${layout.offenders.join(" | ")}`
    : "";
  expect(
    layout.documentScrollWidth <= layout.viewportWidth && layout.offenders.length === 0,
    `${surface} overflowed horizontally ${stage} at ${layout.viewportWidth}px: document width was ${layout.documentScrollWidth}px.${details}`,
  ).toBe(true);
}
