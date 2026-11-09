import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5273",
    headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  projects: [
    { name: "api", testMatch: "**/api.spec.ts" },
    {
      name: "browser",
      testMatch: "**/browser.spec.ts",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: "node scripts/preview-test.mjs",
      url: "http://127.0.0.1:4273",
      timeout: 120000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    },
    {
      command: "node scripts/fake-llm.mjs",
      url: "http://127.0.0.1:4274",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5273",
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        POCKET_WORKERS_AI: "off",
        POCKET_AI_PROVIDER: "openai-compatible",
        POCKET_AI_BASE_URL: "http://127.0.0.1:4274/v1",
        POCKET_AI_MODEL: "fake",
      },
    },
  ],
});
