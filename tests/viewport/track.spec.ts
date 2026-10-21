import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

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
  await expectNoHorizontalOverflow(page, "Track", "after adding a shoe");

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
  await expectNoHorizontalOverflow(page, "Track", "after logging a run");

  const edit = page.getByRole("button", { name: "Edit" });
  await edit.scrollIntoViewIfNeeded();
  await expect(edit).toBeInViewport();
  await edit.click();
  await expect(page.getByRole("form", { name: /Edit run from/ })).toBeVisible();
  await expectNoHorizontalOverflow(page, "Track", "while editing a run");
  await page.getByRole("button", { name: "Cancel" }).click();

  const deleteRun = page.getByRole("button", { name: /Delete run from/ });
  await deleteRun.scrollIntoViewIfNeeded();
  await expect(deleteRun).toBeInViewport();
  await deleteRun.click();
  await expect(
    page.getByRole("dialog", { name: "Delete this completed run?" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Track",
    "with the delete confirmation open",
  );
});
