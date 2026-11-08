import { defineConfig } from "@playwright/test";

const PORT = 5174;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Locally reuse the installed Chrome (no browser download); CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: { VITE_E2E: "1" },
  },
});
