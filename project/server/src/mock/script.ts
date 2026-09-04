import { inspectAudience, sendNotice } from '../db.js';
import { publish } from '../sse.js';
import { setLastRunSummary } from '../agent/context.js';
import { buildEscalationQuestion } from '../agent/question.js';

const MOCK_PRESENTER_NUMBER = '+15550100100';
const IGNORE_WINDOW_SEC = 14; // long enough that the presenter has to actually let it ring

/**
 * Plays the exact same sequence as the real run, on a fixed schedule, with no
 * model key and no Twilio spend. The audience work is real -- checkAudience
 * and sendTheNotice hit the same SQLite database as `npm start`, and the
 * quiet-hours split is computed from the actual clock -- only the network
 * calls (the model and Twilio) are scripted.
 */
export async function runMockScript(runId: string, prompt: string): Promise<void> {
  publish(runId, { type: 'run-start', prompt, mock: true });
  await sleep(300);

  publish(runId, { type: 'tool-call', tool: 'checkAudience', args: {} });
  publish(runId, {
    type: 'step',
    tool: 'checkAudience',
    message: 'pulling the list of affected customers…',
  });
  await sleep(600);

  const slice = inspectAudience();
  publish(runId, {
    type: 'step',
    tool: 'checkAudience',
    message: `${slice.total.toLocaleString()} customers were affected`,
  });
  await sleep(500);

  publish(runId, {
    type: 'step',
    tool: 'checkAudience',
    message: 'checking what time it is where each of them lives…',
  });
  await sleep(700);

  publish(runId, {
    type: 'step',
    tool: 'checkAudience',
    message: `${slice.awake.toLocaleString()} are awake right now — fine to text`,
  });
  await sleep(400);

  publish(runId, {
    type: 'step',
    tool: 'checkAudience',
    message:
      `${slice.asleep.toLocaleString()} are between ${slice.quietWindow} where they live — ` +
      `that's a judgement call, asking a human`,
    severity: 'irreversible',
  });
  await sleep(300);
  publish(runId, { type: 'tool-result', tool: 'checkAudience', result: slice });

  const question = buildEscalationQuestion(slice);

  publish(runId, { type: 'tool-call', tool: 'askHuman', args: { question } });

  // Mirror the real askHuman body exactly -- the PRACTICE MODE badge already
  // says this isn't live, and a "(mock)" suffix here would be the one bit of
  // on-screen text that differs from a real run.
  publish(runId, {
    type: 'message-sent',
    to: MOCK_PRESENTER_NUMBER,
    body: `${question} Reply "hold them", "send all", or "cancel".`,
    kind: 'question',
  });

  for (let sec = 0; sec <= IGNORE_WINDOW_SEC; sec++) {
    publish(runId, { type: 'waiting', elapsedSec: sec });
    await sleep(1000);
  }

  publish(runId, { type: 'escalating', message: 'no answer — escalating to voice' });
  await sleep(600);
  publish(runId, { type: 'calling', to: MOCK_PRESENTER_NUMBER });
  await sleep(3200);

  const decision = 'hold them';
  publish(runId, { type: 'reply', text: decision, via: 'whatsapp-after-call' });
  publish(runId, { type: 'tool-result', tool: 'askHuman', result: { decision } });
  await sleep(500);

  publish(runId, { type: 'tool-call', tool: 'sendTheNotice', args: { decision } });
  await sleep(400);
  publish(runId, {
    type: 'step',
    tool: 'sendTheNotice',
    message: `sending to the ${slice.awake.toLocaleString()} people who are awake…`,
  });
  await sleep(700);
  publish(runId, {
    type: 'step',
    tool: 'sendTheNotice',
    message: `holding ${slice.asleep.toLocaleString()} until 8am their time`,
  });
  await sleep(500);

  const result = sendNotice(true, 'human-on-the-phone');

  publish(runId, {
    type: 'applied',
    sentNow: result.sentNow,
    scheduled: result.scheduled,
    held: true,
    canceled: false,
  });

  setLastRunSummary({
    prompt,
    decision,
    total: slice.total,
    sentNow: result.sentNow,
    scheduled: result.scheduled,
    quietWindow: slice.quietWindow,
    heldUntilMorning: true,
    canceled: false,
  });

  // Mirror the real confirmation text -- same reasoning as the outbound
  // question above: practice mode should look byte-for-byte like a real run.
  const confirmBody = `Done — sent to the ${result.sentNow.toLocaleString()} who are awake now, holding ${result.scheduled.toLocaleString()} until 8am their time.`;
  publish(runId, { type: 'message-sent', to: MOCK_PRESENTER_NUMBER, body: confirmBody, kind: 'confirmation' });
  await sleep(400);

  publish(runId, {
    type: 'done',
    text: `Sent to ${result.sentNow.toLocaleString()} now, holding ${result.scheduled.toLocaleString()} until morning.`,
  });

  await sleep(2500);
  const closingQuestion = 'why did you hold them instead of just sending?';
  const closingAnswer =
    `${result.scheduled.toLocaleString()} of them are between ${slice.quietWindow} local right now. ` +
    `The outage is already over, so waking them at 3am would cost us more goodwill than the ` +
    `notice is worth. They'll get it at 8am their time.`;
  publish(runId, { type: 'closing-question', from: MOCK_PRESENTER_NUMBER, text: closingQuestion, mock: true });
  await sleep(1200);
  publish(runId, { type: 'closing-answer', to: MOCK_PRESENTER_NUMBER, text: closingAnswer, mock: true });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
