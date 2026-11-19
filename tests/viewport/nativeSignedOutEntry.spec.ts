import { expect, test } from "@playwright/test";
import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from "./layoutAssertions";

const phoneViewports = [
  { name: "compact phone", width: 320, height: 568 },
  { name: "current iPhone", width: 390, height: 844 },
] as const;

for (const viewport of phoneViewports) {
  test(`fits the installed signed-out gateway on a ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("tests/viewport/nativeSignedOutEntry.html");

    const entry = page.getByTestId("native-signed-out-entry");
    const login = page.getByRole("button", { name: "Log in" });
    const reset = page.getByRole("button", { name: "Reset password" });
    const support = page.getByRole("link", { name: "Contact support" });

    await expect(entry).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Training for a marathon is enough work.",
      }),
    ).toBeVisible();
    await expect(login).toBeInViewport();
    await expect(reset).toBeInViewport();
    await expect(support).toBeInViewport();
    await expectMinimumTouchTarget(login, "native login button");
    await expectMinimumTouchTarget(reset, "native password-reset button");
    await expectMinimumTouchTarget(support, "native support link");
    await expectNoHorizontalOverflow(
      page,
      "Native signed-out entry",
      `at ${viewport.width}x${viewport.height}`,
    );

    const dimensions = await page.evaluate(() => ({
      viewportHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(
      dimensions.scrollHeight,
      "the normal-size native gateway should remain a single screen",
    ).toBeLessThanOrEqual(dimensions.viewportHeight);
  });
}

test("respects iPhone safe areas and keeps the login dialog inside them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("tests/viewport/nativeSignedOutEntry.html");
  await page.addStyleTag({
    content: `
      .native-entry-shell {
        --native-entry-safe-top: 47px;
        --native-entry-safe-right: 0px;
        --native-entry-safe-bottom: 34px;
        --native-entry-safe-left: 0px;
      }
    `,
  });

  const entry = page.getByTestId("native-signed-out-entry");
  await expect(entry).toHaveCSS("padding-top", "59.8px");
  await expect(entry).toHaveCSS("padding-bottom", "47.6px");

  await page.getByRole("button", { name: "Reset password" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset your password" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();

  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds) {
    expect(bounds.y).toBeGreaterThanOrEqual(59);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(798);
  }
  await expectNoHorizontalOverflow(
    page,
    "Native signed-out entry",
    "with safe areas and password recovery open",
  );
});

test("keeps every action reachable with large Dynamic Type", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("tests/viewport/nativeSignedOutEntry.html");
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });

  const entry = page.getByTestId("native-signed-out-entry");
  const support = page.getByRole("link", { name: "Contact support" });
  await support.scrollIntoViewIfNeeded();
  await expect(support).toBeVisible();
  await expect(support).toBeInViewport();
  await expectMinimumTouchTarget(
    page.getByRole("button", { name: "Log in" }),
    "large-text login button",
  );
  await expectNoHorizontalOverflow(
    page,
    "Native signed-out entry",
    "at 200% text",
  );
  await expect(entry).toContainText("Private founding beta");
});

test("uses the static visual when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("tests/viewport/nativeSignedOutEntry.html");

  await expect(page.getByTestId("native-entry-poster")).toBeVisible();
  await expect(page.getByTestId("native-entry-video")).toHaveCount(0);
});
