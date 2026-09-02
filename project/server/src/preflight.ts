import './env.js';
import { getTwilioClient, WHATSAPP_NUMBER, PRESENTER_NUMBER } from './twilio/client.js';

/**
 * Run this the day before, the night before, and 30 minutes before the
 * demo. The WhatsApp Sandbox doesn't have SMS's silent A2P 10DLC
 * filtering problem, but it has its own gotcha: it only delivers to a
 * number that has texted "join <code>" to the sandbox number, and that
 * join expires after 72 hours of inactivity. This catches both -- a clear
 * error if you haven't joined, and real delivery confirmation if you have.
 */

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 30_000;
const GOOD_STATUSES = new Set(['delivered', 'sent']);
const BAD_STATUSES = new Set(['failed', 'undelivered']);
const SANDBOX_NOT_JOINED_ERROR_CODE = 63015;

async function main() {
  const sandbox = WHATSAPP_NUMBER();
  const to = PRESENTER_NUMBER();

  console.log(`[preflight] sending a test WhatsApp message via the sandbox (${sandbox})…`);
  const client = getTwilioClient();

  let message;
  try {
    message = await client.messages.create({
      to: `whatsapp:${to}`,
      from: `whatsapp:${sandbox}`,
      body: `Preflight check ${new Date().toISOString()} -- if this arrives, the sandbox is live.`,
    });
  } catch (err) {
    if (isTwilioError(err) && err.code === SANDBOX_NOT_JOINED_ERROR_CODE) {
      console.error(
        `[preflight] FAIL -- ${to} hasn't joined the WhatsApp Sandbox, or the join expired (it lasts 72 hours). ` +
          `From that phone, text "join <your-sandbox-code>" to ${sandbox}, then re-run this.`,
      );
      process.exit(1);
    }
    throw err;
  }

  console.log(`[preflight] sent, sid=${message.sid}, polling status…`);

  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const fetched = await client.messages(message.sid).fetch();
    console.log(`[preflight] status=${fetched.status}`);

    if (GOOD_STATUSES.has(fetched.status)) {
      console.log('[preflight] PASS -- message went through the sandbox.');
      process.exit(0);
    }
    if (BAD_STATUSES.has(fetched.status)) {
      console.error(`[preflight] FAIL -- status=${fetched.status}, errorCode=${fetched.errorCode ?? 'n/a'}`);
      process.exit(1);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  console.error('[preflight] FAIL -- timed out still pending. Check the Twilio Console for details.');
  process.exit(1);
}

function isTwilioError(err: unknown): err is { code: number } {
  return typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'number';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('[preflight] error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
