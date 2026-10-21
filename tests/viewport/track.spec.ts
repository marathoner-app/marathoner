import { expect, test, type Page } from "@playwright/test";

const phoneViewport = { width: 390, height: 844 };

async function expectNoHorizontalOverflow(page: Page, stage: string) {
  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
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
    `Track overflowed horizontally ${stage} at ${layout.viewportWidth}px: document width was ${layout.documentScrollWidth}px.${details}`,
  ).toBe(true);
}

test.use({ viewport: phoneViewport });

test("keeps the complete Track workflow usable at phone width", async ({ page }) => {
  await page.goto("tests/viewport/track.html");

  const shoeName = page.getByPlaceholder("Shoe Name");
  const addShoe = page.getByRole("button", { name: "Add shoe" });
  await expect(shoeName).toBeVisible();
  await expect(addShoe).toBeVisible();
  await shoeName.fill("Daily Trainer");
  await addShoe.click();
  await expect(page.getByText("Total: 0 mi")).toBeVisible();
  await expectNoHorizontalOverflow(page, "after adding a shoe");

  await page.getByPlaceholder("Miles").fill("5");
  await page.getByPlaceholder("Time (e.g. 45:30)").fill("45:30");
  await page.getByRole("combobox", { name: "Running shoes" }).selectOption({
    label: "Daily Trainer (0 mi)",
  });
  const logRun = page.getByRole("button", { name: "Log Run" });
  await expect(logRun).toBeVisible();
  await logRun.click();

  const runSummary = page.getByText(/5 mi in 45:30 wearing Daily Trainer/);
  await expect(runSummary).toBeVisible();
  await expectNoHorizontalOverflow(page, "after logging a run");

  const edit = page.getByRole("button", { name: "Edit" });
  await edit.scrollIntoViewIfNeeded();
  await expect(edit).toBeInViewport();
  await edit.click();
  await expect(page.getByRole("form", { name: /Edit run from/ })).toBeVisible();
  await expectNoHorizontalOverflow(page, "while editing a run");
  await page.getByRole("button", { name: "Cancel" }).click();

  const deleteRun = page.getByRole("button", { name: /Delete run from/ });
  await deleteRun.scrollIntoViewIfNeeded();
  await expect(deleteRun).toBeInViewport();
  await deleteRun.click();
  await expect(
    page.getByRole("dialog", { name: "Delete this completed run?" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, "with the delete confirmation open");
});
