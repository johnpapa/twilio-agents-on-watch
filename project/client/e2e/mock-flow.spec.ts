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

test('a full mock run plays every step of the escalation', async ({ page }) => {
  await page.goto('/');

  await page.locator('.run-button').click();
  await expect(page.locator('.run-button')).toHaveText('Running…');
  await expect(page.locator('.run-button')).toBeDisabled();

  // Right pane: the agent works out that some recipients are asleep, and
  // decides that is not its call. Asserting on the phrase rather than a count,
  // because the split is computed from the real clock.
  await expect(page.locator('.step.step-escalation').first()).toContainText(
    'judgement call',
    { timeout: 15_000 },
  );

  // Left pane: the outbound text, then the ticking wait.
  await expect(page.locator('.msg-agent .bubble').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.waiting')).toBeVisible({ timeout: 5_000 });

  // The escalation to voice -- this row has to look different from every
  // other row, so assert on the specific marker classes, not just text.
  await expect(page.locator('.sys-escalation')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.sys-call')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.waiting')).toHaveCount(0);

  // The human's reply comes back, the agent finishes and opens a PR banner
  // (or explicitly skips it in practice mode -- either way the run reaches done).
  await expect(page.locator('.msg-you .bubble').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.badge-done')).toBeVisible({ timeout: 10_000 });

  // The closing beat: a fresh inbound question, answered live.
  await expect(page.locator('.msg-you .bubble').nth(1)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.msg-agent .bubble').nth(1)).toBeVisible({ timeout: 5_000 });

  await expect(page.locator('.run-button')).toBeEnabled();
});
