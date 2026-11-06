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
    { name: "browser", testMatch: "**/browser.spec.ts" },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5273",
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command: "npm run preview",
      url: "http://127.0.0.1:4273",
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
});
