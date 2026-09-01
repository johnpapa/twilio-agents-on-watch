import { sendText, checkForReply, placeCall } from './fakeChannel.js';

const TEXT_WAIT_MS = 3000;
const CALL_WAIT_MS = 3000;
const POLL_INTERVAL_MS = 250;

/**
 * The escalation ladder: text first, wait, escalate to a call if ignored,
 * keep waiting, return whatever the human decided.
 *
 * Nothing here is Twilio-specific yet -- fakeChannel.js stands in for it
 * so you can focus entirely on the pattern.
 */
export async function askHuman(question) {
  const sentAt = Date.now();
  await sendText(question);

  let decision = await pollForReply(sentAt, TEXT_WAIT_MS);
  if (decision) return decision;

  await placeCall(question);

  // A fresh, independent budget for this second wait -- not what's left
  // over from the first one. Matches the real implementation in chapter 2+.
  decision = await pollForReply(sentAt, CALL_WAIT_MS);
  if (decision) return decision;

  throw new Error('No human response received after voice escalation.');
}

async function pollForReply(sentAt, timeoutMs) {
  const start = Date.now(); // this call's own budget -- independent of sentAt
  while (Date.now() - start < timeoutMs) {
    const decision = await checkForReply(sentAt); // still checks against the original send time
    if (decision) return decision;
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
