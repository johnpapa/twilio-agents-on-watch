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
 *
 * Fill in the three TODOs below.
 */
export async function askHuman(question) {
  const sentAt = Date.now();
  await sendText(question);

  // TODO 1: Poll checkForReply(sentAt) every POLL_INTERVAL_MS. If it ever
  // returns a non-null decision, return that decision immediately. Keep
  // polling until TEXT_WAIT_MS has elapsed since `sentAt`.

  // TODO 2: No reply arrived in time. Escalate: call placeCall(question).

  // TODO 3: Poll again, the same way -- but give this one its own fresh
  // budget of CALL_WAIT_MS starting NOW, from the moment the call went out.
  // (Measuring from `sentAt` again would be a window that has already
  // expired, so the call would go out and nothing would ever be heard.)
  // If a decision arrives, return it. If time runs out again,
  // throw new Error('No human response received after voice escalation.')
}
