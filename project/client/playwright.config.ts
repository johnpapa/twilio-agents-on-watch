import { defineConfig, devices } from '@playwright/test';
import { findInstalledChromium } from './find-installed-chromium.js';

/**
 * Runs against MOCK=1 -- real DB work, deterministic timing, zero Twilio
 * or model spend. Same reason practice mode exists at all: fast, free, and
 * exercises the real SSE-driven UI, not a fake one.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4202',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // The pinned @playwright/test version's own bundled browser
          // revision may not match what's pre-installed in CI/dev images --
          // point at whichever chromium is actually on disk rather than
          // requiring a fresh `playwright install` download every time.
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_PATH ||
            findInstalledChromium() ||
            undefined,
        },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run practice',
      cwd: '../server',
      port: 4000,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npx ng serve --proxy-config proxy.conf.json --port 4202',
      cwd: '.',
      port: 4202,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
