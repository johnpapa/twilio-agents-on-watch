import { defineConfig, devices } from '@playwright/test';
import { findInstalledChromium } from './find-installed-chromium.js';

/**
 * Captures the screenshots used in the level READMEs.
 *
 * Kept separate from playwright.config.ts so CI keeps running the fast
 * assertion suite rather than a full screenshot pass. Run it whenever the UI
 * changes, so the pictures in the READMEs never drift from the app:
 *
 *   npx playwright test --config=playwright.shots.config.ts
 *
 * Images land in ../../images/ at the repo root.
 */
export default defineConfig({
  testDir: './e2e-shots',
  testMatch: '**/*.shots.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 240_000,
  outputDir: './.shots-tmp',
  use: {
    baseURL: 'http://localhost:4202',
    // A 2x scale factor keeps the UI text crisp when GitHub scales the
    // image down into a README column.
    viewport: { width: 1440, height: 860 },
    deviceScaleFactor: 2,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_PATH || findInstalledChromium() || undefined,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 860 },
        deviceScaleFactor: 2,
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
      port: 4202,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
