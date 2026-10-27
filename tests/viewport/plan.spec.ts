import { expect, test, type Page } from "@playwright/test";
import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

const phoneViewport = { width: 390, height: 844 };

test.use({ viewport: phoneViewport });

async function exercisePlan(page: Page, textSizeLabel: string) {
  await expect(
    page.getByRole("heading", { name: "Week 1 of 3" }),
  ).toBeVisible();
  await expect(page.getByText("Base building")).toBeVisible();
  await expect(page.getByText("8.1 mi")).toBeVisible();
  await expect(page.getByText("1 of 2 workouts complete")).toBeVisible();

  const previousWeek = page.getByRole("button", { name: "Previous week" });
  const nextWeek = page.getByRole("button", { name: "Next week" });
  const weekSelector = page.getByRole("combobox", { name: "Training week" });
  await expectMinimumTouchTarget(previousWeek, `previous week at ${textSizeLabel}`);
  await expectMinimumTouchTarget(nextWeek, `next week at ${textSizeLabel}`);
  await expectMinimumTouchTarget(weekSelector, `week selector at ${textSizeLabel}`);

  const tempoWorkout = page.getByRole("button", {
    name: "Thu, Oct 29 Tempo run 5 mi · 45 min Scheduled",
  });
  await expect(tempoWorkout).toBeVisible();
  await expectMinimumTouchTarget(tempoWorkout, `tempo workout at ${textSizeLabel}`);
  await expectNoHorizontalOverflow(
    page,
    "Plan",
    `while viewing week one at ${textSizeLabel}`,
  );

  await tempoWorkout.click();
  const dialog = page.getByRole("dialog", { name: "Tempo run" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("5 mi", { exact: true })).toBeVisible();
  await expect(dialog.getByText("45 min", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(
      "Keep the opening miles controlled, then settle into a comfortably hard effort.",
    ),
  ).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close" });
  await expectMinimumTouchTarget(close, `workout close at ${textSizeLabel}`);
  await expectNoHorizontalOverflow(
    page,
    "Plan",
    `with workout details open at ${textSizeLabel}`,
  );
  await close.click();

  await nextWeek.click();
  await expect(
    page.getByRole("heading", { name: "Week 2 of 3" }),
  ).toBeVisible();
  await expect(page.getByText("Marathon training")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Sun, Nov 8 Long run 10 mi Scheduled",
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Plan",
    `after moving to week two at ${textSizeLabel}`,
  );
}

test("keeps Plan browsing usable at phone width", async ({ page }) => {
  await page.goto("tests/viewport/plan.html");

  await exercisePlan(page, "default text size");
});

test("keeps Plan browsing usable with 200% text", async ({ page }) => {
  await page.goto("tests/viewport/plan.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });

  await expect
    .poll(() =>
      page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize),
    )
    .toBe("32px");
  await expectNoHorizontalOverflow(
    page,
    "Plan",
    "before interaction at 200% text",
  );

  await exercisePlan(page, "200% text");
});
