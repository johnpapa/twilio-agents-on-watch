import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Finds whatever chromium build is actually on disk under
 * PLAYWRIGHT_BROWSERS_PATH, regardless of the exact revision this
 * @playwright/test version expects -- avoids requiring a fresh
 * `playwright install` download in an environment that already has one.
 * Shared by every Playwright config here so the lookup logic only exists once.
 */
export function findInstalledChromium(): string | undefined {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;

  const revisionDir = readdirSync(root).find(
    (name) => name.startsWith('chromium-') && !name.includes('headless_shell'),
  );
  if (!revisionDir) return undefined;

  const binary = join(root, revisionDir, 'chrome-linux', 'chrome');
  return existsSync(binary) ? binary : undefined;
}
