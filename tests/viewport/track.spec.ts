import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport });

async function exerciseTrackWorkflow(page: Page, textSizeLabel: string) {
  const shoeName = page.getByPlaceholder("Shoe Name");
  const addShoe = page.getByRole("button", { name: "Add shoe" });
  await expect(shoeName).toBeVisible();
  await expect(addShoe).toBeVisible();
  await shoeName.fill("Daily Trainer");
  await addShoe.click();
  await expect(page.getByText("Total: 0 mi")).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Track",
    `after adding a shoe at ${textSizeLabel}`,
  );

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
  await expectNoHorizontalOverflow(
    page,
    "Track",
    `after logging a run at ${textSizeLabel}`,
  );

  const edit = page.getByRole("button", { name: "Edit" });
  await edit.scrollIntoViewIfNeeded();
  await expect(edit).toBeInViewport();
  await edit.click();
  await expect(page.getByRole("form", { name: /Edit run from/ })).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Track",
    `while editing a run at ${textSizeLabel}`,
  );
  await page.getByRole("button", { name: "Cancel" }).click();

  const deleteRun = page.getByRole("button", { name: /Delete run from/ });
  await deleteRun.scrollIntoViewIfNeeded();
  await expect(deleteRun).toBeInViewport();
  await deleteRun.click();
  await expect(
    page.getByRole("dialog", { name: "Delete this completed run?" }),
  ).toBeVisible();
  const cancelDeletion = page.getByRole("button", { name: "Cancel" });
  const confirmDeletion = page.getByRole("button", {
    name: "Delete run",
    exact: true,
  });
  await cancelDeletion.scrollIntoViewIfNeeded();
  await expect(cancelDeletion).toBeInViewport();
  await confirmDeletion.scrollIntoViewIfNeeded();
  await expect(confirmDeletion).toBeInViewport();
  await expectNoHorizontalOverflow(
    page,
    "Track",
    `with the delete confirmation open at ${textSizeLabel}`,
  );
}

test("keeps the complete Track workflow usable at phone width", async ({ page }) => {
  await page.goto("tests/viewport/track.html");

  await exerciseTrackWorkflow(page, "default text size");
});

test("keeps the complete Track workflow usable with 200% text", async ({
  page,
}) => {
  await page.goto("tests/viewport/track.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });

  await expect
    .poll(() =>
      page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize),
    )
    .toBe("32px");
  await expectNoHorizontalOverflow(page, "Track", "before interaction at 200% text");

  await exerciseTrackWorkflow(page, "200% text");
});
