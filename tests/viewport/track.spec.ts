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

async function expectEvenDurationSegments(
  segments: readonly [Locator, Locator, Locator],
  textSizeLabel: string,
) {
  const boxes = await Promise.all(segments.map((segment) => segment.boundingBox()));
  expect(boxes, `duration segments should be visible at ${textSizeLabel}`).not.toContain(
    null,
  );

  const [hours, minutes, seconds] = boxes as [
    NonNullable<(typeof boxes)[number]>,
    NonNullable<(typeof boxes)[number]>,
    NonNullable<(typeof boxes)[number]>,
  ];
  const widths = [hours.width, minutes.width, seconds.width];
  const gaps = [
    minutes.x - (hours.x + hours.width),
    seconds.x - (minutes.x + minutes.width),
  ];

  expect(
    Math.max(...widths) - Math.min(...widths),
    `duration segments should have equal widths at ${textSizeLabel}: ${widths.join(", ")}`,
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(gaps[0] - gaps[1]),
    `duration segments should have equal gaps at ${textSizeLabel}: ${gaps.join(", ")}`,
  ).toBeLessThanOrEqual(1);
}

async function expectTrackerCardsToContainControls(
  page: Page,
  textSizeLabel: string,
) {
  const cards = page.locator(".entry, .shoe-tracking");

  for (let index = 0; index < (await cards.count()); index += 1) {
    const card = cards.nth(index);
    const overflow = await card.evaluate((element) => {
      const cardBounds = element.getBoundingClientRect();
      return Array.from(
        element.querySelectorAll<HTMLElement>("h2, h3, input, select, textarea, button"),
      )
        .filter((child) => {
          const style = window.getComputedStyle(child);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const bounds = child.getBoundingClientRect();
          return (
            bounds.left < cardBounds.left - 0.5 ||
            bounds.right > cardBounds.right + 0.5
          );
        })
        .map((child) => {
          const bounds = child.getBoundingClientRect();
          return `${child.tagName.toLowerCase()} (${Math.round(bounds.left)}..${Math.round(bounds.right)}) ${child.textContent?.trim() ?? child.getAttribute("name") ?? ""}`;
        });
    });

    expect(
      overflow,
      `Track card ${index + 1} should contain its headings and controls at ${textSizeLabel}`,
    ).toEqual([]);
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
  await expectTrackerCardsToContainControls(page, textSizeLabel);

  const runDate = page.getByRole("textbox", { name: "Run date" });
  const runDistance = page.getByRole("spinbutton", { name: "Distance (miles)" });
  const runDuration = page.getByRole("group", { name: "Elapsed time" });
  const runDurationHours = runDuration.getByRole("spinbutton", {
    name: "Elapsed time hours",
  });
  const runDurationMinutes = runDuration.getByRole("spinbutton", {
    name: "Elapsed time minutes",
  });
  const runDurationSeconds = runDuration.getByRole("spinbutton", {
    name: "Elapsed time seconds",
  });
  await expectEvenDurationSegments(
    [runDurationHours, runDurationMinutes, runDurationSeconds],
    textSizeLabel,
  );
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
    { locator: runDurationHours, label: `run duration hours at ${textSizeLabel}` },
    {
      locator: runDurationMinutes,
      label: `run duration minutes at ${textSizeLabel}`,
    },
    {
      locator: runDurationSeconds,
      label: `run duration seconds at ${textSizeLabel}`,
    },
    { locator: runningShoes, label: `running shoes at ${textSizeLabel}` },
    { locator: plannedWorkout, label: `planned workout at ${textSizeLabel}` },
    { locator: perceivedEffort, label: `perceived effort at ${textSizeLabel}` },
    { locator: runNotes, label: `run notes at ${textSizeLabel}` },
    { locator: logRun, label: `log run at ${textSizeLabel}` },
  ]);

  await runDistance.fill("5");
  await runDurationMinutes.fill("45");
  await runDurationSeconds.fill("30");
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
      locator: editForm.getByRole("spinbutton", {
        name: "Edit distance (miles)",
      }),
      label: `edit miles at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("spinbutton", {
        name: "Edit elapsed time hours",
      }),
      label: `edit elapsed hours at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("spinbutton", {
        name: "Edit elapsed time minutes",
      }),
      label: `edit elapsed minutes at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("spinbutton", {
        name: "Edit elapsed time seconds",
      }),
      label: `edit elapsed seconds at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("combobox", { name: "Edit running shoes" }),
      label: `edit running shoes at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("combobox", {
        name: "Edit perceived effort (optional)",
      }),
      label: `edit perceived effort at ${textSizeLabel}`,
    },
    {
      locator: editForm.getByRole("textbox", {
        name: "Edit run notes (optional)",
      }),
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
  await expectTrackerCardsToContainControls(page, textSizeLabel);
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
