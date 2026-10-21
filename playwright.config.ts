import { defineConfig } from "@playwright/test";

const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const applicationBasePath = "/";

export default defineConfig({
  testDir: "./tests/viewport",
  outputDir: "./test-results/viewport",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `${origin}${applicationBasePath}`,
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: `${origin}${applicationBasePath}tests/viewport/track.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
