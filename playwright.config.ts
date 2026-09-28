import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end UI tests. The Claude API routes are mocked inside the tests
 * (see e2e/mocks.ts) so the suite is deterministic and free to run; the
 * app itself, the pipeline, and the browser store run for real.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.HELM_BASE_URL ?? "http://localhost:3000",
    // Tracing is opt-in (--trace on); recording it hung teardown under Rosetta.
    trace: "off",
    screenshot: "only-on-failure",
    viewport: { width: 1400, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: 'bash -lc "source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 22 >/dev/null 2>&1; npm run dev -- --port 3000"',
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
