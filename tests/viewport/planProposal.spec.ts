import { expect, test, type Page } from "@playwright/test";
import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

test.use({ viewport: { width: 390, height: 844 } });

async function exerciseProposal(page: Page, textSizeLabel: string) {
  await expect(
    page.getByRole("heading", { name: "Choose where training begins" }),
  ).toBeVisible();
  const start = page.getByRole("radio", {
    name: /December 10, 2029 22 weeks to race day/i,
  });
  const noSymptoms = page.getByRole("radio", { name: "No" });
  const create = page.getByRole("button", { name: "Create plan proposal" });
  await expectMinimumTouchTarget(create, `create proposal at ${textSizeLabel}`);
  await expectNoHorizontalOverflow(page, "Plan proposal", textSizeLabel);

  await start.click();
  await noSymptoms.click();
  await create.click();

  await expect(
    page.getByRole("heading", { name: "Founding beta completion plan" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Generated plan proposal",
    textSizeLabel,
  );
}

test("keeps plan creation usable at phone width", async ({ page }) => {
  await page.goto("tests/viewport/planProposal.html");
  await exerciseProposal(page, "default text size");
});

test("keeps plan creation usable with 200% text", async ({ page }) => {
  await page.goto("tests/viewport/planProposal.html");
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });
  await exerciseProposal(page, "200% text");
});
