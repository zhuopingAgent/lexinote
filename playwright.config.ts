import * as nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const runLiveAi = process.env.E2E_RUN_LIVE_AI === "1";
const e2ePort = process.env.E2E_PORT?.trim() || "3100";
const baseURL = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.mjs",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${e2ePort}`,
    env: {
      ...process.env,
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      AI_GATEWAY_API_KEY: runLiveAi
        ? process.env.AI_GATEWAY_API_KEY ?? ""
        : "",
      VERCEL_OIDC_TOKEN: runLiveAi
        ? process.env.VERCEL_OIDC_TOKEN ?? ""
        : "",
      PRACTICE_GENERATION_V2: "1",
      APP_BASIC_AUTH_PASSWORD: "",
      APP_TWO_FACTOR_TOTP_SECRET: "",
      APP_TWO_FACTOR_COOKIE_SECRET: "",
      APP_TWO_FACTOR_SETUP_TOKEN: "",
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  outputDir: "output/playwright/test-results",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
