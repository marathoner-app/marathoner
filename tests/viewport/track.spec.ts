import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport });

async function expectMinimumTouchTargets(
  targets: ReadonlyArray<{ locator: Locator; label: string }>,
) {
  for (const target of targets) {
    await expectMinimumTouchTarget(target.locator, target.label);
  }
}

async function exerciseTrackWorkflow(page: Page, textSizeLabel: string) {
  const shoeName = page.getByPlaceholder("Shoe Name");
  const startingDistance = page.getByLabel(/Distance already on this shoe/);
  const addShoe = page.getByRole("button", { name: "Add shoe" });
  await expect(shoeName).toBeVisible();
  await expect(addShoe).toBeVisible();
  await expectMinimumTouchTargets([
    { locator: shoeName, label: `shoe name at ${textSizeLabel}` },
    {
      locator: startingDistance,
      label: `shoe starting distance at ${textSizeLabel}`,
    },
    { locator: addShoe, label: `add shoe at ${textSizeLabel}` },
  ]);
  await shoeName.fill("Daily Trainer");
  await addShoe.click();
  await expect(page.getByText("Total: 0 mi")).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Track",
    `after adding a shoe at ${textSizeLabel}`,
  );

  const runDate = page.getByRole("textbox", { name: "Run date" });
  const runDistance = page.getByRole("spinbutton", { name: "Distance (miles)" });
  const runDuration = page.getByRole("textbox", { name: "Elapsed time" });
  const runningShoes = page.getByRole("combobox", { name: "Running shoes" });
  const plannedWorkout = page.getByRole("combobox", { name: "Planned workout" });
  const perceivedEffort = page.getByRole("combobox", {
    name: "Perceived effort (optional)",
  });
  const runNotes = page.getByRole("textbox", { name: "Run notes (optional)" });
  const logRun = page.getByRole("button", { name: "Log Run" });
  await expectMinimumTouchTargets([
    { locator: runDate, label: `run date at ${textSizeLabel}` },
    { locator: runDistance, label: `run distance at ${textSizeLabel}` },
    { locator: runDuration, label: `run duration at ${textSizeLabel}` },
    { locator: runningShoes, label: `running shoes at ${textSizeLabel}` },
    { locator: plannedWorkout, label: `planned workout at ${textSizeLabel}` },
    { locator: perceivedEffort, label: `perceived effort at ${textSizeLabel}` },
    { locator: runNotes, label: `run notes at ${textSizeLabel}` },
    { locator: logRun, label: `log run at ${textSizeLabel}` },
  ]);

  await runDistance.fill("5");
  await runDuration.fill("45:30");
  await runningShoes.selectOption({
    label: "Daily Trainer (0 mi)",
  });
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
  const deleteRun = page.getByRole("button", { name: /Delete run from/ });
  await expectMinimumTouchTargets([
    { locator: edit, label: `edit run at ${textSizeLabel}` },
    { locator: deleteRun, label: `delete run at ${textSizeLabel}` },
  ]);
  await edit.scrollIntoViewIfNeeded();
  await expect(edit).toBeInViewport();
  await edit.click();
  const editForm = page.getByRole("form", { name: /Edit run from/ });
  await expect(editForm).toBeVisible();
  await expectMinimumTouchTargets([
    {
      locator: editForm.getByRole("textbox", { name: "Edit run date" }),
      label: `edit run date at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("spinbutton", { name: "Edit miles" }),
      label: `edit miles at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("textbox", { name: "Edit elapsed time" }),
      label: `edit elapsed time at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("combobox", { name: "Edit running shoes" }),
      label: `edit running shoes at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("combobox", { name: "Edit perceived effort" }),
      label: `edit perceived effort at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("textbox", { name: "Edit run notes" }),
      label: `edit run notes at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("button", { name: "Save" }),
      label: `save edited run at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("button", { name: "Cancel" }),
      label: `cancel run editing at ${textSizeLabel}`,
    },
  ]);
  await expectNoHorizontalOverflow(
    page,
    "Track",
    `while editing a run at ${textSizeLabel}`,
  );
  await page.getByRole("button", { name: "Cancel" }).click();

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
  await expectMinimumTouchTargets([
    { locator: cancelDeletion, label: `cancel deletion at ${textSizeLabel}` },
    { locator: confirmDeletion, label: `confirm deletion at ${textSizeLabel}` },
  ]);
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
