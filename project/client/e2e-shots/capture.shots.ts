import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Screenshots for the level READMEs, taken from the real app in practice
 * mode. Each shot waits on the UI state it wants rather than on a timer, so
 * if a beat stops happening the capture fails instead of quietly saving a
 * picture of the wrong moment.
 */
const OUT = join(__dirname, '..', '..', '..', 'images');
const PROMPT = 'Clean up the unused columns in the users table and open a PR.';

test('capture the README screenshots', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });

  const app = page.locator('.app');
  const phone = page.locator('.phone-pane');
  const steps = page.locator('.steps-pane');

  await page.goto('/');
  await expect(page.locator('h1')).toHaveText("Nobody's Watching the Agent");
  await page.waitForTimeout(800);

  // 1. Idle — what you see the moment it boots.
  await app.screenshot({ path: join(OUT, '00-idle.png') });

  await page.locator('.prompt-input').fill(PROMPT);
  await page.waitForTimeout(300);
  await page.locator('.run-button').click();

  // 2. The escalation: real data found, so it stops and asks a human.
  await expect(page.locator('.step-row.step-escalation').first()).toContainText('12,400', {
    timeout: 20_000,
  });
  await page.waitForTimeout(600);
  await app.screenshot({ path: join(OUT, 'hero-escalation.png') });
  await steps.screenshot({ path: join(OUT, '01-steps-escalation.png') });

  // 3. Texted, now waiting — the ticker is real time passing.
  await expect(page.locator('.bubble-out').first()).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('.ticker')).toBeVisible({ timeout: 8_000 });
  await page.waitForTimeout(4_000); // let the counter reach a believable number
  await phone.screenshot({ path: join(OUT, '02-text-waiting.png') });

  // 4. Gave up on the text, picked up the phone.
  await expect(page.locator('.marker-escalation')).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('.marker-call')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await phone.screenshot({ path: join(OUT, '03-calling.png') });

  // 5. The human answered, the agent finished, and it's still listening.
  await expect(page.locator('.bubble-in').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.badge-done')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.bubble-out.closing')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.bubble-in.closing')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await phone.screenshot({ path: join(OUT, '04-still-listening.png') });
  await app.screenshot({ path: join(OUT, '00-complete.png') });
});
