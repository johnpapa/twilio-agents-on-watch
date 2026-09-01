import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Finds whatever chromium build is actually on disk under
 * PLAYWRIGHT_BROWSERS_PATH, regardless of the exact revision this
 * @playwright/test version expects -- avoids requiring a fresh
 * `playwright install` download in an environment that already has one.
 */
function findInstalledChromium(): string | undefined {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;

  const revisionDir = readdirSync(root).find(
    (name) => name.startsWith('chromium-') && !name.includes('headless_shell'),
  );
  if (!revisionDir) return undefined;

  const binary = join(root, revisionDir, 'chrome-linux', 'chrome');
  return existsSync(binary) ? binary : undefined;
}

/**
 * Runs against MOCK=1 -- real DB work, deterministic timing, zero Twilio
 * or model spend. Same reason mock mode exists at all: fast, free, and
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
      command: 'npm run mock',
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
