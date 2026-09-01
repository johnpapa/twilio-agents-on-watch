import { test, expect } from '@playwright/test';

/**
 * Exercises the real SSE-driven UI end to end against MOCK=1 -- the exact
 * flow a presenter or a learner sees, not a mocked-out version of it.
 * This is the thing most likely to silently break: unit tests only check
 * that the component mounts, not that a live run actually updates the DOM.
 */

test('idle state loads correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText("Nobody's Watching the Agent");
  await expect(page.locator('.run-button')).toBeEnabled();
  await expect(page.locator('.run-button')).toHaveText('Run');
  await expect(page.locator('.badge-mock')).toBeVisible();
});

test('a full mock run plays every beat of the escalation', async ({ page }) => {
  await page.goto('/');

  await page.locator('.run-button').click();
  await expect(page.locator('.run-button')).toHaveText('Running…');
  await expect(page.locator('.run-button')).toBeDisabled();

  // Right pane: the agent finds the irreversible column.
  await expect(page.locator('.step-row.step-escalation').first()).toContainText(
    '12,400',
    { timeout: 15_000 },
  );

  // Left pane: the outbound text, then the ticking wait.
  await expect(page.locator('.bubble-out').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.ticker')).toBeVisible({ timeout: 5_000 });

  // The escalation to voice -- this row has to look different from every
  // other row, so assert on the specific marker classes, not just text.
  await expect(page.locator('.marker-escalation')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.marker-call')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.ticker')).toHaveCount(0);

  // The human's reply comes back, the agent finishes and opens a PR banner
  // (or explicitly skips it in practice mode -- either way the run reaches done).
  await expect(page.locator('.bubble-in').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.badge-done')).toBeVisible({ timeout: 10_000 });

  // The closing beat: a fresh inbound question, answered live.
  await expect(page.locator('.bubble-out.closing')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.bubble-in.closing')).toBeVisible({ timeout: 5_000 });

  await expect(page.locator('.run-button')).toBeEnabled();
});
