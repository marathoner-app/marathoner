import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./layoutAssertions";

test("keeps runner setup cards usable with 200% text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("tests/viewport/onboarding.html");
  await page.addStyleTag({
    content: ":root { font-size: 200% !important; }",
  });
  await page.getByLabel("I have a date").click();

  await expect
    .poll(() =>
      page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize),
    )
    .toBe("32px");
  await expect(
    page.getByRole("heading", { name: "Tell us where you are starting" }),
  ).toBeVisible();
  await expect(page.getByLabel("Marathon date")).toBeVisible();
  await expect(page.getByLabel("Date", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(
    page,
    "Runner setup",
    "with a marathon date selected at 200% text",
  );

  const questions = page.locator(".onboarding-question");
  for (let index = 0; index < (await questions.count()); index += 1) {
    const question = questions.nth(index);
    const overflow = await question.evaluate((element) => {
      const questionBounds = element.getBoundingClientRect();
      return Array.from(
        element.querySelectorAll<HTMLElement>(
          "legend, label, input, select, textarea, button",
        ),
      )
        .filter((child) => {
          const style = window.getComputedStyle(child);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const bounds = child.getBoundingClientRect();
          return (
            bounds.top < questionBounds.top - 0.5 ||
            bounds.left < questionBounds.left - 0.5 ||
            bounds.right > questionBounds.right + 0.5
          );
        })
        .map((child) => {
          const bounds = child.getBoundingClientRect();
          return `${child.tagName.toLowerCase()} (${Math.round(bounds.left)}..${Math.round(bounds.right)}) ${child.textContent?.trim() ?? child.getAttribute("id") ?? ""}`;
        });
    });

    expect(
      overflow,
      `Runner setup question ${index + 1} should contain its heading and controls`,
    ).toEqual([]);
  }
});
