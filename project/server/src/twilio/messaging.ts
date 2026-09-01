import { getTwilioClient, WHATSAPP_NUMBER } from './client.js';

export interface InboundMessage {
  sid: string;
  from: string; // plain E.164 -- the "whatsapp:" prefix is stripped before this leaves the module
  body: string;
  dateSent: Date;
}

const asWhatsApp = (e164: string) => (e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`);
const stripWhatsApp = (addr: string) => addr.replace(/^whatsapp:/, '');

/**
 * Texting runs over the Twilio WhatsApp Sandbox by default -- real
 * messages, no A2P 10DLC brand/campaign registration, no multi-day wait.
 * The tradeoff: only numbers that have texted "join <code>" to the sandbox
 * number can receive from it, and that join expires after 72 hours. See
 * the README for what changes if you move this to a registered SMS number
 * for production.
 */
export async function sendMessage(to: string, body: string): Promise<string> {
  const client = getTwilioClient();
  const message = await client.messages.create({
    to: asWhatsApp(to),
    from: asWhatsApp(WHATSAPP_NUMBER()),
    body,
  });
  return message.sid;
}

/**
 * Lists inbound messages to our WhatsApp Sandbox number sent after `since`.
 * `dateSentAfter` has one-second granularity on Twilio's side, so we back
 * `since` off by a second to avoid missing a message sent in the same tick
 * we started polling from.
 */
export async function listInboundSince(
  since: Date,
  opts: { from?: string; limit?: number } = {},
): Promise<InboundMessage[]> {
  const client = getTwilioClient();
  const dateSentAfter = new Date(since.getTime() - 1000);

  const messages = await client.messages.list({
    to: asWhatsApp(WHATSAPP_NUMBER()),
    dateSentAfter,
    limit: opts.limit ?? 50,
  });

  return messages
    .filter((m) => m.direction === 'inbound')
    .filter((m) => (opts.from ? stripWhatsApp(m.from) === opts.from : true))
    .filter((m) => m.dateSent && m.dateSent.getTime() > since.getTime() - 1000)
    .map((m) => ({
      sid: m.sid,
      from: stripWhatsApp(m.from),
      body: m.body,
      dateSent: m.dateSent as Date,
    }))
    .sort((a, b) => a.dateSent.getTime() - b.dateSent.getTime());
}

export interface PollOptions {
  from: string;
  since: Date;
  timeoutMs: number;
  intervalMs?: number;
  onTick?: (elapsedMs: number) => void;
  shouldStop?: () => boolean;
}

/**
 * Polls for a reply from a specific number until one arrives or the
 * timeout elapses. Returns null on timeout.
 */
export async function pollForReply(opts: PollOptions): Promise<InboundMessage | null> {
  const interval = opts.intervalMs ?? 2500;
  const start = Date.now();

  while (Date.now() - start < opts.timeoutMs) {
    if (opts.shouldStop?.()) return null;

    const messages = await listInboundSince(opts.since, { from: opts.from });
    if (messages.length > 0) return messages[0];

    opts.onTick?.(Date.now() - start);
    await sleep(interval);
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
